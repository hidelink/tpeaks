"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { parseWorkoutStructureInput, type WorkoutStructure } from "@/lib/workout-structure";

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
  tags: string[];
  structure: WorkoutStructure;
}) {
  const membership = await requireRole("COACH");
  const structure = parseWorkoutStructureInput(input.structure);

  const template = await prisma.workoutTemplate.create({
    data: {
      teamId: membership.teamId,
      createdById: membership.userId,
      title: input.title,
      description: input.description || undefined,
      tags: input.tags,
      structure,
    },
  });

  revalidatePath("/coach/templates");
  return { id: template.id };
}
