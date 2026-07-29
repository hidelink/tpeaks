import { describe, it, expect, afterEach } from "vitest";
import { clubToday, DEFAULT_CLUB_TIMEZONE } from "./club-time";
import { format } from "date-fns";

const original = process.env.TZ;
afterEach(() => {
  process.env.TZ = original;
});

/** Lo que lee date-fns con getters locales, que es como se usa en toda la app. */
const asCalendarDay = (d: Date) => format(d, "yyyy-MM-dd");

describe("clubToday", () => {
  // El caso exacto que destapó el bug: 18:35 del martes en México son las
  // 00:35 del miércoles en UTC. El servidor de Vercel corre en UTC y por eso
  // el dashboard mostraba los números de un día que todavía no empezaba.
  it("de noche en México sigue siendo el mismo día, aunque en UTC ya sea el siguiente", () => {
    const instant = new Date("2026-07-29T00:35:00.000Z");

    expect(asCalendarDay(clubToday("America/Mexico_City", instant))).toBe("2026-07-28");
    expect(asCalendarDay(clubToday("UTC", instant))).toBe("2026-07-29");
  });

  it("no depende de la zona horaria del proceso", () => {
    const instant = new Date("2026-07-29T00:35:00.000Z");

    process.env.TZ = "UTC";
    const desdeUtc = asCalendarDay(clubToday("America/Mexico_City", instant));
    process.env.TZ = "Asia/Tokyo";
    const desdeTokio = asCalendarDay(clubToday("America/Mexico_City", instant));

    // Es el punto entero de la función: el servidor puede estar donde sea.
    expect(desdeUtc).toBe("2026-07-28");
    expect(desdeTokio).toBe("2026-07-28");
  });

  it("distingue clubes en zonas distintas en el mismo instante", () => {
    const instant = new Date("2026-07-29T02:00:00.000Z");

    expect(asCalendarDay(clubToday("America/Mexico_City", instant))).toBe("2026-07-28");
    expect(asCalendarDay(clubToday("America/Bogota", instant))).toBe("2026-07-28");
    expect(asCalendarDay(clubToday("Europe/Madrid", instant))).toBe("2026-07-29");
  });

  it("devuelve medianoche local, lista para las funciones de date-fns", () => {
    const day = clubToday("America/Mexico_City", new Date("2026-07-29T00:35:00.000Z"));

    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
    expect(day.getSeconds()).toBe(0);
  });

  it("cae al default en vez de tumbar la página si la zona es inválida", () => {
    const instant = new Date("2026-07-29T00:35:00.000Z");

    expect(() => clubToday("Zona/Inventada", instant)).not.toThrow();
    expect(asCalendarDay(clubToday("Zona/Inventada", instant))).toBe(
      asCalendarDay(clubToday(DEFAULT_CLUB_TIMEZONE, instant)),
    );
  });

  it("respeta el cambio de horario de verano", () => {
    // Madrid está en UTC+2 en verano y UTC+1 en invierno.
    expect(asCalendarDay(clubToday("Europe/Madrid", new Date("2026-07-14T22:30:00.000Z")))).toBe(
      "2026-07-15",
    );
    expect(asCalendarDay(clubToday("Europe/Madrid", new Date("2026-01-14T22:30:00.000Z")))).toBe(
      "2026-01-14",
    );
  });
});
