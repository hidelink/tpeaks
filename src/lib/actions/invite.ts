"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { requireCapability } from "@/lib/permissions";

/**
 * Invita a un atleta por email a la Organization (Team) del coach. Clerk
 * envía el correo y maneja el flujo de aceptación; cuando el atleta acepta,
 * nuestro webhook (o el fallback sync-on-read en getCurrentMembership) crea
 * su TeamMembership(ATHLETE) automáticamente — "org:member" es la señal que
 * mapeamos a ATHLETE (ver src/lib/clerk-sync.ts).
 */
export async function inviteAthlete(email: string) {
  const membership = await requireCapability("MANAGE_MEMBERS");

  const client = await clerkClient();
  await client.organizations.createOrganizationInvitation({
    organizationId: membership.team.clerkOrgId,
    emailAddress: email,
    role: "org:member",
    inviterUserId: membership.user.clerkUserId,
  });

  revalidatePath("/coach/athletes");
}

export async function revokeInvitation(invitationId: string) {
  const membership = await requireCapability("MANAGE_MEMBERS");

  const client = await clerkClient();
  await client.organizations.revokeOrganizationInvitation({
    organizationId: membership.team.clerkOrgId,
    invitationId,
    requestingUserId: membership.user.clerkUserId,
  });

  revalidatePath("/coach/athletes");
}
