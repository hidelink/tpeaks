import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { parseWorkoutStructure } from "@/lib/workout-structure";
import { DeleteTemplateButton } from "./DeleteTemplateButton";
import { sportMeta } from "@/lib/sports";

export default async function CoachTemplatesPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const templates = await prisma.workoutTemplate.findMany({
    where: { teamId: membership.teamId },
    orderBy: { createdAt: "desc" },
  });

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

      {templates.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aún no tienes plantillas. Crea la primera para poder asignarla a tus atletas.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => {
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
                  {structure.segments.length} segmento{structure.segments.length === 1 ? "" : "s"}
                </p>
                {t.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
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
      )}
    </div>
  );
}
