/**
 * Validación del feedback que manda un socio al marcar un entrenamiento.
 *
 * No existía: la acción pasaba lo que llegara directo a Prisma. El problema no
 * es teórico — el RPE se MULTIPLICA por la duración para calcular la carga de
 * entrenamiento (src/lib/training-load.ts), así que un RPE de 100 aplasta la
 * escala de la gráfica y deja las demás semanas visualmente en cero. Y un RPE
 * ≥ 8 dispara el panel "Requiere tu atención" del coach.
 *
 * Los límites superiores son detectores de dedazo, no reglas deportivas: nadie
 * entrena 30 horas ni corre 900 km en una sesión, así que si llega eso es un
 * error de captura y es mejor rechazarlo que ensuciar las métricas del club.
 */
export type CompletionFeedback = {
  durationMinutes?: number;
  distanceKm?: number;
  perceivedPace?: string;
  rpe?: number;
  athleteComment?: string;
};

/** Escala estándar de RPE, la misma que documenta el schema. */
const RPE_MIN = 1;
const RPE_MAX = 10;
const MAX_MINUTES = 24 * 60;
const MAX_KM = 500;
const MAX_TEXT = 2000;
const MAX_PACE = 40;

function optionalInt(value: number | undefined, field: string, min: number, max: number) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error(`${field}: escribe un número.`);
  if (!Number.isInteger(value)) throw new Error(`${field}: debe ser un número entero.`);
  if (value < min || value > max) throw new Error(`${field}: debe estar entre ${min} y ${max}.`);
  return value;
}

function optionalText(value: string | undefined, field: string, max: number) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new Error(`${field}: máximo ${max} caracteres.`);
  return trimmed;
}

export function parseCompletionFeedback(input: CompletionFeedback): CompletionFeedback {
  const distanceKm =
    input.distanceKm === undefined
      ? undefined
      : (() => {
          if (!Number.isFinite(input.distanceKm)) throw new Error("Distancia: escribe un número.");
          if (input.distanceKm! <= 0 || input.distanceKm! > MAX_KM) {
            throw new Error(`Distancia: debe estar entre 0 y ${MAX_KM} km.`);
          }
          // Dos decimales bastan y evita basura tipo 5.000000001 del input.
          return Math.round(input.distanceKm! * 100) / 100;
        })();

  return {
    durationMinutes: optionalInt(input.durationMinutes, "Duración", 1, MAX_MINUTES),
    distanceKm,
    rpe: optionalInt(input.rpe, "RPE", RPE_MIN, RPE_MAX),
    perceivedPace: optionalText(input.perceivedPace, "Ritmo percibido", MAX_PACE),
    athleteComment: optionalText(input.athleteComment, "Comentario", MAX_TEXT),
  };
}
