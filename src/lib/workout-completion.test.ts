import { describe, it, expect } from "vitest";
import { parseCompletionFeedback } from "./workout-completion";

describe("parseCompletionFeedback", () => {
  it("deja pasar un feedback normal tal cual", () => {
    expect(
      parseCompletionFeedback({
        durationMinutes: 45,
        distanceKm: 8.5,
        rpe: 6,
        perceivedPace: "5:20/km",
        athleteComment: "Me sentí bien",
      }),
    ).toEqual({
      durationMinutes: 45,
      distanceKm: 8.5,
      rpe: 6,
      perceivedPace: "5:20/km",
      athleteComment: "Me sentí bien",
    });
  });

  it("todos los campos son opcionales: marcar sin feedback es válido", () => {
    expect(parseCompletionFeedback({})).toEqual({
      durationMinutes: undefined,
      distanceKm: undefined,
      rpe: undefined,
      perceivedPace: undefined,
      athleteComment: undefined,
    });
  });

  describe("RPE", () => {
    // El motivo de que exista esta validación: el RPE se MULTIPLICA por la
    // duración para la carga de entrenamiento. Un 100 aplasta la escala de la
    // gráfica y deja las demás semanas visualmente en cero.
    it("rechaza valores fuera de la escala 1-10", () => {
      expect(() => parseCompletionFeedback({ rpe: 100 })).toThrow(/RPE/);
      expect(() => parseCompletionFeedback({ rpe: 0 })).toThrow(/RPE/);
      expect(() => parseCompletionFeedback({ rpe: -5 })).toThrow(/RPE/);
      expect(() => parseCompletionFeedback({ rpe: 11 })).toThrow(/RPE/);
    });

    it("acepta los dos extremos de la escala", () => {
      expect(parseCompletionFeedback({ rpe: 1 }).rpe).toBe(1);
      expect(parseCompletionFeedback({ rpe: 10 }).rpe).toBe(10);
    });

    it("rechaza decimales y NaN — Number('abc') llega como NaN desde el formulario", () => {
      expect(() => parseCompletionFeedback({ rpe: 7.5 })).toThrow(/entero/);
      expect(() => parseCompletionFeedback({ rpe: NaN })).toThrow(/número/);
    });
  });

  describe("duración", () => {
    it("rechaza cero, negativos y más de 24 horas", () => {
      expect(() => parseCompletionFeedback({ durationMinutes: 0 })).toThrow(/Duración/);
      expect(() => parseCompletionFeedback({ durationMinutes: -30 })).toThrow(/Duración/);
      expect(() => parseCompletionFeedback({ durationMinutes: 1441 })).toThrow(/Duración/);
    });

    it("acepta una sesión larga pero plausible", () => {
      expect(parseCompletionFeedback({ durationMinutes: 300 }).durationMinutes).toBe(300);
    });
  });

  describe("distancia", () => {
    it("rechaza cero, negativos y distancias absurdas", () => {
      // Un km negativo restaría de la métrica "Km corriendo" del club.
      expect(() => parseCompletionFeedback({ distanceKm: -5 })).toThrow(/Distancia/);
      expect(() => parseCompletionFeedback({ distanceKm: 0 })).toThrow(/Distancia/);
      expect(() => parseCompletionFeedback({ distanceKm: 900 })).toThrow(/Distancia/);
    });

    it("permite decimales y los redondea a dos", () => {
      expect(parseCompletionFeedback({ distanceKm: 10.456 }).distanceKm).toBe(10.46);
      expect(parseCompletionFeedback({ distanceKm: 5.000000001 }).distanceKm).toBe(5);
    });
  });

  describe("texto", () => {
    it("recorta espacios y convierte el vacío en undefined", () => {
      const result = parseCompletionFeedback({ athleteComment: "   ", perceivedPace: "  5:00  " });
      expect(result.athleteComment).toBeUndefined();
      expect(result.perceivedPace).toBe("5:00");
    });

    it("rechaza un comentario desmedido", () => {
      expect(() => parseCompletionFeedback({ athleteComment: "a".repeat(2001) })).toThrow(
        /Comentario/,
      );
    });

    it("acepta un comentario largo pero razonable", () => {
      const comment = "a".repeat(2000);
      expect(parseCompletionFeedback({ athleteComment: comment }).athleteComment).toBe(comment);
    });
  });
});
