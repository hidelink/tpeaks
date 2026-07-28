import type { MembershipRole } from "@/generated/prisma/enums";

/**
 * Roles de club y qué puede hacer cada uno.
 *
 * Los permisos se checan contra CAPACIDADES, no comparando el rol. La razón es
 * concreta: cuando este proyecto solo tenía COACH y ATHLETE, cada Server Action
 * hacía `requireRole("COACH")`. Al agregar un rol con más permisos, todas esas
 * comparaciones habrían dejado a esa persona fuera de su propia plataforma, y
 * el error no lo habría atrapado ningún test — solo aparecería al iniciar
 * sesión con ese rol. Con capacidades, agregar un rol es editar la tabla de
 * abajo. Lo mismo permitió fusionar OWNER en ADMIN sin auditar nada.
 *
 * ADMIN es la unión de todo lo que un club puede hacer, a propósito: el caso
 * que manda es el club de una persona que administra y entrena. Separar "dueño"
 * de "administración" agregaba vocabulario sin agregar capacidades.
 *
 * DECISIÓN: no se modela "ADMIN que además es socio". Quien administre un club
 * y quiera entrenar en él como socio usa otra cuenta. Es explícito, no un
 * descuido: con un solo valor la exclusión la garantiza el motor de datos; con
 * una lista de roles habría que validarla a mano en cada escritura, y si se
 * cuela un ["ADMIN","ATHLETE"] la persona califica para dos layouts y aterriza
 * en el que decida el orden de dos ifs.
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
  // Todo lo del club. En un club de una persona, el único rol necesario.
  ADMIN: ["MANAGE_TRAINING", "MANAGE_MEMBERS", "MANAGE_CLUB"],
  // Un coach invita a sus propios atletas, pero no toca los ajustes del club:
  // un coach contratado no debería poder cambiar la marca ni, después, los cobros.
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
  ADMIN: "Admin",
  COACH: "Coach",
  ATHLETE: "Socio",
};

/** Orden de presentación: de más autoridad a menos. */
export const STAFF_ROLES: readonly MembershipRole[] = ["ADMIN", "COACH"];
