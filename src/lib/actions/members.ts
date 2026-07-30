"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { clerkErrorMessage } from "@/lib/clerk-errors";
import type { MembershipRole } from "@/generated/prisma/enums";

/**
 * Cambiar el rol de alguien dentro del club.
 *
 * Va bajo MANAGE_CLUB y NO bajo MANAGE_MEMBERS, aunque viva en la pantalla de
 * socios. Gestionar socios (invitar, dar de baja) no es lo mismo que repartir
 * poder: MANAGE_MEMBERS lo tiene también el Coach, así que ponerlo ahí dejaría
 * que cualquier coach se ascendiera a Admin — escalación de privilegios en una
 * línea. Solo un Admin reparte roles.
 */
export async function updateMembershipRole(membershipId: string, role: MembershipRole) {
  const actor = await requireCapability("MANAGE_CLUB");

  const target = await prisma.teamMembership.findFirst({
    where: { id: membershipId, teamId: actor.teamId },
    include: { user: true },
  });
  if (!target) throw new ForbiddenError("Esa persona no es de tu club.");

  if (target.role === role) return { changed: false as const };

  // Un club sin Admin queda sin nadie que pueda tocar ajustes, cobros ni
  // repartir roles — incluido el poder de volver a nombrar a un Admin. Es un
  // estado del que no se sale desde el producto.
  if (target.role === "ADMIN" && role !== "ADMIN") {
    const admins = await prisma.teamMembership.count({
      where: { teamId: actor.teamId, role: "ADMIN", status: "ACTIVE" },
    });
    if (admins <= 1) {
      throw new Error(
        "Tu club se quedaría sin ningún Admin. Nombra a otro antes de cambiar este rol.",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamMembership.update({ where: { id: membershipId }, data: { role } });

    // Al dejar de ser socio, se sale de los grupos de entrenamiento: son de
    // socios. Si la fila se queda, el grupo lo sigue contando aunque ninguna
    // pantalla lo muestre — el mismo dato zombi que ya causó tres síntomas
    // cuando alguien se daba de baja.
    if (role !== "ATHLETE") {
      await tx.trainingGroupMember.deleteMany({ where: { membershipId } });
    }
  });

  revalidatePath("/coach/athletes");
  revalidatePath("/coach/groups");

  return {
    changed: true as const,
    name: target.user.name,
    from: ROLE_LABELS[target.role],
    to: ROLE_LABELS[role],
  };
}

/**
 * Saca a alguien del club.
 *
 * NO BORRA DATOS, a propósito: la membresía pasa a REMOVED y todo su historial
 * —entrenamientos, feedback, asistencia— sigue siendo del club. La asistencia
 * del año pasado sigue contando aunque la persona ya no esté, y borrarla además
 * rompería las llaves foráneas de ScheduledWorkout. Por eso la interfaz dice
 * "quitar del club" y no "eliminar".
 *
 * PERMISOS, con la misma lógica que invitar y cambiar de rol: quitar un socio
 * pide MANAGE_MEMBERS (un coach puede quitar a sus propios atletas), pero quitar
 * a un Coach o a un Admin pide MANAGE_CLUB. Sin esa distinción, un coach podría
 * quitar al Admin del club.
 */
export async function removeMember(membershipId: string) {
  const target = await prisma.teamMembership.findFirst({
    where: { id: membershipId },
    include: { user: true, team: true },
  });
  // Se resuelve la capacidad según a QUIÉN se quita, así que primero hay que
  // saber qué rol tiene. El acotado al club se valida enseguida.
  const actor =
    target?.role === "ATHLETE"
      ? await requireCapability("MANAGE_MEMBERS")
      : await requireCapability("MANAGE_CLUB");

  if (!target || target.teamId !== actor.teamId) {
    throw new ForbiddenError("Esa persona no es de tu club.");
  }

  // Quitarse a uno mismo deja fuera de la plataforma a quien hizo clic, sin
  // forma de deshacerlo desde dentro. Si un Admin se quiere ir, lo quita otro.
  if (target.id === actor.id) {
    throw new Error("No puedes quitarte a ti mismo del club. Pídele a otro Admin que lo haga.");
  }

  // Mismo razonamiento que en updateMembershipRole: un club sin Admin no tiene
  // a nadie que pueda nombrar otro.
  if (target.role === "ADMIN") {
    const admins = await prisma.teamMembership.count({
      where: { teamId: actor.teamId, role: "ADMIN", status: "ACTIVE" },
    });
    if (admins <= 1) {
      throw new Error(
        "Tu club se quedaría sin ningún Admin. Nombra a otro antes de quitar a esta persona.",
      );
    }
  }

  // CLERK PRIMERO, y el orden importa. Al revés —nuestra base primero— si la
  // llamada a Clerk fallara, la persona quedaría REMOVED para nosotros pero con
  // sesión válida en Clerk, y upsertMembership la reactiva en el siguiente
  // sync-on-read: volvería a entrar sola. Así, si Clerk falla no cambiamos nada.
  const client = await clerkClient();
  try {
    await client.organizations.deleteOrganizationMembership({
      organizationId: target.team.clerkOrgId,
      userId: target.user.clerkUserId,
    });
  } catch (err) {
    const readable = clerkErrorMessage(err);
    if (readable) throw new Error(readable);
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamMembership.update({ where: { id: membershipId }, data: { status: "REMOVED" } });
    // La pertenencia a grupos sí se borra: si se queda, el grupo sigue contando
    // a alguien que ya no está. Es el dato zombi que ya costó tres síntomas.
    await tx.trainingGroupMember.deleteMany({ where: { membershipId } });
  });

  revalidatePath("/coach/athletes");
  revalidatePath("/coach/groups");

  return { name: target.user.name, role: ROLE_LABELS[target.role] };
}
