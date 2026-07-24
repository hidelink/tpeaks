import { CreateOrganization } from "@clerk/nextjs";

/**
 * A donde llega un usuario autenticado que todavía no tiene equipo (Team).
 * Crear la Organization de Clerk aquí dispara nuestro webhook (o el
 * fallback de sync-on-read en getCurrentMembership) para crear el Team +
 * TeamMembership(COACH) correspondiente.
 */
export default function OnboardingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu equipo</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Esto te convierte en coach de tu propio equipo en TPeaks.
        </p>
      </div>
      <CreateOrganization afterCreateOrganizationUrl="/" />
    </div>
  );
}
