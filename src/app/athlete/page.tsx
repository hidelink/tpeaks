import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getCurrentWeekRange } from "@/lib/dates";
import { toLocalCalendarDate, todayAsUtcMidnight, toQueryBoundary } from "@/lib/calendar-date";
import { assertAthleteTeamAccess } from "@/lib/subscription-gate";
import { getWeeklyLoadSeries } from "@/lib/training-load";
import { TrainingLoadChart } from "@/components/TrainingLoadChart";

export default async function AthleteDashboardPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  await assertAthleteTeamAccess(membership.teamId);

  const { start, end } = getCurrentWeekRange();

  const [weekWorkouts, nextWorkout, loadSeries] = await Promise.all([
    prisma.scheduledWorkout.findMany({
      where: {
        athleteMembershipId: membership.id,
        date: { gte: toQueryBoundary(start), lte: toQueryBoundary(end) },
      },
      include: { completion: true },
    }),
    prisma.scheduledWorkout.findFirst({
      where: {
        athleteMembershipId: membership.id,
        status: "PLANNED",
        date: { gte: todayAsUtcMidnight() },
      },
      orderBy: { date: "asc" },
    }),
    getWeeklyLoadSeries(membership.id),
  ]);

  const completed = weekWorkouts.filter((w) => w.status === "COMPLETED");
  const totalKm = completed.reduce((sum, w) => sum + (w.completion?.distanceKm ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {membership.user.name}</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Completados (semana)</p>
          <p className="text-2xl font-semibold">{completed.length}/{weekWorkouts.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Km semanales</p>
          <p className="text-2xl font-semibold">{totalKm.toFixed(1)}</p>
        </div>
      </div>

      {nextWorkout && (
        <Link
          href={`/workout/${nextWorkout.id}`}
          className="rounded-xl border border-zinc-200 p-4"
        >
          <p className="text-sm text-zinc-500">Próximo entrenamiento</p>
          <p className="font-medium">{nextWorkout.title}</p>
          <p className="text-sm text-zinc-500 capitalize">
            {format(toLocalCalendarDate(nextWorkout.date), "EEEE d MMMM", { locale: es })}
          </p>
        </Link>
      )}

      <div className="rounded-xl border border-zinc-200 p-4">
        <h2 className="mb-1 font-medium">Carga de entrenamiento</h2>
        <p className="mb-4 text-xs text-zinc-500">
          RPE × duración de cada entrenamiento completado, sumado por semana.
        </p>
        <TrainingLoadChart data={loadSeries} />
      </div>
    </div>
  );
}
