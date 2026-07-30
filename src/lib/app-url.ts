/**
 * URL pública de la app, para los enlaces que se abren FUERA de ella — hoy el
 * de las invitaciones de Clerk, que llega por correo.
 *
 * Orden de preferencia:
 * 1. NEXT_PUBLIC_APP_URL — el dominio que la gente de verdad usa.
 * 2. VERCEL_PROJECT_PRODUCTION_URL — el dominio de producción del proyecto, que
 *    Vercel inyecta solo. Sirve para no configurar nada, pero puede no ser el
 *    alias bonito.
 * 3. localhost, para desarrollo.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return stripTrailingSlash(withProtocol(explicit));

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return stripTrailingSlash(withProtocol(vercel));

  return "http://localhost:3000";
}

/** Absoluta y con dominio: el correo se abre fuera de la app, una ruta no basta. */
export function absoluteUrl(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Vercel entrega el dominio sin protocolo; una variable a mano puede traerlo. */
function withProtocol(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
