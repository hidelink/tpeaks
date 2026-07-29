"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
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
