import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertDestructiveAllowed, positionalArgs } from "./_guard";

/**
 * Siembra plantillas de entrenamiento reutilizables, con variedad real de
 * tipos de sesión — para que /coach/templates se vea como se usaría de verdad,
 * no vacío. Incluye fuerza y movilidad, que es como entrena un corredor de
 * verdad: no solo corriendo.
 *
 * Re-ejecutable: borra primero las plantillas con estos mismos títulos, para
 * no acumular copias cada vez que se corre.
 *
 * Uso: npx tsx scripts/seed-templates.ts [email-del-coach]
 * Sin argumento, asume que solo hay un coach y lo usa.
 */

const coachEmail = positionalArgs()[0];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEMPLATES = [
  {
    sport: "RUN" as const,
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
    sport: "RUN" as const,
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
    sport: "RUN" as const,
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
    sport: "RUN" as const,
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
  {
    sport: "STRENGTH" as const,
    title: "Fuerza para corredores",
    description:
      "Trabajo de fuerza general, 2 veces por semana en base. Sin campos de distancia ni ritmo: las series, repeticiones y peso van en la etiqueta de cada ejercicio.",
    tags: ["fuerza", "gimnasio"],
    segments: [
      { label: "Movilidad y activación", durationSeconds: 600 },
      { label: "Sentadilla 4x8 @ 60-70% 1RM", targetRpe: 7, note: "2min de descanso entre series" },
      { label: "Peso muerto rumano 3x10", targetRpe: 7 },
      { label: "Zancadas con mancuernas 3x10 por pierna", targetRpe: 6 },
      { label: "Elevación de talones 3x15", targetRpe: 6, note: "Clave para el tendón de Aquiles" },
      { label: "Core: plancha 3x45s + dead bug 3x10", durationSeconds: 480 },
    ],
  },
  {
    sport: "MOBILITY" as const,
    title: "Movilidad post-fondo",
    description:
      "Sesión corta para el día después del fondo largo. Sin intensidad: el objetivo es recuperar, no entrenar.",
    tags: ["movilidad", "recuperación"],
    segments: [
      { label: "Movilidad de cadera (90/90, flexores)", durationSeconds: 480, targetRpe: 2 },
      { label: "Isquiotibiales y gemelos", durationSeconds: 360, targetRpe: 2 },
      { label: "Foam roller: cuádriceps, glúteo, banda iliotibial", durationSeconds: 480, targetRpe: 3 },
      { label: "Respiración y estiramiento suave", durationSeconds: 300, targetRpe: 1 },
    ],
  },
  {
    sport: "BIKE" as const,
    title: "Bici — 60min zona 2 (cross-training)",
    description:
      "Trabajo aeróbico sin impacto: útil para sumar volumen sin cargar más las piernas, o para mantener la forma con una molestia menor.",
    tags: ["bici", "cross-training"],
    segments: [
      { label: "Calentamiento progresivo", durationSeconds: 600, targetRpe: 3 },
      { label: "Bloque continuo zona 2", durationSeconds: 2400, targetPace: "Conversación posible", targetRpe: 4 },
      { label: "Vuelta a la calma", durationSeconds: 600, targetRpe: 2 },
    ],
  },
];

async function main() {
  assertDestructiveAllowed(
    `las plantillas del club que se llamen igual que las de este script (${TEMPLATES.length})`,
  );

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

  // Re-ejecutable: quita las versiones anteriores de estas mismas plantillas.
  // Borrarlas no afecta entrenamientos ya asignados (templateId es SET NULL y
  // structure es un snapshot) — ver src/lib/actions/templates.ts.
  await prisma.workoutTemplate.deleteMany({
    where: { teamId: coachMembership.teamId, title: { in: TEMPLATES.map((t) => t.title) } },
  });

  for (const t of TEMPLATES) {
    await prisma.workoutTemplate.create({
      data: {
        teamId: coachMembership.teamId,
        createdById: coachMembership.userId,
        title: t.title,
        description: t.description,
        sport: t.sport,
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
