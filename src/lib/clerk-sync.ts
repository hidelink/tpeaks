import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@/generated/prisma/client";

/**
 * Clerk solo distingue admin/member a nivel organización (roles finos custom
 * son de plan de pago). Usamos ese rol únicamente como señal INICIAL — la
 * fuente de verdad real para permisos de la app es TeamMembership.role, no
 * Clerk (ver docs/PRODUCT_SPEC.md, Paso 3).
 *
 * `org:admin` mapea a OWNER porque quien crea la organización en Clerk es
 * quien está dando de alta su club. A partir de ahí los roles se ajustan
 * dentro de la app (scripts/set-role.ts hoy; pantalla de socios después).
 *
 * Ojo: upsertMembership solo escribe `role` al CREAR, nunca al actualizar. Por
 * eso cambiar este mapeo no reescribe roles ya asignados — si lo cambias a que
 * también actualice, un ADMIN degradado en la app volvería a OWNER en el
 * siguiente login.
 */
export function mapOrgRole(orgRole: string | null | undefined): MembershipRole {
  return orgRole === "org:admin" ? "OWNER" : "ATHLETE";
}

export function upsertTeamFromClerkOrg(orgId: string, name: string, slug?: string | null) {
  return prisma.team.upsert({
    where: { clerkOrgId: orgId },
    create: { clerkOrgId: orgId, name, slug: slug ?? orgId },
    update: { name },
  });
}

export function upsertUserFromClerk(
  clerkUserId: string,
  email: string,
  name: string,
  avatarUrl?: string | null,
) {
  return prisma.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId, email, name, avatarUrl },
    update: { email },
  });
}

export function upsertMembership(teamId: string, userId: string, role: MembershipRole) {
  return prisma.teamMembership.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId, role, status: "ACTIVE" },
    update: { status: "ACTIVE" },
    include: { team: true, user: true },
  });
}

/**
 * Fallback de "sync-on-read": si el webhook de Clerk todavía no corrió (ej.
 * en local sin túnel configurado) o llega con retraso, esto evita bloquear
 * el onboarding. El webhook sigue siendo la fuente de verdad para
 * actualizaciones fuera de banda (remociones, cambios de nombre, etc.) — ver
 * src/app/api/webhooks/clerk/route.ts.
 */
export async function syncMembershipFromClerk(
  clerkUserId: string,
  orgId: string,
  orgRole: string | null | undefined,
) {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const dbUser = await upsertUserFromClerk(
    clerkUserId,
    email,
    [user.firstName, user.lastName].filter(Boolean).join(" ") || email,
    user.imageUrl,
  );

  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  const team = await upsertTeamFromClerkOrg(orgId, org.name, org.slug);

  return upsertMembership(team.id, dbUser.id, mapOrgRole(orgRole));
}
