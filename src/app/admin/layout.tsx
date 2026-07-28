import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { requirePlatformAdmin } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 py-4">
        <nav className="flex items-center gap-6 text-sm font-medium">
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white">Admin</span>
          <Link href="/admin">Equipos</Link>
        </nav>
        <UserButton />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
