import { describe, it, expect } from "vitest";
import { SPORTS, sportMeta, RUNNING_KM_SPORTS, groupBySport } from "./sports";
import { WorkoutSport } from "@/generated/prisma/enums";

describe("SPORTS", () => {
  it("cubre todos los valores del enum de Prisma — si se agrega uno y se olvida aquí, este test falla", () => {
    const inEnum = Object.values(WorkoutSport).sort();
    const inMetadata = SPORTS.map((s) => s.value).sort();
    expect(inMetadata).toEqual(inEnum);
  });

  it("no repite valores", () => {
    expect(new Set(SPORTS.map((s) => s.value)).size).toBe(SPORTS.length);
  });

  it("todo deporte que sugiere ritmos también usa el campo de ritmo", () => {
    for (const s of SPORTS) {
      if (s.suggestsPaces) expect(s.usesPace).toBe(true);
    }
  });

  it("solo correr en plano sugiere los ritmos calculados — el VDOT no se traduce a otros deportes", () => {
    expect(SPORTS.filter((s) => s.suggestsPaces).map((s) => s.value)).toEqual(["RUN"]);
  });

  it("un deporte sin ritmo tampoco trae placeholder de ritmo", () => {
    for (const s of SPORTS) {
      if (!s.usesPace) expect(s.paceHint).toBe("");
    }
  });
});

describe("sportMeta", () => {
  it("devuelve la metadata del deporte", () => {
    expect(sportMeta("STRENGTH").label).toBe("Fuerza");
    expect(sportMeta("STRENGTH").usesDistance).toBe(false);
  });

  it("falla ruidosamente ante un deporte desconocido en vez de renderizar vacío", () => {
    // @ts-expect-error — a propósito: simula un valor nuevo del enum sin metadata.
    expect(() => sportMeta("PADEL")).toThrow(/sports.ts/);
  });
});

describe("groupBySport", () => {
  it("agrupa respetando el orden de SPORTS, no el de entrada", () => {
    const groups = groupBySport([
      { id: "a", sport: "MOBILITY" as const },
      { id: "b", sport: "RUN" as const },
      { id: "c", sport: "STRENGTH" as const },
      { id: "d", sport: "RUN" as const },
    ]);
    expect(groups.map((g) => g.meta.value)).toEqual(["RUN", "STRENGTH", "MOBILITY"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["b", "d"]);
  });

  it("omite los grupos vacíos", () => {
    const groups = groupBySport([{ sport: "BIKE" as const }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].meta.value).toBe("BIKE");
  });

  it("con una lista vacía no devuelve grupos", () => {
    expect(groupBySport([])).toEqual([]);
  });
});

describe("RUNNING_KM_SPORTS", () => {
  it("cuenta correr y trail, no bici ni natación — sumar km de bici con km de correr da un número sin significado", () => {
    expect(RUNNING_KM_SPORTS).toEqual(["RUN", "TRAIL_RUN"]);
  });
});
