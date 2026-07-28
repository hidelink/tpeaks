"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";

/**
 * Marca del equipo (white-label) — logo y color de acento. Se aplican en
 * runtime vía la variable CSS --team-accent (ver src/lib/team-theme.ts) y
 * en el header (src/components/AppHeader.tsx). No hay subida de archivos a
 * propósito: el coach pega una URL de imagen ya alojada en algún lado —
 * construir upload+storage propio es una feature aparte, no falta hoy para
 * que el white-label funcione.
 */
export async function updateTeamBranding(input: { logoUrl: string; primaryColor: string }) {
  const membership = await requireCapability("MANAGE_CLUB");

  await prisma.team.update({
    where: { id: membership.teamId },
    data: {
      logoUrl: input.logoUrl || null,
      primaryColor: input.primaryColor || null,
    },
  });

  revalidatePath("/coach/settings");
}
