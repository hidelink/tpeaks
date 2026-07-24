import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return null;

  // Scoped a membership.teamId: un coach nunca debe poder ver el atleta de
  // otro equipo aunque adivine el id.
  const athlete = await prisma.teamMembership.findFirst({
    where: { id, teamId: membership.teamId, role: "ATHLETE" },
    include: { user: true, athleteProfile: true },
  });

  if (!athlete) notFound();

  const history = await prisma.scheduledWorkout.findMany({
    where: { athleteMembershipId: athlete.id },
    include: { completion: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{athlete.user.name}</h1>
        <p className="text-sm text-zinc-500">{athlete.user.email}</p>
      </div>

      {athlete.athleteProfile?.coachPrivateNote && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-1 font-medium">Nota privada (solo tú la ves)</p>
          <p>{athlete.athleteProfile.coachPrivateNote}</p>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-medium">Historial</h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {history.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/workout/${w.id}`} className="font-medium underline">
                  {w.title}
                </Link>
                <p className="text-sm text-zinc-500">{format(w.date, "d MMM yyyy")}</p>
              </div>
              <span className="text-sm text-zinc-500">
                {w.status === "COMPLETED"
                  ? `${w.completion?.distanceKm ?? "?"} km`
                  : w.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
