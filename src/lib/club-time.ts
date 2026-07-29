/**
 * "Hoy" según el club, no según el servidor.
 *
 * Todo el cálculo de calendario de la app usa funciones locales de date-fns
 * (`startOfWeek`, `startOfDay`, `differenceInCalendarDays`), que leen la zona
 * horaria del PROCESO. En local eso era America/Mexico_City y todo cuadraba;
 * en Vercel el proceso corre en UTC. Resultado: a las 18:00 de México el
 * servidor ya cree que es mañana, y a partir de esa hora
 *
 *   - el cumplimiento cuenta como vencidas las sesiones de hoy,
 *   - la comparación de carga mete un día de más en el término anterior,
 *   - "próximo entrenamiento" se salta el de hoy,
 *   - el calendario resalta el día equivocado.
 *
 * Se detectó porque el dashboard mostraba −72% donde el cálculo local daba
 * +53%: eran dos días distintos, no dos fórmulas distintas.
 *
 * La zona es del CLUB y no de la app: un club en Bogotá y otro en Ciudad de
 * México cierran su día en momentos distintos. Vive en Team.timezone.
 */
export const DEFAULT_CLUB_TIMEZONE = "America/Mexico_City";

/**
 * El día calendario que el club está viviendo ahora mismo, como Date anclado a
 * medianoche LOCAL del proceso — la misma convención que `toLocalCalendarDate`,
 * para que se pueda pasar directo a las funciones de date-fns que ya usamos.
 *
 * `instant` existe solo para poder probar esto sin relojes falsos.
 */
export function clubToday(timeZone: string, instant: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  return new Date(get("year"), get("month") - 1, get("day"));
}

/**
 * Una zona inválida en la base (escrita a mano, o de un import) haría que
 * Intl lance y tumbe la página entera. Mejor caer al default: mostrar el día
 * equivocado por unas horas es mucho menos grave que un dashboard en blanco.
 */
function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_CLUB_TIMEZONE;
  }
}
