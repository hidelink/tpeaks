"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTeamBranding } from "@/lib/actions/team";

export function BrandingForm({
  initialLogoUrl,
  initialPrimaryColor,
}: {
  initialLogoUrl: string;
  initialPrimaryColor: string;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor || "#000000");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateTeamBranding({ logoUrl, primaryColor });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        URL del logo (opcional)
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => {
            setLogoUrl(e.target.value);
            setSaved(false);
          }}
          placeholder="https://..."
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-3 text-sm">
        Color de acento
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => {
            setPrimaryColor(e.target.value);
            setSaved(false);
          }}
          className="h-9 w-16 cursor-pointer rounded border border-zinc-300"
        />
        <span className="text-zinc-500">{primaryColor}</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-[var(--team-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar marca"}
        </button>
        {saved && <span className="text-sm text-green-700">Guardado.</span>}
      </div>
    </form>
  );
}
