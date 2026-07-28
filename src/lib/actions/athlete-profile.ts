"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/permissions";
import { calculateVdot } from "@/lib/vdot";

/**
 * Todo lo que vive en AthleteProfile lo edita el coach, nunca el atleta —
 * y siempre acotado a su propio equipo, aunque adivine el id de otro.
 */
async function assertCoachOfAthlete(athleteMembershipId: string) {
  const membership = await requireRole("COACH");

  const athlete = await prisma.teamMembership.findFirst({
    where: { id: athleteMembershipId, teamId: membership.teamId, role: "ATHLETE" },
  });
  if (!athlete) throw new ForbiddenError("Ese atleta no es de tu equipo.");

  return athlete;
}

/**
 * Nota privada del coach sobre un atleta — nunca se expone al atleta en
 * ninguna pantalla/API (ver AthleteProfile.coachPrivateNote en el schema).
 */
export async function updateAthletePrivateNote(athleteMembershipId: string, note: string) {
  await assertCoachOfAthlete(athleteMembershipId);

  await prisma.athleteProfile.upsert({
    where: { membershipId: athleteMembershipId },
    create: { membershipId: athleteMembershipId, coachPrivateNote: note || null },
    update: { coachPrivateNote: note || null },
  });

  revalidatePath(`/coach/athletes/${athleteMembershipId}`);
}

// La curva de Daniels pierde precisión en esfuerzos de menos de ~3 minutos,
// y una carrera de más de 100 km ya no es el mismo deporte que modela.
const MIN_RACE_METERS = 1500;
const MAX_RACE_METERS = 100_000;
const MIN_RACE_SECONDS = 180;
const MAX_RACE_SECONDS = 24 * 60 * 60;

/**
 * Guarda el resultado de carrera reciente de un atleta y recalcula su VDOT.
 * El VDOT se persiste (en vez de calcularse al vuelo en cada pantalla) para
 * que quede el registro de con qué números se prescribieron los ritmos, aunque
 * después cambie la fórmula.
 */
export async function updateAthleteRaceResult(
  athleteMembershipId: string,
  distanceMeters: number,
  timeSeconds: number,
) {
  await assertCoachOfAthlete(athleteMembershipId);

  if (!Number.isFinite(distanceMeters) || distanceMeters < MIN_RACE_METERS || distanceMeters > MAX_RACE_METERS) {
    throw new Error(`La distancia debe estar entre ${MIN_RACE_METERS} m y ${MAX_RACE_METERS / 1000} km.`);
  }
  if (!Number.isInteger(timeSeconds) || timeSeconds < MIN_RACE_SECONDS || timeSeconds > MAX_RACE_SECONDS) {
    throw new Error("El tiempo debe estar entre 3 minutos y 24 horas.");
  }

  const vdot = calculateVdot(distanceMeters, timeSeconds);
  if (!Number.isFinite(vdot) || vdot <= 0) {
    throw new Error("Ese resultado no da un VDOT válido — revisa la distancia y el tiempo.");
  }

  const data = {
    raceResultDistanceMeters: distanceMeters,
    raceResultTimeSeconds: timeSeconds,
    vdot,
  };

  await prisma.athleteProfile.upsert({
    where: { membershipId: athleteMembershipId },
    create: { membershipId: athleteMembershipId, ...data },
    update: data,
  });

  revalidatePath(`/coach/athletes/${athleteMembershipId}`);
}

/** Borra el resultado de carrera — los ritmos dejan de mostrarse. */
export async function clearAthleteRaceResult(athleteMembershipId: string) {
  await assertCoachOfAthlete(athleteMembershipId);

  await prisma.athleteProfile.updateMany({
    where: { membershipId: athleteMembershipId },
    data: { raceResultDistanceMeters: null, raceResultTimeSeconds: null, vdot: null },
  });

  revalidatePath(`/coach/athletes/${athleteMembershipId}`);
}
