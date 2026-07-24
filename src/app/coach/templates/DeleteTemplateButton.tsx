"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkoutTemplate } from "@/lib/actions/templates";

export function DeleteTemplateButton({ templateId, title }: { templateId: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`¿Borrar la plantilla "${title}"? Los entrenamientos ya asignados desde ella no se ven afectados.`)) {
      return;
    }
    startTransition(async () => {
      await deleteWorkoutTemplate(templateId);
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
      {isPending ? "Borrando..." : "Borrar"}
    </button>
  );
}
