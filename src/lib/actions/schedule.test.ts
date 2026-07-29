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
    scheduledWorkout: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import {
  scheduleWorkoutToMany,
  updateScheduledWorkout,
  duplicateScheduledWorkout,
} from "./schedule";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findAthletesMock = prisma.teamMembership.findMany as unknown as ReturnType<typeof vi.fn>;
const transactionMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;
const findWorkoutMock = prisma.scheduledWorkout.findFirst as unknown as ReturnType<typeof vi.fn>;
const findAthleteMock = prisma.teamMembership.findFirst as unknown as ReturnType<typeof vi.fn>;
const createWorkoutMock = prisma.scheduledWorkout.create as unknown as ReturnType<typeof vi.fn>;
const findTemplateMock = prisma.workoutTemplate.findFirst as unknown as ReturnType<typeof vi.fn>;

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

describe("scheduleWorkoutToMany desde plantilla", () => {
  it("copia estructura y deporte de la plantilla como snapshot", async () => {
    findAthletesMock.mockResolvedValue([{ id: "a" }]);
    findTemplateMock.mockResolvedValue({
      id: "tpl_1",
      teamId: "team_1",
      structure: STRUCTURE,
      sport: "STRENGTH",
    });
    transactionMock.mockImplementation(async (ops: unknown[]) => ops.map(() => ({ id: "sw_1" })));

    await scheduleWorkoutToMany({
      athleteMembershipIds: ["a"],
      date: "2026-08-01",
      title: "Fuerza",
      templateId: "tpl_1",
    });

    // El snapshot es lo que hace que editar la plantilla después no reescriba
    // lo ya asignado.
    expect(createWorkoutMock.mock.calls[0][0].data.sport).toBe("STRENGTH");
    expect(createWorkoutMock.mock.calls[0][0].data.structure).toEqual(STRUCTURE);
  });

  it("rechaza una plantilla de otro club", async () => {
    findAthletesMock.mockResolvedValue([{ id: "a" }]);
    findTemplateMock.mockResolvedValue(null);

    await expect(
      scheduleWorkoutToMany({
        athleteMembershipIds: ["a"],
        date: "2026-08-01",
        title: "X",
        templateId: "de_otro_club",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("updateScheduledWorkout", () => {
  it("rechaza un entrenamiento de otro club", async () => {
    findWorkoutMock.mockResolvedValue(null);
    await expect(
      updateScheduledWorkout("ajeno", {
        date: "2026-08-01",
        title: "X",
        sport: "RUN",
        structure: STRUCTURE,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("acota la búsqueda al club, no solo al id", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", teamId: "team_1" });
    await updateScheduledWorkout("w1", {
      date: "2026-08-01",
      title: "X",
      sport: "RUN",
      structure: STRUCTURE,
    });
    expect(findWorkoutMock.mock.calls[0][0].where).toMatchObject({ teamId: "team_1" });
  });

  it("valida la estructura antes de escribir", async () => {
    findWorkoutMock.mockResolvedValue({ id: "w1", teamId: "team_1" });
    await expect(
      updateScheduledWorkout("w1", {
        date: "2026-08-01",
        title: "X",
        sport: "RUN",
        structure: { segments: [] },
      }),
    ).rejects.toThrow();
    expect(prisma.scheduledWorkout.update).not.toHaveBeenCalled();
  });
});

describe("duplicateScheduledWorkout", () => {
  beforeEach(() => {
    findWorkoutMock.mockResolvedValue({
      id: "w1",
      teamId: "team_1",
      athleteMembershipId: "a",
      title: "Fondo",
      sport: "RUN",
      structure: STRUCTURE,
      coachNote: null,
      templateId: null,
    });
    findAthleteMock.mockResolvedValue({ id: "a" });
    createWorkoutMock.mockResolvedValue({ id: "copia_1" });
  });

  it("rechaza duplicar un entrenamiento de otro club", async () => {
    findWorkoutMock.mockResolvedValue(null);
    await expect(duplicateScheduledWorkout("ajeno", { date: "2026-08-05" })).rejects.toThrow(
      ForbiddenError,
    );
  });

  // Regresión de la misma familia: la copia iba a parar a alguien dado de baja.
  it("solo copia hacia un socio ACTIVO", async () => {
    await duplicateScheduledWorkout("w1", { date: "2026-08-05" });
    expect(findAthleteMock.mock.calls[0][0].where).toMatchObject({
      teamId: "team_1",
      role: "ATHLETE",
      status: "ACTIVE",
    });
  });

  it("falla si el destino ya no es un socio activo", async () => {
    findAthleteMock.mockResolvedValue(null);
    await expect(
      duplicateScheduledWorkout("w1", { date: "2026-08-05", athleteMembershipId: "dado_de_baja" }),
    ).rejects.toThrow(ForbiddenError);
    expect(createWorkoutMock).not.toHaveBeenCalled();
  });

  it("sin atleta destino, duplica sobre el mismo socio", async () => {
    await duplicateScheduledWorkout("w1", { date: "2026-08-05" });
    expect(findAthleteMock.mock.calls[0][0].where.id).toBe("a");
  });

  it("la copia conserva deporte y estructura del original", async () => {
    await duplicateScheduledWorkout("w1", { date: "2026-08-05" });
    expect(createWorkoutMock.mock.calls[0][0].data).toMatchObject({
      sport: "RUN",
      title: "Fondo",
    });
  });
});
