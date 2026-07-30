import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const createInvitationMock = vi.fn();
const revokeInvitationMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    organizations: {
      createOrganizationInvitation: createInvitationMock,
      revokeOrganizationInvitation: revokeInvitationMock,
    },
  })),
}));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return { ...actual, requireCapability: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMembership: { findFirst: vi.fn() },
    clubInvitation: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { inviteMember, revokeInvitation } from "./invite";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;
const findMembershipMock = prisma.teamMembership.findFirst as unknown as ReturnType<typeof vi.fn>;
const upsertInvitationMock = prisma.clubInvitation.upsert as unknown as ReturnType<typeof vi.fn>;
const deleteInvitationsMock = prisma.clubInvitation.deleteMany as unknown as ReturnType<typeof vi.fn>;

const ACTOR = {
  teamId: "team_1",
  team: { clerkOrgId: "org_1" },
  user: { clerkUserId: "clerk_admin" },
};

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue(ACTOR);
  findMembershipMock.mockResolvedValue(null);
  createInvitationMock.mockResolvedValue({ id: "inv_clerk_1" });
});

describe("inviteMember — permisos", () => {
  it("invitar un socio pide MANAGE_MEMBERS", async () => {
    await inviteMember("nuevo@ejemplo.com", "ATHLETE");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  // La trampa del cambio: MANAGE_MEMBERS lo tiene también el Coach, así que si
  // invitar staff viviera ahí, un coach podría invitar su propio correo alterno
  // como Admin y ascenderse por la puerta de atrás.
  it("invitar un coach o un admin pide MANAGE_CLUB, no MANAGE_MEMBERS", async () => {
    await inviteMember("coach@ejemplo.com", "COACH");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_CLUB");

    requireCapabilityMock.mockClear();
    await inviteMember("admin@ejemplo.com", "ADMIN");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_CLUB");
  });

  it("si no tiene la capacidad, no se manda ninguna invitación", async () => {
    requireCapabilityMock.mockRejectedValue(new ForbiddenError());
    await expect(inviteMember("coach@ejemplo.com", "COACH")).rejects.toThrow(ForbiddenError);
    expect(createInvitationMock).not.toHaveBeenCalled();
  });
});

describe("inviteMember — invitación en Clerk", () => {
  it("invita a la organización del club de quien invita", async () => {
    await inviteMember("nuevo@ejemplo.com", "ATHLETE");
    expect(createInvitationMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_1", emailAddress: "nuevo@ejemplo.com" }),
    );
  });

  // Nuestros roles viven en nuestra tabla. org:admin daría poderes sobre la
  // organización de Clerk (editarla, expulsar) que no controlamos.
  it("en Clerk TODOS entran como org:member, incluso un Admin de club", async () => {
    await inviteMember("admin@ejemplo.com", "ADMIN");
    expect(createInvitationMock.mock.calls[0][0].role).toBe("org:member");
  });

  it("normaliza el email: recorta y baja a minúsculas", async () => {
    await inviteMember("  Nuevo@Ejemplo.COM  ", "ATHLETE");
    expect(createInvitationMock.mock.calls[0][0].emailAddress).toBe("nuevo@ejemplo.com");
  });

  it("rechaza un email inválido antes de llamar a Clerk", async () => {
    await expect(inviteMember("no-es-un-email", "ATHLETE")).rejects.toThrow(/correo/i);
    expect(createInvitationMock).not.toHaveBeenCalled();
  });
});

describe("inviteMember — rol prometido", () => {
  it("guarda el rol elegido para aplicarlo cuando la persona acepte", async () => {
    await inviteMember("coach@ejemplo.com", "COACH");

    const call = upsertInvitationMock.mock.calls[0][0];
    expect(call.create).toMatchObject({
      teamId: "team_1",
      email: "coach@ejemplo.com",
      role: "COACH",
      clerkInvitationId: "inv_clerk_1",
    });
  });

  it("reinvitar reemplaza el rol prometido en vez de dejar dos filas", async () => {
    await inviteMember("ana@ejemplo.com", "ADMIN");

    const call = upsertInvitationMock.mock.calls[0][0];
    expect(call.where).toEqual({ teamId_email: { teamId: "team_1", email: "ana@ejemplo.com" } });
    expect(call.update).toMatchObject({ role: "ADMIN" });
  });
});

describe("inviteMember — ya está dentro", () => {
  it("rechaza invitar a alguien que ya es miembro, y sugiere cambiarle el rol", async () => {
    findMembershipMock.mockResolvedValue({ id: "m1", role: "COACH" });

    await expect(inviteMember("ya@esta.com", "ADMIN")).rejects.toThrow(/ya está en tu club/);
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("a alguien dado de baja sí se le puede volver a invitar", async () => {
    // La query excluye REMOVED, así que devuelve null y la invitación procede.
    findMembershipMock.mockResolvedValue(null);
    await expect(inviteMember("volvio@ejemplo.com", "ATHLETE")).resolves.toBeUndefined();

    expect(findMembershipMock.mock.calls[0][0].where).toMatchObject({
      teamId: "team_1",
      status: { not: "REMOVED" },
    });
  });
});

describe("revokeInvitation", () => {
  it("exige la capacidad de gestionar socios", async () => {
    await revokeInvitation("inv_clerk_1");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  it("revoca en Clerk acotado a la organización del club", async () => {
    await revokeInvitation("inv_clerk_1");
    expect(revokeInvitationMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_1", invitationId: "inv_clerk_1" }),
    );
  });

  // Si la fila se queda, esa persona podría entrar después por otra vía y
  // recibir el rol de una invitación ya revocada.
  it("borra también el rol prometido, acotado al club", async () => {
    await revokeInvitation("inv_clerk_1");
    expect(deleteInvitationsMock).toHaveBeenCalledWith({
      where: { teamId: "team_1", clerkInvitationId: "inv_clerk_1" },
    });
  });
});

describe("errores de Clerk", () => {
  /** Un error del SDK de Clerk, con la forma real que trae. */
  function clerkError(code: string, longMessage?: string) {
    return Object.assign(new Error("Forbidden"), {
      clerkError: true,
      status: 403,
      errors: [{ code, message: code, longMessage }],
    });
  }

  // Regresión: este error subía tal cual y Next.js lo convertía en "An error
  // occurred in the Server Components render... A digest property is included",
  // que no le dice nada a nadie. El mensaje real quedaba enterrado en los logs.
  it("el tope de miembros de la instancia da un mensaje accionable, no un 500 opaco", async () => {
    createInvitationMock.mockRejectedValue(clerkError("organization_membership_quota_exceeded"));

    await expect(inviteMember("nuevo@ejemplo.com", "ATHLETE")).rejects.toThrow(
      /límite de miembros por club/,
    );
  });

  it("una invitación duplicada se explica en vez de mostrar el código de Clerk", async () => {
    createInvitationMock.mockRejectedValue(clerkError("duplicate_record"));

    await expect(inviteMember("nuevo@ejemplo.com", "ATHLETE")).rejects.toThrow(
      /invitación pendiente/,
    );
  });

  it("para otros errores de Clerk se muestra su propio mensaje largo", async () => {
    createInvitationMock.mockRejectedValue(
      clerkError("something_else", "Ese dominio de correo está bloqueado."),
    );

    await expect(inviteMember("nuevo@ejemplo.com", "ATHLETE")).rejects.toThrow(
      /dominio de correo está bloqueado/,
    );
  });

  it("un error que no es de Clerk se deja pasar sin disfrazarlo", async () => {
    createInvitationMock.mockRejectedValue(new Error("se cayó la red"));

    await expect(inviteMember("nuevo@ejemplo.com", "ATHLETE")).rejects.toThrow(/se cayó la red/);
  });

  it("revocar traduce igual, no solo invitar", async () => {
    revokeInvitationMock.mockRejectedValue(
      clerkError("otro", "La invitación ya no existe."),
    );

    await expect(revokeInvitation("inv_1")).rejects.toThrow(/ya no existe/);
  });
});
