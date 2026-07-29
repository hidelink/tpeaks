import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isValid,
  parseISO,
} from "date-fns";

/**
 * Semana lunes-domingo, usada para las métricas de cumplimiento semanal.
 *
 * `reference` es obligatorio a propósito: cuando tenía `= new Date()` por
 * default, el día salía de la zona horaria del proceso (UTC en Vercel) y la
 * semana cambiaba seis horas antes para un club mexicano. Pásale
 * clubToday(team.timezone).
 */
export function getCurrentWeekRange(reference: Date) {
  return {
    start: startOfWeek(reference, { weekStartsOn: 1 }),
    end: endOfWeek(reference, { weekStartsOn: 1 }),
  };
}

/**
 * Convierte el query param ?date=yyyy-MM-dd (usado para navegar entre
 * semanas/meses en el calendario) en una fecha de referencia. Cualquier día
 * dentro de la semana/mes deseado sirve — getCurrentWeekRange/getMonthGridRange
 * ya normalizan. Si el param falta o es inválido, usa `today` — que debe venir
 * de clubToday(team.timezone), no de new Date().
 */
export function parseDateParam(param: string | undefined, today: Date): Date {
  if (!param) return today;
  const parsed = parseISO(param);
  return isValid(parsed) ? parsed : today;
}

export function adjacentWeekParams(reference: Date) {
  return {
    previous: formatDateParam(subWeeks(reference, 1)),
    next: formatDateParam(addWeeks(reference, 1)),
  };
}

/**
 * La cuadrícula de un mes en un calendario siempre muestra semanas
 * completas (lunes-domingo), así que gridStart/gridEnd pueden incluir días
 * del mes anterior/siguiente — monthStart/monthEnd sirven para saber cuáles
 * días "no cuentan" y deben verse atenuados.
 */
export function getMonthGridRange(reference: Date) {
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  return {
    monthStart,
    monthEnd,
    gridStart: startOfWeek(monthStart, { weekStartsOn: 1 }),
    gridEnd: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  };
}

export function adjacentMonthParams(reference: Date) {
  return {
    previous: formatDateParam(subMonths(reference, 1)),
    next: formatDateParam(addMonths(reference, 1)),
  };
}

function formatDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}
