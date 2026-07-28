import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/permissions";
import { can, type Capability } from "@/lib/roles";

/**
 * Guard para páginas (Server Components) del área de club.
 *
 * Vive aparte de permissions.ts a propósito: ahí solo hay autorización pura,
 * aquí hay efectos de ruteo. Y el efecto es distinto del de una Server Action —
 * una acción lanza ForbiddenError, una página redirige, porque quien llega aquí
 * normalmente escribió una URL o siguió un link viejo, no está atacando.
 *
 * Esconder el link de navegación NO es seguridad; esto tampoco. La seguridad
 * está en requireCapability dentro de las Server Actions. Esto evita que
 * alguien vea un formulario que no va a poder guardar.
 */
export async function requirePageCapability(capability: Capability) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/sign-in");
  if (!can(membership.role, capability)) redirect("/coach");
  return membership;
}
