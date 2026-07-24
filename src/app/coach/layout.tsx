import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getCurrentMembership } from "@/lib/permissions";

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
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <nav className="flex items-center gap-6 text-sm font-medium">
          <span className="font-semibold">{membership.team.name}</span>
          <Link href="/coach">Dashboard</Link>
          <Link href="/coach/calendar">Calendario</Link>
          <Link href="/coach/athletes">Atletas</Link>
          <Link href="/coach/settings">Ajustes</Link>
        </nav>
        <UserButton />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
