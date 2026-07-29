import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingGroup: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teamMembership: { findMany: vi.fn() },
    trainingGroupMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import {
  setTrainingGroupMembers,
  createTrainingGroup,
  updateTrainingGroup,
  deleteTrainingGroup,
} from "./groups";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findGroupMock = prisma.trainingGroup.findFirst as unknown as ReturnType<typeof vi.fn>;
const findMembersMock = prisma.teamMembership.findMany as unknown as ReturnType<typeof vi.fn>;
const createManyMock = prisma.trainingGroupMember.createMany as unknown as ReturnType<typeof vi.fn>;
const transactionMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;
const createGroupMock = prisma.trainingGroup.create as unknown as ReturnType<typeof vi.fn>;
const updateGroupMock = prisma.trainingGroup.update as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "coach_1", teamId: "team_1" });
  findGroupMock.mockResolvedValue({ id: "group_1", teamId: "team_1" });
  transactionMock.mockResolvedValue([]);
  createGroupMock.mockResolvedValue({ id: "group_1" });
});

/** Lo que Prisma devolvería para los ids consultados. */
function membersInClub(rows: { id: string; status: string }[]) {
  findMembersMock.mockResolvedValue(rows);
}

describe("setTrainingGroupMembers", () => {
  it("exige la capacidad de gestionar socios", async () => {
    membersInClub([]);
    await setTrainingGroupMembers("group_1", []);
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  it("rechaza el grupo de otro club aunque se adivine el id", async () => {
    findGroupMock.mockResolvedValue(null);
    await expect(setTrainingGroupMembers("group_ajeno", [])).rejects.toThrow(ForbiddenError);
  });

  it("acota la consulta de socios al club y al rol, no solo a los ids del formulario", async () => {
    membersInClub([{ id: "a", status: "ACTIVE" }]);
    await setTrainingGroupMembers("group_1", ["a"]);

    expect(findMembersMock.mock.calls[0][0].where).toMatchObject({
      teamId: "team_1",
      role: "ATHLETE",
    });
  });

  it("rechaza un socio que no pertenece al club", async () => {
    // Se piden dos ids y la base solo reconoce uno como del club.
    membersInClub([{ id: "a", status: "ACTIVE" }]);
    await expect(setTrainingGroupMembers("group_1", ["a", "de_otro_club"])).rejects.toThrow(
      ForbiddenError,
    );
  });

  // Regresión del bug que dejaba el grupo imposible de guardar: bastaba con que
  // un socio del grupo se diera de baja para que la pantalla mandara su id y la
  // acción lanzara "no es de tu club", que además era falso.
  it("un socio dado de baja se descarta en silencio, NO bloquea el guardado", async () => {
    membersInClub([
      { id: "activo", status: "ACTIVE" },
      { id: "dado_de_baja", status: "REMOVED" },
    ]);

    const result = await setTrainingGroupMembers("group_1", ["activo", "dado_de_baja"]);

    expect(result).toEqual({ count: 1 });
    expect(createManyMock).toHaveBeenCalledWith({
      data: [{ groupId: "group_1", membershipId: "activo" }],
    });
  });

  it("guardar una lista vacía deja el grupo sin socios, sin error", async () => {
    membersInClub([]);
    const result = await setTrainingGroupMembers("group_1", []);
    expect(result).toEqual({ count: 0 });
  });

  it("reemplaza la lista completa en una sola transacción, no de uno en uno", async () => {
    membersInClub([{ id: "a", status: "ACTIVE" }]);
    await setTrainingGroupMembers("group_1", ["a"]);
    expect(transactionMock).toHaveBeenCalledOnce();
  });
});

describe("createTrainingGroup", () => {
  it("exige la capacidad de gestionar socios", async () => {
    await createTrainingGroup({ name: "Avanzados" });
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  it("crea el grupo siempre en el club de quien lo crea", async () => {
    await createTrainingGroup({ name: "Avanzados" });
    expect(createGroupMock.mock.calls[0][0].data.teamId).toBe("team_1");
  });

  it("recorta el nombre y la descripción", async () => {
    await createTrainingGroup({ name: "  Avanzados  ", description: "  nivel alto  " });
    expect(createGroupMock.mock.calls[0][0].data).toMatchObject({
      name: "Avanzados",
      description: "nivel alto",
    });
  });

  it("rechaza un nombre vacío o de puros espacios", async () => {
    await expect(createTrainingGroup({ name: "   " })).rejects.toThrow(/nombre/);
    expect(createGroupMock).not.toHaveBeenCalled();
  });

  it("rechaza un nombre desmedido", async () => {
    await expect(createTrainingGroup({ name: "a".repeat(61) })).rejects.toThrow(/largo/);
  });

  it("una descripción vacía se guarda como null", async () => {
    await createTrainingGroup({ name: "Avanzados", description: "  " });
    expect(createGroupMock.mock.calls[0][0].data.description).toBeNull();
  });

  // El unique de (teamId, name) da un P2002 ilegible; el coach merece saber
  // que ya tiene un grupo con ese nombre.
  it("traduce el choque de nombre duplicado a un mensaje legible", async () => {
    createGroupMock.mockRejectedValue(Object.assign(new Error("P2002"), { code: "P2002" }));
    await expect(createTrainingGroup({ name: "Avanzados" })).rejects.toThrow(
      /Ya existe un grupo llamado "Avanzados"/,
    );
  });

  it("no se traga otros errores de la base", async () => {
    createGroupMock.mockRejectedValue(Object.assign(new Error("caída"), { code: "P1001" }));
    await expect(createTrainingGroup({ name: "Avanzados" })).rejects.toThrow(/caída/);
  });
});

describe("updateTrainingGroup y deleteTrainingGroup", () => {
  it("rechazan un grupo de otro club", async () => {
    findGroupMock.mockResolvedValue(null);
    await expect(updateTrainingGroup("ajeno", { name: "X" })).rejects.toThrow(ForbiddenError);
    await expect(deleteTrainingGroup("ajeno")).rejects.toThrow(ForbiddenError);
  });

  it("renombrar valida igual que crear", async () => {
    await expect(updateTrainingGroup("group_1", { name: "  " })).rejects.toThrow(/nombre/);
    expect(updateGroupMock).not.toHaveBeenCalled();
  });

  it("renombrar a un nombre ya usado da el mismo mensaje legible", async () => {
    updateGroupMock.mockRejectedValue(Object.assign(new Error("P2002"), { code: "P2002" }));
    await expect(updateTrainingGroup("group_1", { name: "Trail" })).rejects.toThrow(/Ya existe/);
  });

  it("borrar el grupo no toca socios ni entrenamientos, solo el grupo", async () => {
    await deleteTrainingGroup("group_1");
    expect(prisma.trainingGroup.delete).toHaveBeenCalledWith({ where: { id: "group_1" } });
  });
});
