import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/permissions";
import { AppHeader } from "@/components/AppHeader";
import { COACH_NAV_LINKS } from "@/lib/nav-links";
import { teamAccentStyle } from "@/lib/team-theme";
import { isStaff } from "@/lib/roles";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/sign-in");
  }
  if (!isStaff(membership.role)) {
    redirect("/athlete");
  }

  return (
    <div className="flex flex-1 flex-col" style={teamAccentStyle(membership.team.primaryColor)}>
      <AppHeader
        teamName={membership.team.name}
        logoUrl={membership.team.logoUrl}
        links={COACH_NAV_LINKS}
      />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
