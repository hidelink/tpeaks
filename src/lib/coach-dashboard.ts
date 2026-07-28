import { startOfDay, startOfWeek, subWeeks, differenceInCalendarDays } from "date-fns";
import { toLocalCalendarDate } from "@/lib/calendar-date";

/**
 * Lógica pura del dashboard del coach. Las queries viven en la página; aquí
 * solo van los cálculos, para poder probarlos sin base de datos.
 */

export type ComplianceCount = {
  /** Entrenamientos que ya vencieron dentro de la semana (excluye hoy). */
  due: number;
  completed: number;
  /** null cuando no hay nada vencido todavía — un 0% de lunes sería mentira. */
  rate: number | null;
};

/**
 * Cumplimiento de la semana medido SOLO sobre lo que ya venció.
 *
 * La versión anterior dividía entre todos los entrenamientos de la semana,
 * incluidos los de días que aún no llegan: un martes con 9 sesiones
 * programadas y 1 hecha daba 11%, cuando de esas 9 solo 2 habían vencido.
 * El número bajaba a casi cero cada lunes y saltaba el domingo, así que no
 * medía cumplimiento sino cuánto de la semana había transcurrido.
 *
 * Hoy se excluye a propósito: la sesión de hoy todavía se puede hacer en la
 * tarde, y marcarla como incumplida a las 9 de la mañana es injusto.
 */
export function weeklyCompliance(
  workouts: { date: Date; status: string }[],
  today: Date,
): ComplianceCount {
  const cutoff = startOfDay(today);
  const due = workouts.filter((w) => toLocalCalendarDate(w.date) < cutoff);
  const completed = due.filter((w) => w.status === "COMPLETED");

  return {
    due: due.length,
    completed: completed.length,
    rate: due.length === 0 ? null : Math.round((completed.length / due.length) * 100),
  };
}

/** Días desde el último entrenamiento registrado; null si nunca registró uno. */
export function daysSinceLastActivity(lastCompletedDate: Date | null, today: Date): number | null {
  if (!lastCompletedDate) return null;
  return differenceInCalendarDays(startOfDay(today), toLocalCalendarDate(lastCompletedDate));
}

export type AthleteActivity = { id: string; name: string; lastCompletedDate: Date | null };

export type InactiveAthlete = { id: string; name: string; daysSince: number | null };

/**
 * Atletas que llevan demasiado sin registrar nada. Los que nunca registraron
 * uno también cuentan — es el caso más fácil de que se te pierda un atleta
 * recién invitado que nunca arrancó.
 */
export function pickInactiveAthletes(
  athletes: AthleteActivity[],
  today: Date,
  thresholdDays = 10,
): InactiveAthlete[] {
  return athletes
    .map((a) => ({ id: a.id, name: a.name, daysSince: daysSinceLastActivity(a.lastCompletedDate, today) }))
    .filter((a) => a.daysSince === null || a.daysSince >= thresholdDays)
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
}

export type LoadRow = {
  athleteMembershipId: string;
  date: Date;
  rpe: number | null;
  durationMinutes: number | null;
};

/**
 * Carga sRPE de esta semana y de la anterior, por atleta — la misma métrica
 * de la gráfica (RPE × minutos), agrupada en memoria a partir de una sola
 * query en vez de una por atleta.
 */
export function loadByAthlete(
  rows: LoadRow[],
  today: Date,
): Map<string, { thisWeek: number; lastWeek: number }> {
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 }).getTime();
  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }).getTime();
  const result = new Map<string, { thisWeek: number; lastWeek: number }>();

  for (const row of rows) {
    const weekStart = startOfWeek(toLocalCalendarDate(row.date), { weekStartsOn: 1 }).getTime();
    // Cualquier otra semana se ignora: la comparación es esta contra la
    // anterior, no "todo lo viejo" contra esta.
    if (weekStart !== thisWeekStart && weekStart !== lastWeekStart) continue;

    const bucket = result.get(row.athleteMembershipId) ?? { thisWeek: 0, lastWeek: 0 };
    const load = (row.rpe ?? 0) * (row.durationMinutes ?? 0);

    if (weekStart === thisWeekStart) bucket.thisWeek += load;
    else bucket.lastWeek += load;

    result.set(row.athleteMembershipId, bucket);
  }

  return result;
}
