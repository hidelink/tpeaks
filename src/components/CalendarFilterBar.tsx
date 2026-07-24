"use client";

/**
 * Formulario GET nativo: funciona sin JS (Buscar, Enter) salvo el
 * auto-submit del select de atleta, que es puro azúcar. Preserva date/view
 * vía inputs ocultos para no perder la semana/mes en la que estás al filtrar.
 */
export function CalendarFilterBar({
  basePath,
  date,
  view,
  athleteId,
  q,
  athletes,
}: {
  basePath: string;
  date?: string;
  view: "week" | "month";
  athleteId?: string;
  q?: string;
  athletes?: { id: string; name: string }[];
}) {
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-center gap-2">
      {date && <input type="hidden" name="date" value={date} />}
      <input type="hidden" name="view" value={view} />

      {athletes && athletes.length > 0 && (
        <select
          name="athleteId"
          defaultValue={athleteId ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos los atletas</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <input
        type="search"
        name="q"
        defaultValue={q ?? ""}
        placeholder="Buscar por título..."
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium"
      >
        Buscar
      </button>
    </form>
  );
}
