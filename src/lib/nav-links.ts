import { can, type Capability } from "@/lib/roles";
import type { MembershipRole } from "@/generated/prisma/enums";

export type NavLink = {
  href: string;
  label: string;
  /** Sin esto, el link lo ve cualquiera del staff. */
  requires?: Capability;
};

/**
 * Navegación del área de club. Cada link declara qué capacidad necesita, para
 * que nadie vea una pestaña que lo va a mandar a un formulario que no puede
 * guardar. La misma capacidad se vuelve a checar en la página — esconder el
 * link no es seguridad, es honestidad de la interfaz.
 */
export const STAFF_NAV_LINKS: NavLink[] = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/calendar", label: "Calendario" },
  { href: "/coach/templates", label: "Plantillas", requires: "MANAGE_TRAINING" },
  { href: "/coach/athletes", label: "Socios", requires: "MANAGE_MEMBERS" },
  { href: "/coach/groups", label: "Grupos", requires: "MANAGE_MEMBERS" },
  { href: "/coach/settings", label: "Ajustes", requires: "MANAGE_CLUB" },
];

export const ATHLETE_NAV_LINKS: NavLink[] = [
  { href: "/athlete", label: "Dashboard" },
  { href: "/athlete/calendar", label: "Calendario" },
];

/** Los links que le tocan a un rol, ya filtrados. */
export function navLinksFor(role: MembershipRole): NavLink[] {
  if (role === "ATHLETE") return ATHLETE_NAV_LINKS;
  return STAFF_NAV_LINKS.filter((link) => !link.requires || can(role, link.requires));
}
