import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getWeeklyLoadSeries } from "@/lib/training-load";
import { TrainingLoadChart } from "@/components/TrainingLoadChart";
import { toLocalCalendarDate } from "@/lib/calendar-date";
import { PrivateNoteForm } from "./PrivateNoteForm";

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return null;

  // Scoped a membership.teamId: un coach nunca debe poder ver el atleta de
  // otro equipo aunque adivine el id.
  const athlete = await prisma.teamMembership.findFirst({
    where: { id, teamId: membership.teamId, role: "ATHLETE" },
    include: { user: true, athleteProfile: true },
  });

  if (!athlete) notFound();

  const [history, loadSeries] = await Promise.all([
    prisma.scheduledWorkout.findMany({
      where: { athleteMembershipId: athlete.id },
      include: { completion: true },
      orderBy: { date: "desc" },
      take: 20,
    }),
    getWeeklyLoadSeries(athlete.id, 8),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{athlete.user.name}</h1>
        <p className="text-sm text-zinc-500">{athlete.user.email}</p>
      </div>

      <PrivateNoteForm
        athleteMembershipId={athlete.id}
        initialNote={athlete.athleteProfile?.coachPrivateNote ?? ""}
      />

      <div className="rounded-xl border border-zinc-200 p-4">
        <h2 className="mb-1 font-medium">Carga de entrenamiento</h2>
        <p className="mb-4 text-xs text-zinc-500">
          RPE × duración de cada entrenamiento completado, sumado por semana (últimas 8).
        </p>
        <TrainingLoadChart data={loadSeries} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Historial</h2>
        <ul className="divide-y divide-zinc-200">
          {history.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/workout/${w.id}`} className="font-medium underline">
                  {w.title}
                </Link>
                <p className="text-sm text-zinc-500">
                  {format(toLocalCalendarDate(w.date), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <span className="text-sm text-zinc-500">
                {w.status === "COMPLETED"
                  ? `${w.completion?.distanceKm ?? "?"} km`
                  : w.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
