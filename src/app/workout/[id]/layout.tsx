import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/permissions";
import { AppHeader } from "@/components/AppHeader";
import { COACH_NAV_LINKS, ATHLETE_NAV_LINKS } from "@/lib/nav-links";

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

  const links = membership.role === "COACH" ? COACH_NAV_LINKS : ATHLETE_NAV_LINKS;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader teamName={membership.team.name} links={links} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
