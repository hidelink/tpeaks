import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/permissions";
import { AppHeader } from "@/components/AppHeader";
import { ATHLETE_NAV_LINKS } from "@/lib/nav-links";

export default async function AthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/sign-in");
  }
  if (membership.role !== "ATHLETE") {
    redirect("/coach");
  }

  // El gate de suscripción (Fase 2) se aplica página por página con
  // assertAthleteTeamAccess, no aquí en el layout — así /athlete/billing-gate
  // en sí mismo no queda atrapado en un loop de redirect.

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader teamName={membership.team.name} links={ATHLETE_NAV_LINKS} />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
