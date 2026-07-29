import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clubSession: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    trainingGroup: { findFirst: vi.fn() },
    teamMembership: { findFirst: vi.fn() },
    sessionAttendance: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import {
  createClubSession,
  updateClubSession,
  deleteClubSession,
  markAttendance,
  clearAttendance,
} from "./sessions";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findSessionMock = prisma.clubSession.findFirst as unknown as ReturnType<typeof vi.fn>;
const createSessionMock = prisma.clubSession.create as unknown as ReturnType<typeof vi.fn>;
const findGroupMock = prisma.trainingGroup.findFirst as unknown as ReturnType<typeof vi.fn>;
const findAthleteMock = prisma.teamMembership.findFirst as unknown as ReturnType<typeof vi.fn>;
const upsertAttendanceMock = prisma.sessionAttendance.upsert as unknown as ReturnType<typeof vi.fn>;

const VALID = { title: "Series", date: "2026-08-04", startTime: "07:00" };

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "coach_1", teamId: "team_1" });
  createSessionMock.mockResolvedValue({ id: "session_1" });
  findSessionMock.mockResolvedValue({ id: "session_1", teamId: "team_1" });
});

describe("createClubSession", () => {
  it("exige la capacidad de prescribir entrenamiento", async () => {
    await createClubSession(VALID);
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_TRAINING");
  });

  it("normaliza la hora a HH:mm antes de guardarla", async () => {
    // Se guarda como texto: sin normalizar, "7:00" y "07:00" ordenarían distinto.
    await createClubSession({ ...VALID, startTime: "7:00" });
    expect(createSessionMock.mock.calls[0][0].data.startTime).toBe("07:00");
  });

  it("rechaza una hora que no es HH:mm", async () => {
    await expect(createClubSession({ ...VALID, startTime: "7am" })).rejects.toThrow(/HH:mm/);
    await expect(createClubSession({ ...VALID, startTime: "25:00" })).rejects.toThrow(/HH:mm/);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("rechaza un título vacío", async () => {
    await expect(createClubSession({ ...VALID, title: "   " })).rejects.toThrow(/título/);
  });

  it("rechaza una fecha con formato inesperado", async () => {
    await expect(createClubSession({ ...VALID, date: "04/08/2026" })).rejects.toThrow(/Fecha/);
  });

  it("guarda la fecha como medianoche UTC, igual que el resto del calendario", async () => {
    await createClubSession(VALID);
    const saved: Date = createSessionMock.mock.calls[0][0].data.date;
    expect(saved.toISOString()).toBe("2026-08-04T00:00:00.000Z");
  });

  it("sin grupo, la sesión queda abierta a todo el club", async () => {
    await createClubSession(VALID);
    expect(createSessionMock.mock.calls[0][0].data.groupId).toBeNull();
    expect(findGroupMock).not.toHaveBeenCalled();
  });

  it("rechaza un grupo de otro club", async () => {
    findGroupMock.mockResolvedValue(null);
    await expect(createClubSession({ ...VALID, groupId: "grupo_ajeno" })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("deja a quien la crea como responsable", async () => {
    await createClubSession(VALID);
    expect(createSessionMock.mock.calls[0][0].data.coachMembershipId).toBe("coach_1");
  });
});

describe("updateClubSession y deleteClubSession", () => {
  it("rechazan una sesión de otro club aunque se adivine el id", async () => {
    findSessionMock.mockResolvedValue(null);
    await expect(updateClubSession("ajena", VALID)).rejects.toThrow(ForbiddenError);
    await expect(deleteClubSession("ajena")).rejects.toThrow(ForbiddenError);
  });

  it("editar valida la hora igual que crear", async () => {
    await expect(updateClubSession("session_1", { ...VALID, startTime: "99:99" })).rejects.toThrow(
      /HH:mm/,
    );
  });
});

describe("markAttendance", () => {
  it("exige la capacidad de prescribir entrenamiento", async () => {
    findAthleteMock.mockResolvedValue({ id: "a1" });
    await markAttendance("session_1", "a1", "PRESENT");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_TRAINING");
  });

  it("rechaza pasar lista en una sesión de otro club", async () => {
    findSessionMock.mockResolvedValue(null);
    await expect(markAttendance("ajena", "a1", "PRESENT")).rejects.toThrow(ForbiddenError);
  });

  // Regresión: antes aceptaba a cualquier atleta del club, activo o no.
  it("solo acepta socios ACTIVOS del club", async () => {
    findAthleteMock.mockResolvedValue({ id: "a1" });
    await markAttendance("session_1", "a1", "PRESENT");

    expect(findAthleteMock.mock.calls[0][0].where).toMatchObject({
      teamId: "team_1",
      role: "ATHLETE",
      status: "ACTIVE",
    });
  });

  it("falla si el socio no es un socio activo del club", async () => {
    findAthleteMock.mockResolvedValue(null);
    await expect(markAttendance("session_1", "dado_de_baja", "PRESENT")).rejects.toThrow(
      ForbiddenError,
    );
    expect(upsertAttendanceMock).not.toHaveBeenCalled();
  });

  it("volver a marcar a la misma persona actualiza en vez de duplicar", async () => {
    findAthleteMock.mockResolvedValue({ id: "a1" });
    await markAttendance("session_1", "a1", "ABSENT");

    const call = upsertAttendanceMock.mock.calls[0][0];
    expect(call.where).toEqual({ sessionId_membershipId: { sessionId: "session_1", membershipId: "a1" } });
    expect(call.update.status).toBe("ABSENT");
  });
});

describe("clearAttendance", () => {
  it("rechaza una sesión de otro club", async () => {
    findSessionMock.mockResolvedValue(null);
    await expect(clearAttendance("ajena", "a1")).rejects.toThrow(ForbiddenError);
  });

  it("borra solo la marca de esa persona en esa sesión", async () => {
    await clearAttendance("session_1", "a1");
    expect(prisma.sessionAttendance.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "session_1", membershipId: "a1" },
    });
  });
});
