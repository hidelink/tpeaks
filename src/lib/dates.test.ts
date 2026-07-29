import { describe, it, expect, vi } from "vitest";
import {
  getCurrentWeekRange,
  parseDateParam,
  adjacentWeekParams,
  getMonthGridRange,
  adjacentMonthParams,
} from "./dates";

describe("getCurrentWeekRange", () => {
  it("una referencia a mitad de semana da lunes-domingo de esa semana", () => {
    const wednesday = new Date(2026, 6, 22); // miércoles 22 de julio 2026
    const { start, end } = getCurrentWeekRange(wednesday);

    expect(start.getDate()).toBe(20); // lunes
    expect(start.getMonth()).toBe(6);
    expect(end.getDate()).toBe(26); // domingo
    expect(end.getMonth()).toBe(6);
  });

  it("una referencia que ya es lunes se queda igual", () => {
    const monday = new Date(2026, 6, 20);
    const { start } = getCurrentWeekRange(monday);
    expect(start.getDate()).toBe(20);
  });

  it("una referencia que ya es domingo no se corre a la semana siguiente", () => {
    const sunday = new Date(2026, 6, 26);
    const { start, end } = getCurrentWeekRange(sunday);
    expect(start.getDate()).toBe(20);
    expect(end.getDate()).toBe(26);
  });

  it("cruza el límite de mes correctamente", () => {
    // 29 de junio 2026 es lunes; esa semana termina domingo 5 de julio.
    const { start, end } = getCurrentWeekRange(new Date(2026, 5, 30));
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(29);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(5);
  });
});

/** Cualquier día sirve; lo que importa es que sea explícito y no new Date(). */
const HOY = new Date(2026, 6, 28);

describe("parseDateParam", () => {
  it("un string yyyy-MM-dd válido se parsea en hora local al mismo día", () => {
    const result = parseDateParam("2026-07-24", HOY);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(24);
  });

  it("sin param, usa el día que se le pasa", () => {
    expect(parseDateParam(undefined, HOY)).toBe(HOY);
  });

  it("un string inválido cae de vuelta a ese mismo día en vez de tronar", () => {
    expect(parseDateParam("no-es-una-fecha", HOY)).toBe(HOY);
  });

  // Antes el fallback era new Date(), así que el día salía del reloj del
  // proceso — en Vercel, UTC. Ahora tiene que venir de quien llama, que sabe
  // la zona del club.
  it("NO usa el reloj del sistema: el día lo decide quien llama", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    try {
      expect(parseDateParam(undefined, HOY).getDate()).toBe(28);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("adjacentWeekParams", () => {
  it("da la semana anterior y siguiente como yyyy-MM-dd", () => {
    const { previous, next } = adjacentWeekParams(new Date(2026, 6, 22));
    expect(previous).toBe("2026-07-15");
    expect(next).toBe("2026-07-29");
  });
});

describe("getMonthGridRange", () => {
  it("julio 2026 arranca en lunes 29 de junio y termina domingo 2 de agosto", () => {
    const { monthStart, monthEnd, gridStart, gridEnd } = getMonthGridRange(new Date(2026, 6, 15));

    expect(monthStart.getMonth()).toBe(6);
    expect(monthStart.getDate()).toBe(1);
    expect(monthEnd.getMonth()).toBe(6);
    expect(monthEnd.getDate()).toBe(31);

    expect(gridStart.getMonth()).toBe(5); // junio
    expect(gridStart.getDate()).toBe(29);
    expect(gridEnd.getMonth()).toBe(7); // agosto
    expect(gridEnd.getDate()).toBe(2);
  });

  it("un mes que empieza en lunes no necesita días del mes anterior", () => {
    // Junio 2026 empieza lunes 1.
    const { gridStart, monthStart } = getMonthGridRange(new Date(2026, 5, 10));
    expect(gridStart.getTime()).toBe(monthStart.getTime());
  });
});

describe("adjacentMonthParams", () => {
  it("da el mes anterior y siguiente", () => {
    const { previous, next } = adjacentMonthParams(new Date(2026, 6, 15));
    expect(previous.slice(0, 7)).toBe("2026-06");
    expect(next.slice(0, 7)).toBe("2026-08");
  });
});
