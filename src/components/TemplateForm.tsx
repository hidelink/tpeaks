"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentEditor } from "@/components/SegmentEditor";
import { SportSelect } from "@/components/SportSelect";
import type { WorkoutSegment, WorkoutStructure } from "@/lib/workout-structure";
import type { WorkoutSport } from "@/generated/prisma/enums";

export type TemplateFormValues = {
  title: string;
  description?: string;
  sport: WorkoutSport;
  tags: string[];
  structure: WorkoutStructure;
};

/**
 * Formulario compartido entre crear y editar una plantilla — ambos casos
 * producen los mismos datos, solo cambia qué Server Action se llama al
 * enviar (ver /coach/templates/new y /coach/templates/[id]/edit).
 */
export function TemplateForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: TemplateFormValues;
  submitLabel: string;
  onSubmit: (data: TemplateFormValues) => Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sport, setSport] = useState<WorkoutSport>(initial?.sport ?? "RUN");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [segments, setSegments] = useState<WorkoutSegment[]>(
    initial?.structure.segments ?? [{ label: "", repeat: 1 }],
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit({
          title,
          description: description || undefined,
          sport,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          structure: { segments },
        });
        router.push("/coach/templates");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Título
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Series 10x400m"
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Descripción (opcional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <SportSelect value={sport} onChange={setSport} />

      <label className="flex flex-col gap-1 text-sm">
        Tags (separados por coma)
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="velocidad, series, pista"
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Segmentos</p>
        <SegmentEditor
          segments={segments}
          sport={sport}
          onChange={(segs) => {
            setSegments(segs);
            setError(null);
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || segments.length === 0}
        className="self-start rounded-full bg-[var(--team-accent)] px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
