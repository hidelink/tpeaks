import { TemplateForm } from "@/components/TemplateForm";
import { createWorkoutTemplate } from "@/lib/actions/templates";
import { requirePageCapability } from "@/lib/page-guards";

/**
 * Server Component a propósito, aunque el formulario sea de cliente: así se
 * puede checar la capacidad antes de renderizar. Pasar la Server Action como
 * prop a un Client Component es válido.
 */
export default async function NewTemplatePage() {
  await requirePageCapability("MANAGE_TRAINING");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva plantilla</h1>
      <TemplateForm submitLabel="Guardar plantilla" onSubmit={createWorkoutTemplate} />
    </div>
  );
}
