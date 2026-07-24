"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentEditor } from "@/components/SegmentEditor";
import { createWorkoutTemplate } from "@/lib/actions/templates";
import type { WorkoutSegment } from "@/lib/workout-structure";

export default function NewTemplatePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [segments, setSegments] = useState<WorkoutSegment[]>([{ label: "", repeat: 1 }]);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createWorkoutTemplate({
          title,
          description: description || undefined,
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva plantilla</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          className="self-start rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar plantilla"}
        </button>
      </form>
    </div>
  );
}
