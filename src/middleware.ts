import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renombró middleware.ts -> proxy.ts, pero Clerk (7.6.0) todavía
// documenta y soporta middleware.ts (funciona, aunque el nombre esté
// deprecado). Revisar cuando Clerk publique soporte explícito para proxy.ts.
const isPublicRoute = createRouteMatcher([
  // La raíz decide sola qué mostrar: landing si no hay sesión, o redirect según
  // el rol si la hay (ver src/app/page.tsx). Estando protegida, el middleware
  // rebotaba a /sign-in antes de que la página corriera, así que la landing para
  // visitantes era código inalcanzable — y cualquier parámetro de la URL (por
  // ejemplo el ticket de una invitación) se perdía en ese rebote.
  "/",
  // Quien llega de una invitación todavía no tiene sesión, y si el middleware
  // rebota se pierden los parámetros __clerk_ticket/__clerk_status de la URL.
  // Ya pasó una vez apuntando la invitación a "/".
  "/invitacion",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/terms",
  "/privacy",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
