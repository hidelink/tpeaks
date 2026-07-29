import { startOfWeek, subWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toLocalCalendarDate, toQueryBoundary } from "@/lib/calendar-date";

/**
 * Carga de entrenamiento por sRPE (session RPE): RPE (1-10) × duración en
 * minutos, el método estándar de ciencia del deporte cuando no hay datos de
 * reloj/HR (ver conversación de producto — Fase 1 no tiene wearables).
 *
 * Se calcula sobre "carga real" (WorkoutCompletion), no sobre lo planeado:
 * targetRpe por segmento es opcional hoy, así que la carga planeada sería
 * un estimado poco confiable. Si más adelante se vuelve consistente pedir
 * targetRpe al crear entrenamientos, se puede agregar una serie "planeada"
 * en paralelo sin tocar este cálculo.
 *
 * Semana = lunes-domingo, igual que el resto del calendario. La carga se
 * asigna a la semana de ScheduledWorkout.date (el día para el que era el
 * entrenamiento), no a WorkoutCompletion.completedAt (cuándo el atleta
 * mandó el feedback) — así un feedback tardío no distorsiona la semana.
 */
export type WeeklyLoadPoint = {
  weekStart: Date;
  load: number;
  hasData: boolean;
  chronicAvg: number;
};

export async function getWeeklyLoadSeries(
  athleteMembershipId: string,
  /** Día del club (clubToday), no del servidor — ver src/lib/club-time.ts. */
  today: Date,
  weeksBack = 12,
): Promise<WeeklyLoadPoint[]> {
  const now = today;
  const earliestWeekStart = startOfWeek(subWeeks(now, weeksBack - 1), { weekStartsOn: 1 });

  const completions = await prisma.workoutCompletion.findMany({
    where: {
      scheduledWorkout: { athleteMembershipId, date: { gte: toQueryBoundary(earliestWeekStart) } },
      rpe: { not: null },
      durationMinutes: { not: null },
    },
    select: {
      rpe: true,
      durationMinutes: true,
      scheduledWorkout: { select: { date: true } },
    },
  });

  const loadByWeekKey = new Map<string, number>();
  for (const c of completions) {
    const weekStart = startOfWeek(toLocalCalendarDate(c.scheduledWorkout.date), { weekStartsOn: 1 });
    const key = weekStart.toISOString();
    const load = (c.rpe ?? 0) * (c.durationMinutes ?? 0);
    loadByWeekKey.set(key, (loadByWeekKey.get(key) ?? 0) + load);
  }

  const weeks: Omit<WeeklyLoadPoint, "chronicAvg">[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const key = weekStart.toISOString();
    weeks.push({
      weekStart,
      load: loadByWeekKey.get(key) ?? 0,
      hasData: loadByWeekKey.has(key),
    });
  }

  // Promedio móvil de 4 semanas (esta semana + las 3 anteriores) — la
  // referencia "crónica" contra la que se compara cada barra semanal
  // ("aguda") para ver si hubo un pico de carga o una semana de descarga.
  return weeks.map((w, i) => {
    const window = weeks.slice(Math.max(0, i - 3), i + 1);
    const chronicAvg = window.reduce((sum, x) => sum + x.load, 0) / window.length;
    return { ...w, chronicAvg };
  });
}
