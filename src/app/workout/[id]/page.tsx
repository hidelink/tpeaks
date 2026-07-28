import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { parseWorkoutStructure } from "@/lib/workout-structure";
import { toLocalCalendarDate } from "@/lib/calendar-date";
import { CompletionForm } from "./CompletionForm";
import { CommentForm } from "./CommentForm";
import { DuplicateWorkoutForm } from "./DuplicateWorkoutForm";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Programado", className: "bg-blue-50 text-blue-700" },
  COMPLETED: { label: "Completado", className: "bg-green-50 text-green-700" },
  MISSED: { label: "No realizado", className: "bg-red-50 text-red-700" },
  SKIPPED: { label: "Omitido", className: "bg-zinc-100 text-zinc-600" },
};

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

  const athletes =
    membership.role === "COACH"
      ? await prisma.teamMembership.findMany({
          where: { teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
          include: { user: true },
        })
      : [];

  const structure = parseWorkoutStructure(workout.structure);
  const status = STATUS_STYLES[workout.status] ?? STATUS_STYLES.PLANNED;
  const localDate = toLocalCalendarDate(workout.date);

  const totalDistanceMeters = structure.segments.reduce(
    (sum, s) => sum + (s.distanceMeters ?? 0) * s.repeat,
    0,
  );
  const totalDurationSeconds = structure.segments.reduce(
    (sum, s) => sum + (s.durationSeconds ?? 0) * s.repeat,
    0,
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 capitalize">
            {format(localDate, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{workout.title}</h1>
          {membership.role === "COACH" && (
            <p className="mt-1 text-sm text-zinc-500">Atleta: {workout.athlete.user.name}</p>
          )}
          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {membership.role === "COACH" && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              href={`/coach/schedule/new?date=${format(localDate, "yyyy-MM-dd")}&athleteId=${workout.athleteMembershipId}`}
              className="rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium whitespace-nowrap text-white"
            >
              + Asignar otro
            </Link>
            <Link href={`/workout/${workout.id}/edit`} className="text-xs underline">
              Editar
            </Link>
          </div>
        )}
      </div>

      {(totalDistanceMeters > 0 || totalDurationSeconds > 0) && (
        <div className="flex gap-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4">
          {totalDistanceMeters > 0 && (
            <div>
              <p className="text-xs text-zinc-500">Distancia total</p>
              <p className="text-lg font-semibold">{(totalDistanceMeters / 1000).toFixed(1)} km</p>
            </div>
          )}
          {totalDurationSeconds > 0 && (
            <div>
              <p className="text-xs text-zinc-500">Duración estimada</p>
              <p className="text-lg font-semibold">{Math.round(totalDurationSeconds / 60)} min</p>
            </div>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 p-5">
        <h2 className="mb-4 font-medium">Estructura</h2>
        <ol className="flex flex-col gap-3">
          {structure.segments.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">
                  {s.repeat > 1 ? `${s.repeat}x ` : ""}
                  {s.label || "Segmento"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.distanceMeters && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {s.distanceMeters}m
                    </span>
                  )}
                  {s.durationSeconds && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {Math.round(s.durationSeconds / 60)} min
                    </span>
                  )}
                  {s.targetPace && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      @ {s.targetPace}
                    </span>
                  )}
                </div>
                {s.note && <p className="mt-1 text-sm text-zinc-500">{s.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {workout.coachNote && (
        <section className="rounded-2xl border border-zinc-200 p-5 text-sm">
          <h2 className="mb-1 font-medium">Nota del coach</h2>
          <p>{workout.coachNote}</p>
        </section>
      )}

      {workout.completion ? (
        <section className="rounded-2xl border border-zinc-200 p-5">
          <h2 className="mb-3 font-medium">Feedback del atleta</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
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
            <p className="mt-3 text-sm italic text-zinc-600">
              &quot;{workout.completion.athleteComment}&quot;
            </p>
          )}
        </section>
      ) : membership.role === "ATHLETE" ? (
        <CompletionForm scheduledWorkoutId={workout.id} />
      ) : (
        <section className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          Este entrenamiento todavía no ha sido completado por el atleta. Cuando lo marque como
          hecho, aquí verás su feedback (duración, distancia, ritmo percibido, RPE y comentario).
        </section>
      )}

      {membership.role === "COACH" && (
        <DuplicateWorkoutForm
          workoutId={workout.id}
          athletes={athletes.map((a) => ({ id: a.id, name: a.user.name }))}
          defaultAthleteId={workout.athleteMembershipId}
          defaultDate={format(localDate, "yyyy-MM-dd")}
        />
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Comentarios del coach</h2>
          <p className="text-xs text-zinc-500">Visibles para el atleta en este entrenamiento.</p>
        </div>
        {workout.comments.length === 0 && (
          <p className="text-sm text-zinc-500">Sin comentarios todavía.</p>
        )}
        <ul className="flex flex-col gap-2">
          {workout.comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-zinc-100 px-3 py-2 text-sm">
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
