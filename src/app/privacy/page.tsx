import Link from "next/link";

export const metadata = { title: "Aviso de privacidad — TPeaks" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12 text-sm leading-relaxed">
      <Link href="/" className="text-xs underline">
        ← Volver
      </Link>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs">
        <strong>Borrador inicial, no una revisión legal.</strong> Este aviso describe con
        honestidad qué datos recolectamos y para qué, pero no sustituye una revisión legal real
        (por ejemplo, conforme a la Ley Federal de Protección de Datos Personales en Posesión de
        los Particulares en México) antes de operar con usuarios reales.
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Aviso de privacidad</h1>
      <p className="text-zinc-500">Última actualización: 27 de julio de 2026.</p>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Qué datos recolectamos</h2>
        <ul className="list-disc pl-5">
          <li>Nombre y correo electrónico (a través de Clerk, nuestro proveedor de autenticación).</li>
          <li>Nombre y logo del equipo, si eres coach.</li>
          <li>
            Entrenamientos programados y feedback de entrenamiento: duración, distancia, ritmo
            percibido, RPE (esfuerzo percibido) y comentarios de texto libre.
          </li>
          <li>
            Notas privadas que tu coach escriba sobre ti (pueden incluir contexto de salud, como
            lesiones previas) — visibles solo para tu coach, nunca para ti ni para otros atletas.
          </li>
          <li>Datos de facturación, si tu equipo tiene una suscripción activa (procesados por Stripe, no los almacenamos nosotros directamente).</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Para qué los usamos</h2>
        <p>
          Únicamente para operar la plataforma: mostrar tu calendario, calcular tu carga de
          entrenamiento, y darle a tu coach visibilidad de tu progreso. No vendemos datos a
          terceros ni los usamos para publicidad.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Quién puede ver tu información</h2>
        <p>
          Tu coach y los administradores de tu propio equipo. Coaches de otros equipos nunca
          tienen acceso a tu información — cada equipo está completamente aislado en nuestra base
          de datos. Un número reducido de personas del equipo de TPeaks puede acceder a datos
          agregados con fines de soporte técnico.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Terceros que procesan datos por nosotros</h2>
        <ul className="list-disc pl-5">
          <li><strong>Clerk</strong> — autenticación e identidad.</li>
          <li><strong>Supabase / PostgreSQL</strong> — almacenamiento de la base de datos.</li>
          <li><strong>Stripe</strong> — procesamiento de pagos (cuando aplique).</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Tus derechos</h2>
        <p>
          Puedes solicitar acceso, corrección o eliminación de tus datos personales (derechos
          ARCO) escribiendo al correo de contacto de tu equipo o al de TPeaks. Si eliminas tu
          cuenta, tu historial de entrenamientos deja de ser visible, pero puede conservarse de
          forma anonimizada para estadísticas agregadas del equipo.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Menores de edad</h2>
        <p>
          Si eres coach y tu equipo incluye atletas menores de edad, es tu responsabilidad contar
          con el consentimiento de madres, padres o tutores antes de registrar su información en
          la plataforma.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Contacto</h2>
        <p>Para cualquier solicitud relacionada con tus datos, contáctanos por el correo del equipo con el que te registraste.</p>
      </section>
    </div>
  );
}
