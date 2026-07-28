import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requirePageCapability } from "@/lib/page-guards";
import { toLocalCalendarDate } from "@/lib/calendar-date";
import { attendanceSummary, attendanceRate } from "@/lib/attendance";
import { AttendanceRoster } from "./AttendanceRoster";
import { DeleteSessionButton } from "./DeleteSessionButton";

export default async function ClubSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requirePageCapability("MANAGE_TRAINING");

  const session = await prisma.clubSession.findFirst({
    where: { id, teamId: membership.teamId },
    include: {
      group: true,
      coach: { include: { user: true } },
      attendance: true,
    },
  });
  if (!session) notFound();

  // Convocados: los del grupo, o todo el club si la sesión es abierta.
  const roster = await prisma.teamMembership.findMany({
    where: {
      teamId: membership.teamId,
      role: "ATHLETE",
      status: "ACTIVE",
      ...(session.groupId ? { groups: { some: { groupId: session.groupId } } } : {}),
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const summary = attendanceSummary(
    roster.map((r) => r.id),
    session.attendance.map((a) => ({ membershipId: a.membershipId, status: a.status })),
  );
  const rate = attendanceRate(summary);
  const statusById = new Map(session.attendance.map((a) => [a.membershipId, a.status]));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/coach/sessions" className="text-xs text-zinc-500 underline">
            ← Sesiones
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="capitalize">
              {format(toLocalCalendarDate(session.date), "EEEE d 'de' MMMM", { locale: es })}
            </span>{" "}
            · {session.startTime}
            {session.location && <> · {session.location}</>}
          </p>
          <p className="text-sm text-zinc-500">
            {session.group?.name ?? "Todo el club"}
            {session.coach && <> · {session.coach.user.name}</>}
          </p>
        </div>
        <DeleteSessionButton sessionId={session.id} title={session.title} />
      </div>

      {session.note && (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm">{session.note}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Asistieron" value={summary.present} />
        <Metric label="Avisaron" value={summary.excused} />
        <Metric label="Faltaron" value={summary.absent} />
        <Metric
          label="Asistencia"
          value={rate === null ? "—" : `${rate}%`}
          hint={
            rate === null
              ? "Sin pasar lista"
              : summary.pending > 0
                ? `${summary.pending} sin marcar`
                : undefined
          }
        />
      </div>

      <section className="rounded-xl border border-zinc-200 p-4">
        <h2 className="mb-3 font-medium">Pase de lista</h2>
        <AttendanceRoster
          sessionId={session.id}
          roster={roster.map((r) => ({
            membershipId: r.id,
            name: r.user.name,
            status: statusById.get(r.id) ?? null,
          }))}
        />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
