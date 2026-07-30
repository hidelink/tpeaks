import { SignIn, SignUp } from "@clerk/nextjs";

/**
 * Donde aterriza quien abre el link de una invitación al club.
 *
 * POR QUÉ EXISTE: sin `redirectUrl` en la invitación, Clerk maneja todo en su
 * Account Portal y al terminar manda a su "home origin". En instancias de
 * DESARROLLO ese origen lo detecta del navegador en tiempo de ejecución, y el
 * navegador de un invitado en incógnito nunca visitó la app: no hay origen que
 * detectar, así que termina en la pantalla "Now, it's time to connect Clerk to
 * your application". El ajuste del dashboard no lo vence, probado.
 *
 * Poniendo `redirectUrl` recuperamos el control, pero con eso viene la
 * responsabilidad: la documentación de Clerk dice que en esa página "you must
 * handle the authentication flow in your code", y ofrece dos caminos —
 * incrustar el componente (esto) o construir un flujo propio con
 * signUp.create({ strategy: "ticket" }).
 *
 * ESTA RUTA DEBE SER PÚBLICA. Un intento anterior apuntó la invitación a "/",
 * que exige sesión: el middleware rebotaba a /sign-in y se perdía el ticket en
 * el camino. Ver src/middleware.ts.
 *
 * Clerk añade dos parámetros al llegar:
 *   __clerk_ticket  el ticket que vincula el registro con la invitación
 *   __clerk_status  "sign_up" si la persona no existe, "sign_in" si ya existe
 *
 * VERIFICADO de punta a punta con una invitación real: el componente incrustado
 * SÍ consume el __clerk_ticket. Alguien sin cuenta previa se registró aquí,
 * aterrizó en la app y quedó con el rol prometido. La referencia del componente
 * no menciona tickets, así que quedaba en duda hasta probarlo.
 *
 * Si algún día dejara de funcionar, se nota: la persona acabaría en /onboarding
 * viendo "Crea tu club" en vez de entrar al que la invitó, y su invitación
 * seguiría pendiente (puede volver a abrir el link del correo).
 */
export default async function InvitacionPage({
  searchParams,
}: {
  searchParams: Promise<{ __clerk_status?: string }>;
}) {
  const { __clerk_status: status } = await searchParams;
  const yaTieneCuenta = status === "sign_in";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Te invitaron a un club</h1>
        <p className="mt-1 max-w-md text-sm text-zinc-500">
          {yaTieneCuenta
            ? "Inicia sesión para entrar al club. Tu rol ya quedó definido por quien te invitó."
            : "Crea tu cuenta para entrar al club. Tu rol ya quedó definido por quien te invitó."}
        </p>
      </div>

      {/*
        routing="hash" a propósito: los pasos internos del componente (verificar
        el correo, poner contraseña) navegan en el hash y no en la ruta, así no
        hace falta un segmento catch-all ni choca con /sign-in y /sign-up, que
        son las rutas que Clerk conoce por NEXT_PUBLIC_CLERK_SIGN_*_URL.
      */}
      {yaTieneCuenta ? (
        <SignIn routing="hash" fallbackRedirectUrl="/" />
      ) : (
        <SignUp routing="hash" fallbackRedirectUrl="/" />
      )}
    </div>
  );
}
