import { CreateOrganization, OrganizationList } from "@clerk/nextjs";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * A dónde llega alguien autenticado que todavía no tiene un club ACTIVO en su
 * sesión. Son dos situaciones muy distintas y antes se trataban igual:
 *
 * 1. No pertenece a ningún club -> está dando de alta el suyo.
 * 2. SÍ pertenece a uno (aceptó una invitación) pero su sesión no lo tiene
 *    activo todavía -> solo hay que entrar.
 *
 * El caso 2 aterrizaba en "Crea tu equipo", así que a un coach recién invitado
 * le pedíamos fundar su propio club en vez de entrar al que lo invitó. Se
 * detectó al aceptar una invitación de verdad.
 */
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const client = await clerkClient();
  const { data: memberships } = await client.users.getOrganizationMembershipList({ userId });

  if (memberships.length > 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entra a tu club</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {memberships.length === 1
              ? "Ya eres parte de este club. Selecciónalo para entrar."
              : "Perteneces a más de un club. Elige con cuál quieres entrar."}
          </p>
        </div>
        {/* hidePersonal: aquí no existe el concepto de "espacio personal", todo
            pasa dentro de un club. */}
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu club</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Esto te deja como Admin de tu propio club en TPeaks.
        </p>
      </div>
      <CreateOrganization afterCreateOrganizationUrl="/" />
    </div>
  );
}
