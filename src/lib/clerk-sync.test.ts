import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clubInvitation: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { mapOrgRole, resolveInitialRole } from "./clerk-sync";

const findInvitationMock = prisma.clubInvitation.findUnique as unknown as ReturnType<typeof vi.fn>;
const deleteInvitationMock = prisma.clubInvitation.delete as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});


describe("mapOrgRole", () => {
  it("org:admin se mapea a ADMIN de club: quien crea la organización está dando de alta su club", () => {
    expect(mapOrgRole("org:admin")).toBe("ADMIN");
  });

  it("org:member se mapea a ATHLETE", () => {
    expect(mapOrgRole("org:member")).toBe("ATHLETE");
  });

  it("cualquier otro valor (incluyendo null/undefined) cae a ATHLETE por defecto", () => {
    expect(mapOrgRole(null)).toBe("ATHLETE");
    expect(mapOrgRole(undefined)).toBe("ATHLETE");
    expect(mapOrgRole("org:algo_raro")).toBe("ATHLETE");
  });
});

describe("resolveInitialRole", () => {
  it("usa el rol prometido en la invitación del club", async () => {
    findInvitationMock.mockResolvedValue({ id: "inv_1", role: "COACH" });

    await expect(resolveInitialRole("team_1", "coach@ejemplo.com", "org:member")).resolves.toBe(
      "COACH",
    );
  });

  // El rol prometido gana sobre el de Clerk: en Clerk todos entran como
  // org:member, incluso los Admin de club.
  it("el rol prometido manda sobre el rol de Clerk", async () => {
    findInvitationMock.mockResolvedValue({ id: "inv_1", role: "ADMIN" });

    await expect(resolveInitialRole("team_1", "ana@ejemplo.com", "org:member")).resolves.toBe(
      "ADMIN",
    );
  });

  it("consume la invitación: una reinvitación vieja no debe reaparecer después", async () => {
    findInvitationMock.mockResolvedValue({ id: "inv_1", role: "COACH" });

    await resolveInitialRole("team_1", "coach@ejemplo.com", "org:member");
    expect(deleteInvitationMock).toHaveBeenCalledWith({ where: { id: "inv_1" } });
  });

  it("busca acotado al club y en minúsculas", async () => {
    findInvitationMock.mockResolvedValue(null);

    await resolveInitialRole("team_1", "Ana@Ejemplo.COM", "org:member");
    expect(findInvitationMock.mock.calls[0][0].where).toEqual({
      teamId_email: { teamId: "team_1", email: "ana@ejemplo.com" },
    });
  });

  describe("sin invitación", () => {
    beforeEach(() => {
      findInvitationMock.mockResolvedValue(null);
    });

    it("quien crea la organización entra como Admin de club", async () => {
      await expect(resolveInitialRole("team_1", "fundador@ejemplo.com", "org:admin")).resolves.toBe(
        "ADMIN",
      );
    });

    // Ej. agregado a mano desde el dashboard de Clerk: entra como socio, que es
    // el rol con menos permisos.
    it("cualquier otro caso cae a Socio", async () => {
      await expect(resolveInitialRole("team_1", "x@ejemplo.com", "org:member")).resolves.toBe(
        "ATHLETE",
      );
      await expect(resolveInitialRole("team_1", "x@ejemplo.com", null)).resolves.toBe("ATHLETE");
    });

    it("no borra nada si no había invitación", async () => {
      await resolveInitialRole("team_1", "x@ejemplo.com", "org:member");
      expect(deleteInvitationMock).not.toHaveBeenCalled();
    });
  });
});
