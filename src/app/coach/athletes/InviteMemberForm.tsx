"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/lib/actions/invite";
import { ROLE_LABELS } from "@/lib/roles";
import { MembershipRole } from "@/generated/prisma/enums";

/**
 * Invitar a alguien al club eligiendo su rol.
 *
 * `canInviteStaff` decide si el selector ofrece Coach y Admin. Es cortesía, no
 * seguridad: la acción vuelve a exigir MANAGE_CLUB para cualquier rol que no
 * sea socio (ver src/lib/actions/invite.ts). Un coach solo puede invitar socios,
 * porque si no podría invitar su propio correo alterno como Admin.
 */
export function InviteMemberForm({ canInviteStaff }: { canInviteStaff: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("ATHLETE");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roles = canInviteStaff
    ? Object.values(MembershipRole)
    : (["ATHLETE"] as MembershipRole[]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await inviteMember(email, role);
        setSuccess(`Invitación enviada a ${email.trim().toLowerCase()} como ${ROLE_LABELS[role]}.`);
        setEmail("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          clearFeedback();
        }}
        placeholder="correo@ejemplo.com"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />

      {/* Con un solo rol disponible el selector no aporta y solo ocupa espacio. */}
      {roles.length > 1 && (
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as MembershipRole);
            clearFeedback();
          }}
          aria-label="Rol con el que entrará"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50"
      >
        {isPending ? "Invitando..." : "Invitar"}
      </button>

      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      {success && <p className="w-full text-sm text-green-600">{success}</p>}
    </form>
  );
}
