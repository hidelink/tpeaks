"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember } from "@/lib/actions/members";

/**
 * "Quitar del club", no "Eliminar": la persona sale del club pero su historial
 * de entrenamientos, feedback y asistencia se queda (ver removeMember). Decirle
 * "eliminar" prometería algo que no pasa.
 */
export function RemoveMemberButton({
  membershipId,
  name,
  role,
}: {
  membershipId: string;
  name: string;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const ok = confirm(
            `¿Quitar a ${name} (${role}) del club?\n\n` +
              `Pierde el acceso, pero su historial de entrenamientos y asistencia se conserva. ` +
              `Puedes volver a invitarlo después.`,
          );
          if (!ok) return;

          setError(null);
          startTransition(async () => {
            try {
              await removeMember(membershipId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo quitar.");
            }
          });
        }}
        className="text-xs text-red-600 underline disabled:opacity-50"
      >
        {isPending ? "Quitando..." : "Quitar"}
      </button>
      {error && <p className="mt-1 max-w-56 text-xs text-red-600">{error}</p>}
    </div>
  );
}
