import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { InviteMemberForm } from "./InviteMemberForm";
import { RevokeInvitationButton } from "./RevokeInvitationButton";
import { ROLE_LABELS, STAFF_ROLES, can } from "@/lib/roles";
import { RoleSelect } from "./RoleSelect";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { requirePageCapability } from "@/lib/page-guards";

export default async function CoachAthletesPage() {
  const membership = await requirePageCapability("MANAGE_MEMBERS");

  const [athletes, staff, client, clubInvitations] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE" },
      include: { user: true, groups: { include: { group: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: { in: [...STAFF_ROLES] }, status: "ACTIVE" },
      include: { user: true },
    }),
    clerkClient(),
    prisma.clubInvitation.findMany({ where: { teamId: membership.teamId } }),
  ]);

  // El rol que tendrá cada invitado al aceptar. Clerk solo sabe el email, así
  // que el rol prometido sale de nuestra tabla (ver actions/invite.ts).
  const promisedRole = new Map(clubInvitations.map((i) => [i.email, i.role]));

  // De más autoridad a menos, no por fecha de alta.
  // Solo un Admin reparte roles: MANAGE_MEMBERS lo tiene también el Coach, y
  // eso dejaría que un coach se ascendiera solo. Ver actions/members.ts.
  const canAssignRoles = can(membership.role, "MANAGE_CLUB");

  const staffOrdered = [...staff].sort(
    (a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role),
  );

  const { data: pendingInvitations } = await client.organizations.getOrganizationInvitationList({
    organizationId: membership.team.clerkOrgId,
    status: ["pending"],
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Socios y staff</h1>

      {/* El formulario va en su propio bloque y no compartiendo fila con el
          título: al aparecer el mensaje de éxito, el formulario crecía y
          empujaba el encabezado, así que la pantalla brincaba al invitar.
          Mismo patrón que /coach/groups. */}
      <div className="rounded-xl border border-zinc-200 p-4">
        <InviteMemberForm canInviteStaff={canAssignRoles} />
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
              <div className="flex items-center gap-3">
                {canAssignRoles ? (
                  <RoleSelect membershipId={m.id} role={m.role} isSelf={m.id === membership.id} />
                ) : (
                  <span className="rounded-full border border-[var(--team-accent)] px-2 py-1 text-xs font-medium">
                    {ROLE_LABELS[m.role]}
                  </span>
                )}
                {/* Quitar staff pide MANAGE_CLUB, y uno mismo nunca: la acción
                    lo vuelve a exigir, esto solo evita ofrecer lo imposible. */}
                {canAssignRoles && m.id !== membership.id && (
                  <RemoveMemberButton
                    membershipId={m.id}
                    name={m.user.name}
                    role={ROLE_LABELS[m.role]}
                  />
                )}
              </div>
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
                <span className="text-sm">
                  {inv.emailAddress}
                  <span className="ml-2 text-xs text-zinc-500">
                    entrará como{" "}
                    {ROLE_LABELS[promisedRole.get(inv.emailAddress.toLowerCase()) ?? "ATHLETE"]}
                  </span>
                </span>
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
                  <p className="text-sm text-zinc-500">
                    {a.user.email}
                    {a.groups.length > 0 && (
                      <> · {a.groups.map((g) => g.group.name).join(", ")}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
                    {a.status === "ACTIVE" ? "Activo" : a.status === "INVITED" ? "Invitado" : "Removido"}
                  </span>
                  {canAssignRoles && a.status === "ACTIVE" && (
                    <RoleSelect membershipId={a.id} role={a.role} isSelf={false} />
                  )}
                  <Link href={`/coach/athletes/${a.id}`} className="text-sm underline">
                    Ver perfil
                  </Link>
                  {a.status === "ACTIVE" && (
                    <RemoveMemberButton
                      membershipId={a.id}
                      name={a.user.name}
                      role={ROLE_LABELS[a.role]}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
