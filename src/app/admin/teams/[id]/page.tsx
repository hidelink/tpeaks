import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
      subscription: true,
    },
  });

  if (!team) notFound();

  const [templateCount, scheduledCount] = await Promise.all([
    prisma.workoutTemplate.count({ where: { teamId: team.id } }),
    prisma.scheduledWorkout.count({ where: { teamId: team.id } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <p className="text-sm text-zinc-500">
          slug: {team.slug} · org de Clerk: {team.clerkOrgId}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Suscripción</p>
          <p className="text-lg font-semibold">{team.subscriptionStatus}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Plantillas</p>
          <p className="text-lg font-semibold">{templateCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Entrenamientos asignados</p>
          <p className="text-lg font-semibold">{scheduledCount}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Miembros</h2>
        <ul className="divide-y divide-zinc-200">
          {team.memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{m.user.name}</p>
                <p className="text-sm text-zinc-500">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">{m.role}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">{m.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
