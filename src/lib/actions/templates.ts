"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, ForbiddenError } from "@/lib/permissions";
import { parseWorkoutStructureInput, type WorkoutStructure } from "@/lib/workout-structure";
import type { WorkoutSport } from "@/generated/prisma/enums";

/**
 * El formulario marca el título como `required`, pero una Server Action es un
 * endpoint público: lo que valide el cliente no cuenta.
 */
function cleanTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("La plantilla necesita un título.");
  if (trimmed.length > 120) throw new Error("El título es demasiado largo.");
  return trimmed;
}

/**
 * Retorna el id creado en vez de hacer redirect() aquí: esta acción se
 * invoca como una función normal desde un Client Component (no un <form
 * action=...>), y redirect() lanza un error especial que un try/catch en el
 * cliente terminaría atrapando como si fuera un fallo real. La navegación
 * la hace el cliente con router.push tras un resultado exitoso.
 */
export async function createWorkoutTemplate(input: {
  title: string;
  description?: string;
  sport: WorkoutSport;
  tags: string[];
  structure: WorkoutStructure;
}) {
  const membership = await requireCapability("MANAGE_TRAINING");
  const title = cleanTitle(input.title);
  const structure = parseWorkoutStructureInput(input.structure);

  const template = await prisma.workoutTemplate.create({
    data: {
      teamId: membership.teamId,
      createdById: membership.userId,
      title,
      description: input.description?.trim() || undefined,
      sport: input.sport,
      tags: input.tags,
      structure,
    },
  });

  revalidatePath("/coach/templates");
  return { id: template.id };
}

/**
 * Editar una plantilla NO afecta entrenamientos ya asignados desde ella —
 * ScheduledWorkout.structure es un snapshot independiente copiado al
 * momento de asignar (ver docs/PRODUCT_SPEC.md, Paso 4).
 */
export async function updateWorkoutTemplate(
  templateId: string,
  input: {
    title: string;
    description?: string;
    sport: WorkoutSport;
    tags: string[];
    structure: WorkoutStructure;
  },
) {
  const membership = await requireCapability("MANAGE_TRAINING");
  const title = cleanTitle(input.title);
  const structure = parseWorkoutStructureInput(input.structure);

  const existing = await prisma.workoutTemplate.findFirst({
    where: { id: templateId, teamId: membership.teamId },
  });
  if (!existing) throw new ForbiddenError("Esa plantilla no es de tu equipo.");

  await prisma.workoutTemplate.update({
    where: { id: templateId },
    data: {
      title,
      description: input.description?.trim() || null,
      sport: input.sport,
      tags: input.tags,
      structure,
    },
  });

  revalidatePath("/coach/templates");
  return { id: templateId };
}

/**
 * Borrar una plantilla no afecta entrenamientos ya asignados desde ella:
 * ScheduledWorkout.templateId es ON DELETE SET NULL (ver migration.sql) y
 * structure ya es un snapshot independiente — el entrenamiento programado
 * sigue existiendo tal cual, solo pierde el vínculo a la plantilla borrada.
 */
export async function deleteWorkoutTemplate(templateId: string) {
  const membership = await requireCapability("MANAGE_TRAINING");

  const existing = await prisma.workoutTemplate.findFirst({
    where: { id: templateId, teamId: membership.teamId },
  });
  if (!existing) throw new ForbiddenError("Esa plantilla no es de tu equipo.");

  await prisma.workoutTemplate.delete({ where: { id: templateId } });

  revalidatePath("/coach/templates");
}
