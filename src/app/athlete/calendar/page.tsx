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
import { toLocalCalendarDate } from "@/lib/calendar-date";
import { CalendarFilterBar } from "@/components/CalendarFilterBar";
import { assertAthleteTeamAccess } from "@/lib/subscription-gate";

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; q?: string }>;
}) {
  const { date, view: viewParam, q } = await searchParams;
  const view: CalendarView = viewParam === "month" ? "month" : "week";
  const membership = await getCurrentMembership();
  if (!membership) return null;
  await assertAthleteTeamAccess(membership.teamId);

  const reference = parseDateParam(date);

  const range =
    view === "week"
      ? getCurrentWeekRange(reference)
      : (() => {
          const { gridStart, gridEnd } = getMonthGridRange(reference);
          return { start: gridStart, end: gridEnd };
        })();

  const monthInfo = view === "month" ? getMonthGridRange(reference) : null;
  const days = eachDayOfInterval(range);

  const workouts = await prisma.scheduledWorkout.findMany({
    where: {
      athleteMembershipId: membership.id,
      date: { gte: range.start, lte: range.end },
      title: q ? { contains: q, mode: "insensitive" } : undefined,
    },
    orderBy: { date: "asc" },
  });

  const { previous: prevWeek, next: nextWeek } = adjacentWeekParams(reference);
  const { previous: prevMonth, next: nextMonth } = adjacentMonthParams(reference);
  const previous = view === "week" ? prevWeek : prevMonth;
  const next = view === "week" ? nextWeek : nextMonth;

  const hrefFor = (overrides: { date?: string; view?: CalendarView }) =>
    buildCalendarHref("/athlete/calendar", { date, view, q, ...overrides });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi calendario</h1>
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
              className={`rounded-full px-3 py-1 ${view === "week" ? "bg-black text-white" : ""}`}
            >
              Semana
            </Link>
            <Link
              href={hrefFor({ view: "month" })}
              className={`rounded-full px-3 py-1 ${view === "month" ? "bg-black text-white" : ""}`}
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
        </div>
      </div>

      <CalendarFilterBar basePath="/athlete/calendar" date={date} view={view} q={q} />

      {view === "month" && (
        <div className="hidden grid-cols-7 gap-4 text-center text-xs font-medium text-zinc-500 sm:grid">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {days.map((day) => {
          const isToday = isSameDay(day, new Date());
          const dimmed = monthInfo ? !isSameMonth(day, monthInfo.monthStart) : false;
          const dayWorkouts = workouts.filter((w) => isSameDay(toLocalCalendarDate(w.date), day));
          const visible = view === "month" ? dayWorkouts.slice(0, 2) : dayWorkouts;
          const overflow = view === "month" ? dayWorkouts.length - visible.length : 0;
          const dateParam = format(day, "yyyy-MM-dd");

          return (
            <div
              key={day.toISOString()}
              className={`rounded-xl border p-3 ${isToday ? "border-zinc-900" : "border-zinc-200"} ${dimmed ? "opacity-40" : ""}`}
            >
              <p className="mb-2 text-sm font-medium capitalize">
                {format(day, view === "week" ? "EEEE d" : "d", { locale: es })}
              </p>
              <div className="flex flex-col gap-2">
                {visible.map((w) => (
                  <Link
                    key={w.id}
                    href={`/workout/${w.id}`}
                    className="rounded-lg bg-zinc-100 px-2 py-1 text-xs"
                  >
                    <p className="truncate font-medium">{w.title}</p>
                    <p className="text-zinc-500">{w.status}</p>
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
