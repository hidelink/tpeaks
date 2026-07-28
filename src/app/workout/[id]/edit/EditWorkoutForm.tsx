"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentEditor } from "@/components/SegmentEditor";
import { updateScheduledWorkout } from "@/lib/actions/schedule";
import type { WorkoutSegment, WorkoutStructure } from "@/lib/workout-structure";
import { trainingPaces } from "@/lib/vdot";
import { SportSelect } from "@/components/SportSelect";
import type { WorkoutSport } from "@/generated/prisma/enums";

export function EditWorkoutForm({
  workoutId,
  initial,
  vdot,
}: {
  workoutId: string;
  initial: {
    date: string;
    title: string;
    sport: WorkoutSport;
    coachNote?: string;
    structure: WorkoutStructure;
  };
  /** VDOT del atleta dueño de este entrenamiento, si el coach ya lo capturó. */
  vdot: number | null;
}) {
  const paces = vdot === null ? null : trainingPaces(vdot);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(initial.date);
  const [title, setTitle] = useState(initial.title);
  const [sport, setSport] = useState<WorkoutSport>(initial.sport);
  const [coachNote, setCoachNote] = useState(initial.coachNote ?? "");
  const [segments, setSegments] = useState<WorkoutSegment[]>(initial.structure.segments);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateScheduledWorkout(workoutId, {
          date,
          title,
          sport,
          coachNote: coachNote || undefined,
          structure: { segments },
        });
        router.push(`/workout/${workoutId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Fecha
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Título
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <SportSelect value={sport} onChange={setSport} />

      <label className="flex flex-col gap-1 text-sm">
        Nota para el atleta (opcional)
        <textarea
          value={coachNote}
          onChange={(e) => setCoachNote(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Segmentos</p>
        <SegmentEditor
          segments={segments}
          onChange={(segs) => {
            setSegments(segs);
            setError(null);
          }}
          paces={paces}
          sport={sport}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || segments.length === 0}
        className="self-start rounded-full bg-[var(--team-accent)] px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
