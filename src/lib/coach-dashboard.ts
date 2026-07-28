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

export type AthleteLoad = {
  /** Carga acumulada de esta semana hasta hoy. */
  thisWeek: number;
  /** La misma porción de la semana pasada — el único término comparable. */
  lastWeekToDate: number;
  /** La semana pasada completa, como contexto de a dónde va la actual. */
  lastWeekTotal: number;
};

/**
 * Carga sRPE por atleta — la misma métrica de la gráfica (RPE × minutos),
 * agrupada en memoria a partir de una sola query en vez de una por atleta.
 *
 * La comparación se hace contra la MISMA porción de la semana pasada, no
 * contra la semana pasada completa. Comparar un lunes contra siete días
 * siempre da un desplome enorme: en datos reales, un atleta que iba 184 contra
 * 120 en el mismo punto (+53%, subiendo carga) se mostraba como −93% contra el
 * total de 2698. No era impreciso, apuntaba al lado contrario.
 *
 * Hoy sí cuenta de los dos lados: la sesión de hoy ya hecha es carga real, y
 * se compara contra ese mismo día de la semana pasada.
 */
export function loadByAthlete(rows: LoadRow[], today: Date): Map<string, AthleteLoad> {
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const elapsedDays = differenceInCalendarDays(startOfDay(today), thisWeekStart);
  const result = new Map<string, AthleteLoad>();

  for (const row of rows) {
    const date = toLocalCalendarDate(row.date);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const isThisWeek = weekStart.getTime() === thisWeekStart.getTime();
    const isLastWeek = weekStart.getTime() === lastWeekStart.getTime();
    // Cualquier otra semana se ignora: la comparación es esta contra la
    // anterior, no "todo lo viejo" contra esta.
    if (!isThisWeek && !isLastWeek) continue;

    const bucket =
      result.get(row.athleteMembershipId) ?? { thisWeek: 0, lastWeekToDate: 0, lastWeekTotal: 0 };
    const load = (row.rpe ?? 0) * (row.durationMinutes ?? 0);

    if (isThisWeek) {
      bucket.thisWeek += load;
    } else {
      bucket.lastWeekTotal += load;
      if (differenceInCalendarDays(date, lastWeekStart) <= elapsedDays) {
        bucket.lastWeekToDate += load;
      }
    }

    result.set(row.athleteMembershipId, bucket);
  }

  return result;
}
