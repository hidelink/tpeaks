import { describe, it, expect, vi, afterEach } from "vitest";
import { toLocalCalendarDate, todayAsUtcMidnight, toQueryBoundary } from "./calendar-date";

describe("toLocalCalendarDate", () => {
  it("reads the same calendar date locally as the DB value reads in UTC", () => {
    // Como vendría de Prisma para un ScheduledWorkout.date del 29 de junio 2026.
    const dbDate = new Date("2026-06-29T00:00:00.000Z");
    const result = toLocalCalendarDate(dbDate);

    expect(result.getFullYear()).toBe(dbDate.getUTCFullYear());
    expect(result.getMonth()).toBe(dbDate.getUTCMonth());
    expect(result.getDate()).toBe(dbDate.getUTCDate());
  });

  it("regression: en un timezone detrás de UTC, ya no se lee un día antes", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/Mexico_City";
    try {
      const dbDate = new Date("2026-06-29T00:00:00.000Z"); // lunes
      const result = toLocalCalendarDate(dbDate);
      // El bug original hacía que esto leyera domingo 28 en vez de lunes 29.
      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(5); // junio, 0-indexed
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("es estable en el límite de fin de mes/año", () => {
    const dbDate = new Date("2025-12-31T00:00:00.000Z");
    const result = toLocalCalendarDate(dbDate);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(31);
  });
});

describe("toQueryBoundary", () => {
  it("convierte una fecha local a medianoche UTC del mismo día calendario", () => {
    const localDate = new Date(2026, 5, 29); // 29 de junio, hora local, cualquier TZ
    const result = toQueryBoundary(localDate);

    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(29);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });

  it("regression: un endOfWeek local (23:59:59.999) no se corre al día calendario siguiente", () => {
    // Simula exactamente lo que endOfWeek(reference, {weekStartsOn:1}) produce:
    // el último instante local del domingo.
    const localEndOfWeek = new Date(2026, 6, 5, 23, 59, 59, 999); // domingo 5 de julio, 23:59:59.999 local
    const result = toQueryBoundary(localEndOfWeek);

    // Sin el fix, convertir esto directo a ISO en un TZ detrás de UTC cae en
    // la madrugada del 6 de julio (lunes de la semana siguiente).
    expect(result.getUTCDate()).toBe(5);
    expect(result.getUTCMonth()).toBe(6);
  });

  it("es la inversa de toLocalCalendarDate", () => {
    const dbDate = new Date("2026-03-15T00:00:00.000Z");
    const roundTripped = toQueryBoundary(toLocalCalendarDate(dbDate));
    expect(roundTripped.getTime()).toBe(dbDate.getTime());
  });
});

describe("todayAsUtcMidnight", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna medianoche UTC del día calendario local de hoy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24, 15, 30)); // 24 de julio, 3:30pm hora local
    const result = todayAsUtcMidnight();

    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(6);
    expect(result.getUTCDate()).toBe(24);
    expect(result.getUTCHours()).toBe(0);
  });
});
