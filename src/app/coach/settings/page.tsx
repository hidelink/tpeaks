import { BrandingForm } from "./BrandingForm";
import { requirePageCapability } from "@/lib/page-guards";

export default async function CoachSettingsPage() {
  const membership = await requirePageCapability("MANAGE_CLUB");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes del equipo</h1>

      <section className="rounded-xl border border-zinc-200 p-4">
        <h2 className="mb-2 font-medium">Equipo</h2>
        <p className="text-sm text-zinc-500">Nombre: {membership.team.name}</p>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4">
        <h2 className="mb-1 font-medium">Marca (white-label)</h2>
        <p className="mb-4 text-sm text-zinc-500">
          El logo aparece en el header y el color de acento en los botones principales,
          en toda la plataforma — así se ve como propia del equipo.
        </p>
        <BrandingForm
          initialLogoUrl={membership.team.logoUrl ?? ""}
          initialPrimaryColor={membership.team.primaryColor ?? ""}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 opacity-60">
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
