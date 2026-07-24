import Link from "next/link";
import { eachDayOfInterval, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getCurrentWeekRange, parseWeekParam, adjacentWeekParams } from "@/lib/dates";

/**
 * Vista semanal con navegación (semana anterior/siguiente/hoy vía ?week=).
 * Mover/copiar/duplicar entrenamientos por drag-and-drop sigue pendiente
 * como mejora futura — hoy "mover" se hace editando la fecha del
 * entrenamiento y "copiar/duplicar" desde su página de detalle.
 */
export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const reference = parseWeekParam(week);
  const { start, end } = getCurrentWeekRange(reference);
  const { previous, next } = adjacentWeekParams(reference);
  const days = eachDayOfInterval({ start, end });

  const workouts = await prisma.scheduledWorkout.findMany({
    where: { teamId: membership.teamId, date: { gte: start, lte: end } },
    include: { athlete: { include: { user: true } } },
    orderBy: { date: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-zinc-500 capitalize">
            {format(start, "d MMM", { locale: es })} – {format(end, "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/coach/calendar?week=${previous}`} className="text-sm underline">
            ← Anterior
          </Link>
          <Link href="/coach/calendar" className="text-sm underline">
            Hoy
          </Link>
          <Link href={`/coach/calendar?week=${next}`} className="text-sm underline">
            Siguiente →
          </Link>
          <Link
            href="/coach/schedule/new"
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Asignar entrenamiento
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {days.map((day) => {
          const dateParam = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`rounded-xl border p-3 ${isToday ? "border-zinc-900" : "border-zinc-200"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium capitalize">
                  {format(day, "EEEE d", { locale: es })}
                </p>
                <Link
                  href={`/coach/schedule/new?date=${dateParam}`}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  + Agregar
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {workouts
                  .filter((w) => isSameDay(w.date, day))
                  .map((w) => (
                    <Link
                      key={w.id}
                      href={`/workout/${w.id}`}
                      className="rounded-lg bg-zinc-100 px-2 py-1 text-xs"
                    >
                      <p className="font-medium">{w.title}</p>
                      <p className="text-zinc-500">{w.athlete.user.name}</p>
                    </Link>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
