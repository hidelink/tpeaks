"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { absoluteUrl } from "@/lib/app-url";
import { clerkErrorMessage } from "@/lib/clerk-errors";
import type { MembershipRole } from "@/generated/prisma/enums";

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
 * Invita a alguien al club con el rol que va a tener al aceptar.
 *
 * PERMISOS: invitar un socio pide MANAGE_MEMBERS, pero invitar un Coach o un
 * Admin pide MANAGE_CLUB. La razón es la misma que en updateMembershipRole:
 * MANAGE_MEMBERS lo tiene también el Coach, así que sin esta distinción un
 * coach podría invitar su propio correo alterno como Admin y ascenderse por la
 * puerta de atrás.
 *
 * EN CLERK TODOS ENTRAN COMO `org:member`, incluidos los Admin de club. El rol
 * de Clerk solo gobierna poderes sobre la organización de Clerk (editarla,
 * expulsar miembros); nuestros roles viven en nuestra tabla. Darle `org:admin`
 * a un coach le daría poderes que no le corresponden y que no controlamos.
 *
 * El rol prometido se guarda en ClubInvitation y se aplica al crear la
 * membresía — ver resolveInitialRole en src/lib/clerk-sync.ts.
 */
export async function inviteMember(email: string, role: MembershipRole) {
  const membership =
    role === "ATHLETE"
      ? await requireCapability("MANAGE_MEMBERS")
      : await requireCapability("MANAGE_CLUB");

  const emailAddress = cleanEmail(email);

  // Ya está dentro: reinvitar no haría nada útil y el mensaje de Clerk sería
  // confuso. Mejor decirle que use el selector de rol.
  const existing = await prisma.teamMembership.findFirst({
    where: {
      teamId: membership.teamId,
      status: { not: "REMOVED" },
      user: { email: emailAddress },
    },
  });
  if (existing) {
    throw new Error(
      `${emailAddress} ya está en tu club como ${ROLE_LABELS[existing.role]}. ` +
        `Cámbiale el rol desde la lista en vez de invitarlo otra vez.`,
    );
  }

  const client = await clerkClient();
  let invitation;
  try {
    invitation = await client.organizations.createOrganizationInvitation({
      organizationId: membership.team.clerkOrgId,
      emailAddress,
      role: "org:member",
      inviterUserId: membership.user.clerkUserId,
      // Apunta a NUESTRA página, que incrusta el componente de Clerk y recibe
      // ?__clerk_ticket=...&__clerk_status=... — ver src/app/invitacion/page.tsx
      // para el porqué (el Account Portal de una instancia de desarrollo termina
      // en la pantalla de bienvenida de Clerk y eso no se arregla por config).
      //
      // La ruta /invitacion es PÚBLICA en el middleware. Un intento anterior
      // apuntó a "/", que exige sesión: el middleware rebotaba a /sign-in y se
      // perdía el ticket.
      redirectUrl: absoluteUrl("/invitacion"),
    });
  } catch (err) {
    const readable = clerkErrorMessage(err);
    if (readable) throw new Error(readable);
    throw err;
  }

  // upsert y no create: reinvitar a alguien reemplaza el rol prometido en vez
  // de chocar con el unique (teamId, email).
  await prisma.clubInvitation.upsert({
    where: { teamId_email: { teamId: membership.teamId, email: emailAddress } },
    create: {
      teamId: membership.teamId,
      email: emailAddress,
      role,
      clerkInvitationId: invitation.id,
    },
    update: { role, clerkInvitationId: invitation.id },
  });

  revalidatePath("/coach/athletes");
}

export async function revokeInvitation(invitationId: string) {
  const membership = await requireCapability("MANAGE_MEMBERS");

  const client = await clerkClient();
  try {
    await client.organizations.revokeOrganizationInvitation({
      organizationId: membership.team.clerkOrgId,
      invitationId,
      requestingUserId: membership.user.clerkUserId,
    });
  } catch (err) {
    const readable = clerkErrorMessage(err);
    if (readable) throw new Error(readable);
    throw err;
  }

  // Acotado al club: sin el teamId, alguien podría borrar la fila de otro club
  // pasando su id de invitación. Puede no existir si la invitación se creó
  // antes de que existiera esta tabla, y por eso es deleteMany y no delete.
  //
  // Importa borrarla: si esa persona entra después por otra vía, debe entrar
  // como socio y no con el rol de una invitación ya revocada.
  await prisma.clubInvitation.deleteMany({
    where: { teamId: membership.teamId, clerkInvitationId: invitationId },
  });

  revalidatePath("/coach/athletes");
}
