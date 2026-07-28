"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTrainingGroupMembers,
  updateTrainingGroup,
  deleteTrainingGroup,
} from "@/lib/actions/groups";

type Athlete = { id: string; name: string };

export function GroupCard({
  group,
  athletes,
}: {
  group: { id: string; name: string; description: string | null; memberIds: string[] };
  athletes: Athlete[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [selected, setSelected] = useState<string[]>(group.memberIds);

  // Comparación por conjunto: reordenar los checkboxes no debe verse como
  // cambio pendiente.
  const dirty =
    selected.length !== group.memberIds.length ||
    selected.some((id) => !group.memberIds.includes(id));

  function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <div className="flex flex-1 flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción (opcional)"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </div>
        ) : (
          <div>
            <h2 className="font-medium">{group.name}</h2>
            {group.description && (
              <p className="text-sm text-zinc-500">{group.description}</p>
            )}
            <p className="mt-0.5 text-xs text-zinc-500">
              {group.memberIds.length} socio{group.memberIds.length === 1 ? "" : "s"}
            </p>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-3 text-xs">
          {editing ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => updateTrainingGroup(group.id, { name, description }), () =>
                    setEditing(false),
                  )
                }
                className="rounded-full bg-[var(--team-accent)] px-3 py-1 font-medium text-white disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(group.name);
                  setDescription(group.description ?? "");
                  setError(null);
                }}
                className="text-zinc-500 underline"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="underline">
                Renombrar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`¿Borrar el grupo "${group.name}"? Los socios no se borran.`)) return;
                  run(() => deleteTrainingGroup(group.id));
                }}
                className="text-red-600 underline disabled:opacity-50"
              >
                Borrar
              </button>
            </>
          )}
        </div>
      </div>

      {athletes.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Todavía no hay socios activos en el club que puedas agregar a este grupo.
        </p>
      ) : (
        <>
          <div className="mt-4 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-md border border-zinc-200 p-2">
            {athletes.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(a.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                    )
                  }
                />
                {a.name}
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={isPending || !dirty}
              onClick={() => run(() => setTrainingGroupMembers(group.id, selected))}
              className="rounded-full bg-[var(--team-accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "Guardar socios"}
            </button>
            {dirty && <span className="text-xs text-zinc-500">Cambios sin guardar</span>}
          </div>
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
