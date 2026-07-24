import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/permissions";
import { AppHeader } from "@/components/AppHeader";
import { COACH_NAV_LINKS } from "@/lib/nav-links";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/sign-in");
  }
  if (membership.role !== "COACH") {
    redirect("/athlete");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader teamName={membership.team.name} links={COACH_NAV_LINKS} />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
