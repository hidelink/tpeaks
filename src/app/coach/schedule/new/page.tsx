import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { ScheduleForm } from "./ScheduleForm";

export default async function NewScheduledWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; athleteId?: string }>;
}) {
  const { date, athleteId } = await searchParams;
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const [athletes, templates] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
      include: { user: true, athleteProfile: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workoutTemplate.findMany({
      where: { teamId: membership.teamId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Asignar entrenamiento</h1>
      {athletes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Necesitas al menos un atleta activo en tu equipo antes de poder asignar entrenamientos.
        </p>
      ) : (
        <ScheduleForm
          athletes={athletes.map((a) => ({
            id: a.id,
            name: a.user.name,
            vdot: a.athleteProfile?.vdot ?? null,
          }))}
          templates={templates.map((t) => ({ id: t.id, title: t.title, sport: t.sport }))}
          defaultDate={date ?? format(new Date(), "yyyy-MM-dd")}
          defaultAthleteId={athleteId}
        />
      )}
    </div>
  );
}
