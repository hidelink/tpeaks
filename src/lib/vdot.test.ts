import { describe, it, expect } from "vitest";
import {
  calculateVdot,
  trainingPaces,
  formatPace,
  parseRaceTime,
  formatRaceTime,
} from "./vdot";

describe("calculateVdot", () => {
  it("un 5k en 20:00 da un VDOT ~49.8 (referencia bien conocida: 20:00 5k ~ VDOT 50)", () => {
    expect(calculateVdot(5000, 20 * 60)).toBeCloseTo(49.81, 1);
  });

  it("un maratón en 3:30:00 da un VDOT más bajo que el 5k de 20:00 (menor intensidad sostenible)", () => {
    const marathonVdot = calculateVdot(42195, 3.5 * 60 * 60);
    expect(marathonVdot).toBeCloseTo(44.55, 1);
    expect(marathonVdot).toBeLessThan(calculateVdot(5000, 20 * 60));
  });

  it("una carrera más rápida siempre da un VDOT más alto a igual distancia", () => {
    const slower = calculateVdot(10000, 50 * 60);
    const faster = calculateVdot(10000, 40 * 60);
    expect(faster).toBeGreaterThan(slower);
  });
});

describe("trainingPaces", () => {
  // VDOT de un 5k en 20:00 — valores de referencia calculados directamente
  // con la misma fórmula (Daniels-Gilbert), no de memoria.
  const vdot = calculateVdot(5000, 20 * 60);
  const paces = trainingPaces(vdot);

  it("el ritmo fácil es un rango, y el 'rápido' del rango es más veloz que el 'lento'", () => {
    expect(paces.easy.fastSecPerKm).toBeLessThan(paces.easy.slowSecPerKm);
  });

  it("los ritmos van de más lento a más rápido: fácil > maratón > umbral > intervalo > repetición", () => {
    expect(paces.easy.slowSecPerKm).toBeGreaterThan(paces.marathon);
    expect(paces.marathon).toBeGreaterThan(paces.threshold);
    expect(paces.threshold).toBeGreaterThan(paces.interval);
    expect(paces.interval).toBeGreaterThan(paces.repetition);
  });

  it("coincide con los valores de referencia calculados para VDOT ~49.8", () => {
    expect(paces.marathon).toBeCloseTo(271.0, 0);
    expect(paces.threshold).toBeCloseTo(251.4, 0);
    expect(paces.interval).toBeCloseTo(235.6, 0);
    expect(paces.repetition).toBeCloseTo(217.7, 0);
  });

  it("un VDOT más alto (mejor condición) siempre da ritmos más rápidos (menos segundos/km)", () => {
    const fitter = trainingPaces(vdot + 10);
    expect(fitter.marathon).toBeLessThan(paces.marathon);
    expect(fitter.threshold).toBeLessThan(paces.threshold);
  });
});

describe("parseRaceTime", () => {
  it("acepta MM:SS", () => {
    expect(parseRaceTime("20:00")).toBe(1200);
    expect(parseRaceTime("42:15")).toBe(2535);
  });

  it("acepta H:MM:SS", () => {
    expect(parseRaceTime("1:32:40")).toBe(5560);
    expect(parseRaceTime("3:30:00")).toBe(12600);
  });

  it("permite que la primera parte pase de 59 (90:00 = 90 minutos)", () => {
    expect(parseRaceTime("90:00")).toBe(5400);
  });

  it("ignora espacios alrededor", () => {
    expect(parseRaceTime("  20:00 ")).toBe(1200);
  });

  it("rechaza formatos inválidos", () => {
    expect(parseRaceTime("20")).toBeNull();
    expect(parseRaceTime("1:2:3:4")).toBeNull();
    expect(parseRaceTime("20:aa")).toBeNull();
    expect(parseRaceTime("")).toBeNull();
    // Minutos/segundos fuera de rango en las partes que no son la primera.
    expect(parseRaceTime("1:60:00")).toBeNull();
    expect(parseRaceTime("20:75")).toBeNull();
  });

  it("rechaza un tiempo de cero", () => {
    expect(parseRaceTime("0:00")).toBeNull();
  });
});

describe("formatRaceTime", () => {
  it("omite las horas cuando el tiempo es menor a una hora", () => {
    expect(formatRaceTime(1200)).toBe("20:00");
    expect(formatRaceTime(2535)).toBe("42:15");
  });

  it("incluye las horas cuando hacen falta", () => {
    expect(formatRaceTime(5560)).toBe("1:32:40");
    expect(formatRaceTime(12600)).toBe("3:30:00");
  });

  it("es la inversa de parseRaceTime", () => {
    for (const t of ["20:00", "42:15", "1:32:40", "3:30:00"]) {
      expect(formatRaceTime(parseRaceTime(t)!)).toBe(t);
    }
  });
});

describe("formatPace", () => {
  it("formatea segundos/km como M:SS/km", () => {
    expect(formatPace(271)).toBe("4:31/km");
    expect(formatPace(300)).toBe("5:00/km");
  });

  it("rellena los segundos con cero a la izquierda cuando hace falta", () => {
    expect(formatPace(245)).toBe("4:05/km");
  });

  it("redondea en vez de truncar", () => {
    expect(formatPace(299.6)).toBe("5:00/km");
  });
});
