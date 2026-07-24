import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { parseWorkoutStructure } from "@/lib/workout-structure";
import { CompletionForm } from "./CompletionForm";
import { CommentForm } from "./CommentForm";

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const workout = await prisma.scheduledWorkout.findFirst({
    where: { id, teamId: membership.teamId },
    include: {
      athlete: { include: { user: true } },
      completion: true,
      comments: { include: { coach: { include: { user: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!workout) notFound();

  // Un atleta solo puede ver su propio entrenamiento, aunque sea del mismo equipo.
  if (membership.role === "ATHLETE" && workout.athleteMembershipId !== membership.id) {
    notFound();
  }

  const structure = parseWorkoutStructure(workout.structure);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm text-zinc-500">{format(workout.date, "EEEE d MMMM")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{workout.title}</h1>
        {membership.role === "COACH" && (
          <p className="text-sm text-zinc-500">Atleta: {workout.athlete.user.name}</p>
        )}
        <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
          {workout.status}
        </span>
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Estructura</h2>
        <ol className="flex flex-col gap-2">
          {structure.segments.map((s, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">
                {s.repeat > 1 ? `${s.repeat}x ` : ""}
                {s.label}
              </span>
              {s.distanceMeters && ` — ${s.distanceMeters}m`}
              {s.durationSeconds && ` — ${Math.round(s.durationSeconds / 60)}min`}
              {s.targetPace && ` @ ${s.targetPace}`}
              {s.note && <p className="text-zinc-500">{s.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      {workout.coachNote && (
        <section className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="mb-1 font-medium">Nota del coach</h2>
          <p>{workout.coachNote}</p>
        </section>
      )}

      {workout.completion ? (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 font-medium">Feedback del atleta</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Duración</dt>
            <dd>{workout.completion.durationMinutes ?? "—"} min</dd>
            <dt className="text-zinc-500">Distancia</dt>
            <dd>{workout.completion.distanceKm ?? "—"} km</dd>
            <dt className="text-zinc-500">Ritmo percibido</dt>
            <dd>{workout.completion.perceivedPace ?? "—"}</dd>
            <dt className="text-zinc-500">RPE</dt>
            <dd>{workout.completion.rpe ?? "—"}</dd>
          </dl>
          {workout.completion.athleteComment && (
            <p className="mt-2 text-sm">&quot;{workout.completion.athleteComment}&quot;</p>
          )}
        </section>
      ) : (
        membership.role === "ATHLETE" && <CompletionForm scheduledWorkoutId={workout.id} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Comentarios del coach</h2>
        {workout.comments.length === 0 && (
          <p className="text-sm text-zinc-500">Sin comentarios todavía.</p>
        )}
        <ul className="flex flex-col gap-2">
          {workout.comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-zinc-100 p-2 text-sm dark:bg-zinc-900">
              <span className="font-medium">{c.coach.user.name}: </span>
              {c.comment}
            </li>
          ))}
        </ul>
        {membership.role === "COACH" && <CommentForm scheduledWorkoutId={workout.id} />}
      </section>
    </div>
  );
}
