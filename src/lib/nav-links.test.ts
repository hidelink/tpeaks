import { describe, it, expect } from "vitest";
import { navLinksFor, STAFF_NAV_LINKS, ATHLETE_NAV_LINKS } from "./nav-links";
import { can } from "./roles";

const hrefs = (role: Parameters<typeof navLinksFor>[0]) => navLinksFor(role).map((l) => l.href);

describe("navLinksFor", () => {
  it("un admin ve todo el área de club", () => {
    expect(hrefs("ADMIN")).toEqual(STAFF_NAV_LINKS.map((l) => l.href));
  });

  it("un coach no ve Ajustes, porque no toca la marca ni los cobros del club", () => {
    expect(hrefs("COACH")).not.toContain("/coach/settings");
    expect(hrefs("COACH")).toContain("/coach/templates");
  });

  it("dashboard y calendario los ve cualquiera del staff", () => {
    for (const role of ["ADMIN", "COACH"] as const) {
      expect(hrefs(role)).toContain("/coach");
      expect(hrefs(role)).toContain("/coach/calendar");
    }
  });

  it("un socio recibe su propia navegación, nunca la del club", () => {
    expect(navLinksFor("ATHLETE")).toEqual(ATHLETE_NAV_LINKS);
    expect(hrefs("ATHLETE").every((h) => h.startsWith("/athlete"))).toBe(true);
  });

  it("todo link visible es uno que el rol sí puede usar — es la invariante que importa", () => {
    for (const role of ["ADMIN", "COACH"] as const) {
      for (const link of navLinksFor(role)) {
        if (link.requires) {
          expect(can(role, link.requires), `${role} ve ${link.href} sin poder usarlo`).toBe(true);
        }
      }
    }
  });
});
