import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { parseWorkoutStructure } from "@/lib/workout-structure";
import { EditTemplateForm } from "./EditTemplateForm";
import { can } from "@/lib/roles";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership || !can(membership.role, "MANAGE_TRAINING")) notFound();

  const template = await prisma.workoutTemplate.findFirst({
    where: { id, teamId: membership.teamId },
  });
  if (!template) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar plantilla</h1>
      <EditTemplateForm
        templateId={template.id}
        initial={{
          title: template.title,
          description: template.description ?? undefined,
          sport: template.sport,
          tags: template.tags,
          structure: parseWorkoutStructure(template.structure),
        }}
      />
    </div>
  );
}
