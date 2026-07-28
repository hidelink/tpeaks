import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requirePageCapability } from "@/lib/page-guards";
import { toLocalCalendarDate, todayAsUtcMidnight } from "@/lib/calendar-date";
import { NewSessionForm } from "./NewSessionForm";

export default async function CoachSessionsPage() {
  const membership = await requirePageCapability("MANAGE_TRAINING");
  const today = todayAsUtcMidnight();

  const [upcoming, past, groups, activeAthleteCount] = await Promise.all([
    prisma.clubSession.findMany({
      where: { teamId: membership.teamId, date: { gte: today } },
      include: { group: { include: { members: true } }, attendance: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.clubSession.findMany({
      where: { teamId: membership.teamId, date: { lt: today } },
      include: { group: { include: { members: true } }, attendance: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 10,
    }),
    prisma.trainingGroup.findMany({
      where: { teamId: membership.teamId },
      orderBy: { name: "asc" },
    }),
    prisma.teamMembership.count({
      where: { teamId: membership.teamId, role: "ATHLETE", status: "ACTIVE" },
    }),
  ]);

  type Row = (typeof upcoming)[number];

  /** Sin grupo, la sesión convoca a todo el club. */
  function expectedCount(session: Row) {
    return session.group ? session.group.members.length : activeAthleteCount;
  }

  function SessionRow({ session, showAttendance }: { session: Row; showAttendance: boolean }) {
    // En la lista basta contar presentes; el resumen completo (con pendientes)
    // se calcula en el detalle, que sí carga la lista de convocados.
    const present = session.attendance.filter((a) => a.status === "PRESENT").length;

    return (
      <li className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <Link href={`/coach/sessions/${session.id}`} className="font-medium hover:underline">
            {session.title}
          </Link>
          <p className="text-sm text-zinc-500">
            <span className="capitalize">
              {format(toLocalCalendarDate(session.date), "EEEE d MMM", { locale: es })}
            </span>{" "}
            · {session.startTime}
            {session.location && <> · {session.location}</>}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="text-xs text-zinc-500">{session.group?.name ?? "Todo el club"}</p>
          <p className="tabular-nums">
            {showAttendance && session.attendance.length > 0 ? (
              <>
                {present} de {expectedCount(session)} asistieron
              </>
            ) : (
              <span className="text-zinc-500">{expectedCount(session)} convocados</span>
            )}
          </p>
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sesiones</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Los entrenamientos presenciales del club: día, hora y lugar. Distinto del plan individual
          de cada socio — aquí se pasa lista.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4">
        <NewSessionForm
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          defaultDate={format(new Date(), "yyyy-MM-dd")}
        />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Próximas</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay sesiones programadas.</p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} showAttendance={false} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Anteriores</h2>
          <ul className="divide-y divide-zinc-200">
            {past.map((s) => (
              <SessionRow key={s.id} session={s} showAttendance />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
