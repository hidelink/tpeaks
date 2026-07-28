import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminTeamsPage() {
  const teams = await prisma.team.findMany({
    include: { memberships: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipos</h1>
        <p className="text-sm text-zinc-500">{teams.length} en total</p>
      </div>

      <ul className="divide-y divide-zinc-200">
        {teams.map((team) => {
          const coach = team.memberships.find((m) => m.role === "COACH");
          const athleteCount = team.memberships.filter(
            (m) => m.role === "ATHLETE" && m.status === "ACTIVE",
          ).length;

          return (
            <li key={team.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/admin/teams/${team.id}`} className="font-medium underline">
                  {team.name}
                </Link>
                <p className="text-sm text-zinc-500">
                  Coach: {coach?.user.email ?? "—"} · {athleteCount} atleta
                  {athleteCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
                {team.subscriptionStatus}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
