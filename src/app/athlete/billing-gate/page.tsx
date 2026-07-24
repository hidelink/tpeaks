/**
 * Se muestra cuando Team.subscriptionStatus no cuenta como acceso válido
 * (ver src/lib/subscription-gate.ts). En Fase 1 nunca se llega aquí porque
 * el default de Team es TRIALING. En Fase 2, Stripe actualiza el estado del
 * equipo y esta pantalla reemplaza al calendario del atleta.
 */
export default function BillingGatePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Tu equipo no tiene una suscripción activa
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Contacta a tu coach para reactivar el acceso. Podrás ver tu calendario
        de entrenamientos en cuanto la suscripción del equipo esté al día.
      </p>
    </div>
  );
}
