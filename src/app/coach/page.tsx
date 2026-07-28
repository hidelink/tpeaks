import Link from "next/link";
import { format, subWeeks, startOfWeek, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getCurrentWeekRange } from "@/lib/dates";
import { toQueryBoundary, toLocalCalendarDate, todayAsUtcMidnight } from "@/lib/calendar-date";
import { RUNNING_KM_SPORTS, sportMeta } from "@/lib/sports";
import {
  weeklyCompliance,
  pickInactiveAthletes,
  loadByAthlete,
  daysSinceLastActivity,
  type AthleteLoad,
} from "@/lib/coach-dashboard";

/** Cuántos días sin registrar nada antes de que un atleta salga en la lista de pendientes. */
const INACTIVE_AFTER_DAYS = 10;
/** Ventana para "feedback sin responder" — más atrás ya no es accionable. */
const FEEDBACK_WINDOW_DAYS = 14;
/** RPE a partir del cual una sesión merece que el coach la mire aunque no haya comentario. */
const HIGH_RPE = 8;

export default async function CoachDashboardPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const today = new Date();
  const { start, end } = getCurrentWeekRange();
  const teamId = membership.teamId;
  const feedbackSince = toQueryBoundary(subDays(today, FEEDBACK_WINDOW_DAYS));
  const lastWeekStart = toQueryBoundary(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }));

  const [scheduledThisWeek, athletes, overdue, needsReply, loadRows, lastCompleted] =
    await Promise.all([
      prisma.scheduledWorkout.findMany({
        where: { teamId, date: { gte: toQueryBoundary(start), lte: toQueryBoundary(end) } },
        include: { completion: true, athlete: { include: { user: true } } },
      }),
      prisma.teamMembership.findMany({
        where: { teamId, role: "ATHLETE", status: "ACTIVE" },
        include: { user: true },
      }),
      // Vencidos sin marcar: ya pasó el día y siguen en PLANNED.
      prisma.scheduledWorkout.findMany({
        where: { teamId, status: "PLANNED", date: { lt: todayAsUtcMidnight() } },
        include: { athlete: { include: { user: true } } },
        orderBy: { date: "desc" },
        take: 8,
      }),
      // Feedback que pide respuesta: comentario del atleta o RPE alto, y sin
      // ningún comentario del coach todavía.
      prisma.scheduledWorkout.findMany({
        where: {
          teamId,
          date: { gte: feedbackSince },
          comments: { none: {} },
          completion: {
            is: { OR: [{ athleteComment: { not: null } }, { rpe: { gte: HIGH_RPE } }] },
          },
        },
        include: { athlete: { include: { user: true } }, completion: true },
        orderBy: { date: "desc" },
        take: 8,
      }),
      // Una sola query para la carga de las dos últimas semanas de todo el
      // equipo, en vez de una por atleta.
      prisma.workoutCompletion.findMany({
        where: { scheduledWorkout: { teamId, date: { gte: lastWeekStart } } },
        select: {
          rpe: true,
          durationMinutes: true,
          scheduledWorkout: { select: { athleteMembershipId: true, date: true } },
        },
      }),
      prisma.scheduledWorkout.groupBy({
        by: ["athleteMembershipId"],
        where: { teamId, status: "COMPLETED" },
        _max: { date: true },
      }),
    ]);

  const completed = scheduledThisWeek.filter((w) => w.status === "COMPLETED");
  const compliance = weeklyCompliance(scheduledThisWeek, today);

  // Solo correr y trail: sumar los km de una sesión de bici con los de un
  // fondo da un número que no significa nada. Las demás sesiones sí cuentan
  // en el cumplimiento y en la gráfica de carga (RPE × duración es comparable
  // entre deportes; los kilómetros no).
  const runningKm = completed
    .filter((w) => RUNNING_KM_SPORTS.includes(w.sport))
    .reduce((sum, w) => sum + (w.completion?.distanceKm ?? 0), 0);

  const lastCompletedById = new Map(
    lastCompleted.map((row) => [row.athleteMembershipId, row._max.date ?? null]),
  );
  const loads = loadByAthlete(
    loadRows.map((r) => ({
      athleteMembershipId: r.scheduledWorkout.athleteMembershipId,
      date: r.scheduledWorkout.date,
      rpe: r.rpe,
      durationMinutes: r.durationMinutes,
    })),
    today,
  );

  const inactive = pickInactiveAthletes(
    athletes.map((a) => ({
      id: a.id,
      name: a.user.name,
      lastCompletedDate: lastCompletedById.get(a.id) ?? null,
    })),
    today,
    INACTIVE_AFTER_DAYS,
  );

  const attentionCount = overdue.length + needsReply.length + inactive.length;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Programados (semana)" value={scheduledThisWeek.length} />
        <MetricCard label="Completados (semana)" value={completed.length} />
        <MetricCard
          label="Cumplimiento"
          value={compliance.rate === null ? "—" : `${compliance.rate}%`}
          hint={
            compliance.rate === null
              ? "Nada ha vencido todavía"
              : `${compliance.completed}/${compliance.due} vencidos`
          }
        />
        <MetricCard label="Km corriendo (semana)" value={runningKm.toFixed(1)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Requiere tu atención{attentionCount > 0 && ` (${attentionCount})`}
        </h2>

        {attentionCount === 0 ? (
          <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500">
            Nada pendiente: no hay entrenamientos vencidos sin marcar, ni feedback sin responder,
            ni atletas inactivos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overdue.map((w) => (
              <AttentionRow
                key={`overdue-${w.id}`}
                href={`/workout/${w.id}`}
                tone="amber"
                tag="Sin marcar"
                title={`${sportMeta(w.sport).icon} ${w.title}`}
                detail={`${w.athlete.user.name} · ${format(toLocalCalendarDate(w.date), "d MMM", { locale: es })}`}
              />
            ))}

            {needsReply.map((w) => (
              <AttentionRow
                key={`reply-${w.id}`}
                href={`/workout/${w.id}`}
                tone="blue"
                tag={
                  (w.completion?.rpe ?? 0) >= HIGH_RPE
                    ? `RPE ${w.completion?.rpe}`
                    : "Sin responder"
                }
                title={`${sportMeta(w.sport).icon} ${w.title}`}
                detail={
                  w.completion?.athleteComment
                    ? `${w.athlete.user.name} · "${w.completion.athleteComment}"`
                    : `${w.athlete.user.name} · esfuerzo alto, sin comentario tuyo`
                }
              />
            ))}

            {inactive.map((a) => (
              <AttentionRow
                key={`inactive-${a.id}`}
                href={`/coach/athletes/${a.id}`}
                tone="zinc"
                tag="Inactivo"
                title={a.name}
                detail={
                  a.daysSince === null
                    ? "Nunca ha registrado un entrenamiento"
                    : `${a.daysSince} días sin registrar nada`
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Atletas</h2>
        {athletes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aún no tienes atletas. Ve a &quot;Atletas&quot; para agregar el primero.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {athletes.map((a) => {
              const own = scheduledThisWeek.filter((w) => w.athleteMembershipId === a.id);
              const ownCompliance = weeklyCompliance(own, today);
              const load = loads.get(a.id) ?? {
                thisWeek: 0,
                lastWeekToDate: 0,
                lastWeekTotal: 0,
              };
              const days = daysSinceLastActivity(lastCompletedById.get(a.id) ?? null, today);

              return (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/coach/athletes/${a.id}`} className="font-medium hover:underline">
                      {a.user.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {days === null
                        ? "Sin entrenamientos registrados"
                        : days === 0
                          ? "Registró algo hoy"
                          : `Último registro hace ${days} día${days === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-6 text-right text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Cumplimiento</p>
                      <p className="font-medium tabular-nums">
                        {ownCompliance.rate === null
                          ? "—"
                          : `${ownCompliance.completed}/${ownCompliance.due}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Carga vs. mismo punto</p>
                      <p className="font-medium tabular-nums">
                        {load.thisWeek} <LoadDelta load={load} />
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const TONES = {
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

function AttentionRow({
  href,
  tone,
  tag,
  title,
  detail,
}: {
  href: string;
  tone: keyof typeof TONES;
  tag: string;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50"
      >
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
        >
          {tag}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-zinc-500">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Comparación contra la MISMA porción de la semana pasada, no contra la semana
 * pasada completa — comparar un lunes contra siete días siempre da un desplome
 * que no significa nada (ver loadByAthlete). Sigue siendo un dato de contexto
 * en gris: con pocos días transcurridos, una sola sesión mueve mucho el número.
 */
function LoadDelta({ load }: { load: AthleteLoad }) {
  if (load.lastWeekToDate === 0) return null;
  const delta = Math.round(((load.thisWeek - load.lastWeekToDate) / load.lastWeekToDate) * 100);
  return (
    <span
      className="text-xs font-normal text-zinc-500"
      title={`${load.thisWeek} contra ${load.lastWeekToDate} al mismo punto de la semana pasada (${load.lastWeekTotal} en la semana completa)`}
    >
      ({delta >= 0 ? "+" : ""}
      {delta}%)
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
