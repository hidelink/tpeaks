export type CalendarView = "week" | "month";

/** Construye la URL de una vista de calendario preservando los filtros activos. */
export function buildCalendarHref(
  basePath: string,
  params: { date?: string; view?: CalendarView; athleteId?: string; q?: string },
) {
  const sp = new URLSearchParams();
  if (params.date) sp.set("date", params.date);
  if (params.view) sp.set("view", params.view);
  if (params.athleteId) sp.set("athleteId", params.athleteId);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
