import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Marca (o desmarca) a un usuario existente como SOPORTE de plataforma.
 * No confundir con el rol ADMIN de club (src/lib/roles.ts): esto da acceso a
 * /admin, que ve todos los clubes, y vive en User.isPlatformAdmin.
 * No hay UI para esto a propósito — son muy pocas personas las que
 * necesitan este acceso (ver src/lib/permissions.ts, requirePlatformAdmin).
 *
 * Uso: npx tsx scripts/make-admin.ts email@ejemplo.com [--revoke]
 */

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Uso: npx tsx scripts/make-admin.ts email@ejemplo.com [--revoke]");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No existe ningún User con email ${email}.`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: !revoke },
  });

  console.log(`${email} ahora ${revoke ? "NO tiene" : "tiene"} acceso de soporte de plataforma.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
