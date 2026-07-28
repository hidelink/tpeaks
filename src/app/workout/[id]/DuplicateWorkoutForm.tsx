"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateScheduledWorkout } from "@/lib/actions/schedule";

/**
 * "Copiar a otro atleta" y "duplicar a otra fecha" son la misma acción acá
 * — el coach elige el atleta destino (por defecto el mismo) y la fecha.
 */
export function DuplicateWorkoutForm({
  workoutId,
  athletes,
  defaultAthleteId,
  defaultDate,
}: {
  workoutId: string;
  athletes: { id: string; name: string }[];
  defaultAthleteId: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [athleteMembershipId, setAthleteMembershipId] = useState(defaultAthleteId);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium"
      >
        Duplicar / copiar
      </button>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await duplicateScheduledWorkout(workoutId, { date, athleteMembershipId });
        router.push(`/workout/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4">
      <p className="text-sm font-medium">Duplicar este entrenamiento</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Atleta
          <select
            value={athleteMembershipId}
            onChange={(e) => setAthleteMembershipId(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          >
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Duplicando..." : "Duplicar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
