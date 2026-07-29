"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { parseStartTime } from "@/lib/attendance";
import type { AttendanceStatus } from "@/generated/prisma/enums";

/**
 * Sesiones presenciales del club y su pase de lista.
 *
 * Van bajo MANAGE_TRAINING porque quien monta y dirige la sesión es quien
 * entrena. Si en la práctica resulta que el pase de lista lo hace quien lleva
 * la administración (porque de ahí sale quién paga), la asistencia se mueve a
 * MANAGE_MEMBERS — es un cambio de una línea gracias a las capacidades.
 */

async function assertSessionOfMyClub(sessionId: string) {
  const membership = await requireCapability("MANAGE_TRAINING");

  const session = await prisma.clubSession.findFirst({
    where: { id: sessionId, teamId: membership.teamId },
  });
  if (!session) throw new ForbiddenError("Esa sesión no es de tu club.");

  return { membership, session };
}

function validated(input: { title: string; date: string; startTime: string }) {
  const title = input.title.trim();
  if (!title) throw new Error("La sesión necesita un título.");

  const startTime = parseStartTime(input.startTime);
  if (!startTime) throw new Error("La hora debe ser HH:mm (ej. 07:00 o 19:30).");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Fecha inválida.");

  return { title, startTime };
}

/** El grupo, si viene, tiene que ser del mismo club. Null = abierta a todos. */
async function resolveGroupId(teamId: string, groupId?: string) {
  if (!groupId) return null;

  const group = await prisma.trainingGroup.findFirst({ where: { id: groupId, teamId } });
  if (!group) throw new ForbiddenError("Ese grupo no es de tu club.");
  return group.id;
}

export async function createClubSession(input: {
  title: string;
  date: string; // "yyyy-MM-dd"
  startTime: string; // "HH:mm", hora local del club
  groupId?: string;
  location?: string;
  note?: string;
}) {
  const membership = await requireCapability("MANAGE_TRAINING");
  const { title, startTime } = validated(input);
  const groupId = await resolveGroupId(membership.teamId, input.groupId);

  const session = await prisma.clubSession.create({
    data: {
      teamId: membership.teamId,
      groupId,
      // Quien la crea queda como responsable por defecto; se puede reasignar
      // después si el club tiene varios coaches.
      coachMembershipId: membership.id,
      title,
      date: new Date(input.date),
      startTime,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
    },
  });

  revalidatePath("/coach/sessions");
  return { id: session.id };
}

export async function updateClubSession(
  sessionId: string,
  input: {
    title: string;
    date: string;
    startTime: string;
    groupId?: string;
    location?: string;
    note?: string;
  },
) {
  const { membership } = await assertSessionOfMyClub(sessionId);
  const { title, startTime } = validated(input);
  const groupId = await resolveGroupId(membership.teamId, input.groupId);

  await prisma.clubSession.update({
    where: { id: sessionId },
    data: {
      title,
      date: new Date(input.date),
      startTime,
      groupId,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
    },
  });

  revalidatePath("/coach/sessions");
  revalidatePath(`/coach/sessions/${sessionId}`);
  return { id: sessionId };
}

/** Borrar la sesión borra su pase de lista (CASCADE); no toca a los socios. */
export async function deleteClubSession(sessionId: string) {
  await assertSessionOfMyClub(sessionId);

  await prisma.clubSession.delete({ where: { id: sessionId } });

  revalidatePath("/coach/sessions");
}

/**
 * Marca a UNA persona. Es por persona y no por lista completa a propósito: el
 * pase de lista se hace de pie en el parque, con el teléfono, mientras la gente
 * va llegando — guardar toda la lista de golpe obligaría a decidir por
 * adelantado sobre quien todavía no llega, y "no marcado" tiene que poder
 * seguir significando "todavía no sé".
 */
export async function markAttendance(
  sessionId: string,
  membershipId: string,
  status: AttendanceStatus,
) {
  const { membership } = await assertSessionOfMyClub(sessionId);

  const athlete = await prisma.teamMembership.findFirst({
    where: { id: membershipId, teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
  });
  if (!athlete) throw new ForbiddenError("Ese socio no es un socio activo de tu club.");

  await prisma.sessionAttendance.upsert({
    where: { sessionId_membershipId: { sessionId, membershipId } },
    create: { sessionId, membershipId, status },
    update: { status, markedAt: new Date() },
  });

  revalidatePath(`/coach/sessions/${sessionId}`);
}

/** Quita la marca: vuelve a "todavía no se pasó lista" para esa persona. */
export async function clearAttendance(sessionId: string, membershipId: string) {
  await assertSessionOfMyClub(sessionId);

  await prisma.sessionAttendance.deleteMany({ where: { sessionId, membershipId } });

  revalidatePath(`/coach/sessions/${sessionId}`);
}
