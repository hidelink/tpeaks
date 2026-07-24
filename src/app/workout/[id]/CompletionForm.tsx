"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markWorkoutCompleted } from "@/lib/actions/workouts";

export function CompletionForm({ scheduledWorkoutId }: { scheduledWorkoutId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [durationMinutes, setDurationMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [perceivedPace, setPerceivedPace] = useState("");
  const [rpe, setRpe] = useState("");
  const [athleteComment, setAthleteComment] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await markWorkoutCompleted(scheduledWorkoutId, {
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        distanceKm: distanceKm ? Number(distanceKm) : undefined,
        perceivedPace: perceivedPace || undefined,
        rpe: rpe ? Number(rpe) : undefined,
        athleteComment: athleteComment || undefined,
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-medium">Marcar como completado</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Duración (min)
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Distancia (km)
          <input
            type="number"
            step="0.1"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ritmo percibido
          <input
            type="text"
            placeholder="5:30/km"
            value={perceivedPace}
            onChange={(e) => setPerceivedPace(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          RPE (1-10)
          <input
            type="number"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Comentario
        <textarea
          value={athleteComment}
          onChange={(e) => setAthleteComment(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Guardando..." : "Completar"}
      </button>
    </form>
  );
}
