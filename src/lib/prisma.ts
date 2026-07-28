import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requiere un driver adapter explícito en runtime (ya no lee
// DATABASE_URL implícitamente vía el datasource del schema). El CLI
// (migrate/studio) usa DIRECT_URL vía prisma.config.ts.
//
// DATABASE_URL debe apuntar al pooler de Supabase en TRANSACTION MODE
// (puerto 6543), no en session mode (5432). En session mode cada conexión se
// queda con un backend de Postgres dedicado y el tope son 15 clientes: con
// varias instancias serverless en paralelo (Next.js precarga los links del
// nav, así que una visita dispara media docena de renders a la vez) se agota
// en segundos y toda la app devuelve 500 con
// "(EMAXCONNSESSION) max clients reached in session mode". Pasó en producción.
//
// `max` acota además el pool de pg POR INSTANCIA. El default de node-postgres
// es 10, así que una sola lambda podía acaparar más conexiones que todo el
// resto de la app junto. En transaction mode las conexiones se multiplexan,
// así que un pool chico no cuesta latencia.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX ?? 3),
});

// Evita agotar conexiones en dev por hot-reload de Next.js.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
