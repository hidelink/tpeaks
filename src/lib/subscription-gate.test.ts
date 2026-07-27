import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    team: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { teamHasActiveAccess, assertAthleteTeamAccess } from "./subscription-gate";

const findTeamMock = prisma.team.findUniqueOrThrow as unknown as ReturnType<typeof vi.fn>;
const redirectMock = redirect as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.resetAllMocks();
});

describe("teamHasActiveAccess", () => {
  it.each([
    ["TRIALING", true],
    ["ACTIVE", true],
    ["PAST_DUE", false],
    ["CANCELED", false],
    ["PAUSED", false],
  ] as const)("status %s -> acceso %s", async (status, expected) => {
    findTeamMock.mockResolvedValue({ subscriptionStatus: status });
    const result = await teamHasActiveAccess("team_1");
    expect(result).toBe(expected);
  });
});

describe("assertAthleteTeamAccess", () => {
  it("con acceso válido, no redirige", async () => {
    findTeamMock.mockResolvedValue({ subscriptionStatus: "ACTIVE" });
    await assertAthleteTeamAccess("team_1");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("sin acceso (ej. CANCELED), redirige a la pantalla de bloqueo", async () => {
    findTeamMock.mockResolvedValue({ subscriptionStatus: "CANCELED" });
    await assertAthleteTeamAccess("team_1");
    expect(redirectMock).toHaveBeenCalledWith("/athlete/billing-gate");
  });
});
