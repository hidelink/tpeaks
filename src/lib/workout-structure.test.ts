import { describe, it, expect } from "vitest";
import { parseWorkoutStructure, parseWorkoutStructureInput } from "./workout-structure";

describe("parseWorkoutStructure", () => {
  it("acepta un segmento mínimo (solo etiqueta)", () => {
    const result = parseWorkoutStructure({ segments: [{ label: "Fondo suave" }] });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].repeat).toBe(1); // default
  });

  it("acepta un segmento completo", () => {
    const result = parseWorkoutStructure({
      segments: [
        {
          label: "Serie 1",
          repeat: 10,
          distanceMeters: 400,
          durationSeconds: 90,
          targetPace: "3:45/km",
          targetRpe: 8,
          note: "Recuperación trote suave",
        },
      ],
    });
    expect(result.segments[0].repeat).toBe(10);
    expect(result.segments[0].distanceMeters).toBe(400);
  });

  it("distancia/duración/ritmo/RPE son independientes: cualquier subconjunto es válido", () => {
    expect(() =>
      parseWorkoutStructure({ segments: [{ label: "Fondo", durationSeconds: 1200 }] }),
    ).not.toThrow();
    expect(() =>
      parseWorkoutStructure({ segments: [{ label: "Repeticiones", distanceMeters: 400 }] }),
    ).not.toThrow();
  });

  it("rechaza una lista de segmentos vacía", () => {
    expect(() => parseWorkoutStructure({ segments: [] })).toThrow();
  });

  it("rechaza un segmento sin etiqueta", () => {
    expect(() => parseWorkoutStructure({ segments: [{ label: "" }] })).toThrow();
  });

  it("rechaza distancia/duración en cero o negativas", () => {
    expect(() =>
      parseWorkoutStructure({ segments: [{ label: "X", distanceMeters: 0 }] }),
    ).toThrow();
    expect(() =>
      parseWorkoutStructure({ segments: [{ label: "X", durationSeconds: -5 }] }),
    ).toThrow();
  });

  it("rechaza RPE fuera de 1-10", () => {
    expect(() =>
      parseWorkoutStructure({ segments: [{ label: "X", targetRpe: 11 }] }),
    ).toThrow();
    expect(() =>
      parseWorkoutStructure({ segments: [{ label: "X", targetRpe: 0 }] }),
    ).toThrow();
  });

  it("rechaza algo que ni siquiera tiene forma de estructura", () => {
    expect(() => parseWorkoutStructure(null)).toThrow();
    expect(() => parseWorkoutStructure("no es un objeto")).toThrow();
    expect(() => parseWorkoutStructure({})).toThrow();
  });
});

describe("parseWorkoutStructureInput (mensajes de error legibles)", () => {
  it("estructura válida no lanza y retorna los datos", () => {
    const result = parseWorkoutStructureInput({ segments: [{ label: "Fondo", repeat: 1 }] });
    expect(result.segments[0].label).toBe("Fondo");
  });

  it("señala el número de segmento y el campo en español, no el error crudo de Zod", () => {
    expect(() =>
      parseWorkoutStructureInput({
        segments: [{ label: "Fondo" }, { label: "Series", distanceMeters: -1 }],
      }),
    ).toThrowError(/Segmento 2 — Distancia/);
  });

  it("junta varios problemas en un solo mensaje separado por ' · '", () => {
    try {
      parseWorkoutStructureInput({
        segments: [
          { label: "", distanceMeters: -1 },
          { label: "ok", durationSeconds: -1 },
        ],
      });
      expect.unreachable("debía lanzar");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("Segmento 1");
      expect(message).toContain("Segmento 2");
      expect(message.split(" · ").length).toBeGreaterThan(1);
    }
  });

  it("nunca deja pasar el JSON crudo de ZodError al mensaje", () => {
    try {
      parseWorkoutStructureInput({ segments: [{ label: "", distanceMeters: -1 }] });
      expect.unreachable("debía lanzar");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toMatch(/"origin"|"code"|ZodError/);
    }
  });
});
