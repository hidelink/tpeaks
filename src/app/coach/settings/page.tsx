import { getCurrentMembership } from "@/lib/permissions";

export default async function CoachSettingsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes del equipo</h1>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-medium">Equipo</h2>
        <p className="text-sm text-zinc-500">Nombre: {membership.team.name}</p>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 opacity-60 dark:border-zinc-800">
        <h2 className="mb-2 font-medium">Marca (white-label)</h2>
        <p className="text-sm text-zinc-500">
          Logo y color del equipo — el modelo de datos ya soporta{" "}
          <code>Team.logoUrl</code> y <code>Team.primaryColor</code>, la pantalla
          de edición y el theming en runtime se activan después del MVP.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 opacity-60 dark:border-zinc-800">
        <h2 className="mb-2 font-medium">Suscripción y facturación</h2>
        <p className="text-sm text-zinc-500">
          Estado actual: <strong>{membership.team.subscriptionStatus}</strong>.
          La integración real con Stripe llega en Fase 2 — hoy este estado no
          bloquea a nadie.
        </p>
      </section>
    </div>
  );
}
