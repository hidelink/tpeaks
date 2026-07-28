import type { WorkoutSport } from "@/generated/prisma/enums";

/**
 * Qué significa cada tipo de sesión para la UI. La estructura de un
 * entrenamiento (segmentos con duración/RPE/nota) siempre sirvió para
 * cualquier deporte; lo único que hacía falta era saber qué campos tienen
 * sentido enseñar y qué cuenta como kilometraje de carrera.
 *
 * Deliberadamente NO hay campos por deporte (series/reps/peso para fuerza,
 * potencia para bici). Ver docs/PRODUCT_SPEC.md: se prefirió empezar por la
 * etiqueta y añadir campos solo cuando el uso real lo pida — agregar campos
 * opcionales al contrato Zod después es aditivo y no rompe lo ya guardado.
 */
export type SportMeta = {
  value: WorkoutSport;
  label: string;
  icon: string;
  /** ¿Tiene sentido pedir una distancia? En fuerza y movilidad, no. */
  usesDistance: boolean;
  /** ¿Tiene sentido pedir un ritmo objetivo? */
  usesPace: boolean;
  /** Placeholder del campo de ritmo — "4:30/km" no significa nada en bici. */
  paceHint: string;
  /**
   * Placeholder de la etiqueta del segmento. En fuerza es donde se escriben
   * las series/reps/peso mientras no sean campos propios, así que el ejemplo
   * tiene que enseñar el formato esperado.
   */
  labelHint: string;
  /**
   * ¿Se le pueden sugerir los ritmos calculados del atleta? Solo correr en
   * plano: el VDOT no se traduce a trail, bici ni natación (ver src/lib/vdot.ts).
   */
  suggestsPaces: boolean;
  /** ¿Sus kilómetros cuentan en la métrica "km corriendo"? */
  countsAsRunningKm: boolean;
};

export const SPORTS: SportMeta[] = [
  {
    value: "RUN",
    label: "Correr",
    icon: "🏃",
    usesDistance: true,
    usesPace: true,
    paceHint: "Ej. 4:30/km",
    labelHint: "Ej. Serie 1, Calentamiento...",
    suggestsPaces: true,
    countsAsRunningKm: true,
  },
  {
    value: "TRAIL_RUN",
    label: "Trail",
    icon: "⛰️",
    usesDistance: true,
    usesPace: true,
    // El campo sigue ahí por si el coach quiere anotar algo, pero sin
    // sugerencias: en trail el ritmo no es una unidad de esfuerzo comparable.
    paceHint: "Mejor por sensación o tiempo",
    labelHint: "Ej. Subida sostenida, Bajada técnica...",
    suggestsPaces: false,
    countsAsRunningKm: true,
  },
  {
    value: "BIKE",
    label: "Bici",
    icon: "🚴",
    usesDistance: true,
    usesPace: true,
    paceHint: "Ej. 30 km/h o 200 W",
    labelHint: "Ej. Bloque zona 2, Sprint...",
    suggestsPaces: false,
    countsAsRunningKm: false,
  },
  {
    value: "SWIM",
    label: "Natación",
    icon: "🏊",
    usesDistance: true,
    usesPace: true,
    paceHint: "Ej. 1:45/100m",
    labelHint: "Ej. 8x100 crol, Técnica...",
    suggestsPaces: false,
    countsAsRunningKm: false,
  },
  {
    value: "STRENGTH",
    label: "Fuerza",
    icon: "🏋️",
    usesDistance: false,
    usesPace: false,
    paceHint: "",
    labelHint: "Ej. Sentadilla 4x8 @ 70 kg",
    suggestsPaces: false,
    countsAsRunningKm: false,
  },
  {
    value: "MOBILITY",
    label: "Movilidad",
    icon: "🧘",
    usesDistance: false,
    usesPace: false,
    paceHint: "",
    labelHint: "Ej. Movilidad de cadera",
    suggestsPaces: false,
    countsAsRunningKm: false,
  },
  {
    value: "OTHER",
    label: "Otro",
    icon: "•",
    usesDistance: true,
    usesPace: true,
    paceHint: "",
    labelHint: "Ej. Bloque 1",
    suggestsPaces: false,
    countsAsRunningKm: false,
  },
];

const BY_VALUE = new Map(SPORTS.map((s) => [s.value, s]));

export function sportMeta(sport: WorkoutSport): SportMeta {
  const meta = BY_VALUE.get(sport);
  // El enum de Prisma y SPORTS se mantienen a mano en sincronía; si algún día
  // se agrega un valor y se olvida aquí, es mejor fallar que renderizar vacío.
  if (!meta) throw new Error(`Deporte sin metadata en src/lib/sports.ts: ${sport}`);
  return meta;
}

/**
 * Agrupa por deporte respetando el orden de SPORTS (correr primero, "otro" al
 * final) y omitiendo los grupos vacíos — así la lista de plantillas siempre
 * sale en el mismo orden sin importar en qué orden se crearon.
 */
export function groupBySport<T extends { sport: WorkoutSport }>(
  items: T[],
): { meta: SportMeta; items: T[] }[] {
  return SPORTS.map((meta) => ({ meta, items: items.filter((i) => i.sport === meta.value) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Para filtrar en Prisma la métrica de km corriendo. */
export const RUNNING_KM_SPORTS: WorkoutSport[] = SPORTS.filter((s) => s.countsAsRunningKm).map(
  (s) => s.value,
);
