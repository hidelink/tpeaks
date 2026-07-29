import Link from "next/link";
import { eachDayOfInterval, format, isSameDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import {
  getCurrentWeekRange,
  getMonthGridRange,
  parseDateParam,
  adjacentWeekParams,
  adjacentMonthParams,
} from "@/lib/dates";
import { buildCalendarHref, type CalendarView } from "@/lib/calendar-url";
import { toLocalCalendarDate, toQueryBoundary } from "@/lib/calendar-date";
import { CalendarFilterBar } from "@/components/CalendarFilterBar";
import { sportMeta } from "@/lib/sports";
import { can } from "@/lib/roles";
import { clubToday } from "@/lib/club-time";

/**
 * Vista semanal o mensual (?view=week|month), con navegación y filtros por
 * atleta / texto en el título. Mover/copiar/duplicar entrenamientos sigue
 * siendo por botones explícitos, no drag-and-drop — ver docs/PRODUCT_SPEC.md.
 */
export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; athleteId?: string; q?: string }>;
}) {
  const { date, view: viewParam, athleteId, q } = await searchParams;
  const view: CalendarView = viewParam === "month" ? "month" : "week";
  const membership = await getCurrentMembership();
  if (!membership) return null;
  // El calendario lo ve cualquiera del staff, pero asignar es de quien entrena.
  const canTrain = can(membership.role, "MANAGE_TRAINING");

  const today = clubToday(membership.team.timezone);
  const reference = parseDateParam(date, today);

  const range =
    view === "week"
      ? getCurrentWeekRange(reference)
      : (() => {
          const { gridStart, gridEnd } = getMonthGridRange(reference);
          return { start: gridStart, end: gridEnd };
        })();

  const monthInfo = view === "month" ? getMonthGridRange(reference) : null;
  const days = eachDayOfInterval(range);

  const [athletes, workouts] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scheduledWorkout.findMany({
      where: {
        teamId: membership.teamId,
        date: { gte: toQueryBoundary(range.start), lte: toQueryBoundary(range.end) },
        athleteMembershipId: athleteId || undefined,
        title: q ? { contains: q, mode: "insensitive" } : undefined,
      },
      include: { athlete: { include: { user: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const { previous: prevWeek, next: nextWeek } = adjacentWeekParams(reference);
  const { previous: prevMonth, next: nextMonth } = adjacentMonthParams(reference);
  const previous = view === "week" ? prevWeek : prevMonth;
  const next = view === "week" ? nextWeek : nextMonth;

  const hrefFor = (overrides: { date?: string; view?: CalendarView }) =>
    buildCalendarHref("/coach/calendar", { date, view, athleteId, q, ...overrides });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-zinc-500 capitalize">
            {view === "week"
              ? `${format(range.start, "d MMM", { locale: es })} – ${format(range.end, "d MMM yyyy", { locale: es })}`
              : format(reference, "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-zinc-300 p-0.5 text-sm">
            <Link
              href={hrefFor({ view: "week" })}
              className={`rounded-full px-3 py-1 ${view === "week" ? "bg-[var(--team-accent)] text-white" : ""}`}
            >
              Semana
            </Link>
            <Link
              href={hrefFor({ view: "month" })}
              className={`rounded-full px-3 py-1 ${view === "month" ? "bg-[var(--team-accent)] text-white" : ""}`}
            >
              Mes
            </Link>
          </div>
          <Link href={hrefFor({ date: previous })} className="text-sm underline">
            ← Anterior
          </Link>
          <Link href={hrefFor({ date: undefined })} className="text-sm underline">
            Hoy
          </Link>
          <Link href={hrefFor({ date: next })} className="text-sm underline">
            Siguiente →
          </Link>
          {canTrain && (
            <Link
              href="/coach/schedule/new"
              className="rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Asignar entrenamiento
            </Link>
          )}
        </div>
      </div>

      <CalendarFilterBar
        basePath="/coach/calendar"
        date={date}
        view={view}
        athleteId={athleteId}
        q={q}
        athletes={athletes.map((a) => ({ id: a.id, name: a.user.name }))}
      />

      {view === "month" && (
        <div className="hidden grid-cols-7 gap-4 text-center text-xs font-medium text-zinc-500 sm:grid">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {days.map((day) => {
          const dateParam = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, today);
          const dimmed = monthInfo ? !isSameMonth(day, monthInfo.monthStart) : false;
          const dayWorkouts = workouts.filter((w) => isSameDay(toLocalCalendarDate(w.date), day));
          const visible = view === "month" ? dayWorkouts.slice(0, 2) : dayWorkouts;
          const overflow = view === "month" ? dayWorkouts.length - visible.length : 0;

          return (
            <div
              key={day.toISOString()}
              className={`rounded-xl border p-3 ${isToday ? "border-zinc-900" : "border-zinc-200"} ${dimmed ? "opacity-40" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium capitalize">
                  {format(day, view === "week" ? "EEEE d" : "d", { locale: es })}
                </p>
                {canTrain && (
                  <Link
                    href={`/coach/schedule/new?date=${dateParam}`}
                    className="text-xs text-zinc-500 hover:underline"
                  >
                    + Agregar
                  </Link>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {visible.map((w) => (
                  <Link
                    key={w.id}
                    href={`/workout/${w.id}`}
                    className="rounded-lg bg-zinc-100 px-2 py-1 text-xs"
                  >
                    <p className="truncate font-medium">
                      <span aria-hidden>{sportMeta(w.sport).icon}</span> {w.title}
                    </p>
                    <p className="truncate text-zinc-500">{w.athlete.user.name}</p>
                  </Link>
                ))}
                {overflow > 0 && (
                  <Link
                    href={hrefFor({ date: dateParam, view: "week" })}
                    className="text-xs text-zinc-500 underline"
                  >
                    +{overflow} más
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
