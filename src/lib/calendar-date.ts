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
 *
 * `today` es obligatorio: tiene que venir de clubToday(team.timezone). Cuando
 * esta función llamaba a new Date() por su cuenta, "hoy" era el día del
 * servidor (UTC en Vercel), no el del club.
 */
export function todayAsUtcMidnight(today: Date): Date {
  return toQueryBoundary(today);
}

/**
 * Convierte cualquier Date calculado en hora LOCAL (ej. startOfWeek/endOfWeek/
 * startOfMonth de date-fns) a medianoche UTC de ese mismo día calendario —
 * la forma correcta de construir límites `gte`/`lte` para comparar contra
 * ScheduledWorkout.date. Sin esto, un `endOfWeek` local (23:59:59.999 local)
 * cae en la madrugada del día calendario SIGUIENTE en UTC en cualquier
 * timezone detrás de UTC, y Prisma lo trunca a esa fecha — el rango de
 * "esta semana" termina incluyendo el lunes de la semana que sigue.
 * Confirmado empíricamente: sin esto, una semana con un entrenamiento ya
 * programado para el lunes siguiente lo cuenta de más en las métricas.
 */
export function toQueryBoundary(localDate: Date): Date {
  return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));
}
