"use client";

import { SPORTS } from "@/lib/sports";
import type { WorkoutSport } from "@/generated/prisma/enums";

/**
 * Selector de tipo de sesión, compartido por plantillas, asignación y edición.
 * El default es correr — es lo que hace la mayoría de las sesiones de un
 * equipo de running, y así nadie tiene que tocarlo en el caso normal.
 */
export function SportSelect({
  value,
  onChange,
  disabled,
}: {
  value: WorkoutSport;
  onChange: (sport: WorkoutSport) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Tipo
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as WorkoutSport)}
        className="rounded-md border border-zinc-300 px-3 py-2 disabled:bg-zinc-100 disabled:text-zinc-500"
      >
        {SPORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.icon} {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
