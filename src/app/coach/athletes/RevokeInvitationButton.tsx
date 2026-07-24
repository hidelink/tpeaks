"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeInvitation } from "@/lib/actions/invite";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await revokeInvitation(invitationId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {isPending ? "Revocando..." : "Revocar"}
    </button>
  );
}
