import { describe, it, expect } from "vitest";
import { can, isStaff, ROLE_LABELS, STAFF_ROLES, type Capability } from "./roles";
import { MembershipRole } from "@/generated/prisma/enums";

const ALL_ROLES = Object.values(MembershipRole);
const ALL_CAPABILITIES: Capability[] = [
  "MANAGE_TRAINING",
  "MANAGE_MEMBERS",
  "MANAGE_CLUB",
  "LOG_OWN_TRAINING",
];

describe("can", () => {
  it("el dueño puede todo lo del club: entrenar, socios y ajustes", () => {
    expect(can("OWNER", "MANAGE_TRAINING")).toBe(true);
    expect(can("OWNER", "MANAGE_MEMBERS")).toBe(true);
    expect(can("OWNER", "MANAGE_CLUB")).toBe(true);
  });

  it("administración maneja socios y ajustes, pero no prescribe entrenamientos", () => {
    expect(can("ADMIN", "MANAGE_MEMBERS")).toBe(true);
    expect(can("ADMIN", "MANAGE_CLUB")).toBe(true);
    expect(can("ADMIN", "MANAGE_TRAINING")).toBe(false);
  });

  it("un coach entrena e invita a sus atletas, pero no toca los ajustes del club", () => {
    expect(can("COACH", "MANAGE_TRAINING")).toBe(true);
    expect(can("COACH", "MANAGE_MEMBERS")).toBe(true);
    expect(can("COACH", "MANAGE_CLUB")).toBe(false);
  });

  it("un socio solo registra su propio entrenamiento", () => {
    expect(can("ATHLETE", "LOG_OWN_TRAINING")).toBe(true);
    expect(can("ATHLETE", "MANAGE_TRAINING")).toBe(false);
    expect(can("ATHLETE", "MANAGE_MEMBERS")).toBe(false);
    expect(can("ATHLETE", "MANAGE_CLUB")).toBe(false);
  });

  it("nadie del staff registra entrenamiento propio: el rol es de un solo valor", () => {
    // Limitación documentada en roles.ts, no un descuido. Si un dueño quiere
    // entrenar con su club, hoy necesita otra membresía.
    for (const role of STAFF_ROLES) {
      expect(can(role, "LOG_OWN_TRAINING")).toBe(false);
    }
  });

  it("todo rol del enum tiene al menos una capacidad — un rol sin nada es un bug", () => {
    for (const role of ALL_ROLES) {
      const some = ALL_CAPABILITIES.some((c) => can(role, c));
      expect(some, `${role} no puede hacer nada`).toBe(true);
    }
  });
});

describe("isStaff", () => {
  it("distingue a quien trabaja en el club de los socios", () => {
    expect(isStaff("OWNER")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
    expect(isStaff("COACH")).toBe(true);
    expect(isStaff("ATHLETE")).toBe(false);
  });

  it("coincide con STAFF_ROLES", () => {
    expect(ALL_ROLES.filter(isStaff).sort()).toEqual([...STAFF_ROLES].sort());
  });
});

describe("ROLE_LABELS", () => {
  it("cubre todos los valores del enum de Prisma — si se agrega un rol y se olvida, este test falla", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ALL_ROLES].sort());
  });

  it("no deja etiquetas vacías", () => {
    for (const label of Object.values(ROLE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
