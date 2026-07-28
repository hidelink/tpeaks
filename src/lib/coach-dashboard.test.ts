import { describe, it, expect } from "vitest";
import {
  weeklyCompliance,
  daysSinceLastActivity,
  pickInactiveAthletes,
  loadByAthlete,
} from "./coach-dashboard";

/** Igual que Prisma devuelve una columna @db.Date: medianoche UTC. */
function dbDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Una hora local cualquiera de ese día — a propósito no es medianoche. */
function localNoon(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

describe("weeklyCompliance", () => {
  // El caso real que motivó el arreglo: martes 28/07/2026, 9 entrenamientos
  // programados en la semana, 7 de ellos en días que todavía no llegan.
  const week = [
    { date: dbDate("2026-07-27"), status: "COMPLETED" },
    { date: dbDate("2026-07-27"), status: "PLANNED" },
    { date: dbDate("2026-07-28"), status: "PLANNED" },
    { date: dbDate("2026-07-29"), status: "PLANNED" },
    { date: dbDate("2026-07-30"), status: "PLANNED" },
    { date: dbDate("2026-07-30"), status: "PLANNED" },
    { date: dbDate("2026-07-31"), status: "PLANNED" },
    { date: dbDate("2026-08-01"), status: "PLANNED" },
    { date: dbDate("2026-08-02"), status: "PLANNED" },
  ];

  it("solo cuenta lo que ya venció, no la semana completa", () => {
    const result = weeklyCompliance(week, localNoon("2026-07-28"));
    // Vencidos = los dos del lunes 27. Hoy (28) se excluye a propósito.
    expect(result).toEqual({ due: 2, completed: 1, rate: 50 });
  });

  it("no cuenta el día de hoy: la sesión todavía se puede hacer en la tarde", () => {
    const soloHoy = [{ date: dbDate("2026-07-28"), status: "PLANNED" }];
    expect(weeklyCompliance(soloHoy, localNoon("2026-07-28")).due).toBe(0);
  });

  it("devuelve rate null cuando nada ha vencido — un 0% de lunes sería mentira", () => {
    const result = weeklyCompliance(week, localNoon("2026-07-27"));
    expect(result).toEqual({ due: 0, completed: 0, rate: null });
  });

  it("al cerrar la semana ya cuenta todo lo programado", () => {
    const result = weeklyCompliance(week, localNoon("2026-08-03"));
    expect(result.due).toBe(9);
    expect(result.completed).toBe(1);
    expect(result.rate).toBe(11);
  });

  it("no se corre un día en un timezone detrás de UTC", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Mexico_City";
    try {
      // El entrenamiento del 27 venció el 28; leído con getters locales sin
      // normalizar, la fecha UTC se vería como el 26 y seguiría contando.
      const result = weeklyCompliance(
        [{ date: dbDate("2026-07-28"), status: "PLANNED" }],
        localNoon("2026-07-28"),
      );
      expect(result.due).toBe(0);
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("daysSinceLastActivity", () => {
  it("cuenta días de calendario, no horas", () => {
    expect(daysSinceLastActivity(dbDate("2026-07-25"), localNoon("2026-07-28"))).toBe(3);
  });

  it("un entrenamiento de hoy da cero", () => {
    expect(daysSinceLastActivity(dbDate("2026-07-28"), localNoon("2026-07-28"))).toBe(0);
  });

  it("devuelve null si nunca registró nada", () => {
    expect(daysSinceLastActivity(null, localNoon("2026-07-28"))).toBeNull();
  });
});

describe("pickInactiveAthletes", () => {
  const today = localNoon("2026-07-28");

  it("señala a quien pasó el umbral y deja fuera a quien está al corriente", () => {
    const result = pickInactiveAthletes(
      [
        { id: "a", name: "Al corriente", lastCompletedDate: dbDate("2026-07-27") },
        { id: "b", name: "Ausente", lastCompletedDate: dbDate("2026-07-10") },
      ],
      today,
    );
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("incluye a quien nunca registró nada — es el que más fácil se pierde", () => {
    const result = pickInactiveAthletes(
      [{ id: "nuevo", name: "Recién invitado", lastCompletedDate: null }],
      today,
    );
    expect(result).toEqual([{ id: "nuevo", name: "Recién invitado", daysSince: null }]);
  });

  it("ordena por más ausente primero, con los que nunca registraron al frente", () => {
    const result = pickInactiveAthletes(
      [
        { id: "b", name: "B", lastCompletedDate: dbDate("2026-07-10") },
        { id: "nunca", name: "Nunca", lastCompletedDate: null },
        { id: "c", name: "C", lastCompletedDate: dbDate("2026-07-01") },
      ],
      today,
    );
    expect(result.map((r) => r.id)).toEqual(["nunca", "c", "b"]);
  });

  it("respeta un umbral distinto", () => {
    const athletes = [{ id: "a", name: "A", lastCompletedDate: dbDate("2026-07-24") }];
    expect(pickInactiveAthletes(athletes, today, 10)).toHaveLength(0);
    expect(pickInactiveAthletes(athletes, today, 4)).toHaveLength(1);
  });
});

describe("loadByAthlete", () => {
  const today = localNoon("2026-07-28"); // semana del 27/07; anterior, del 20/07

  it("separa la carga de esta semana de la de la anterior", () => {
    const result = loadByAthlete(
      [
        { athleteMembershipId: "a", date: dbDate("2026-07-27"), rpe: 5, durationMinutes: 60 },
        { athleteMembershipId: "a", date: dbDate("2026-07-22"), rpe: 7, durationMinutes: 30 },
      ],
      today,
    );
    expect(result.get("a")).toEqual({ thisWeek: 300, lastWeek: 210 });
  });

  it("suma varias sesiones de la misma semana", () => {
    const result = loadByAthlete(
      [
        { athleteMembershipId: "a", date: dbDate("2026-07-27"), rpe: 5, durationMinutes: 60 },
        { athleteMembershipId: "a", date: dbDate("2026-07-28"), rpe: 5, durationMinutes: 20 },
      ],
      today,
    );
    expect(result.get("a")?.thisWeek).toBe(400);
  });

  it("ignora semanas más viejas en vez de meterlas en 'la anterior'", () => {
    const result = loadByAthlete(
      [{ athleteMembershipId: "a", date: dbDate("2026-06-01"), rpe: 9, durationMinutes: 90 }],
      today,
    );
    expect(result.has("a")).toBe(false);
  });

  it("trata rpe o duración faltantes como carga cero, sin romperse", () => {
    const result = loadByAthlete(
      [{ athleteMembershipId: "a", date: dbDate("2026-07-27"), rpe: null, durationMinutes: 60 }],
      today,
    );
    expect(result.get("a")?.thisWeek).toBe(0);
  });
});
