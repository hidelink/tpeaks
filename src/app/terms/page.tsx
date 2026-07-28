import Link from "next/link";

export const metadata = { title: "Términos de servicio — TPeaks" };

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12 text-sm leading-relaxed">
      <Link href="/" className="text-xs underline">
        ← Volver
      </Link>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs">
        <strong>Borrador inicial, no una revisión legal.</strong> Este texto cubre lo esencial
        para operar de forma razonable desde el día uno, pero no sustituye una revisión legal
        real antes de cobrar a usuarios de verdad o de operar con atletas menores de edad.
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Términos de servicio</h1>
      <p className="text-zinc-500">Última actualización: 27 de julio de 2026.</p>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">1. Qué es TPeaks</h2>
        <p>
          TPeaks es una plataforma para que coaches de running creen, asignen y den seguimiento
          a entrenamientos de sus atletas. Cada equipo (organización) es independiente: un coach
          solo puede ver y administrar a los atletas de su propio equipo.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">2. Cuentas y roles</h2>
        <p>
          Hay dos tipos de cuenta: <strong>coach</strong> (crea el equipo, invita atletas, crea y
          asigna entrenamientos) y <strong>atleta</strong> (se une a un equipo por invitación, ve
          su calendario y reporta su propio avance). Eres responsable de mantener segura tu
          sesión y de la veracidad de la información que registras.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">3. Relación coach-atleta</h2>
        <p>
          Al unirte a un equipo, aceptas que tu coach vea tu calendario de entrenamientos, tu
          historial y el feedback que registras (duración, distancia, ritmo percibido, RPE y
          comentarios). El coach puede además dejar notas privadas sobre ti que tú no puedes ver
          — es información interna del equipo, no un espacio de mensajería con expectativa de
          confidencialidad para ti.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">4. Suscripción y pagos</h2>
        <p>
          El equipo (a través de su coach) puede contratar un plan de pago que cubre a sus
          atletas — los atletas no pagan directamente. Si la suscripción del equipo deja de
          estar activa, los atletas pueden perder acceso a su calendario hasta que se reactive;
          el coach conserva acceso a la información de sus atletas en todo momento. Los pagos, si
          aplican, se procesan a través de un proveedor externo (Stripe) — TPeaks no almacena
          datos de tarjetas.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">5. Uso aceptable</h2>
        <p>
          No uses TPeaks para subir contenido ilegal, acosar a otros usuarios, o intentar acceder
          a datos de equipos a los que no perteneces. Nos reservamos el derecho de suspender
          cuentas que violen esto.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">6. Menores de edad</h2>
        <p>
          Si tu equipo incluye atletas menores de edad, es responsabilidad del coach contar con
          el consentimiento correspondiente de madres, padres o tutores para el uso de la
          plataforma y el registro de su información.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">7. Sin garantías</h2>
        <p>
          TPeaks se ofrece &quot;tal cual&quot;, en fase de desarrollo activo. No garantizamos
          disponibilidad ininterrumpida ni ausencia total de errores. No somos responsables por
          decisiones de entrenamiento tomadas con base en la información de la plataforma —
          las decisiones médicas o de salud siempre deben consultarse con un profesional.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">8. Cambios y contacto</h2>
        <p>
          Podemos actualizar estos términos conforme el producto evoluciona. Para dudas o
          solicitudes, contáctanos a través del correo del equipo con el que te registraste.
        </p>
      </section>
    </div>
  );
}
