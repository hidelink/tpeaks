"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteAthlete } from "@/lib/actions/invite";

export function InviteAthleteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await inviteAthlete(email);
        setEmail("");
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-start gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
          setSuccess(false);
        }}
        placeholder="email@atleta.com"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50"
      >
        {isPending ? "Invitando..." : "Invitar atleta"}
      </button>
      {error && <p className="self-center text-sm text-red-600">{error}</p>}
      {success && <p className="self-center text-sm text-green-600">Invitación enviada.</p>}
    </form>
  );
}
