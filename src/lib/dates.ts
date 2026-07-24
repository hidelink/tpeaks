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

/** Semana lunes-domingo, usada para las métricas de cumplimiento semanal. */
export function getCurrentWeekRange(reference = new Date()) {
  return {
    start: startOfWeek(reference, { weekStartsOn: 1 }),
    end: endOfWeek(reference, { weekStartsOn: 1 }),
  };
}

/**
 * Convierte el query param ?date=yyyy-MM-dd (usado para navegar entre
 * semanas/meses en el calendario) en una fecha de referencia. Cualquier día
 * dentro de la semana/mes deseado sirve — getCurrentWeekRange/getMonthGridRange
 * ya normalizan. Si el param falta o es inválido, usa hoy.
 */
export function parseDateParam(param?: string): Date {
  if (!param) return new Date();
  const parsed = parseISO(param);
  return isValid(parsed) ? parsed : new Date();
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
