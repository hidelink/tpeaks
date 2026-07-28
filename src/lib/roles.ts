import type { MembershipRole } from "@/generated/prisma/enums";

/**
 * Roles de club y qué puede hacer cada uno.
 *
 * Los permisos se checan contra CAPACIDADES, no comparando el rol. La razón es
 * concreta: cuando este proyecto solo tenía COACH y ATHLETE, cada Server Action
 * hacía `requireRole("COACH")`. Al agregar OWNER, todas esas comparaciones
 * habrían dejado al dueño del club fuera de su propia plataforma, y el error no
 * lo habría atrapado ningún test — solo aparecería al iniciar sesión como
 * dueño. Con capacidades, agregar un rol es editar la tabla de abajo.
 *
 * LIMITACIÓN CONOCIDA: el rol es un solo valor, así que no se puede expresar
 * "dueño del club que además entrena como atleta", que en clubes chicos es
 * común (el fundador suele correr con su propio grupo). Cuando haga falta, el
 * cambio es pasar `role` a una lista o a una tabla aparte; las capacidades ya
 * están listas para recibirlo porque nada compara el rol directamente.
 */
export type Capability =
  /** Crear plantillas, asignar y editar entrenamientos, comentar. */
  | "MANAGE_TRAINING"
  /** Invitar, revocar y ver la ficha de los socios. */
  | "MANAGE_MEMBERS"
  /** Ajustes del club: marca, y más adelante planes de membresía y cobros. */
  | "MANAGE_CLUB"
  /** Registrar el propio entrenamiento y dar feedback. */
  | "LOG_OWN_TRAINING";

const CAPABILITIES: Record<MembershipRole, readonly Capability[]> = {
  OWNER: ["MANAGE_TRAINING", "MANAGE_MEMBERS", "MANAGE_CLUB"],
  // Administración sin entrenar: puede dar de alta socios y tocar ajustes,
  // pero no prescribe entrenamientos.
  ADMIN: ["MANAGE_MEMBERS", "MANAGE_CLUB"],
  // Un coach invita a sus propios atletas, pero no toca los ajustes del club.
  COACH: ["MANAGE_TRAINING", "MANAGE_MEMBERS"],
  ATHLETE: ["LOG_OWN_TRAINING"],
};

export function can(role: MembershipRole, capability: Capability): boolean {
  return CAPABILITIES[role]?.includes(capability) ?? false;
}

/**
 * Cualquiera que trabaje en el club, en oposición a los socios. Es el criterio
 * para decidir qué navegación y qué layout ve alguien, no para autorizar
 * acciones — para eso está `can`.
 */
export function isStaff(role: MembershipRole): boolean {
  return role !== "ATHLETE";
}

export const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Dueño",
  ADMIN: "Administración",
  COACH: "Coach",
  ATHLETE: "Socio",
};

/** Orden de presentación: de más autoridad a menos. */
export const STAFF_ROLES: readonly MembershipRole[] = ["OWNER", "ADMIN", "COACH"];
