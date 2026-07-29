"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { parseWorkoutStructure, parseWorkoutStructureInput, type WorkoutStructure } from "@/lib/workout-structure";
import type { WorkoutSport } from "@/generated/prisma/enums";

/**
 * Asigna un entrenamiento (desde plantilla o ad hoc) al calendario de uno o
 * varios atletas a la vez — el caso de uso real de un coach con equipo:
 * "esta serie del martes, para todo mi grupo de fondo". Si viene de una
 * plantilla, structure se copia como snapshot en ese instante — editar la
 * plantilla después no debe alterar lo ya programado (ver
 * docs/PRODUCT_SPEC.md, Paso 4). Un solo WorkoutTemplate/structure, un
 * ScheduledWorkout independiente por atleta (cada quien completa/comenta el
 * suyo por separado).
 *
 * Retorna los ids creados en vez de hacer redirect() aquí — ver el
 * comentario equivalente en src/lib/actions/templates.ts.
 */
export async function scheduleWorkoutToMany(input: {
  athleteMembershipIds: string[];
  date: string; // "yyyy-MM-dd"
  title: string;
  coachNote?: string;
  templateId?: string;
  sport?: WorkoutSport;
  structure?: WorkoutStructure;
}) {
  const membership = await requireCapability("MANAGE_TRAINING");

  if (input.athleteMembershipIds.length === 0) {
    throw new ForbiddenError("Selecciona al menos un atleta.");
  }

  // status ACTIVE, no solo "del club": la interfaz solo ofrece socios activos,
  // así que aceptar a un dado de baja significaba que un id viejo (de un chip
  // de grupo desactualizado o de un formulario reenviado) le programaba
  // entrenamientos a alguien que ya se fue.
  const athletes = await prisma.teamMembership.findMany({
    where: {
      id: { in: input.athleteMembershipIds },
      teamId: membership.teamId,
      role: "ATHLETE",
      status: "ACTIVE",
    },
  });
  if (athletes.length !== input.athleteMembershipIds.length) {
    throw new ForbiddenError("Alguno de esos atletas no es un socio activo de tu club.");
  }

  let structure: WorkoutStructure;
  // El deporte, igual que structure, se copia de la plantilla como snapshot:
  // cambiar la plantilla después no debe reescribir lo ya asignado.
  let sport: WorkoutSport;
  if (input.templateId) {
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: input.templateId, teamId: membership.teamId },
    });
    if (!template) throw new ForbiddenError("Esa plantilla no es de tu equipo.");
    structure = parseWorkoutStructureInput(template.structure);
    sport = template.sport;
  } else {
    structure = parseWorkoutStructureInput(input.structure);
    sport = input.sport ?? "RUN";
  }

  const date = new Date(input.date);

  const created = await prisma.$transaction(
    athletes.map((athlete) =>
      prisma.scheduledWorkout.create({
        data: {
          teamId: membership.teamId,
          athleteMembershipId: athlete.id,
          coachMembershipId: membership.id,
          templateId: input.templateId,
          date,
          title: input.title,
          sport,
          structure,
          coachNote: input.coachNote || undefined,
        },
      }),
    ),
  );

  revalidatePath("/coach/calendar");
  revalidatePath("/athlete/calendar");
  return { ids: created.map((w) => w.id), date: input.date };
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
    sport: WorkoutSport;
    coachNote?: string;
    structure: WorkoutStructure;
  },
) {
  const membership = await requireCapability("MANAGE_TRAINING");

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
      sport: input.sport,
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
  const membership = await requireCapability("MANAGE_TRAINING");

  const source = await prisma.scheduledWorkout.findFirst({
    where: { id: sourceId, teamId: membership.teamId },
  });
  if (!source) throw new ForbiddenError("Ese entrenamiento no es de tu equipo.");

  const targetAthleteId = input.athleteMembershipId ?? source.athleteMembershipId;
  const targetAthlete = await prisma.teamMembership.findFirst({
    where: { id: targetAthleteId, teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
  });
  if (!targetAthlete) throw new ForbiddenError("Ese atleta no es un socio activo de tu club.");

  const copy = await prisma.scheduledWorkout.create({
    data: {
      teamId: membership.teamId,
      athleteMembershipId: targetAthlete.id,
      coachMembershipId: membership.id,
      templateId: source.templateId,
      date: new Date(input.date),
      title: source.title,
      sport: source.sport,
      structure: parseWorkoutStructure(source.structure),
      coachNote: source.coachNote,
    },
  });

  revalidatePath("/coach/calendar");
  revalidatePath("/athlete/calendar");
  return { id: copy.id };
}
