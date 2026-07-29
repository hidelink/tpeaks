import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      // src/lib/actions/** estuvo excluido y eso escondía el problema: la capa
      // donde viven autorización, validación e integridad de datos no tenía un
      // solo test, y el porcentaje global se veía sano igual. Medirla hace
      // visible lo que falta.
      exclude: ["src/lib/**/*.test.ts", "src/lib/prisma.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
