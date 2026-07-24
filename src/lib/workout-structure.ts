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

const SEGMENT_FIELD_LABELS: Record<string, string> = {
  label: "Etiqueta",
  repeat: "Repeticiones",
  distanceMeters: "Distancia",
  durationSeconds: "Duración",
  targetPace: "Ritmo objetivo",
  targetRpe: "RPE",
  note: "Nota",
};

/**
 * Igual que parseWorkoutStructure, pero convierte el ZodError crudo en un
 * mensaje legible en español para mostrar directo en la UI (ver
 * src/lib/actions/templates.ts y schedule.ts).
 */
export function parseWorkoutStructureInput(value: unknown): WorkoutStructure {
  const result = workoutStructureSchema.safeParse(value);
  if (result.success) return result.data;

  const messages = result.error.issues.map((issue) => {
    const segmentIndex = issue.path[1];
    const field = issue.path[2];
    if (typeof segmentIndex !== "number") return issue.message;
    const label = typeof field === "string" ? (SEGMENT_FIELD_LABELS[field] ?? field) : "segmento";
    return `Segmento ${segmentIndex + 1} — ${label}: ${issue.message}`;
  });

  throw new Error(messages.join(" · "));
}
