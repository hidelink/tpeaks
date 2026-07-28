import type { AttendanceStatus } from "@/generated/prisma/enums";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Faltó",
  EXCUSED: "Avisó",
};

/**
 * ClubSession.startTime es un string "HH:mm" en hora local del club, no un
 * timestamp — ver el comentario del modelo en schema.prisma. Como la base no
 * puede validar el formato, se valida aquí y esta función es la única puerta
 * de entrada.
 *
 * Acepta "7:00" y lo normaliza a "07:00" para que ordenar por texto ordene
 * también por hora.
 */
export function parseStartTime(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

export type AttendanceSummary = {
  present: number;
  absent: number;
  excused: number;
  /** Convocados a los que todavía no se les pasó lista. */
  pending: number;
  /** A quiénes se convocó en total. */
  expected: number;
};

/**
 * Resumen del pase de lista de una sesión.
 *
 * La distinción que importa: **no tener fila no es lo mismo que faltar**. Una
 * sesión a la que nadie le pasó lista tiene 0 presentes y 0 faltas, no 20
 * faltas — si no, el historial de un socio se llenaría de ausencias inventadas
 * por sesiones que el coach nunca registró.
 */
export function attendanceSummary(
  expectedMembershipIds: string[],
  marks: { membershipId: string; status: AttendanceStatus }[],
): AttendanceSummary {
  const expected = new Set(expectedMembershipIds);
  const byMember = new Map(marks.map((m) => [m.membershipId, m.status]));

  let present = 0;
  let absent = 0;
  let excused = 0;
  let pending = 0;

  for (const id of expected) {
    const status = byMember.get(id);
    if (status === "PRESENT") present++;
    else if (status === "ABSENT") absent++;
    else if (status === "EXCUSED") excused++;
    else pending++;
  }

  return { present, absent, excused, pending, expected: expected.size };
}

/**
 * Porcentaje de asistencia sobre lo YA registrado, no sobre los convocados:
 * con media lista sin pasar, dividir entre los convocados daría un número
 * artificialmente bajo. Devuelve null si no hay nada registrado — mismo
 * criterio que el cumplimiento semanal del dashboard.
 */
export function attendanceRate(summary: AttendanceSummary): number | null {
  const marked = summary.present + summary.absent + summary.excused;
  if (marked === 0) return null;
  return Math.round((summary.present / marked) * 100);
}
