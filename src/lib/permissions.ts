import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { syncMembershipFromClerk } from "@/lib/clerk-sync";
import type { MembershipRole } from "@/generated/prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para hacer esto.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resuelve la membresía activa del usuario autenticado dentro de la
 * organización (Team) activa en su sesión de Clerk. Retorna null si no hay
 * sesión, no hay organización activa, o la membresía no existe/está removida.
 */
export async function getCurrentMembership() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return null;

  const existing = await prisma.teamMembership.findFirst({
    where: {
      status: "ACTIVE",
      user: { clerkUserId: userId },
      team: { clerkOrgId: orgId },
    },
    include: { team: true, user: true },
  });
  if (existing) return existing;

  // El webhook de Clerk (/api/webhooks/clerk) es la fuente de verdad normal,
  // pero puede no estar configurado (ej. local sin túnel) o llegar con
  // retraso. Sin este fallback, un usuario recién creado se queda sin
  // membresía y ve el onboarding en loop.
  return syncMembershipFromClerk(userId, orgId, orgRole);
}

/**
 * Guard para Server Actions / Route Handlers: exige una membresía activa con
 * el rol dado. Nunca confiar solo en ocultar botones en el cliente — esta es
 * la única fuente de verdad de permisos (ver docs/PRODUCT_SPEC.md, Paso 5).
 */
export async function requireRole(role: MembershipRole) {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== role) {
    throw new ForbiddenError();
  }
  return membership;
}

export async function requireMembership() {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new ForbiddenError("No perteneces a ningún equipo.");
  }
  return membership;
}
