import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MembershipRole } from "../src/generated/prisma/enums";
import { ROLE_LABELS } from "../src/lib/roles";
import { positionalArgs } from "./_guard";

/**
 * Cambia el rol de alguien dentro de su club. No hay pantalla para esto
 * todavía a propósito: cambiar roles es poco frecuente y darle UI antes de
 * tener la pantalla de socios de la Fase 1 sería trabajo tirado.
 *
 * Uso:
 *   npx tsx scripts/set-role.ts email@ejemplo.com OWNER
 *   npx tsx scripts/set-role.ts                     (lista los roles actuales)
 *
 * No lleva --force: cambiar un rol es reversible corriéndolo otra vez.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const VALID = Object.values(MembershipRole);

async function listAll() {
  const memberships = await prisma.teamMembership.findMany({
    include: { user: true, team: true },
    orderBy: [{ team: { name: "asc" } }, { role: "asc" }],
  });

  if (memberships.length === 0) {
    console.log("No hay membresías todavía.");
    return;
  }

  console.log("\nRoles actuales:\n");
  for (const m of memberships) {
    const label = ROLE_LABELS[m.role].padEnd(15);
    console.log(`  ${label} ${m.user.email.padEnd(28)} ${m.team.name}${m.status !== "ACTIVE" ? ` [${m.status}]` : ""}`);
  }
  console.log(`\nPara cambiar uno:\n  npx tsx scripts/set-role.ts email@ejemplo.com ${VALID.join("|")}\n`);
}

async function main() {
  const [email, roleArg] = positionalArgs();

  if (!email) {
    await listAll();
    return;
  }

  if (!roleArg) throw new Error(`Falta el rol. Opciones: ${VALID.join(", ")}`);

  const role = roleArg.toUpperCase() as MembershipRole;
  if (!VALID.includes(role)) {
    throw new Error(`Rol inválido: ${roleArg}. Opciones: ${VALID.join(", ")}`);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No existe ningún usuario con email ${email}.`);

  const membership = await prisma.teamMembership.findFirst({
    where: { userId: user.id },
    include: { team: true },
  });
  if (!membership) throw new Error(`${email} no pertenece a ningún club.`);

  if (membership.role === role) {
    console.log(`${email} ya es ${ROLE_LABELS[role]} en ${membership.team.name}. Sin cambios.`);
    return;
  }

  await prisma.teamMembership.update({ where: { id: membership.id }, data: { role } });

  console.log(
    `${email} en ${membership.team.name}: ${ROLE_LABELS[membership.role]} -> ${ROLE_LABELS[role]}`,
  );
  console.log("Recarga la app para ver el cambio (los permisos se leen en cada request).");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
