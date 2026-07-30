import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const deleteOrgMembershipMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    organizations: { deleteOrganizationMembership: deleteOrgMembershipMock },
  })),
}));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMembership: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    trainingGroupMember: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { updateMembershipRole, removeMember } from "./members";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findMembershipMock = prisma.teamMembership.findFirst as unknown as ReturnType<typeof vi.fn>;
const countMock = prisma.teamMembership.count as unknown as ReturnType<typeof vi.fn>;
const updateMock = prisma.teamMembership.update as unknown as ReturnType<typeof vi.fn>;
const deleteGroupsMock = prisma.trainingGroupMember.deleteMany as unknown as ReturnType<typeof vi.fn>;
const transactionMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

/** Corre el callback de $transaction con un tx que son los mismos mocks. */
function runTransaction() {
  transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      teamMembership: { update: updateMock },
      trainingGroupMember: { deleteMany: deleteGroupsMock },
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: "admin_1", teamId: "team_1" });
  runTransaction();
});

function target(role: string) {
  findMembershipMock.mockResolvedValue({
    id: "m1",
    teamId: "team_1",
    role,
    user: { name: "Ana" },
  });
}

describe("updateMembershipRole", () => {
  // La decisión de seguridad del cambio: MANAGE_MEMBERS también lo tiene el
  // Coach, así que si repartir roles viviera ahí, cualquier coach podría
  // ascenderse a Admin.
  it("exige MANAGE_CLUB, no MANAGE_MEMBERS: repartir poder no es gestionar socios", async () => {
    target("ATHLETE");
    await updateMembershipRole("m1", "COACH");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_CLUB");
  });

  it("rechaza a alguien de otro club aunque se adivine el id", async () => {
    findMembershipMock.mockResolvedValue(null);
    await expect(updateMembershipRole("ajeno", "COACH")).rejects.toThrow(ForbiddenError);
  });

  it("acota la búsqueda al club de quien hace el cambio", async () => {
    target("ATHLETE");
    await updateMembershipRole("m1", "COACH");
    expect(findMembershipMock.mock.calls[0][0].where).toMatchObject({ teamId: "team_1" });
  });

  it("asignar el rol que ya tiene no escribe nada", async () => {
    target("COACH");
    const result = await updateMembershipRole("m1", "COACH");
    expect(result).toEqual({ changed: false });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("promueve un socio a coach y reporta el cambio", async () => {
    target("ATHLETE");
    const result = await updateMembershipRole("m1", "COACH");

    expect(updateMock).toHaveBeenCalledWith({ where: { id: "m1" }, data: { role: "COACH" } });
    expect(result).toMatchObject({ changed: true, name: "Ana", from: "Socio", to: "Coach" });
  });

  describe("el último Admin", () => {
    // Un club sin Admin no tiene a nadie que pueda nombrar otro Admin: es un
    // estado del que no se sale desde el producto.
    it("no puede degradarse a sí mismo si es el único", async () => {
      target("ADMIN");
      countMock.mockResolvedValue(1);

      await expect(updateMembershipRole("m1", "COACH")).rejects.toThrow(/sin ningún Admin/);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it("sí puede degradarse cuando hay otro Admin", async () => {
      target("ADMIN");
      countMock.mockResolvedValue(2);

      await expect(updateMembershipRole("m1", "COACH")).resolves.toMatchObject({ changed: true });
    });

    it("cuenta solo Admins ACTIVOS: uno dado de baja no cubre el puesto", async () => {
      target("ADMIN");
      countMock.mockResolvedValue(1);

      await expect(updateMembershipRole("m1", "ATHLETE")).rejects.toThrow();
      expect(countMock.mock.calls[0][0].where).toMatchObject({
        teamId: "team_1",
        role: "ADMIN",
        status: "ACTIVE",
      });
    });

    it("promover a un segundo Admin nunca se bloquea", async () => {
      target("COACH");
      await expect(updateMembershipRole("m1", "ADMIN")).resolves.toMatchObject({ changed: true });
      expect(countMock).not.toHaveBeenCalled();
    });
  });

  describe("pertenencia a grupos", () => {
    // Mismo dato zombi que ya causó tres síntomas cuando alguien se daba de
    // baja: la fila se queda y el grupo lo sigue contando.
    it("al dejar de ser socio, sale de los grupos de entrenamiento", async () => {
      target("ATHLETE");
      await updateMembershipRole("m1", "COACH");
      expect(deleteGroupsMock).toHaveBeenCalledWith({ where: { membershipId: "m1" } });
    });

    it("al volver a ser socio, no se le borra nada", async () => {
      target("COACH");
      await updateMembershipRole("m1", "ATHLETE");
      expect(deleteGroupsMock).not.toHaveBeenCalled();
    });

    it("el cambio de rol y la limpieza van en la misma transacción", async () => {
      target("ATHLETE");
      await updateMembershipRole("m1", "ADMIN");
      expect(transactionMock).toHaveBeenCalledOnce();
    });
  });
});

describe("removeMember", () => {
  function target(role: string, overrides: Record<string, unknown> = {}) {
    findMembershipMock.mockResolvedValue({
      id: "m1",
      teamId: "team_1",
      role,
      user: { name: "Ana", clerkUserId: "clerk_ana" },
      team: { clerkOrgId: "org_1" },
      ...overrides,
    });
  }

  // Misma lógica de escalación que invitar y cambiar de rol: si quitar staff
  // viviera en MANAGE_MEMBERS, un coach podría quitar al Admin del club.
  it("quitar un socio pide MANAGE_MEMBERS", async () => {
    target("ATHLETE");
    await removeMember("m1");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  it("quitar un coach o un admin pide MANAGE_CLUB", async () => {
    target("COACH");
    countMock.mockResolvedValue(2);
    await removeMember("m1");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_CLUB");
  });

  it("rechaza a alguien de otro club", async () => {
    target("ATHLETE", { teamId: "otro_club" });
    await expect(removeMember("m1")).rejects.toThrow(ForbiddenError);
    expect(deleteOrgMembershipMock).not.toHaveBeenCalled();
  });

  it("no puedes quitarte a ti mismo: te quedarías fuera sin poder deshacerlo", async () => {
    requireCapabilityMock.mockResolvedValue({ id: "m1", teamId: "team_1" });
    target("ADMIN");
    countMock.mockResolvedValue(3);

    await expect(removeMember("m1")).rejects.toThrow(/ti mismo/);
    expect(deleteOrgMembershipMock).not.toHaveBeenCalled();
  });

  it("no puedes quitar al último Admin", async () => {
    target("ADMIN");
    countMock.mockResolvedValue(1);

    await expect(removeMember("m1")).rejects.toThrow(/sin ningún Admin/);
    expect(deleteOrgMembershipMock).not.toHaveBeenCalled();
  });

  it("sí puedes quitar un Admin cuando hay otro", async () => {
    target("ADMIN");
    countMock.mockResolvedValue(2);
    await expect(removeMember("m1")).resolves.toMatchObject({ name: "Ana" });
  });

  it("quita también de Clerk, no solo de nuestra base", async () => {
    target("ATHLETE");
    await removeMember("m1");

    expect(deleteOrgMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      userId: "clerk_ana",
    });
  });

  // El orden importa: si escribiéramos primero en nuestra base y Clerk fallara,
  // la persona quedaría REMOVED para nosotros pero con sesión válida, y
  // upsertMembership la reactiva en el siguiente sync-on-read.
  it("si Clerk falla, NO se toca nuestra base", async () => {
    target("ATHLETE");
    deleteOrgMembershipMock.mockRejectedValue(new Error("Clerk caído"));

    await expect(removeMember("m1")).rejects.toThrow(/Clerk caído/);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("traduce los errores de Clerk en vez de dejarlos subir crudos", async () => {
    target("ATHLETE");
    deleteOrgMembershipMock.mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        clerkError: true,
        errors: [{ code: "otro", longMessage: "No se pudo quitar en Clerk." }],
      }),
    );

    await expect(removeMember("m1")).rejects.toThrow(/No se pudo quitar en Clerk/);
  });

  it("marca REMOVED en vez de borrar: el historial del club se conserva", async () => {
    target("ATHLETE");
    await removeMember("m1");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { status: "REMOVED" },
    });
  });

  it("lo saca de sus grupos de entrenamiento", async () => {
    target("ATHLETE");
    await removeMember("m1");
    expect(deleteGroupsMock).toHaveBeenCalledWith({ where: { membershipId: "m1" } });
  });
});
