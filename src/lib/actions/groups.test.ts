import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingGroup: { findFirst: vi.fn() },
    teamMembership: { findMany: vi.fn() },
    trainingGroupMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { setTrainingGroupMembers } from "./groups";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findGroupMock = prisma.trainingGroup.findFirst as unknown as ReturnType<typeof vi.fn>;
const findMembersMock = prisma.teamMembership.findMany as unknown as ReturnType<typeof vi.fn>;
const createManyMock = prisma.trainingGroupMember.createMany as unknown as ReturnType<typeof vi.fn>;
const transactionMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "coach_1", teamId: "team_1" });
  findGroupMock.mockResolvedValue({ id: "group_1", teamId: "team_1" });
  transactionMock.mockResolvedValue([]);
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
