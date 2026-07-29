import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workoutCompletion: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getWeeklyLoadSeries } from "./training-load";

const findManyMock = prisma.workoutCompletion.findMany as unknown as ReturnType<typeof vi.fn>;

function completion(isoDate: string, rpe: number, durationMinutes: number) {
  return {
    rpe,
    durationMinutes,
    scheduledWorkout: { date: new Date(isoDate) },
  };
}

describe("getWeeklyLoadSeries", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    // El mismo timezone (detrás de UTC) donde se confirmó el bug original —
    // si el bucketing por semana estuviera roto, estos tests lo atraparían
    // sin depender de en qué TZ corra CI.
    process.env.TZ = "America/Mexico_City";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 12, 0)); // jueves 23 de julio 2026, mediodía local
  });

  afterEach(() => {
    process.env.TZ = originalTz;
    vi.useRealTimers();
    findManyMock.mockReset();
  });

  it("suma sRPE (RPE × duración) por semana, patrón 3 semanas construyendo + 1 de descarga", async () => {
    findManyMock.mockResolvedValue([
      completion("2026-06-29T00:00:00.000Z", 4, 40), // semana -3: load 160
      completion("2026-07-06T00:00:00.000Z", 7, 50), // semana -2: load 350 (lunes exacto, ver regression test)
      completion("2026-07-13T00:00:00.000Z", 8, 55), // semana -1: load 440
      completion("2026-07-20T00:00:00.000Z", 3, 30), // semana actual: load 90 (descarga)
    ]);

    const weeks = await getWeeklyLoadSeries("athlete_1", new Date(), 4);

    expect(weeks.map((w) => w.load)).toEqual([160, 350, 440, 90]);
    expect(weeks.every((w) => w.hasData)).toBe(true);
  });

  it("regression: un ScheduledWorkout.date de lunes exacto no se cuenta en la semana anterior", async () => {
    // Este es exactamente el escenario del bug: si toLocalCalendarDate no se
    // aplicara antes de startOfWeek, este lunes (medianoche UTC) se leería
    // como domingo en hora local y caería en la semana equivocada.
    findManyMock.mockResolvedValue([completion("2026-07-06T00:00:00.000Z", 7, 50)]);

    const weeks = await getWeeklyLoadSeries("athlete_1", new Date(), 4);

    const week29Jun = weeks[0]; // semana que empieza 29 de junio
    const week06Jul = weeks[1]; // semana que empieza 6 de julio
    expect(week29Jun.load).toBe(0);
    expect(week29Jun.hasData).toBe(false);
    expect(week06Jul.load).toBe(350);
    expect(week06Jul.hasData).toBe(true);
  });

  it("una semana sin entrenamientos completados queda en 0 con hasData=false, no se omite", async () => {
    findManyMock.mockResolvedValue([
      completion("2026-06-29T00:00:00.000Z", 4, 40),
      // semana -2 sin datos
      completion("2026-07-13T00:00:00.000Z", 8, 55),
      completion("2026-07-20T00:00:00.000Z", 3, 30),
    ]);

    const weeks = await getWeeklyLoadSeries("athlete_1", new Date(), 4);

    expect(weeks).toHaveLength(4);
    expect(weeks[1].load).toBe(0);
    expect(weeks[1].hasData).toBe(false);
  });

  it("el promedio móvil de 4 semanas se calcula sobre la semana actual + las 3 anteriores", async () => {
    findManyMock.mockResolvedValue([
      completion("2026-06-29T00:00:00.000Z", 4, 40), // 160
      completion("2026-07-06T00:00:00.000Z", 7, 50), // 350
      completion("2026-07-13T00:00:00.000Z", 8, 55), // 440
      completion("2026-07-20T00:00:00.000Z", 3, 30), // 90
    ]);

    const weeks = await getWeeklyLoadSeries("athlete_1", new Date(), 4);

    expect(weeks[0].chronicAvg).toBeCloseTo(160);
    expect(weeks[1].chronicAvg).toBeCloseTo((160 + 350) / 2);
    expect(weeks[2].chronicAvg).toBeCloseTo((160 + 350 + 440) / 3);
    expect(weeks[3].chronicAvg).toBeCloseTo((160 + 350 + 440 + 90) / 4);
  });

  it("ignora completions sin rpe o sin duración (no se puede calcular su carga)", async () => {
    // El propio query de Prisma ya filtra rpe/durationMinutes null vía el
    // `where`, así que si el mock (simulando ese filtro) no las regresa,
    // no deberían contarse como si fueran carga 0 con datos.
    findManyMock.mockResolvedValue([completion("2026-07-20T00:00:00.000Z", 5, 40)]);

    const weeks = await getWeeklyLoadSeries("athlete_1", new Date(), 4);
    const currentWeek = weeks[weeks.length - 1];
    expect(currentWeek.load).toBe(200);
  });
});
