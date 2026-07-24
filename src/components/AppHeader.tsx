import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

/**
 * Nav compartida entre los layouts de coach, atleta, y cualquier ruta fuera
 * de esos árboles (ej. /workout/[id], que es compartida entre ambos roles
 * y por eso no hereda el header de ninguno de los dos layouts).
 */
export function AppHeader({
  teamName,
  links,
}: {
  teamName: string;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
      <nav className="flex items-center gap-6 text-sm font-medium">
        <span className="font-semibold">{teamName}</span>
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <UserButton />
    </header>
  );
}
