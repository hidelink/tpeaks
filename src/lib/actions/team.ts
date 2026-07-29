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
/**
 * El color acaba en la variable CSS --team-accent, que pinta TODOS los botones
 * principales de la plataforma. El formulario usa <input type="color">, que
 * siempre manda #rrggbb — pero la acción es un endpoint público, y un valor
 * cualquiera deja los botones sin estilo en todo el club. Se exige hex.
 */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateTeamBranding(input: { logoUrl: string; primaryColor: string }) {
  const membership = await requireCapability("MANAGE_CLUB");

  const primaryColor = input.primaryColor.trim();
  if (primaryColor && !HEX_COLOR.test(primaryColor)) {
    throw new Error("El color debe ser hexadecimal, por ejemplo #1d4ed8.");
  }

  const logoUrl = input.logoUrl.trim();
  if (logoUrl && !/^https:\/\//.test(logoUrl)) {
    // http:// en una página https rompe la imagen por contenido mixto, así que
    // fallar aquí es más claro que un logo que simplemente no aparece.
    throw new Error("La URL del logo debe empezar con https://");
  }

  await prisma.team.update({
    where: { id: membership.teamId },
    data: {
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
    },
  });

  revalidatePath("/coach/settings");
}
