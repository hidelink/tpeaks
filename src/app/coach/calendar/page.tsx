import Link from "next/link";
import { eachDayOfInterval, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getCurrentWeekRange } from "@/lib/dates";

/**
 * Vista semanal. Mover/copiar/duplicar entrenamientos por drag-and-drop es
 * "should have" — ver docs/PRODUCT_SPEC.md, Paso 8 — y se construye en la
 * siguiente iteración sobre esta base. Crear/asignar ya funciona.
 */
export default async function CoachCalendarPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const { start, end } = getCurrentWeekRange();
  const days = eachDayOfInterval({ start, end });

  const workouts = await prisma.scheduledWorkout.findMany({
    where: { teamId: membership.teamId, date: { gte: start, lte: end } },
    include: { athlete: { include: { user: true } } },
    orderBy: { date: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
        <Link
          href="/coach/schedule/new"
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Asignar entrenamiento
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {days.map((day) => {
          const dateParam = format(day, "yyyy-MM-dd");
          return (
            <div
              key={day.toISOString()}
              className="rounded-xl border border-zinc-200 p-3"
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
