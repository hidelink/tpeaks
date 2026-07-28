import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { InviteAthleteForm } from "./InviteAthleteForm";
import { RevokeInvitationButton } from "./RevokeInvitationButton";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";

export default async function CoachAthletesPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const [athletes, staff, client] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: { in: [...STAFF_ROLES] }, status: "ACTIVE" },
      include: { user: true },
    }),
    clerkClient(),
  ]);

  // De más autoridad a menos, no por fecha de alta.
  const staffOrdered = [...staff].sort(
    (a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role),
  );

  const { data: pendingInvitations } = await client.organizations.getOrganizationInvitationList({
    organizationId: membership.team.clerkOrgId,
    status: ["pending"],
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Socios y staff</h1>
        <InviteAthleteForm />
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Staff del club</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Quién puede hacer qué depende del rol — ver src/lib/roles.ts. Se cambia con{" "}
          <code className="rounded bg-zinc-100 px-1">scripts/set-role.ts</code> mientras no haya
          pantalla para hacerlo.
        </p>
        <ul className="divide-y divide-zinc-200">
          {staffOrdered.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">
                  {m.user.name}
                  {m.id === membership.id && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">(tú)</span>
                  )}
                </p>
                <p className="text-sm text-zinc-500">{m.user.email}</p>
              </div>
              <span className="rounded-full border border-[var(--team-accent)] px-2 py-1 text-xs font-medium">
                {ROLE_LABELS[m.role]}
              </span>
            </li>
          ))}
        </ul>
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
        <h2 className="mb-3 text-lg font-medium">
          Socios{pendingInvitations.length > 0 ? " activos" : ""}
        </h2>
        {athletes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aún no tienes socios. Invítalos con el formulario de arriba.
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
