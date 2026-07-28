import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/permissions";
import { AppHeader } from "@/components/AppHeader";
import { COACH_NAV_LINKS, ATHLETE_NAV_LINKS } from "@/lib/nav-links";
import { teamAccentStyle } from "@/lib/team-theme";
import { isStaff } from "@/lib/roles";

/**
 * /workout/[id] es compartida entre coach y atleta (ver page.tsx: el
 * contenido se renderiza distinto según el rol), así que no vive dentro de
 * /coach ni /athlete y necesita su propio header con el menú correcto.
 */
export default async function WorkoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/sign-in");
  }

  const links = isStaff(membership.role) ? COACH_NAV_LINKS : ATHLETE_NAV_LINKS;

  return (
    <div className="flex flex-1 flex-col" style={teamAccentStyle(membership.team.primaryColor)}>
      <AppHeader teamName={membership.team.name} logoUrl={membership.team.logoUrl} links={links} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
