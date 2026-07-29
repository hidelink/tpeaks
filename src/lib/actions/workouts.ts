"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { parseCompletionFeedback, type CompletionFeedback } from "@/lib/workout-completion";

/**
 * El atleta marca su propio entrenamiento como completado + feedback manual.
 * Server-side ownership check: el scheduledWorkout debe pertenecer a la
 * membresía del usuario autenticado — nunca confiar en el id del formulario.
 */
export async function markWorkoutCompleted(
  scheduledWorkoutId: string,
  feedback: CompletionFeedback,
) {
  const membership = await requireCapability("LOG_OWN_TRAINING");

  // Validar ANTES de tocar la base: el RPE se multiplica por la duración en la
  // carga de entrenamiento, así que un valor absurdo no solo guarda basura,
  // deforma la gráfica de todo el bloque. Ver src/lib/workout-completion.ts.
  const clean = parseCompletionFeedback(feedback);

  const workout = await prisma.scheduledWorkout.findFirst({
    where: { id: scheduledWorkoutId, athleteMembershipId: membership.id },
  });
  if (!workout) throw new ForbiddenError("Este entrenamiento no es tuyo.");

  // WorkoutCompletion.scheduledWorkoutId es @unique: sin esta comprobación, un
  // segundo envío (doble clic, o volver atrás y reenviar) revienta con un error
  // crudo de Prisma en la cara del socio.
  if (workout.status === "COMPLETED") {
    throw new Error("Este entrenamiento ya estaba marcado como completado.");
  }

  await prisma.$transaction([
    prisma.workoutCompletion.create({
      data: { scheduledWorkoutId, ...clean },
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

  const text = comment.trim();
  if (!text) throw new Error("El comentario no puede estar vacío.");
  if (text.length > 2000) throw new Error("El comentario es demasiado largo.");

  const workout = await prisma.scheduledWorkout.findFirst({
    where: { id: scheduledWorkoutId, teamId: membership.teamId },
  });
  if (!workout) throw new ForbiddenError("Este entrenamiento no es de tu equipo.");

  await prisma.coachComment.create({
    data: { scheduledWorkoutId, coachMembershipId: membership.id, comment: text },
  });

  revalidatePath(`/workout/${scheduledWorkoutId}`);
}
