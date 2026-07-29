"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMembershipRole } from "@/lib/actions/members";
import { ROLE_LABELS } from "@/lib/roles";
import { MembershipRole } from "@/generated/prisma/enums";

const ROLES = Object.values(MembershipRole);

/**
 * Cambiar el rol de alguien del club. Solo se renderiza para quien tiene
 * MANAGE_CLUB — pero eso es cortesía, no seguridad: la acción lo vuelve a
 * exigir (ver src/lib/actions/members.ts).
 */
export function RoleSelect({
  membershipId,
  role,
  isSelf,
}: {
  membershipId: string;
  role: MembershipRole;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: MembershipRole) {
    if (next === role) return;

    // Bajarse a uno mismo cambia lo que se puede ver en la siguiente pantalla,
    // así que se avisa antes en vez de que la navegación cambie sin explicación.
    if (isSelf && next !== "ADMIN") {
      const ok = confirm(
        `Vas a cambiar TU rol a ${ROLE_LABELS[next]}. Vas a perder acceso a partes de la ` +
          `plataforma y necesitarás que otro Admin te lo devuelva. ¿Seguro?`,
      );
      if (!ok) return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await updateMembershipRole(membershipId, next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cambiar el rol.");
      }
    });
  }

  return (
    <div className="text-right">
      <select
        value={role}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as MembershipRole)}
        aria-label="Rol en el club"
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 max-w-52 text-xs text-red-600">{error}</p>}
    </div>
  );
}
