import { startOfWeek, endOfWeek, addWeeks, subWeeks, isValid, parseISO } from "date-fns";

/** Semana lunes-domingo, usada para las métricas de cumplimiento semanal. */
export function getCurrentWeekRange(reference = new Date()) {
  return {
    start: startOfWeek(reference, { weekStartsOn: 1 }),
    end: endOfWeek(reference, { weekStartsOn: 1 }),
  };
}

/**
 * Convierte el query param ?week=yyyy-MM-dd (usado para navegar entre
 * semanas en el calendario) en una fecha de referencia. Cualquier día
 * dentro de la semana deseada sirve — getCurrentWeekRange ya normaliza a
 * lunes-domingo. Si el param falta o es inválido, usa hoy.
 */
export function parseWeekParam(param?: string): Date {
  if (!param) return new Date();
  const parsed = parseISO(param);
  return isValid(parsed) ? parsed : new Date();
}

export function adjacentWeekParams(reference: Date) {
  return {
    previous: formatWeekParam(subWeeks(reference, 1)),
    next: formatWeekParam(addWeeks(reference, 1)),
  };
}

function formatWeekParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}
