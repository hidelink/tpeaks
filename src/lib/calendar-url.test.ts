import { describe, it, expect } from "vitest";
import { buildCalendarHref } from "./calendar-url";

describe("buildCalendarHref", () => {
  it("sin ningún param, retorna solo el basePath", () => {
    expect(buildCalendarHref("/coach/calendar", {})).toBe("/coach/calendar");
  });

  it("incluye solo los params presentes", () => {
    const href = buildCalendarHref("/coach/calendar", { view: "month" });
    expect(href).toBe("/coach/calendar?view=month");
  });

  it("arma la URL completa con todos los filtros", () => {
    const href = buildCalendarHref("/coach/calendar", {
      date: "2026-07-24",
      view: "week",
      athleteId: "ath_123",
      q: "tempo",
    });
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/coach/calendar");
    expect(url.searchParams.get("date")).toBe("2026-07-24");
    expect(url.searchParams.get("view")).toBe("week");
    expect(url.searchParams.get("athleteId")).toBe("ath_123");
    expect(url.searchParams.get("q")).toBe("tempo");
  });

  it("un string vacío en q no se agrega (evita ?q= colgado)", () => {
    const href = buildCalendarHref("/athlete/calendar", { view: "week", q: "" });
    expect(href).toBe("/athlete/calendar?view=week");
  });

  it("date undefined explícito (usado para el link 'Hoy') no se agrega", () => {
    const href = buildCalendarHref("/coach/calendar", { date: undefined, view: "month" });
    expect(href).toBe("/coach/calendar?view=month");
  });
});
