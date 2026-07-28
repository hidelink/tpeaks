"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";

/**
 * El atleta marca su propio entrenamiento como completado + feedback manual.
 * Server-side ownership check: el scheduledWorkout debe pertenecer a la
 * membresía del usuario autenticado — nunca confiar en el id del formulario.
 */
export async function markWorkoutCompleted(
  scheduledWorkoutId: string,
  feedback: {
    durationMinutes?: number;
    distanceKm?: number;
    perceivedPace?: string;
    rpe?: number;
    athleteComment?: string;
  },
) {
  const membership = await requireCapability("LOG_OWN_TRAINING");

  const workout = await prisma.scheduledWorkout.findFirst({
    where: { id: scheduledWorkoutId, athleteMembershipId: membership.id },
  });
  if (!workout) throw new ForbiddenError("Este entrenamiento no es tuyo.");

  await prisma.$transaction([
    prisma.workoutCompletion.create({
      data: { scheduledWorkoutId, ...feedback },
    }),
    prisma.scheduledWorkout.update({
      where: { id: scheduledWorkoutId },
      data: { status: "COMPLETED" },
    }),
  ]);

  revalidatePath(`/workout/${scheduledWorkoutId}`);
  revalidatePath("/athlete/calendar");
  revalidatePath("/coach");
}

/**
 * El coach comenta un entrenamiento (completado o no) de un atleta de su
 * propio equipo.
 */
export async function addCoachComment(scheduledWorkoutId: string, comment: string) {
  const membership = await requireCapability("MANAGE_TRAINING");

  const workout = await prisma.scheduledWorkout.findFirst({
    where: { id: scheduledWorkoutId, teamId: membership.teamId },
  });
  if (!workout) throw new ForbiddenError("Este entrenamiento no es de tu equipo.");

  await prisma.coachComment.create({
    data: { scheduledWorkoutId, coachMembershipId: membership.id, comment },
  });

  revalidatePath(`/workout/${scheduledWorkoutId}`);
}
