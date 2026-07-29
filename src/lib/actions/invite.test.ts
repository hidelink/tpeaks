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

import { requireCapability } from "@/lib/permissions";
import { inviteAthlete, revokeInvitation } from "./invite";

const requireCapabilityMock = requireCapability as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({
    teamId: "team_1",
    team: { clerkOrgId: "org_1" },
    user: { clerkUserId: "clerk_coach" },
  });
});

describe("inviteAthlete", () => {
  it("exige la capacidad de gestionar socios", async () => {
    await inviteAthlete("nuevo@ejemplo.com");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  it("invita siempre a la organización del club de quien invita", async () => {
    await inviteAthlete("nuevo@ejemplo.com");
    expect(createInvitationMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_1", emailAddress: "nuevo@ejemplo.com" }),
    );
  });

  // org:member es lo que clerk-sync mapea a ATHLETE. Si se invitara como
  // org:admin, el socio entraría con permisos de Admin del club.
  it("invita como org:member, nunca como org:admin", async () => {
    await inviteAthlete("nuevo@ejemplo.com");
    expect(createInvitationMock.mock.calls[0][0].role).toBe("org:member");
  });

  it("rechaza un email inválido antes de llamar a Clerk", async () => {
    await expect(inviteAthlete("no-es-un-email")).rejects.toThrow(/correo/i);
    await expect(inviteAthlete("   ")).rejects.toThrow(/correo/i);
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("normaliza el email: recorta espacios y baja a minúsculas", async () => {
    await inviteAthlete("  Nuevo@Ejemplo.COM  ");
    expect(createInvitationMock.mock.calls[0][0].emailAddress).toBe("nuevo@ejemplo.com");
  });
});

describe("revokeInvitation", () => {
  it("exige la capacidad de gestionar socios", async () => {
    await revokeInvitation("inv_1");
    expect(requireCapabilityMock).toHaveBeenCalledWith("MANAGE_MEMBERS");
  });

  it("revoca acotado a la organización del club, no solo por id de invitación", async () => {
    await revokeInvitation("inv_1");
    expect(revokeInvitationMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_1", invitationId: "inv_1" }),
    );
  });
});
