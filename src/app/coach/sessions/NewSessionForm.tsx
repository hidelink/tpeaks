"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClubSession } from "@/lib/actions/sessions";

export function NewSessionForm({
  groups,
  defaultDate,
}: {
  groups: { id: string; name: string }[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("07:00");
  const [groupId, setGroupId] = useState("");
  const [location, setLocation] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await createClubSession({
          title,
          date,
          startTime,
          groupId: groupId || undefined,
          location,
        });
        router.push(`/coach/sessions/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear la sesión.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Sesión
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Series en la pista"
          className="w-52 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Día
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Hora
        <input
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          placeholder="07:00"
          className="w-20 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Grupo
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todo el club</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Lugar
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ej. Pista del Parque México"
          className="w-56 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || !title.trim()}
        className="rounded-full bg-[var(--team-accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear sesión"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
