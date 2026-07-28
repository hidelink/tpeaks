"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClubSession } from "@/lib/actions/sessions";

export function DeleteSessionButton({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`¿Borrar la sesión "${title}"? También se borra su pase de lista.`)) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteClubSession(sessionId);
              router.push("/coach/sessions");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo borrar.");
            }
          });
        }}
        className="text-xs text-red-600 underline disabled:opacity-50"
      >
        {isPending ? "Borrando..." : "Borrar sesión"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
