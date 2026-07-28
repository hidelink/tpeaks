import { describe, it, expect } from "vitest";
import { mapOrgRole } from "./clerk-sync";

describe("mapOrgRole", () => {
  it("org:admin se mapea a ADMIN de club: quien crea la organización está dando de alta su club", () => {
    expect(mapOrgRole("org:admin")).toBe("ADMIN");
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
