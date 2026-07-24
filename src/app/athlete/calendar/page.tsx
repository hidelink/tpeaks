import Link from "next/link";
import { eachDayOfInterval, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/permissions";
import { getCurrentWeekRange } from "@/lib/dates";
import { assertAthleteTeamAccess } from "@/lib/subscription-gate";

export default async function AthleteCalendarPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  await assertAthleteTeamAccess(membership.teamId);

  const { start, end } = getCurrentWeekRange();
  const days = eachDayOfInterval({ start, end });

  const workouts = await prisma.scheduledWorkout.findMany({
    where: { athleteMembershipId: membership.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mi calendario</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {days.map((day) => (
          <div key={day.toISOString()} className="rounded-xl border border-zinc-200 p-3">
            <p className="mb-2 text-sm font-medium capitalize">
              {format(day, "EEEE d", { locale: es })}
            </p>
            <div className="flex flex-col gap-2">
              {workouts
                .filter((w) => isSameDay(w.date, day))
                .map((w) => (
                  <Link
                    key={w.id}
                    href={`/workout/${w.id}`}
                    className="rounded-lg bg-zinc-100 px-2 py-1 text-xs"
                  >
                    <p className="font-medium">{w.title}</p>
                    <p className="text-zinc-500">{w.status}</p>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
