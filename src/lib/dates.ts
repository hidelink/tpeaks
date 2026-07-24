import { startOfWeek, endOfWeek } from "date-fns";

/** Semana lunes-domingo, usada para las métricas de cumplimiento semanal. */
export function getCurrentWeekRange(reference = new Date()) {
  return {
    start: startOfWeek(reference, { weekStartsOn: 1 }),
    end: endOfWeek(reference, { weekStartsOn: 1 }),
  };
}
