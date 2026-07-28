"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentEditor } from "@/components/SegmentEditor";
import { scheduleWorkoutToMany } from "@/lib/actions/schedule";
import type { WorkoutSegment } from "@/lib/workout-structure";
import { trainingPaces } from "@/lib/vdot";

export function ScheduleForm({
  athletes,
  templates,
  defaultDate,
  defaultAthleteId,
}: {
  athletes: { id: string; name: string; vdot: number | null }[];
  templates: { id: string; title: string }[];
  defaultDate: string;
  defaultAthleteId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [athleteMembershipIds, setAthleteMembershipIds] = useState<string[]>(
    defaultAthleteId ? [defaultAthleteId] : [],
  );
  const [date, setDate] = useState(defaultDate);
  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [segments, setSegments] = useState<WorkoutSegment[]>([{ label: "", repeat: 1 }]);

  // Los ritmos son de una persona: solo tienen sentido si hay exactamente un
  // atleta seleccionado. Con varios, cada quien tiene el suyo y ofrecer uno
  // sería prescribirle a todos el del primero.
  const selectedAthlete =
    athleteMembershipIds.length === 1
      ? athletes.find((a) => a.id === athleteMembershipIds[0])
      : undefined;
  const paces = selectedAthlete?.vdot != null ? trainingPaces(selectedAthlete.vdot) : null;

  function toggleAthlete(id: string) {
    setAthleteMembershipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await scheduleWorkoutToMany({
          athleteMembershipIds,
          date,
          title: title || templates.find((t) => t.id === templateId)?.title || "Entrenamiento",
          coachNote: coachNote || undefined,
          templateId: templateId || undefined,
          structure: templateId ? undefined : { segments },
        });
        if (result.ids.length === 1) {
          router.push(`/workout/${result.ids[0]}`);
        } else {
          router.push(`/coach/calendar?date=${result.date}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">Atletas</label>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setAthleteMembershipIds(athletes.map((a) => a.id))}
              className="underline"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => setAthleteMembershipIds([])}
              className="underline"
            >
              Ninguno
            </button>
          </div>
        </div>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-zinc-300 p-2">
          {athletes.map((a) => (
            <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={athleteMembershipIds.includes(a.id)}
                onChange={() => toggleAthlete(a.id)}
              />
              {a.name}
            </label>
          ))}
        </div>
      </div>

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
        Plantilla (opcional — déjalo en blanco para crear uno nuevo)
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          <option value="">— En blanco —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Título
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={templates.find((t) => t.id === templateId)?.title || "Ej. Fondo suave 8km"}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nota para el atleta (opcional)
        <textarea
          value={coachNote}
          onChange={(e) => setCoachNote(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      {!templateId && (
        <div>
          <p className="mb-2 text-sm font-medium">Segmentos</p>
          <SegmentEditor
            segments={segments}
            onChange={(segs) => {
              setSegments(segs);
              setError(null);
            }}
            paces={paces}
          />
          {athleteMembershipIds.length > 1 && (
            <p className="mt-2 text-xs text-zinc-500">
              Los ritmos calculados no se ofrecen al asignar a varios atletas a la vez — cada
              quien tiene el suyo. Asigna de uno en uno si quieres ritmos personalizados.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || athleteMembershipIds.length === 0}
        className="self-start rounded-full bg-[var(--team-accent)] px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending
          ? "Guardando..."
          : athleteMembershipIds.length === 0
            ? "Selecciona al menos un atleta"
            : `Asignar a ${athleteMembershipIds.length} atleta${athleteMembershipIds.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
