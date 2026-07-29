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
import { TrainingPacesList } from "@/components/TrainingPacesList";
import { trainingPaces } from "@/lib/vdot";
import { RUNNING_KM_SPORTS } from "@/lib/sports";
import { clubToday } from "@/lib/club-time";

export default async function AthleteDashboardPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  await assertAthleteTeamAccess(membership.teamId);

  const today = clubToday(membership.team.timezone);
  const { start, end } = getCurrentWeekRange(today);

  const [weekWorkouts, nextWorkout, loadSeries, profile] = await Promise.all([
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
        date: { gte: todayAsUtcMidnight(today) },
      },
      orderBy: { date: "asc" },
    }),
    getWeeklyLoadSeries(membership.id, today),
    // Solo lectura: el resultado de carrera del que salen estos ritmos lo
    // captura el coach, no el atleta.
    prisma.athleteProfile.findUnique({
      where: { membershipId: membership.id },
      select: { vdot: true },
    }),
  ]);

  const completed = weekWorkouts.filter((w) => w.status === "COMPLETED");
  // Ver el comentario equivalente en el dashboard del coach: los km de bici
  // no son comparables con los de correr, así que la métrica es solo de correr.
  const runningKm = completed
    .filter((w) => RUNNING_KM_SPORTS.includes(w.sport))
    .reduce((sum, w) => sum + (w.completion?.distanceKm ?? 0), 0);
  const paces = profile?.vdot == null ? null : trainingPaces(profile.vdot);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {membership.user.name}</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Completados (semana)</p>
          <p className="text-2xl font-semibold">{completed.length}/{weekWorkouts.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Km corriendo</p>
          <p className="text-2xl font-semibold">{runningKm.toFixed(1)}</p>
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

      {paces && (
        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-1 font-medium">Tus ritmos de entrenamiento</h2>
          <p className="mb-4 text-xs text-zinc-500">
            Calculados por tu entrenador a partir de un resultado de carrera reciente. El más
            importante es el fácil: la mayoría de los rodajes deberían ir ahí, y correrlos más
            rápido de la cuenta es el error más común.
          </p>
          <TrainingPacesList paces={paces} />
        </div>
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
