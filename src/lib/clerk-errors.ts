/**
 * Traduce un error de Clerk a algo que se pueda leer en pantalla.
 *
 * Sin esto, un error de Clerk sube tal cual y Next.js lo convierte en "An error
 * occurred in the Server Components render... A digest property is included",
 * que no le dice nada a nadie. Pasó de verdad al topar el límite de la
 * instancia de desarrollo: 5 membresías por organización, contando invitaciones
 * pendientes. El mensaje real venía en el error, solo que enterrado en los logs.
 */
export function clerkErrorMessage(err: unknown): string | null {
  if (typeof err !== "object" || err === null || !("clerkError" in err)) return null;

  const errors = (err as { errors?: { code?: string; longMessage?: string; message?: string }[] })
    .errors;
  const first = errors?.[0];
  if (!first) return null;

  if (first.code === "organization_membership_quota_exceeded") {
    return (
      "Tu instancia de Clerk llegó a su límite de miembros por club (las " +
      "instancias de desarrollo topan en 5, contando invitaciones pendientes). " +
      "Quita a alguien del club o pasa Clerk a producción."
    );
  }
  if (first.code === "duplicate_record") {
    return "Ya hay una invitación pendiente para ese correo.";
  }

  // Los mensajes de Clerk son razonables; mejor mostrarlos que esconderlos.
  return first.longMessage ?? first.message ?? null;
}
