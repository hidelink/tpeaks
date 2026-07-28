import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentMembership } from "@/lib/permissions";
import { isStaff } from "@/lib/roles";

/**
 * Landing mínima: si hay sesión, manda directo al dashboard según rol.
 * Si no, invita a iniciar sesión. No hay marketing/landing pública en el MVP.
 */
export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">TPeaks</h1>
        <p className="max-w-md text-zinc-600">
          Entrenamiento para coaches y corredores. Simple, moderno, enfocado en running.
        </p>
        <Link
          href="/sign-in"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white"
        >
          Iniciar sesión
        </Link>
        <footer className="mt-8 flex gap-4 text-xs text-zinc-400">
          <Link href="/terms" className="underline">
            Términos de servicio
          </Link>
          <Link href="/privacy" className="underline">
            Aviso de privacidad
          </Link>
        </footer>
      </div>
    );
  }

  const membership = await getCurrentMembership();

  if (membership && isStaff(membership.role)) {
    redirect("/coach");
  }
  if (membership?.role === "ATHLETE") {
    redirect("/athlete");
  }

  // Sesión válida pero sin equipo activo todavía (ej. justo después del registro).
  redirect("/onboarding");
}
