"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAttendance, clearAttendance } from "@/lib/actions/sessions";
import { ATTENDANCE_LABELS } from "@/lib/attendance";
import type { AttendanceStatus } from "@/generated/prisma/enums";

type Row = { membershipId: string; name: string; status: AttendanceStatus | null };

const OPTIONS: AttendanceStatus[] = ["PRESENT", "EXCUSED", "ABSENT"];

const STYLES: Record<AttendanceStatus, string> = {
  PRESENT: "border-green-600 bg-green-50 text-green-800",
  EXCUSED: "border-amber-500 bg-amber-50 text-amber-800",
  ABSENT: "border-red-500 bg-red-50 text-red-800",
};

/**
 * Pase de lista. Se marca de una persona a la vez porque así se usa: de pie en
 * el parque, con el teléfono, mientras la gente va llegando. Volver a tocar el
 * mismo estado lo quita, para poder deshacer un toque accidental.
 */
export function AttendanceRoster({ sessionId, roster }: { sessionId: string; roster: Row[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * `pending` guarda SOLO las marcas en vuelo, y cada una se borra al
   * resolverse — con éxito o con error. Así el servidor siempre vuelve a ser
   * la verdad en cuanto la petición termina.
   *
   * La versión anterior guardaba el valor local para siempre: una vez tocada
   * una persona, su fila dejaba de reflejar el servidor el resto de la sesión,
   * y un error la dejaba mostrando un valor viejo en vez de la verdad.
   */
  const [pending, setPending] = useState<Record<string, AttendanceStatus | null>>({});

  const statusOf = (row: Row) =>
    row.membershipId in pending ? pending[row.membershipId] : row.status;

  function settle(membershipId: string) {
    setPending((prev) => {
      const next = { ...prev };
      delete next[membershipId];
      return next;
    });
  }

  function set(row: Row, status: AttendanceStatus) {
    // Una marca en vuelo por persona: evita que dos toques rápidos sobre la
    // misma fila lleguen desordenados y dejen la base en el estado del primero.
    if (row.membershipId in pending) return;

    const next = statusOf(row) === status ? null : status;
    setPending((prev) => ({ ...prev, [row.membershipId]: next }));
    setError(null);

    startTransition(async () => {
      try {
        if (next === null) await clearAttendance(sessionId, row.membershipId);
        else await markAttendance(sessionId, row.membershipId, next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      } finally {
        settle(row.membershipId);
      }
    });
  }

  if (roster.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay socios convocados a esta sesión. Si es de un grupo, agrégale socios en Grupos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}

      <ul className="divide-y divide-zinc-200">
        {roster.map((row) => {
          const status = statusOf(row);
          return (
            <li key={row.membershipId} className="flex items-center justify-between gap-4 py-2">
              <span className="min-w-0 truncate text-sm">{row.name}</span>
              <div className="flex shrink-0 gap-1.5">
                {OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={row.membershipId in pending}
                    onClick={() => set(row, option)}
                    aria-pressed={status === option}
                    className={`rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-60 ${
                      status === option ? STYLES[option] : "border-zinc-300 text-zinc-500"
                    }`}
                  >
                    {ATTENDANCE_LABELS[option]}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-zinc-500">
        Toca de nuevo el mismo estado para quitar la marca. Sin marca significa &quot;todavía no se
        pasó lista&quot;, que no es lo mismo que faltar.
      </p>
    </div>
  );
}
