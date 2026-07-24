"use client";

import { TemplateForm } from "@/components/TemplateForm";
import { createWorkoutTemplate } from "@/lib/actions/templates";

export default function NewTemplatePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva plantilla</h1>
      <TemplateForm submitLabel="Guardar plantilla" onSubmit={createWorkoutTemplate} />
    </div>
  );
}
