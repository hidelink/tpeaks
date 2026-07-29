import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Acciones administrativas del club: plantillas, marca y ficha del socio.
 * Van juntas porque comparten el mismo andamio de mocks.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workoutTemplate: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    team: { update: vi.fn() },
    teamMembership: { findFirst: vi.fn() },
    athleteProfile: { upsert: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { createWorkoutTemplate, updateWorkoutTemplate, deleteWorkoutTemplate } from "./templates";
import { updateTeamBranding } from "./team";
import { updateAthleteRaceResult, updateAthletePrivateNote } from "./athlete-profile";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const createTemplateMock = prisma.workoutTemplate.create as unknown as ReturnType<typeof vi.fn>;
const findTemplateMock = prisma.workoutTemplate.findFirst as unknown as ReturnType<typeof vi.fn>;
const updateTeamMock = prisma.team.update as unknown as ReturnType<typeof vi.fn>;
const findMembershipMock = prisma.teamMembership.findFirst as unknown as ReturnType<typeof vi.fn>;
const upsertProfileMock = prisma.athleteProfile.upsert as unknown as ReturnType<typeof vi.fn>;

const STRUCTURE = { segments: [{ label: "Rodaje", repeat: 1, durationSeconds: 1800 }] };
const TEMPLATE = { title: "Series", sport: "RUN" as const, tags: [], structure: STRUCTURE };

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "coach_1", teamId: "team_1", userId: "user_1" });
  createTemplateMock.mockResolvedValue({ id: "tpl_1" });
  findTemplateMock.mockResolvedValue({ id: "tpl_1", teamId: "team_1" });
});

describe("plantillas", () => {
  it("crear y editar exigen la capacidad de prescribir entrenamiento", async () => {
    await createWorkoutTemplate(TEMPLATE);
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_TRAINING");
  });

  it("editar y borrar rechazan una plantilla de otro club", async () => {
    findTemplateMock.mockResolvedValue(null);
    await expect(updateWorkoutTemplate("ajena", TEMPLATE)).rejects.toThrow(ForbiddenError);
    await expect(deleteWorkoutTemplate("ajena")).rejects.toThrow(ForbiddenError);
  });

  // El formulario marca el título como required, pero la acción es un endpoint
  // público: lo que valide el cliente no cuenta.
  it("rechazan un título vacío aunque el formulario lo exija", async () => {
    await expect(createWorkoutTemplate({ ...TEMPLATE, title: "   " })).rejects.toThrow(/título/);
    expect(createTemplateMock).not.toHaveBeenCalled();
  });

  it("recortan el título y la descripción", async () => {
    await createWorkoutTemplate({ ...TEMPLATE, title: "  Series  ", description: "  hola  " });
    expect(createTemplateMock.mock.calls[0][0].data).toMatchObject({
      title: "Series",
      description: "hola",
    });
  });

  it("rechazan una estructura sin segmentos", async () => {
    await expect(
      createWorkoutTemplate({ ...TEMPLATE, structure: { segments: [] } }),
    ).rejects.toThrow();
  });

  it("la plantilla se crea siempre en el club de quien la crea", async () => {
    await createWorkoutTemplate(TEMPLATE);
    expect(createTemplateMock.mock.calls[0][0].data.teamId).toBe("team_1");
  });
});

describe("marca del club", () => {
  it("exige la capacidad de ajustes, no la de entrenamiento", async () => {
    await updateTeamBranding({ logoUrl: "", primaryColor: "#1d4ed8" });
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_CLUB");
  });

  // El color pinta TODOS los botones principales vía la variable CSS
  // --team-accent: un valor inválido deja la plataforma entera sin estilo.
  it("rechaza un color que no es hexadecimal", async () => {
    await expect(updateTeamBranding({ logoUrl: "", primaryColor: "rojo" })).rejects.toThrow(/hexadecimal/);
    await expect(updateTeamBranding({ logoUrl: "", primaryColor: "#fff" })).rejects.toThrow(/hexadecimal/);
    expect(updateTeamMock).not.toHaveBeenCalled();
  });

  it("acepta hexadecimal en mayúsculas o minúsculas", async () => {
    await expect(updateTeamBranding({ logoUrl: "", primaryColor: "#AABBCC" })).resolves.toBeUndefined();
    await expect(updateTeamBranding({ logoUrl: "", primaryColor: "#aabbcc" })).resolves.toBeUndefined();
  });

  it("rechaza un logo por http, que se rompería por contenido mixto", async () => {
    await expect(
      updateTeamBranding({ logoUrl: "http://ejemplo.com/logo.png", primaryColor: "" }),
    ).rejects.toThrow(/https/);
  });

  it("vaciar los dos campos los deja en null, no en cadena vacía", async () => {
    await updateTeamBranding({ logoUrl: "", primaryColor: "" });
    expect(updateTeamMock.mock.calls[0][0].data).toEqual({ logoUrl: null, primaryColor: null });
  });

  it("solo puede tocar su propio club", async () => {
    await updateTeamBranding({ logoUrl: "", primaryColor: "#1d4ed8" });
    expect(updateTeamMock.mock.calls[0][0].where).toEqual({ id: "team_1" });
  });
});

describe("ficha del socio", () => {
  beforeEach(() => {
    findMembershipMock.mockResolvedValue({ id: "athlete_1", teamId: "team_1" });
  });

  it("rechaza tocar la ficha de un socio de otro club", async () => {
    findMembershipMock.mockResolvedValue(null);
    await expect(updateAthletePrivateNote("ajeno", "nota")).rejects.toThrow(ForbiddenError);
    await expect(updateAthleteRaceResult("ajeno", 5000, 1200)).rejects.toThrow(ForbiddenError);
  });

  it("calcula y guarda el VDOT junto al resultado", async () => {
    await updateAthleteRaceResult("athlete_1", 5000, 1200);

    const data = upsertProfileMock.mock.calls[0][0].update;
    expect(data.raceResultDistanceMeters).toBe(5000);
    expect(data.raceResultTimeSeconds).toBe(1200);
    expect(data.vdot).toBeCloseTo(49.81, 1);
  });

  it("rechaza distancias y tiempos fuera de donde el modelo es confiable", async () => {
    // Menos de 1500 m: la curva de Daniels se degrada en esfuerzos muy cortos.
    await expect(updateAthleteRaceResult("athlete_1", 400, 60)).rejects.toThrow(/distancia/i);
    await expect(updateAthleteRaceResult("athlete_1", 5000, 30)).rejects.toThrow(/tiempo/i);
    expect(upsertProfileMock).not.toHaveBeenCalled();
  });

  it("rechaza un tiempo no entero", async () => {
    await expect(updateAthleteRaceResult("athlete_1", 5000, 1200.5)).rejects.toThrow(/tiempo/i);
  });

  it("una nota vacía se guarda como null, no como cadena vacía", async () => {
    await updateAthletePrivateNote("athlete_1", "");
    expect(upsertProfileMock.mock.calls[0][0].update.coachPrivateNote).toBeNull();
  });
});
