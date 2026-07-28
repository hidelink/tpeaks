import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { parseWorkoutStructure } from "@/lib/workout-structure";
import { toLocalCalendarDate } from "@/lib/calendar-date";
import { EditWorkoutForm } from "./EditWorkoutForm";

export default async function EditScheduledWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "COACH") notFound();

  const workout = await prisma.scheduledWorkout.findFirst({
    where: { id, teamId: membership.teamId },
    include: { athlete: { include: { user: true, athleteProfile: true } } },
  });
  if (!workout) notFound();

  const vdot = workout.athlete.athleteProfile?.vdot ?? null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar entrenamiento</h1>
        <p className="text-sm text-zinc-500">Atleta: {workout.athlete.user.name}</p>
      </div>
      <EditWorkoutForm
        workoutId={workout.id}
        vdot={vdot}
        initial={{
          date: format(toLocalCalendarDate(workout.date), "yyyy-MM-dd"),
          title: workout.title,
          sport: workout.sport,
          coachNote: workout.coachNote ?? undefined,
          structure: parseWorkoutStructure(workout.structure),
        }}
      />
    </div>
  );
}
