import type { CSSProperties } from "react";

/**
 * Sin color de equipo configurado, se ve exactamente igual que antes de que
 * existiera branding (negro) — nadie ve un cambio hasta que el coach elige
 * un color en Ajustes.
 */
const DEFAULT_ACCENT = "#000000";

/**
 * `--team-accent` se lee vía clases Tailwind arbitrarias (`bg-[var(--team-accent)]`)
 * en todos los botones de acción primaria — ver docs/PRODUCT_SPEC.md, white-label.
 * Se aplica en el div raíz de cada layout autenticado (coach/atleta/workout),
 * no en el root layout: ahí todavía no se conoce el Team del usuario.
 */
export function teamAccentStyle(primaryColor?: string | null): CSSProperties {
  return { "--team-accent": primaryColor || DEFAULT_ACCENT } as CSSProperties;
}
