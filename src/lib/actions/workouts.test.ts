import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scheduledWorkout: { findFirst: vi.fn(), update: vi.fn() },
    workoutCompletion: { create: vi.fn() },
    coachComment: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { markWorkoutCompleted, addCoachComment } from "./workouts";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findWorkoutMock = prisma.scheduledWorkout.findFirst as unknown as ReturnType<typeof vi.fn>;
const createCompletionMock = prisma.workoutCompletion.create as unknown as ReturnType<typeof vi.fn>;
const createCommentMock = prisma.coachComment.create as unknown as ReturnType<typeof vi.fn>;
const transactionMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "athlete_1", teamId: "team_1" });
  transactionMock.mockResolvedValue([]);
});

describe("markWorkoutCompleted", () => {
  it("exige la capacidad de registrar entrenamiento propio", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", status: "PLANNED" });
    await markWorkoutCompleted("w1", { rpe: 5 });
    expect(requireCapabilityMock).toHaveBeenCalledWith("LOG_OWN_TRAINING");
  });

  it("solo permite marcar el entrenamiento propio, no el de otro socio", async () => {
    findWorkoutMock.mockResolvedValue(null);
    await expect(markWorkoutCompleted("de_otro", {})).rejects.toThrow(ForbiddenError);

    // Acota por athleteMembershipId, no solo por el id del formulario.
    expect(findWorkoutMock.mock.calls[0][0].where).toMatchObject({
      id: "de_otro",
      athleteMembershipId: "athlete_1",
    });
  });

  // Regresión: no había NINGUNA validación de servidor. El RPE se multiplica
  // por la duración en la carga de entrenamiento, así que un valor absurdo
  // deforma la gráfica de todo el bloque, no solo esa fila.
  it("rechaza un RPE fuera de escala antes de escribir nada", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", status: "PLANNED" });

    await expect(markWorkoutCompleted("w1", { rpe: 100 })).rejects.toThrow(/RPE/);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("valida antes incluso de consultar el entrenamiento", async () => {
    await expect(markWorkoutCompleted("w1", { rpe: 99 })).rejects.toThrow(/RPE/);
    expect(findWorkoutMock).not.toHaveBeenCalled();
  });

  it("rechaza una distancia negativa, que restaría de los km del club", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", status: "PLANNED" });
    await expect(markWorkoutCompleted("w1", { distanceKm: -5 })).rejects.toThrow(/Distancia/);
  });

  // Regresión: WorkoutCompletion.scheduledWorkoutId es @unique, así que un
  // segundo envío reventaba con un error crudo de Prisma en la cara del socio.
  it("un segundo envío da un mensaje claro en vez de un error de Prisma", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", status: "COMPLETED" });

    await expect(markWorkoutCompleted("w1", { rpe: 5 })).rejects.toThrow(/ya estaba marcado/);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("guarda el feedback ya normalizado, no lo que llegó del formulario", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", status: "PLANNED" });

    await markWorkoutCompleted("w1", {
      rpe: 7,
      distanceKm: 10.456,
      athleteComment: "  con espacios  ",
    });

    expect(createCompletionMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduledWorkoutId: "w1",
        rpe: 7,
        distanceKm: 10.46,
        athleteComment: "con espacios",
      }),
    });
  });

  it("marcar sin feedback es válido", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", status: "PLANNED" });
    await expect(markWorkoutCompleted("w1", {})).resolves.toBeUndefined();
    expect(transactionMock).toHaveBeenCalledOnce();
  });
});

describe("addCoachComment", () => {
  it("exige la capacidad de prescribir entrenamiento", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", teamId: "team_1" });
    await addCoachComment("w1", "Buen trabajo");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_TRAINING");
  });

  it("acota el entrenamiento al club del coach", async () => {
    findWorkoutMock.mockResolvedValue(null);
    await expect(addCoachComment("de_otro_club", "hola")).rejects.toThrow(ForbiddenError);
    expect(findWorkoutMock.mock.calls[0][0].where).toMatchObject({ teamId: "team_1" });
  });

  it("rechaza un comentario vacío o de puros espacios", async () => {
    await expect(addCoachComment("w1", "   ")).rejects.toThrow(/vacío/);
    expect(findWorkoutMock).not.toHaveBeenCalled();
  });

  it("guarda el comentario recortado", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", teamId: "team_1" });
    await addCoachComment("w1", "  Muy bien el cierre  ");

    expect(createCommentMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ comment: "Muy bien el cierre" }),
    });
  });
});
