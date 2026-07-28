import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getCurrentWeekRange } from "@/lib/dates";
import { toQueryBoundary } from "@/lib/calendar-date";
import { RUNNING_KM_SPORTS } from "@/lib/sports";

export default async function CoachDashboardPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const { start, end } = getCurrentWeekRange();
  const teamId = membership.teamId;

  const [scheduledThisWeek, athletes] = await Promise.all([
    prisma.scheduledWorkout.findMany({
      where: { teamId, date: { gte: toQueryBoundary(start), lte: toQueryBoundary(end) } },
      include: { completion: true, athlete: { include: { user: true } } },
    }),
    prisma.teamMembership.findMany({
      where: { teamId, role: "ATHLETE", status: "ACTIVE" },
      include: { user: true },
    }),
  ]);

  const completed = scheduledThisWeek.filter((w) => w.status === "COMPLETED");
  // Solo correr y trail: sumar los km de una sesión de bici con los de un
  // fondo da un número que no significa nada. Las demás sesiones sí cuentan
  // en el cumplimiento y en la gráfica de carga (RPE × duración es comparable
  // entre deportes; los kilómetros no).
  const runningKm = completed
    .filter((w) => RUNNING_KM_SPORTS.includes(w.sport))
    .reduce((sum, w) => sum + (w.completion?.distanceKm ?? 0), 0);
  const complianceRate =
    scheduledThisWeek.length === 0
      ? 0
      : Math.round((completed.length / scheduledThisWeek.length) * 100);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Programados (semana)" value={scheduledThisWeek.length} />
        <MetricCard label="Completados (semana)" value={completed.length} />
        <MetricCard label="Cumplimiento semanal" value={`${complianceRate}%`} />
        <MetricCard label="Km corriendo (semana)" value={runningKm.toFixed(1)} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Atletas</h2>
        {athletes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aún no tienes atletas. Ve a &quot;Atletas&quot; para agregar el primero.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {athletes.map((a) => {
              const own = scheduledThisWeek.filter(
                (w) => w.athleteMembershipId === a.id,
              );
              const ownCompleted = own.filter((w) => w.status === "COMPLETED");
              return (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <span>{a.user.name}</span>
                  <span className="text-sm text-zinc-500">
                    {ownCompleted.length}/{own.length} esta semana
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
