import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMembership: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/clerk-sync", () => ({
  syncMembershipFromClerk: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { syncMembershipFromClerk } from "@/lib/clerk-sync";
import {
  getCurrentMembership,
  requireRole,
  requireCapability,
  requireMembership,
  requirePlatformAdmin,
  ForbiddenError,
} from "./permissions";
import type { MembershipRole } from "@/generated/prisma/client";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findFirstMock = prisma.teamMembership.findFirst as unknown as ReturnType<typeof vi.fn>;
const findUserMock = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const syncMock = syncMembershipFromClerk as unknown as ReturnType<typeof vi.fn>;

const fakeMembership = (role: MembershipRole) => ({
  id: "mem_1",
  teamId: "team_1",
  role,
  team: { id: "team_1", name: "Equipo" },
  user: { id: "user_1", name: "Coach" },
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("getCurrentMembership", () => {
  it("sin sesión (sin userId/orgId), retorna null sin tocar la base de datos", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    const result = await getCurrentMembership();

    expect(result).toBeNull();
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("con sesión y membresía activa existente, la retorna directo sin llamar al fallback de sync", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:admin" });
    const membership = fakeMembership("COACH");
    findFirstMock.mockResolvedValue(membership);

    const result = await getCurrentMembership();

    expect(result).toBe(membership);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("escopa la búsqueda al org activo de la sesión, no solo al usuario", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:member" });
    findFirstMock.mockResolvedValue(fakeMembership("ATHLETE"));

    await getCurrentMembership();

    const whereArg = findFirstMock.mock.calls[0][0].where;
    expect(whereArg.status).toBe("ACTIVE");
    expect(whereArg.user.clerkUserId).toBe("user_1");
    expect(whereArg.team.clerkOrgId).toBe("org_1");
  });

  it("sin membresía en la base de datos, cae al fallback sync-on-read con los datos de la sesión", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:admin" });
    findFirstMock.mockResolvedValue(null);
    const synced = fakeMembership("COACH");
    syncMock.mockResolvedValue(synced);

    const result = await getCurrentMembership();

    expect(syncMock).toHaveBeenCalledWith("user_1", "org_1", "org:admin");
    expect(result).toBe(synced);
  });
});

describe("requireRole", () => {
  it("retorna la membresía cuando el rol coincide", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:admin" });
    const membership = fakeMembership("COACH");
    findFirstMock.mockResolvedValue(membership);

    const result = await requireRole("COACH");
    expect(result).toBe(membership);
  });

  it("lanza ForbiddenError cuando el rol no coincide (un atleta no puede actuar como coach)", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:member" });
    findFirstMock.mockResolvedValue(fakeMembership("ATHLETE"));

    await expect(requireRole("COACH")).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError cuando no hay membresía en absoluto", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await expect(requireRole("COACH")).rejects.toThrow(ForbiddenError);
  });
});

describe("requireCapability", () => {
  function signedInAs(role: MembershipRole) {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:admin" });
    const membership = fakeMembership(role);
    findFirstMock.mockResolvedValue(membership);
    return membership;
  }

  it("el admin del club puede prescribir entrenamiento", async () => {
    const membership = signedInAs("ADMIN");
    await expect(requireCapability("MANAGE_TRAINING")).resolves.toBe(membership);
  });

  // Es exactamente el bug que se habría colado al agregar un rol por encima de
  // COACH si los guards hubieran seguido comparando el rol contra "COACH": el
  // admin del club sin acceso a su propia plataforma.
  it("un admin NO queda fuera de las acciones que antes exigían rol COACH exacto", async () => {
    signedInAs("ADMIN");
    await expect(requireRole("COACH")).rejects.toThrow(ForbiddenError);
    await expect(requireCapability("MANAGE_TRAINING")).resolves.toBeTruthy();
  });

  it("un coach no toca los ajustes del club", async () => {
    signedInAs("COACH");
    await expect(requireCapability("MANAGE_TRAINING")).resolves.toBeTruthy();
    await expect(requireCapability("MANAGE_CLUB")).rejects.toThrow(ForbiddenError);
  });

  it("un socio solo puede registrar su propio entrenamiento", async () => {
    signedInAs("ATHLETE");
    await expect(requireCapability("LOG_OWN_TRAINING")).resolves.toBeTruthy();
    await expect(requireCapability("MANAGE_TRAINING")).rejects.toThrow(ForbiddenError);
    await expect(requireCapability("MANAGE_MEMBERS")).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError cuando no hay membresía en absoluto", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, orgRole: null });
    await expect(requireCapability("MANAGE_TRAINING")).rejects.toThrow(ForbiddenError);
  });
});

describe("requireMembership", () => {
  it("retorna la membresía si existe, sin importar el rol", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: "org_1", orgRole: "org:member" });
    const membership = fakeMembership("ATHLETE");
    findFirstMock.mockResolvedValue(membership);

    const result = await requireMembership();
    expect(result).toBe(membership);
  });

  it("lanza ForbiddenError con mensaje específico cuando no hay membresía", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await expect(requireMembership()).rejects.toThrow("No perteneces a ningún equipo.");
  });
});

describe("requirePlatformAdmin", () => {
  it("retorna el user si isPlatformAdmin es true", async () => {
    authMock.mockResolvedValue({ userId: "user_1" });
    const adminUser = { id: "user_1", email: "admin@tpeaks.dev", isPlatformAdmin: true };
    findUserMock.mockResolvedValue(adminUser);

    const result = await requirePlatformAdmin();
    expect(result).toBe(adminUser);
  });

  it("lanza ForbiddenError si el usuario existe pero no es admin", async () => {
    authMock.mockResolvedValue({ userId: "user_1" });
    findUserMock.mockResolvedValue({ id: "user_1", email: "coach@equipo.com", isPlatformAdmin: false });

    await expect(requirePlatformAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError sin sesión, sin tocar la base de datos", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(requirePlatformAdmin()).rejects.toThrow(ForbiddenError);
    expect(findUserMock).not.toHaveBeenCalled();
  });

  it("no depende de un org activo (a diferencia de getCurrentMembership)", async () => {
    authMock.mockResolvedValue({ userId: "user_1", orgId: null });
    findUserMock.mockResolvedValue({ id: "user_1", email: "admin@tpeaks.dev", isPlatformAdmin: true });

    await expect(requirePlatformAdmin()).resolves.toBeTruthy();
  });
});

describe("ForbiddenError", () => {
  it("tiene un mensaje por default en español", () => {
    expect(new ForbiddenError().message).toBe("No tienes permiso para hacer esto.");
  });
});
