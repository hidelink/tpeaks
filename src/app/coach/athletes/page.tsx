import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";

export default async function CoachAthletesPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const athletes = await prisma.teamMembership.findMany({
    where: { teamId: membership.teamId, role: "ATHLETE" },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Atletas</h1>
        <span className="text-sm text-zinc-500">
          Invitar atleta: próximamente (vía Clerk Organization invite)
        </span>
      </div>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {athletes.map((a) => (
          <li key={a.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{a.user.name}</p>
              <p className="text-sm text-zinc-500">{a.user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
                {a.status === "ACTIVE" ? "Activo" : a.status === "INVITED" ? "Invitado" : "Removido"}
              </span>
              <Link href={`/coach/athletes/${a.id}`} className="text-sm underline">
                Ver perfil
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
