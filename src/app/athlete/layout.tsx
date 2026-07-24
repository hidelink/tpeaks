import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getCurrentMembership } from "@/lib/permissions";

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
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <nav className="flex items-center gap-6 text-sm font-medium">
          <span className="font-semibold">{membership.team.name}</span>
          <Link href="/athlete">Dashboard</Link>
          <Link href="/athlete/calendar">Calendario</Link>
        </nav>
        <UserButton />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
