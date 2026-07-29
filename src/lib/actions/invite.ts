"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { requireCapability } from "@/lib/permissions";

/**
 * Validación mínima antes de llamar a Clerk. Sin esto, un email mal escrito
 * llega hasta Clerk y el error crudo del SDK sale en pantalla; y sin normalizar,
 * "Ana@Club.com" y "ana@club.com" crean dos invitaciones para la misma persona.
 */
function cleanEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Escribe un correo válido.");
  }
  return normalized;
}

/**
 * Invita a un atleta por email a la Organization (Team) del coach. Clerk
 * envía el correo y maneja el flujo de aceptación; cuando el atleta acepta,
 * nuestro webhook (o el fallback sync-on-read en getCurrentMembership) crea
 * su TeamMembership(ATHLETE) automáticamente — "org:member" es la señal que
 * mapeamos a ATHLETE (ver src/lib/clerk-sync.ts).
 */
export async function inviteAthlete(email: string) {
  const membership = await requireCapability("MANAGE_MEMBERS");
  const emailAddress = cleanEmail(email);

  const client = await clerkClient();
  await client.organizations.createOrganizationInvitation({
    organizationId: membership.team.clerkOrgId,
    emailAddress,
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
