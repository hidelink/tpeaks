import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Siembra 4 plantillas de entrenamiento reutilizables, con variedad real de
 * tipos de sesión de running — para que /coach/templates se vea como se
 * usaría de verdad, no vacío.
 *
 * Uso: npx tsx scripts/seed-templates.ts [email-del-coach]
 * Sin argumento, asume que solo hay un coach y lo usa.
 */

const coachEmail = process.argv[2];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEMPLATES = [
  {
    title: "Series 10x400m",
    description:
      "Trabajo de velocidad en pista — mejora economía de carrera y VO2max. Ideal una vez por semana en bloques de base/construcción.",
    tags: ["velocidad", "series", "pista"],
    segments: [
      { label: "Calentamiento", durationSeconds: 900, note: "Trote suave + un par de progresiones cortas" },
      {
        label: "Serie 400m",
        repeat: 10,
        distanceMeters: 400,
        targetPace: "3:45/km",
        note: "Recuperación: 200m trote suave entre cada repetición",
      },
      { label: "Enfriamiento", durationSeconds: 600 },
    ],
  },
  {
    title: "Tempo 6km a ritmo umbral",
    description:
      "Tempo continuo para desarrollar el ritmo de umbral anaeróbico — la sensación de \"cómodamente duro\", no al máximo.",
    tags: ["tempo", "umbral"],
    segments: [
      { label: "Calentamiento", durationSeconds: 600, note: "Incluye 3-4 progresiones cortas" },
      { label: "Tempo", distanceMeters: 6000, durationSeconds: 1710, targetPace: "4:45/km" },
      { label: "Enfriamiento", durationSeconds: 600 },
    ],
  },
  {
    title: "Fondo largo progresivo",
    description:
      "Fondo largo que cierra más rápido de lo que empieza — construye resistencia y la sensación de correr fuerte con fatiga acumulada.",
    tags: ["fondo largo", "resistencia"],
    segments: [
      { label: "Primeros km, suave", distanceMeters: 12000, durationSeconds: 4320, targetPace: "6:00/km" },
      { label: "Km intermedios", distanceMeters: 6000, durationSeconds: 1980, targetPace: "5:30/km" },
      {
        label: "Cierre",
        distanceMeters: 4000,
        durationSeconds: 1200,
        targetPace: "5:00/km",
        note: "Controlado, no al límite — si se pierde la forma, bajarle un poco",
      },
    ],
  },
  {
    title: "Fartlek 8x2min",
    description:
      "Cambios de ritmo continuos sobre terreno variado — buen estímulo de velocidad sin la rigidez de la pista, útil fuera de temporada de series.",
    tags: ["fartlek", "velocidad"],
    segments: [
      { label: "Calentamiento", durationSeconds: 600 },
      {
        label: "Fuerte",
        repeat: 8,
        durationSeconds: 120,
        targetPace: "4:00/km",
        note: "2min trote suave de recuperación entre cada repetición",
      },
      { label: "Enfriamiento", durationSeconds: 600 },
    ],
  },
];

async function main() {
  let coachMembership;

  if (coachEmail) {
    const user = await prisma.user.findUnique({ where: { email: coachEmail } });
    if (!user) throw new Error(`No existe ningún User con email ${coachEmail}.`);
    coachMembership = await prisma.teamMembership.findFirst({
      where: { userId: user.id, role: "COACH" },
    });
    if (!coachMembership) throw new Error(`${coachEmail} no es coach de ningún equipo.`);
  } else {
    const coaches = await prisma.teamMembership.findMany({
      where: { role: "COACH" },
      include: { user: true },
    });
    if (coaches.length === 0) throw new Error("No hay ningún coach todavía.");
    if (coaches.length > 1) {
      throw new Error(
        `Hay ${coaches.length} coaches — especifica cuál con:\n` +
          `  npx tsx scripts/seed-templates.ts email@coach.com\n\n` +
          coaches.map((c) => `  - ${c.user.email}`).join("\n"),
      );
    }
    coachMembership = coaches[0];
  }

  for (const t of TEMPLATES) {
    await prisma.workoutTemplate.create({
      data: {
        teamId: coachMembership.teamId,
        createdById: coachMembership.userId,
        title: t.title,
        description: t.description,
        tags: t.tags,
        structure: { segments: t.segments },
      },
    });
  }

  console.log(`Listo: ${TEMPLATES.length} plantillas creadas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
