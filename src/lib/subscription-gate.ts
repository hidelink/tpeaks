import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus } from "@/generated/prisma/client";

/**
 * Fase 2: si el Team no tiene suscripción activa, sus atletas entran a la
 * plataforma pero deben ver la pantalla de bloqueo en vez de su calendario.
 * El coach NUNCA se bloquea (ver docs/PRODUCT_SPEC.md, Paso 6 y Paso 5).
 *
 * En Fase 1 esta función siempre permite el acceso — el default de
 * Team.subscriptionStatus es TRIALING, que cuenta como acceso válido. La
 * lógica real de Stripe se conecta después sin tocar quién llama a esto.
 */
const STATUSES_WITH_ACCESS: SubscriptionStatus[] = ["TRIALING", "ACTIVE"];

export async function teamHasActiveAccess(teamId: string): Promise<boolean> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { subscriptionStatus: true },
  });
  return STATUSES_WITH_ACCESS.includes(team.subscriptionStatus);
}

/**
 * Igual que teamHasActiveAccess, pero para usar directamente en una page.tsx
 * de atleta: si no hay acceso, redirige a /athlete/billing-gate en vez de
 * retornar un booleano que el caller podría ignorar por error.
 */
export async function assertAthleteTeamAccess(teamId: string) {
  const { redirect } = await import("next/navigation");
  const hasAccess = await teamHasActiveAccess(teamId);
  if (!hasAccess) {
    redirect("/athlete/billing-gate");
  }
}
