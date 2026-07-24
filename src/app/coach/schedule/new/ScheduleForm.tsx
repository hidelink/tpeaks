"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentEditor } from "@/components/SegmentEditor";
import { scheduleWorkout } from "@/lib/actions/schedule";
import type { WorkoutSegment } from "@/lib/workout-structure";

export function ScheduleForm({
  athletes,
  templates,
  defaultDate,
  defaultAthleteId,
}: {
  athletes: { id: string; name: string }[];
  templates: { id: string; title: string }[];
  defaultDate: string;
  defaultAthleteId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [athleteMembershipId, setAthleteMembershipId] = useState(
    defaultAthleteId ?? athletes[0]?.id ?? "",
  );
  const [date, setDate] = useState(defaultDate);
  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [segments, setSegments] = useState<WorkoutSegment[]>([{ label: "", repeat: 1 }]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await scheduleWorkout({
          athleteMembershipId,
          date,
          title: title || templates.find((t) => t.id === templateId)?.title || "Entrenamiento",
          coachNote: coachNote || undefined,
          templateId: templateId || undefined,
          structure: templateId ? undefined : { segments },
        });
        router.push(`/workout/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Atleta
          <select
            value={athleteMembershipId}
            onChange={(e) => setAthleteMembershipId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
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
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

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
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !athleteMembershipId}
        className="self-start rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Asignar al calendario"}
      </button>
    </form>
  );
}
