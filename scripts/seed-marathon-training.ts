import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertDestructiveAllowed, positionalArgs } from "./_guard";
import { startOfWeek, addDays } from "date-fns";
import { toQueryBoundary } from "../src/lib/calendar-date";

/**
 * Siembra un bloque completo de entrenamiento (9 semanas) para un atleta que
 * se prepara para el Maratón de la Ciudad de México — pensado como demo de
 * cómo se vería un plan real de un amateur normal (no elite), con la
 * periodización típica: base -> pico -> taper -> carrera. CDMX es a
 * ~2,240m de altitud, así que los ritmos objetivo son más conservadores
 * de lo que este atleta correría al nivel del mar.
 *
 * Reemplaza (borra) los ScheduledWorkout/WorkoutCompletion previos del
 * atleta para no mezclar esta narrativa con datos de prueba genéricos
 * anteriores — es más útil como demo si cuenta una sola historia coherente.
 *
 * Uso: npx tsx scripts/seed-marathon-training.ts [email-del-atleta]
 * Default: member@yopmail.com
 */

const athleteEmail = positionalArgs()[0] ?? "member@yopmail.com";

// Domingo de la semana de la carrera. Cambia esto si quieres correr la demo
// en otro momento del ciclo (base/pico/taper) relativo a "hoy".
const RACE_DATE = new Date(2026, 7, 30);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Segment = {
  label: string;
  repeat?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  targetPace?: string;
  note?: string;
};

type PlannedWorkout = {
  weeksBeforeRace: number; // 8 = ocho semanas antes de la carrera, 0 = semana de la carrera
  weekday: number; // 1 = lunes ... 7 = domingo
  title: string;
  segments: Segment[];
  durationMin: number;
  distanceKm: number;
  rpe: number;
  pace: string;
  comment?: string;
};

const ALTITUDE_NOTE =
  "CDMX está a ~2,240m — el ritmo se siente más duro que al nivel del mar. Ajusta por sensación, no solo por el número.";

const PLAN: PlannedWorkout[] = [
  // ---- Semana -8: base ----
  { weeksBeforeRace: 8, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3120 }], durationMin: 52, distanceKm: 8, rpe: 4, pace: "6:30/km" },
  { weeksBeforeRace: 8, weekday: 3, title: "Tempo con ritmo maratón", segments: [
    { label: "Calentamiento", distanceMeters: 3000, durationSeconds: 1080 },
    { label: "Ritmo maratón", distanceMeters: 5000, targetPace: "6:10/km", durationSeconds: 1850 },
    { label: "Enfriamiento", distanceMeters: 2000, durationSeconds: 780 },
  ], durationMin: 60, distanceKm: 10, rpe: 7, pace: "6:00/km" },
  { weeksBeforeRace: 8, weekday: 4, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 40, distanceKm: 6, rpe: 3, pace: "6:40/km" },
  { weeksBeforeRace: 8, weekday: 6, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3120 }], durationMin: 52, distanceKm: 8, rpe: 4, pace: "6:30/km" },
  { weeksBeforeRace: 8, weekday: 7, title: "Fondo largo", segments: [
    { label: "Fondo controlado", distanceMeters: 17000, durationSeconds: 6800 },
    { label: "Últimos km un poco más rápido", distanceMeters: 5000, durationSeconds: 1700 },
  ], durationMin: 140, distanceKm: 22, rpe: 6, pace: "6:22/km", comment: "Se sintió bien, altitud pesa en las subidas del Bosque de Chapultepec." },

  // ---- Semana -7: build ----
  { weeksBeforeRace: 7, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3120 }], durationMin: 52, distanceKm: 8, rpe: 4, pace: "6:30/km" },
  { weeksBeforeRace: 7, weekday: 3, title: "Resistencia a ritmo maratón", segments: [
    { label: "Calentamiento", distanceMeters: 2000, durationSeconds: 720 },
    { label: "3x3km a ritmo maratón", repeat: 3, distanceMeters: 3000, targetPace: "6:10/km", durationSeconds: 1110, note: "2min trote suave entre series" },
    { label: "Enfriamiento", distanceMeters: 3000, durationSeconds: 1170 },
  ], durationMin: 80, distanceKm: 14, rpe: 7, pace: "6:05/km" },
  { weeksBeforeRace: 7, weekday: 4, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 40, distanceKm: 6, rpe: 3, pace: "6:40/km" },
  { weeksBeforeRace: 7, weekday: 6, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3120 }], durationMin: 52, distanceKm: 8, rpe: 4, pace: "6:30/km" },
  { weeksBeforeRace: 7, weekday: 7, title: "Fondo largo", segments: [
    { label: "Fondo controlado", distanceMeters: 19000, durationSeconds: 7600 },
    { label: "Últimos km a buen ritmo", distanceMeters: 5000, durationSeconds: 1700 },
  ], durationMin: 155, distanceKm: 24, rpe: 7, pace: "6:28/km" },

  // ---- Semana -6: build + carrera de control ----
  { weeksBeforeRace: 6, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3120 }], durationMin: 52, distanceKm: 8, rpe: 4, pace: "6:30/km" },
  { weeksBeforeRace: 6, weekday: 3, title: "Tempo con ritmo medio maratón", segments: [
    { label: "Calentamiento", distanceMeters: 3000, durationSeconds: 1080 },
    { label: "Ritmo medio maratón", distanceMeters: 6000, targetPace: "5:50/km", durationSeconds: 2100 },
    { label: "Enfriamiento", distanceMeters: 3000, durationSeconds: 1170 },
  ], durationMin: 65, distanceKm: 12, rpe: 7, pace: "5:55/km" },
  { weeksBeforeRace: 6, weekday: 4, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 40, distanceKm: 6, rpe: 3, pace: "6:40/km" },
  { weeksBeforeRace: 6, weekday: 6, title: "Fondo suave (pre-carrera)", segments: [{ label: "Fondo muy suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 38, distanceKm: 6, rpe: 3, pace: "6:45/km" },
  { weeksBeforeRace: 6, weekday: 7, title: "Carrera de control — Medio Maratón", segments: [
    { label: "Medio Maratón (carrera)", distanceMeters: 21100, targetPace: "5:45/km", durationSeconds: 5700, note: ALTITUDE_NOTE },
  ], durationMin: 95, distanceKm: 21.1, rpe: 8, pace: "5:45/km", comment: "Buena señal de fitness — terminé fuerte, el ritmo maratón se siente controlado." },

  // ---- Semana -5: pico ----
  { weeksBeforeRace: 5, weekday: 1, title: "Fondo suave (recuperación de la carrera)", segments: [{ label: "Fondo muy suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 40, distanceKm: 6, rpe: 3, pace: "6:40/km" },
  { weeksBeforeRace: 5, weekday: 3, title: "Tempo con ritmo maratón", segments: [
    { label: "Calentamiento", distanceMeters: 3000, durationSeconds: 1080 },
    { label: "Ritmo maratón", distanceMeters: 8000, targetPace: "6:10/km", durationSeconds: 2960 },
    { label: "Enfriamiento", distanceMeters: 3000, durationSeconds: 1170 },
  ], durationMin: 78, distanceKm: 14, rpe: 7, pace: "6:05/km" },
  { weeksBeforeRace: 5, weekday: 4, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 7000, durationSeconds: 2760 }], durationMin: 46, distanceKm: 7, rpe: 4, pace: "6:35/km" },
  { weeksBeforeRace: 5, weekday: 6, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3120 }], durationMin: 52, distanceKm: 8, rpe: 4, pace: "6:30/km" },
  { weeksBeforeRace: 5, weekday: 7, title: "Fondo largo (el más largo del bloque)", segments: [
    { label: "Fondo controlado", distanceMeters: 22000, durationSeconds: 8800 },
    { label: "A ritmo maratón", distanceMeters: 10000, targetPace: "6:10/km", durationSeconds: 3700 },
  ], durationMin: 205, distanceKm: 32, rpe: 8, pace: "6:31/km", comment: "El fondo largo clave del bloque. Probé geles e hidratación como si fuera el día de la carrera — bien, sin problemas estomacales." },

  // ---- Semana -4: empieza a bajar volumen ----
  { weeksBeforeRace: 4, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 7000, durationSeconds: 2760 }], durationMin: 46, distanceKm: 7, rpe: 4, pace: "6:35/km" },
  { weeksBeforeRace: 4, weekday: 3, title: "Tempo con ritmo maratón", segments: [
    { label: "Calentamiento", distanceMeters: 2000, durationSeconds: 720 },
    { label: "Ritmo maratón", distanceMeters: 5000, targetPace: "6:10/km", durationSeconds: 1850 },
    { label: "Enfriamiento", distanceMeters: 3000, durationSeconds: 1170 },
  ], durationMin: 58, distanceKm: 10, rpe: 6, pace: "6:05/km" },
  { weeksBeforeRace: 4, weekday: 4, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 40, distanceKm: 6, rpe: 3, pace: "6:40/km" },
  { weeksBeforeRace: 4, weekday: 6, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 7000, durationSeconds: 2760 }], durationMin: 45, distanceKm: 7, rpe: 3, pace: "6:35/km" },
  { weeksBeforeRace: 4, weekday: 7, title: "Fondo largo", segments: [
    { label: "Fondo controlado", distanceMeters: 26000, durationSeconds: 10500 },
  ], durationMin: 175, distanceKm: 26, rpe: 6, pace: "6:44/km" },

  // ---- Semana -3: taper empieza ----
  { weeksBeforeRace: 3, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 6000, durationSeconds: 2400 }], durationMin: 40, distanceKm: 6, rpe: 3, pace: "6:40/km" },
  { weeksBeforeRace: 3, weekday: 3, title: "Fondo con progresión", segments: [
    { label: "Fondo suave", distanceMeters: 6000, durationSeconds: 2400 },
    { label: "Progresión a ritmo maratón", distanceMeters: 2000, targetPace: "6:10/km", durationSeconds: 740 },
  ], durationMin: 52, distanceKm: 8, rpe: 5, pace: "6:30/km" },
  { weeksBeforeRace: 3, weekday: 4, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 5000, durationSeconds: 2100 }], durationMin: 35, distanceKm: 5, rpe: 3, pace: "7:00/km" },
  { weeksBeforeRace: 3, weekday: 6, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 5000, durationSeconds: 2100 }], durationMin: 35, distanceKm: 5, rpe: 3, pace: "7:00/km" },
  { weeksBeforeRace: 3, weekday: 7, title: "Fondo largo (taper)", segments: [{ label: "Fondo suave", distanceMeters: 18000, durationSeconds: 7500 }], durationMin: 125, distanceKm: 18, rpe: 5, pace: "6:56/km" },

  // ---- Semana -2: taper profundo ----
  { weeksBeforeRace: 2, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 5000, durationSeconds: 2100 }], durationMin: 35, distanceKm: 5, rpe: 3, pace: "7:00/km" },
  { weeksBeforeRace: 2, weekday: 3, title: "Fondo suave con progresiones", segments: [
    { label: "Fondo suave", distanceMeters: 5500, durationSeconds: 2280 },
    { label: "4 progresiones de 100m", distanceMeters: 400, durationSeconds: 100, note: "solo activar piernas, sin buscar velocidad máxima" },
  ], durationMin: 40, distanceKm: 6, rpe: 4, pace: "6:40/km" },
  { weeksBeforeRace: 2, weekday: 5, title: "Fondo muy suave", segments: [{ label: "Trote suave", distanceMeters: 4000, durationSeconds: 1800 }], durationMin: 30, distanceKm: 4, rpe: 2, pace: "7:30/km" },
  { weeksBeforeRace: 2, weekday: 7, title: "Fondo medio con ritmo maratón", segments: [
    { label: "Fondo suave", distanceMeters: 8000, durationSeconds: 3360 },
    { label: "A ritmo maratón", distanceMeters: 3000, targetPace: "6:10/km", durationSeconds: 1110 },
  ], durationMin: 75, distanceKm: 11, rpe: 5, pace: "6:49/km" },

  // ---- Semana -1: última semana antes de la carrera ----
  { weeksBeforeRace: 1, weekday: 1, title: "Fondo suave", segments: [{ label: "Fondo suave", distanceMeters: 5000, durationSeconds: 2100 }], durationMin: 35, distanceKm: 5, rpe: 3, pace: "7:00/km" },
  { weeksBeforeRace: 1, weekday: 3, title: "Fondo suave con progresiones cortas", segments: [
    { label: "Fondo suave", distanceMeters: 3500, durationSeconds: 1500 },
    { label: "4 progresiones cortas", distanceMeters: 400, durationSeconds: 100 },
  ], durationMin: 30, distanceKm: 4, rpe: 3, pace: "7:15/km" },
  { weeksBeforeRace: 1, weekday: 5, title: "Trote muy suave", segments: [{ label: "Trote + movilidad", distanceMeters: 3000, durationSeconds: 1440 }], durationMin: 24, distanceKm: 3, rpe: 2, pace: "8:00/km", comment: "Solo movilidad, nada de fatiga." },
  { weeksBeforeRace: 1, weekday: 6, title: "Activación pre-carrera", segments: [
    { label: "Trote muy suave", distanceMeters: 2500, durationSeconds: 1200 },
    { label: "3 zancadas suaves", distanceMeters: 100, durationSeconds: 25 },
  ], durationMin: 22, distanceKm: 3, rpe: 2, pace: "8:00/km" },

  // ---- Semana 0: semana de la carrera ----
  { weeksBeforeRace: 0, weekday: 3, title: "Shakeout run", segments: [{ label: "Trote muy corto", distanceMeters: 3000, durationSeconds: 1500 }], durationMin: 25, distanceKm: 3, rpe: 2, pace: "8:20/km", comment: "Piernas frescas, listo para el domingo." },
  { weeksBeforeRace: 0, weekday: 7, title: "Maratón de la Ciudad de México", segments: [
    { label: "Maratón (objetivo ~4:20:00)", distanceMeters: 42195, targetPace: "6:10/km", durationSeconds: 15600, note: ALTITUDE_NOTE },
  ], durationMin: 260, distanceKm: 42.2, rpe: 9, pace: "6:10/km", comment: "¡Día de la carrera!" },
];

async function main() {
  assertDestructiveAllowed(
    `todos los entrenamientos, feedback y comentarios previos de ${athleteEmail}`,
  );

  const user = await prisma.user.findUnique({ where: { email: athleteEmail } });
  if (!user) throw new Error(`No existe ningún User con email ${athleteEmail}.`);

  const athleteMembership = await prisma.teamMembership.findFirst({
    where: { userId: user.id, role: "ATHLETE" },
  });
  if (!athleteMembership) throw new Error(`${athleteEmail} no tiene una membresía ATHLETE.`);

  const coachMembership = await prisma.teamMembership.findFirst({
    where: { teamId: athleteMembership.teamId, role: "COACH" },
  });
  if (!coachMembership) throw new Error("No se encontró un coach en ese equipo.");

  // Limpia lo anterior de este atleta para contar una sola historia coherente.
  const previous = await prisma.scheduledWorkout.findMany({
    where: { athleteMembershipId: athleteMembership.id },
    select: { id: true },
  });
  const previousIds = previous.map((w) => w.id);
  await prisma.coachComment.deleteMany({ where: { scheduledWorkoutId: { in: previousIds } } });
  await prisma.workoutCompletion.deleteMany({ where: { scheduledWorkoutId: { in: previousIds } } });
  await prisma.scheduledWorkout.deleteMany({ where: { id: { in: previousIds } } });
  console.log(`Borrados ${previousIds.length} entrenamientos previos de ${athleteEmail}.`);

  const raceWeekStart = startOfWeek(RACE_DATE, { weekStartsOn: 1 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;
  let completed = 0;

  for (const w of PLAN) {
    const weekStart = addDays(raceWeekStart, -7 * w.weeksBeforeRace);
    const localDate = addDays(weekStart, w.weekday - 1);
    const isPast = localDate <= today;
    const date = toQueryBoundary(localDate);

    const workout = await prisma.scheduledWorkout.create({
      data: {
        teamId: athleteMembership.teamId,
        athleteMembershipId: athleteMembership.id,
        coachMembershipId: coachMembership.id,
        date,
        title: w.title,
        structure: { segments: w.segments },
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
          athleteComment: w.comment ?? null,
        },
      });
      completed++;
    }
  }

  console.log(
    `Listo: ${created} entrenamientos para ${athleteEmail} rumbo al Maratón CDMX (${RACE_DATE.toDateString()}) — ${completed} completados, ${created - completed} programados a futuro.`,
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
