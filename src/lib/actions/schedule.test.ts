import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMembership: { findMany: vi.fn(), findFirst: vi.fn() },
    workoutTemplate: { findFirst: vi.fn() },
    scheduledWorkout: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { scheduleWorkoutToMany } from "./schedule";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findAthletesMock = prisma.teamMembership.findMany as unknown as ReturnType<typeof vi.fn>;
const transactionMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

const STRUCTURE = { segments: [{ label: "Rodaje", repeat: 1, durationSeconds: 1800 }] };

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "coach_1", teamId: "team_1", userId: "user_1" });
  transactionMock.mockResolvedValue([{ id: "sw_1" }]);
});

describe("scheduleWorkoutToMany", () => {
  it("exige la capacidad de prescribir entrenamiento", async () => {
    findAthletesMock.mockResolvedValue([{ id: "a" }]);
    await scheduleWorkoutToMany({
      athleteMembershipIds: ["a"],
      date: "2026-08-01",
      title: "Fondo",
      structure: STRUCTURE,
    });
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_TRAINING");
  });

  it("rechaza asignar sin seleccionar a nadie", async () => {
    await expect(
      scheduleWorkoutToMany({
        athleteMembershipIds: [],
        date: "2026-08-01",
        title: "Fondo",
        structure: STRUCTURE,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // Regresión: la interfaz solo ofrece socios activos, pero la acción aceptaba
  // a cualquier atleta del club. Un chip de grupo desactualizado le programaba
  // entrenamientos a alguien que ya se había ido.
  it("solo acepta socios ACTIVOS, no cualquier atleta del club", async () => {
    findAthletesMock.mockResolvedValue([{ id: "a" }]);

    await scheduleWorkoutToMany({
      athleteMembershipIds: ["a"],
      date: "2026-08-01",
      title: "Fondo",
      structure: STRUCTURE,
    });

    expect(findAthletesMock.mock.calls[0][0].where).toMatchObject({
      teamId: "team_1",
      role: "ATHLETE",
      status: "ACTIVE",
    });
  });

  it("falla si alguno de los ids no resuelve a un socio activo del club", async () => {
    // Se piden dos, la base solo devuelve uno.
    findAthletesMock.mockResolvedValue([{ id: "a" }]);

    await expect(
      scheduleWorkoutToMany({
        athleteMembershipIds: ["a", "dado_de_baja"],
        date: "2026-08-01",
        title: "Fondo",
        structure: STRUCTURE,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("crea un entrenamiento independiente por atleta, en una sola transacción", async () => {
    findAthletesMock.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    transactionMock.mockResolvedValue([{ id: "sw_1" }, { id: "sw_2" }]);

    const result = await scheduleWorkoutToMany({
      athleteMembershipIds: ["a", "b"],
      date: "2026-08-01",
      title: "Fondo",
      structure: STRUCTURE,
    });

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);
    expect(result.ids).toEqual(["sw_1", "sw_2"]);
  });

  it("rechaza una estructura inválida antes de escribir nada", async () => {
    findAthletesMock.mockResolvedValue([{ id: "a" }]);

    await expect(
      scheduleWorkoutToMany({
        athleteMembershipIds: ["a"],
        date: "2026-08-01",
        title: "Fondo",
        // Sin segmentos: el contrato Zod lo rechaza.
        structure: { segments: [] },
      }),
    ).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
