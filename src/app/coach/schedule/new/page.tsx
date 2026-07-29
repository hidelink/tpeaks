import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ScheduleForm } from "./ScheduleForm";
import { requirePageCapability } from "@/lib/page-guards";
import { clubToday } from "@/lib/club-time";

export default async function NewScheduledWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; athleteId?: string }>;
}) {
  const { date, athleteId } = await searchParams;
  const membership = await requirePageCapability("MANAGE_TRAINING");

  const [athletes, templates, groups] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
      include: { user: true, athleteProfile: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workoutTemplate.findMany({
      where: { teamId: membership.teamId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trainingGroup.findMany({
      where: { teamId: membership.teamId },
      include: {
        // Solo activos: el chip debe contar y seleccionar exactamente a los
        // socios que se ven en la lista de abajo.
        members: {
          where: { membership: { status: "ACTIVE", role: "ATHLETE" } },
          select: { membershipId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Asignar entrenamiento</h1>
      {athletes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Necesitas al menos un atleta activo en tu equipo antes de poder asignar entrenamientos.
        </p>
      ) : (
        <ScheduleForm
          athletes={athletes.map((a) => ({
            id: a.id,
            name: a.user.name,
            vdot: a.athleteProfile?.vdot ?? null,
          }))}
          templates={templates.map((t) => ({ id: t.id, title: t.title, sport: t.sport }))}
          groups={groups.map((g) => ({
            id: g.id,
            name: g.name,
            memberIds: g.members.map((m) => m.membershipId),
          }))}
          defaultDate={date ?? format(clubToday(membership.team.timezone), "yyyy-MM-dd")}
          defaultAthleteId={athleteId}
        />
      )}
    </div>
  );
}
