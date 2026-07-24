import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { InviteAthleteForm } from "./InviteAthleteForm";
import { RevokeInvitationButton } from "./RevokeInvitationButton";

export default async function CoachAthletesPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const [athletes, client] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    clerkClient(),
  ]);

  const { data: pendingInvitations } = await client.organizations.getOrganizationInvitationList({
    organizationId: membership.team.clerkOrgId,
    status: ["pending"],
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Atletas</h1>
        <InviteAthleteForm />
      </div>

      {pendingInvitations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-medium">Invitaciones pendientes</h2>
          <ul className="divide-y divide-zinc-200">
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-3">
                <span className="text-sm">{inv.emailAddress}</span>
                <RevokeInvitationButton invitationId={inv.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        {pendingInvitations.length > 0 && <h2 className="mb-3 text-lg font-medium">Activos</h2>}
        {athletes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aún no tienes atletas. Invítalos con el formulario de arriba.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {athletes.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{a.user.name}</p>
                  <p className="text-sm text-zinc-500">{a.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
                    {a.status === "ACTIVE" ? "Activo" : a.status === "INVITED" ? "Invitado" : "Removido"}
                  </span>
                  <Link href={`/coach/athletes/${a.id}`} className="text-sm underline">
                    Ver perfil
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
