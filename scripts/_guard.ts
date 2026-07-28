/**
 * Seguro para scripts que BORRAN datos.
 *
 * El riesgo es concreto, no teórico: hoy la base de datos de desarrollo y la
 * que sirve el sitio desplegado son la misma. `seed-marathon-training.ts`
 * borra entrenamientos, feedback y comentarios de un atleta antes de sembrar;
 * correrlo sin pensar mientras alguien ve el demo se lleva sus datos.
 *
 * Este guard no impide nada que no se pueda impedir con atención — impide
 * hacerlo *sin darse cuenta*. Imprime a qué base apunta y exige --force.
 */
/**
 * Argumentos posicionales, sin las banderas. Necesario porque los scripts leen
 * el email en `process.argv[2]`: sin filtrar, `script.ts --force` tomaría
 * "--force" como si fuera el email y fallaría con un mensaje confuso.
 */
export function positionalArgs(): string[] {
  return process.argv.slice(2).filter((a) => !a.startsWith("-"));
}

export function assertDestructiveAllowed(whatItDeletes: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");

  const { hostname, port, pathname } = new URL(url);
  const target = `${hostname}:${port}${pathname}`;

  const forced = process.argv.includes("--force") || process.argv.includes("-f");

  console.log(`\nBase de datos: ${target}`);
  console.log(`Este script BORRA: ${whatItDeletes}\n`);

  if (!forced) {
    // Sale en vez de lanzar: un stack trace de 20 líneas esconde justo el
    // mensaje que la persona necesita leer. Se llama antes de conectar a la
    // base, así que no hay nada que cerrar.
    console.error(
      "Script destructivo detenido.\n\n" +
        "Revisa la base de datos de arriba y, si de verdad es la que quieres\n" +
        "modificar, vuelve a correrlo agregando --force al final.\n",
    );
    process.exit(1);
  }

  console.log("--force presente, continuando.\n");
}
