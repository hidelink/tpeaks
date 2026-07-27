import { describe, it, expect } from "vitest";
import { mapOrgRole } from "./clerk-sync";

describe("mapOrgRole", () => {
  it("org:admin se mapea a COACH", () => {
    expect(mapOrgRole("org:admin")).toBe("COACH");
  });

  it("org:member se mapea a ATHLETE", () => {
    expect(mapOrgRole("org:member")).toBe("ATHLETE");
  });

  it("cualquier otro valor (incluyendo null/undefined) cae a ATHLETE por defecto", () => {
    expect(mapOrgRole(null)).toBe("ATHLETE");
    expect(mapOrgRole(undefined)).toBe("ATHLETE");
    expect(mapOrgRole("org:algo_raro")).toBe("ATHLETE");
  });
});
