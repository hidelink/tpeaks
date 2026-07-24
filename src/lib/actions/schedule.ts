"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/permissions";
import { parseWorkoutStructureInput, type WorkoutStructure } from "@/lib/workout-structure";

/**
 * Asigna un entrenamiento (desde plantilla o ad hoc) al calendario de un
 * atleta. Si viene de una plantilla, structure se copia como snapshot en
 * ese instante — editar la plantilla después no debe alterar lo ya
 * programado (ver docs/PRODUCT_SPEC.md, Paso 4).
 *
 * Retorna el id creado en vez de hacer redirect() aquí — ver el comentario
 * equivalente en src/lib/actions/templates.ts.
 */
export async function scheduleWorkout(input: {
  athleteMembershipId: string;
  date: string; // "yyyy-MM-dd"
  title: string;
  coachNote?: string;
  templateId?: string;
  structure?: WorkoutStructure;
}) {
  const membership = await requireRole("COACH");

  const athlete = await prisma.teamMembership.findFirst({
    where: { id: input.athleteMembershipId, teamId: membership.teamId, role: "ATHLETE" },
  });
  if (!athlete) throw new ForbiddenError("Ese atleta no es de tu equipo.");

  let structure: WorkoutStructure;
  if (input.templateId) {
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: input.templateId, teamId: membership.teamId },
    });
    if (!template) throw new ForbiddenError("Esa plantilla no es de tu equipo.");
    structure = parseWorkoutStructureInput(template.structure);
  } else {
    structure = parseWorkoutStructureInput(input.structure);
  }

  const workout = await prisma.scheduledWorkout.create({
    data: {
      teamId: membership.teamId,
      athleteMembershipId: athlete.id,
      coachMembershipId: membership.id,
      templateId: input.templateId,
      date: new Date(input.date),
      title: input.title,
      structure,
      coachNote: input.coachNote || undefined,
    },
  });

  revalidatePath("/coach/calendar");
  revalidatePath("/athlete/calendar");
  return { id: workout.id };
}

/**
 * Editar un entrenamiento ya asignado, incluyendo "moverlo" (cambiar la
 * fecha) — es el mismo campo que cualquier otro. Solo afecta esta instancia;
 * si vino de una plantilla, la plantilla no se toca (ver scheduleWorkout).
 */
export async function updateScheduledWorkout(
  scheduledWorkoutId: string,
  input: {
    date: string; // "yyyy-MM-dd"
    title: string;
    coachNote?: string;
    structure: WorkoutStructure;
  },
) {
  const membership = await requireRole("COACH");

  const existing = await prisma.scheduledWorkout.findFirst({
    where: { id: scheduledWorkoutId, teamId: membership.teamId },
  });
  if (!existing) throw new ForbiddenError("Ese entrenamiento no es de tu equipo.");

  const structure = parseWorkoutStructureInput(input.structure);

  await prisma.scheduledWorkout.update({
    where: { id: scheduledWorkoutId },
    data: {
      date: new Date(input.date),
      title: input.title,
      coachNote: input.coachNote || null,
      structure,
    },
  });

  revalidatePath("/coach/calendar");
  revalidatePath("/athlete/calendar");
  revalidatePath(`/workout/${scheduledWorkoutId}`);
  return { id: scheduledWorkoutId };
}

/**
 * Copiar/duplicar: crea un ScheduledWorkout nuevo a partir de uno existente.
 * "Copiar a otro atleta" y "duplicar a otra fecha" son la misma operación —
 * solo cambia si athleteMembershipId apunta al mismo atleta o a otro.
 */
export async function duplicateScheduledWorkout(
  sourceId: string,
  input: { date: string; athleteMembershipId?: string },
) {
  const membership = await requireRole("COACH");

  const source = await prisma.scheduledWorkout.findFirst({
    where: { id: sourceId, teamId: membership.teamId },
  });
  if (!source) throw new ForbiddenError("Ese entrenamiento no es de tu equipo.");

  const targetAthleteId = input.athleteMembershipId ?? source.athleteMembershipId;
  const targetAthlete = await prisma.teamMembership.findFirst({
    where: { id: targetAthleteId, teamId: membership.teamId, role: "ATHLETE" },
  });
  if (!targetAthlete) throw new ForbiddenError("Ese atleta no es de tu equipo.");

  const copy = await prisma.scheduledWorkout.create({
    data: {
      teamId: membership.teamId,
      athleteMembershipId: targetAthlete.id,
      coachMembershipId: membership.id,
      templateId: source.templateId,
      date: new Date(input.date),
      title: source.title,
      structure: source.structure as WorkoutStructure,
      coachNote: source.coachNote,
    },
  });

  revalidatePath("/coach/calendar");
  revalidatePath("/athlete/calendar");
  return { id: copy.id };
}
