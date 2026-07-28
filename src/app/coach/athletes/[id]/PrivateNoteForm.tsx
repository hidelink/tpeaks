"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAthletePrivateNote } from "@/lib/actions/athlete-profile";

export function PrivateNoteForm({
  athleteMembershipId,
  initialNote,
}: {
  athleteMembershipId: string;
  initialNote: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateAthletePrivateNote(athleteMembershipId, note);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="mb-2 font-medium">Nota privada (solo tú la ves)</p>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="Ej. lesión previa, contexto personal, preferencias de comunicación..."
        rows={3}
        className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || note === initialNote}
          className="rounded-full bg-[var(--team-accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar nota"}
        </button>
        {saved && <span className="text-xs text-green-700">Guardado.</span>}
      </div>
    </form>
  );
}
