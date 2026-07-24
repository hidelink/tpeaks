import { z } from "zod";

/**
 * Contrato de la estructura de un entrenamiento (WorkoutTemplate.structure y
 * ScheduledWorkout.structure). Ver docs/PRODUCT_SPEC.md, Paso 4.
 *
 * ScheduledWorkout.structure es un snapshot copiado de WorkoutTemplate.structure
 * al momento de asignar — editar la plantilla después no debe alterar lo ya
 * programado.
 */
export const workoutSegmentSchema = z.object({
  label: z.string().min(1),
  repeat: z.number().int().min(1).default(1),
  distanceMeters: z.number().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  targetPace: z.string().optional(),
  targetRpe: z.number().min(1).max(10).optional(),
  note: z.string().optional(),
});

export const workoutStructureSchema = z.object({
  segments: z.array(workoutSegmentSchema).min(1),
  totalDistanceMeters: z.number().positive().optional(),
});

export type WorkoutSegment = z.infer<typeof workoutSegmentSchema>;
export type WorkoutStructure = z.infer<typeof workoutStructureSchema>;

export function parseWorkoutStructure(value: unknown): WorkoutStructure {
  return workoutStructureSchema.parse(value);
}
