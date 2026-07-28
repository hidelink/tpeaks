import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseWorkoutStructure } from "@/lib/workout-structure";
import { DeleteTemplateButton } from "./DeleteTemplateButton";
import { sportMeta, groupBySport, SPORTS } from "@/lib/sports";
import type { WorkoutSport } from "@/generated/prisma/enums";
import { requirePageCapability } from "@/lib/page-guards";

type Filters = { sport?: string; tag?: string; q?: string };

/** Construye la URL conservando los filtros que no se están cambiando. */
function hrefWith(current: Filters, patch: Filters) {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/coach/templates?${qs}` : "/coach/templates";
}

const VALID_SPORTS = new Set<string>(SPORTS.map((s) => s.value));

export default async function CoachTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const { sport, tag, q } = await searchParams;
  const membership = await requirePageCapability("MANAGE_TRAINING");

  // El sport llega de la URL: si no es un valor del enum se ignora en vez de
  // reventar la query.
  const activeSport = sport && VALID_SPORTS.has(sport) ? (sport as WorkoutSport) : undefined;
  const filters: Filters = { sport: activeSport, tag, q };

  // Se traen filtradas por tag/búsqueda pero NO por deporte: los contadores de
  // cada chip tienen que reflejar cuántas hay dentro de los otros filtros
  // activos, y son pocas plantillas por equipo como para que importe.
  const matching = await prisma.workoutTemplate.findMany({
    where: {
      teamId: membership.teamId,
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { title: "asc" },
  });

  const visible = activeSport ? matching.filter((t) => t.sport === activeSport) : matching;
  const groups = groupBySport(visible);
  const hasFilters = Boolean(activeSport || tag || q);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Plantillas</h1>
        <Link
          href="/coach/templates/new"
          className="rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Nueva plantilla
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefWith(filters, { sport: undefined })}
          className={`rounded-full border px-3 py-1 text-sm ${
            activeSport ? "border-zinc-300 text-zinc-600" : "border-zinc-900 font-medium"
          }`}
        >
          Todas ({matching.length})
        </Link>
        {groupBySport(matching).map(({ meta, items }) => (
          <Link
            key={meta.value}
            href={hrefWith(filters, { sport: meta.value })}
            className={`rounded-full border px-3 py-1 text-sm ${
              activeSport === meta.value
                ? "border-zinc-900 font-medium"
                : "border-zinc-300 text-zinc-600"
            }`}
          >
            <span aria-hidden>{meta.icon}</span> {meta.label} ({items.length})
          </Link>
        ))}

        <form method="get" action="/coach/templates" className="ml-auto flex items-center gap-2">
          {activeSport && <input type="hidden" name="sport" value={activeSport} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
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
      </div>

      {tag && (
        <p className="text-sm text-zinc-500">
          Filtrando por tag <span className="font-medium">{tag}</span>.{" "}
          <Link href={hrefWith(filters, { tag: undefined })} className="underline">
            Quitar
          </Link>
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {hasFilters ? (
            <>
              Ninguna plantilla coincide con ese filtro.{" "}
              <Link href="/coach/templates" className="underline">
                Ver todas
              </Link>
            </>
          ) : (
            "Aún no tienes plantillas. Crea la primera para poder asignarla a tus atletas."
          )}
        </p>
      ) : (
        groups.map(({ meta, items }) => (
          <section key={meta.value} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-500">
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((t) => {
                const structure = parseWorkoutStructure(t.structure);
                return (
                  <li key={t.id} className="rounded-xl border border-zinc-200 p-4">
                    <p className="font-medium">
                      <span aria-hidden>{sportMeta(t.sport).icon}</span> {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-1 text-sm text-zinc-500">{t.description}</p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
                      {structure.segments.length} segmento
                      {structure.segments.length === 1 ? "" : "s"}
                    </p>
                    {t.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.tags.map((tagName) => (
                          <Link
                            key={tagName}
                            href={hrefWith(filters, { tag: tagName })}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs hover:bg-zinc-200"
                          >
                            {tagName}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <Link href={`/coach/templates/${t.id}/edit`} className="text-xs underline">
                        Editar
                      </Link>
                      <DeleteTemplateButton templateId={t.id} title={t.title} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
