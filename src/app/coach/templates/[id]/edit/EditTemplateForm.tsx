"use client";

import { TemplateForm, type TemplateFormValues } from "@/components/TemplateForm";
import { updateWorkoutTemplate } from "@/lib/actions/templates";

export function EditTemplateForm({
  templateId,
  initial,
}: {
  templateId: string;
  initial: TemplateFormValues;
}) {
  return (
    <TemplateForm
      initial={initial}
      submitLabel="Guardar cambios"
      onSubmit={(data) => updateWorkoutTemplate(templateId, data)}
    />
  );
}
