/**
 * ScheduledWorkout.date es una columna `@db.Date` en Postgres — Prisma la
 * devuelve como un Date de JS anclado a medianoche UTC. El resto de la app
 * usa date-fns con getters LOCALES (format, isSameDay, startOfWeek...). En
 * cualquier timezone detrás de UTC (todo el continente americano), leer ese
 * valor con getters locales lo muestra/agrupa un día antes del que
 * realmente es — confirmado empíricamente al construir esta función.
 *
 * Esta función reconstruye la misma fecha calendario pero anclada a
 * medianoche LOCAL, para que el resto del código (que sí opera en local)
 * la lea correctamente sin importar el timezone del servidor. Úsala en
 * cualquier lugar donde un valor `date` que viene de la base de datos entre
 * a una función de date-fns que no sea explícitamente UTC — nunca hace
 * falta para valores que ya vienen de un input del usuario (esos ya se
 * parsean/formatean en local de forma consistente).
 */
export function toLocalCalendarDate(dbDate: Date): Date {
  return new Date(dbDate.getUTCFullYear(), dbDate.getUTCMonth(), dbDate.getUTCDate());
}

/**
 * "Hoy" expresado como medianoche UTC del día calendario local — el mismo
 * formato en el que se guardan los valores `date` (ver scheduleWorkout:
 * `new Date("yyyy-MM-dd")` siempre parsea como medianoche UTC). Úsala para
 * comparar contra ScheduledWorkout.date en queries de Prisma; NUNCA
 * `new Date(new Date().toDateString())` — ese string legacy se parsea en
 * hora LOCAL y queda 6 horas (o lo que sea el offset) después de la
 * medianoche UTC real, excluyendo por error los entrenamientos de hoy.
 */
export function todayAsUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
