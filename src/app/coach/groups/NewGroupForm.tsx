"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainingGroup } from "@/lib/actions/groups";

export function NewGroupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createTrainingGroup({ name, description });
        setName("");
        setDescription("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear el grupo.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Nombre
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Avanzados"
          className="w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Descripción (opcional)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Sub-45 en 10k, martes y jueves"
          className="w-72 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="rounded-full bg-[var(--team-accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear grupo"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
