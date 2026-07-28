import { paceOptions, type TrainingPaces } from "@/lib/vdot";

/**
 * Los cinco ritmos, en modo lectura. Compartido entre la tarjeta editable del
 * coach y el dashboard del atleta, para que ambos vean exactamente los mismos
 * números y la misma advertencia sobre trail.
 */
export function TrainingPacesList({ paces }: { paces: TrainingPaces }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {paceOptions(paces).map((o) => (
          <div key={o.key}>
            <dt className="text-xs text-zinc-500">{o.label}</dt>
            <dd className="font-medium tabular-nums">{o.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Estos ritmos solo aplican en plano — pista, asfalto, terreno estable. En trail el desnivel
        y el terreno cambian el costo del mismo esfuerzo, así que ahí conviene ir por sensación
        (RPE) o por tiempo en vez de por ritmo.
      </p>
    </>
  );
}
