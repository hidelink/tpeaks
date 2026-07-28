import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { syncMembershipFromClerk } from "@/lib/clerk-sync";
import { can, type Capability } from "@/lib/roles";
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
 * Guard principal para Server Actions / Route Handlers: exige una membresía
 * activa que pueda hacer algo concreto. Nunca confiar solo en ocultar botones
 * en el cliente — esta es la única fuente de verdad de permisos (ver
 * docs/PRODUCT_SPEC.md, Paso 5).
 *
 * Se checa contra capacidades y no contra roles a propósito: ver el comentario
 * de src/lib/roles.ts. Preferir esto sobre requireRole en código nuevo.
 */
export async function requireCapability(capability: Capability) {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership.role, capability)) {
    throw new ForbiddenError();
  }
  return membership;
}

/**
 * Exige un rol exacto. Sirve para los pocos casos donde el rol ES el criterio
 * y no una capacidad (ej. "solo un socio tiene entrenamientos propios"). Para
 * autorizar acciones, usa requireCapability.
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

/**
 * Admin de plataforma (soporte interno) — a propósito NO usa
 * getCurrentMembership(): un admin necesita poder ver equipos a los que no
 * pertenece, así que se verifica contra User.isPlatformAdmin directo, sin
 * pasar por el Team/Organization activo en la sesión. Se activa a mano
 * (scripts/make-admin.ts), no hay UI de auto-gestión.
 */
export async function requirePlatformAdmin() {
  const { userId } = await auth();
  if (!userId) throw new ForbiddenError("No has iniciado sesión.");

  const user = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!user?.isPlatformAdmin) {
    throw new ForbiddenError("No tienes acceso de administrador.");
  }
  return user;
}
