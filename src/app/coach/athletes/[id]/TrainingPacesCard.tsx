"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateAthleteRaceResult,
  clearAthleteRaceResult,
} from "@/lib/actions/athlete-profile";
import { parseRaceTime, formatRaceTime, formatPace, type TrainingPaces } from "@/lib/vdot";

/**
 * Distancias más comunes. "Otra" deja escribir metros a mano — hay carreras
 * de 8k, 15k, 12k... que no vale la pena listar todas.
 */
const DISTANCES = [
  { label: "1500 m", meters: 1500 },
  { label: "3000 m", meters: 3000 },
  { label: "5 km", meters: 5000 },
  { label: "10 km", meters: 10000 },
  { label: "Media maratón", meters: 21097 },
  { label: "Maratón", meters: 42195 },
];

function distanceLabel(meters: number) {
  return DISTANCES.find((d) => d.meters === meters)?.label ?? `${(meters / 1000).toFixed(2)} km`;
}

export function TrainingPacesCard({
  athleteMembershipId,
  raceDistanceMeters,
  raceTimeSeconds,
  vdot,
  paces,
}: {
  athleteMembershipId: string;
  raceDistanceMeters: number | null;
  raceTimeSeconds: number | null;
  vdot: number | null;
  paces: TrainingPaces | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isKnownDistance =
    raceDistanceMeters !== null && DISTANCES.some((d) => d.meters === raceDistanceMeters);

  const [distance, setDistance] = useState<string>(
    raceDistanceMeters === null ? "5000" : isKnownDistance ? String(raceDistanceMeters) : "custom",
  );
  const [customMeters, setCustomMeters] = useState(
    raceDistanceMeters !== null && !isKnownDistance ? String(raceDistanceMeters) : "",
  );
  const [time, setTime] = useState(raceTimeSeconds ? formatRaceTime(raceTimeSeconds) : "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const meters = distance === "custom" ? Number(customMeters) : Number(distance);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError("Escribe la distancia en metros.");
      return;
    }

    const seconds = parseRaceTime(time);
    if (seconds === null) {
      setError("Escribe el tiempo como MM:SS o H:MM:SS (ej. 42:15 o 1:32:40).");
      return;
    }

    startTransition(async () => {
      try {
        await updateAthleteRaceResult(athleteMembershipId, meters, seconds);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function onClear() {
    setError(null);
    startTransition(async () => {
      try {
        await clearAthleteRaceResult(athleteMembershipId);
        setTime("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo borrar.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h2 className="mb-1 font-medium">Ritmos de entrenamiento</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Se calculan a partir de un resultado de carrera reciente (modelo VDOT de Jack Daniels).
        Entre más reciente y más a fondo la carrera, mejor la estimación.
      </p>

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Distancia
          <select
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
          >
            {DISTANCES.map((d) => (
              <option key={d.meters} value={d.meters}>
                {d.label}
              </option>
            ))}
            <option value="custom">Otra...</option>
          </select>
        </label>

        {distance === "custom" && (
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Metros
            <input
              type="number"
              value={customMeters}
              onChange={(e) => setCustomMeters(e.target.value)}
              placeholder="8000"
              className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Tiempo
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="42:15"
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[var(--team-accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Calculando..." : "Calcular ritmos"}
        </button>

        {vdot !== null && (
          <button
            type="button"
            onClick={onClear}
            disabled={isPending}
            className="text-xs text-zinc-500 underline disabled:opacity-50"
          >
            Borrar
          </button>
        )}
      </form>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {vdot !== null && paces !== null && (
        <div className="mt-5">
          <p className="mb-3 text-sm">
            <span className="font-medium">VDOT {vdot.toFixed(1)}</span>
            {raceDistanceMeters !== null && raceTimeSeconds !== null && (
              <span className="text-zinc-500">
                {" "}
                — {distanceLabel(raceDistanceMeters)} en {formatRaceTime(raceTimeSeconds)}
              </span>
            )}
          </p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <PaceRow
              label="Fácil / rodaje"
              value={`${formatPace(paces.easy.fastSecPerKm)} – ${formatPace(paces.easy.slowSecPerKm)}`}
            />
            <PaceRow label="Maratón" value={formatPace(paces.marathon)} />
            <PaceRow label="Umbral" value={formatPace(paces.threshold)} />
            <PaceRow label="Intervalo" value={formatPace(paces.interval)} />
            <PaceRow label="Repetición" value={formatPace(paces.repetition)} />
          </dl>

          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Estos ritmos solo aplican en plano — pista, asfalto, terreno estable. En trail el
            desnivel y el terreno cambian el costo del mismo esfuerzo, así que ahí conviene
            prescribir por RPE o por duración en vez de por ritmo.
          </p>
        </div>
      )}
    </div>
  );
}

function PaceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
