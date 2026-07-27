import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { startOfWeek, addDays, subWeeks } from "date-fns";
import { toQueryBoundary } from "../src/lib/calendar-date";

/**
 * Siembra ~4 semanas de entrenamientos de prueba (con feedback ya
 * completado en las semanas pasadas) para un atleta existente, con un
 * patrón deliberado de 3 semanas de construcción + 1 de descarga — así se
 * puede probar visualmente la gráfica de carga (src/components/TrainingLoadChart.tsx).
 *
 * Uso: npx tsx scripts/seed-test-workouts.ts [email-del-atleta]
 * Default: member@yopmail.com
 */

const athleteEmail = process.argv[2] ?? "member@yopmail.com";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type PlannedWorkout = {
  weeksAgo: number; // 0 = semana actual, 3 = hace 3 semanas
  weekday: number; // 1 = lunes ... 7 = domingo
  title: string;
  distanceKm: number;
  durationMin: number;
  rpe: number;
  pace: string;
  note?: string;
};

// 3 semanas construyendo volumen/intensidad, 4ta (actual) de descarga.
const WORKOUTS: PlannedWorkout[] = [
  // Semana -3 (más antigua)
  { weeksAgo: 3, weekday: 1, title: "Fondo suave", distanceKm: 6, durationMin: 40, rpe: 4, pace: "6:40/km" },
  { weeksAgo: 3, weekday: 3, title: "Tempo corto", distanceKm: 7, durationMin: 45, rpe: 7, pace: "6:25/km" },
  { weeksAgo: 3, weekday: 5, title: "Fondo suave", distanceKm: 5.5, durationMin: 35, rpe: 4, pace: "6:22/km" },
  { weeksAgo: 3, weekday: 7, title: "Fondo largo", distanceKm: 11, durationMin: 75, rpe: 6, pace: "6:49/km" },

  // Semana -2
  { weeksAgo: 2, weekday: 1, title: "Fondo suave", distanceKm: 7, durationMin: 45, rpe: 4, pace: "6:26/km" },
  { weeksAgo: 2, weekday: 3, title: "Tempo", distanceKm: 8, durationMin: 50, rpe: 7, pace: "6:15/km" },
  { weeksAgo: 2, weekday: 5, title: "Fondo suave", distanceKm: 6, durationMin: 40, rpe: 5, pace: "6:40/km" },
  { weeksAgo: 2, weekday: 6, title: "Rodaje + progresiones", distanceKm: 5, durationMin: 30, rpe: 5, pace: "6:00/km" },
  { weeksAgo: 2, weekday: 7, title: "Fondo largo", distanceKm: 13, durationMin: 85, rpe: 7, pace: "6:32/km" },

  // Semana -1 (pico de la construcción)
  { weeksAgo: 1, weekday: 1, title: "Fondo suave", distanceKm: 7, durationMin: 45, rpe: 4, pace: "6:26/km" },
  { weeksAgo: 1, weekday: 2, title: "Series 8x400m", distanceKm: 9, durationMin: 55, rpe: 8, pace: "5:30/km", note: "Recuperación trote suave entre series." },
  { weeksAgo: 1, weekday: 4, title: "Fondo suave", distanceKm: 6, durationMin: 40, rpe: 5, pace: "6:40/km" },
  { weeksAgo: 1, weekday: 5, title: "Tempo", distanceKm: 8, durationMin: 50, rpe: 7, pace: "6:15/km" },
  { weeksAgo: 1, weekday: 7, title: "Fondo largo (pico)", distanceKm: 15, durationMin: 95, rpe: 7, pace: "6:20/km" },

  // Semana actual (descarga deliberada — solo Lun/Mié completados si ya pasaron)
  { weeksAgo: 0, weekday: 1, title: "Fondo suave (descarga)", distanceKm: 4.5, durationMin: 30, rpe: 3, pace: "6:40/km" },
  { weeksAgo: 0, weekday: 3, title: "Fondo suave (descarga)", distanceKm: 5.5, durationMin: 35, rpe: 4, pace: "6:22/km" },
  { weeksAgo: 0, weekday: 5, title: "Fondo suave (descarga)", distanceKm: 5, durationMin: 32, rpe: 4, pace: "6:24/km", note: "Semana de descarga, sin intensidad." },
  { weeksAgo: 0, weekday: 7, title: "Rodaje corto", distanceKm: 6, durationMin: 40, rpe: 4, pace: "6:40/km" },
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: athleteEmail } });
  if (!user) {
    throw new Error(`No existe ningún User con email ${athleteEmail}. ¿Ya aceptó la invitación?`);
  }

  const athleteMembership = await prisma.teamMembership.findFirst({
    where: { userId: user.id, role: "ATHLETE" },
  });
  if (!athleteMembership) {
    throw new Error(`${athleteEmail} no tiene una membresía ATHLETE en ningún equipo.`);
  }

  const coachMembership = await prisma.teamMembership.findFirst({
    where: { teamId: athleteMembership.teamId, role: "COACH" },
  });
  if (!coachMembership) {
    throw new Error("No se encontró un coach en ese equipo.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;
  let completed = 0;

  for (const w of WORKOUTS) {
    const weekStart = startOfWeek(subWeeks(today, w.weeksAgo), { weekStartsOn: 1 });
    const localDate = addDays(weekStart, w.weekday - 1);
    const isPast = localDate <= today;
    // ScheduledWorkout.date es @db.Date, guardado como medianoche UTC — nunca
    // escribir un Date calculado en hora local directamente (ver
    // docs/PRODUCT_SPEC.md, riesgo de timezone).
    const date = toQueryBoundary(localDate);

    const durationSeconds = w.durationMin * 60;
    const distanceMeters = Math.round(w.distanceKm * 1000);

    const workout = await prisma.scheduledWorkout.create({
      data: {
        teamId: athleteMembership.teamId,
        athleteMembershipId: athleteMembership.id,
        coachMembershipId: coachMembership.id,
        date,
        title: w.title,
        structure: {
          segments: [
            {
              label: w.title,
              repeat: 1,
              distanceMeters,
              durationSeconds,
              targetPace: w.pace,
              ...(w.note ? { note: w.note } : {}),
            },
          ],
        },
        status: isPast ? "COMPLETED" : "PLANNED",
      },
    });
    created++;

    if (isPast) {
      await prisma.workoutCompletion.create({
        data: {
          scheduledWorkoutId: workout.id,
          completedAt: date,
          durationMinutes: w.durationMin,
          distanceKm: w.distanceKm,
          perceivedPace: w.pace,
          rpe: w.rpe,
          athleteComment: w.note ?? null,
        },
      });
      completed++;
    }
  }

  console.log(
    `Listo: ${created} entrenamientos creados para ${athleteEmail} (${completed} completados con feedback, ${created - completed} programados a futuro).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
