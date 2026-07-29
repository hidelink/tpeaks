import { prisma } from "@/lib/prisma";
import { requirePageCapability } from "@/lib/page-guards";
import { NewGroupForm } from "./NewGroupForm";
import { GroupCard } from "./GroupCard";

export default async function CoachGroupsPage() {
  const membership = await requirePageCapability("MANAGE_MEMBERS");

  const [groups, athletes] = await Promise.all([
    prisma.trainingGroup.findMany({
      where: { teamId: membership.teamId },
      include: {
        // Solo socios activos: un socio dado de baja seguiría contando en el
        // grupo y la pantalla no podría mostrarlo para quitarlo.
        members: {
          where: { membership: { status: "ACTIVE", role: "ATHLETE" } },
          select: { membershipId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grupos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Agrupa socios por nivel o por día de entrenamiento para poder asignarles a todos de una
          vez. Un socio puede estar en varios grupos.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4">
        <NewGroupForm />
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aún no hay grupos. Crea el primero arriba — si tu club es chico, puedes seguir asignando
          socio por socio sin problema.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={{
                id: g.id,
                name: g.name,
                description: g.description,
                memberIds: g.members.map((m) => m.membershipId),
              }}
              athletes={athletes.map((a) => ({ id: a.id, name: a.user.name }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
