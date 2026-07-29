"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";

/**
 * Grupos de entrenamiento del club ("avanzados", "trail", "principiantes").
 *
 * Son gestión de socios, no de entrenamiento: un Admin los administra aunque
 * no prescriba, y un Coach también porque agrupa a sus propios atletas.
 *
 * Igual que en el resto de acciones, cada query va acotada por teamId — nadie
 * toca el grupo de otro club aunque adivine el id.
 */

async function assertGroupOfMyClub(groupId: string) {
  const membership = await requireCapability("MANAGE_MEMBERS");

  const group = await prisma.trainingGroup.findFirst({
    where: { id: groupId, teamId: membership.teamId },
  });
  if (!group) throw new ForbiddenError("Ese grupo no es de tu club.");

  return { membership, group };
}

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El grupo necesita un nombre.");
  if (trimmed.length > 60) throw new Error("El nombre del grupo es demasiado largo.");
  return trimmed;
}

/** El unique de (teamId, name) da un error de Prisma ilegible; se traduce. */
function friendlyDuplicate(err: unknown, name: string): never {
  if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
    throw new Error(`Ya existe un grupo llamado "${name}" en tu club.`);
  }
  throw err;
}

export async function createTrainingGroup(input: { name: string; description?: string }) {
  const membership = await requireCapability("MANAGE_MEMBERS");
  const name = cleanName(input.name);

  try {
    const group = await prisma.trainingGroup.create({
      data: {
        teamId: membership.teamId,
        name,
        description: input.description?.trim() || null,
      },
    });
    revalidatePath("/coach/groups");
    return { id: group.id };
  } catch (err) {
    friendlyDuplicate(err, name);
  }
}

export async function updateTrainingGroup(
  groupId: string,
  input: { name: string; description?: string },
) {
  await assertGroupOfMyClub(groupId);
  const name = cleanName(input.name);

  try {
    await prisma.trainingGroup.update({
      where: { id: groupId },
      data: { name, description: input.description?.trim() || null },
    });
  } catch (err) {
    friendlyDuplicate(err, name);
  }

  revalidatePath("/coach/groups");
  return { id: groupId };
}

/**
 * Borrar un grupo NO borra socios ni entrenamientos: la tabla de unión es
 * ON DELETE CASCADE, así que solo desaparece la pertenencia. Lo ya asignado a
 * esas personas sigue igual — el grupo era el atajo para asignar, no el dueño
 * de nada.
 */
export async function deleteTrainingGroup(groupId: string) {
  await assertGroupOfMyClub(groupId);

  await prisma.trainingGroup.delete({ where: { id: groupId } });

  revalidatePath("/coach/groups");
}

/**
 * Reemplaza la lista completa de miembros del grupo en vez de agregar/quitar
 * de uno en uno: la pantalla es una lista de checkboxes que se guarda entera,
 * y así no hay estados intermedios raros si alguien manda el formulario dos
 * veces.
 */
export async function setTrainingGroupMembers(groupId: string, membershipIds: string[]) {
  const { membership } = await assertGroupOfMyClub(groupId);

  // Dos comprobaciones distintas a propósito:
  //
  // 1. Pertenecer al club se exige y se rechaza — un id de otro club es un
  //    intento de tocar datos ajenos.
  // 2. Estar activo NO se rechaza, se filtra. Antes se exigía, y bastaba con
  //    que un socio del grupo se diera de baja para que la pantalla mandara su
  //    id y la acción lanzara "no es de tu club": el grupo quedaba imposible de
  //    guardar y el mensaje además era falso. Un socio dado de baja simplemente
  //    no forma parte del grupo.
  const inClub = await prisma.teamMembership.findMany({
    where: { id: { in: membershipIds }, teamId: membership.teamId, role: "ATHLETE" },
    select: { id: true, status: true },
  });
  if (inClub.length !== membershipIds.length) {
    throw new ForbiddenError("Alguno de esos socios no es de tu club.");
  }
  const valid = inClub.filter((m) => m.status === "ACTIVE");

  await prisma.$transaction([
    prisma.trainingGroupMember.deleteMany({ where: { groupId } }),
    prisma.trainingGroupMember.createMany({
      data: valid.map((v) => ({ groupId, membershipId: v.id })),
    }),
  ]);

  revalidatePath("/coach/groups");
  revalidatePath("/coach/athletes");
  return { count: valid.length };
}
