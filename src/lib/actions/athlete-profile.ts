"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/permissions";

/**
 * Nota privada del coach sobre un atleta — nunca se expone al atleta en
 * ninguna pantalla/API (ver AthleteProfile.coachPrivateNote en el schema).
 */
export async function updateAthletePrivateNote(athleteMembershipId: string, note: string) {
  const membership = await requireRole("COACH");

  const athlete = await prisma.teamMembership.findFirst({
    where: { id: athleteMembershipId, teamId: membership.teamId, role: "ATHLETE" },
  });
  if (!athlete) throw new ForbiddenError("Ese atleta no es de tu equipo.");

  await prisma.athleteProfile.upsert({
    where: { membershipId: athleteMembershipId },
    create: { membershipId: athleteMembershipId, coachPrivateNote: note || null },
    update: { coachPrivateNote: note || null },
  });

  revalidatePath(`/coach/athletes/${athleteMembershipId}`);
}
