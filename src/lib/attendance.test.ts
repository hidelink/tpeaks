import { describe, it, expect } from "vitest";
import {
  parseStartTime,
  attendanceSummary,
  attendanceRate,
  ATTENDANCE_LABELS,
} from "./attendance";
import { AttendanceStatus } from "@/generated/prisma/enums";

describe("parseStartTime", () => {
  it("normaliza a HH:mm para que ordenar por texto ordene por hora", () => {
    expect(parseStartTime("7:00")).toBe("07:00");
    expect(parseStartTime("07:00")).toBe("07:00");
    expect(parseStartTime("19:30")).toBe("19:30");
  });

  it("ignora espacios alrededor", () => {
    expect(parseStartTime("  6:15 ")).toBe("06:15");
  });

  it("rechaza horas y minutos fuera de rango", () => {
    expect(parseStartTime("24:00")).toBeNull();
    expect(parseStartTime("07:60")).toBeNull();
  });

  it("rechaza formatos que no son HH:mm", () => {
    expect(parseStartTime("7")).toBeNull();
    expect(parseStartTime("7:0")).toBeNull();
    expect(parseStartTime("7:00 am")).toBeNull();
    expect(parseStartTime("")).toBeNull();
    expect(parseStartTime("mañana")).toBeNull();
  });

  it("el orden alfabético de los valores normalizados es el orden cronológico", () => {
    const horas = ["19:30", "7:00", "06:15", "12:00"].map((h) => parseStartTime(h)!);
    expect([...horas].sort()).toEqual(["06:15", "07:00", "12:00", "19:30"]);
  });
});

describe("attendanceSummary", () => {
  const convocados = ["a", "b", "c", "d"];

  it("cuenta cada estado y lo no registrado como pendiente", () => {
    const result = attendanceSummary(convocados, [
      { membershipId: "a", status: "PRESENT" },
      { membershipId: "b", status: "ABSENT" },
      { membershipId: "c", status: "EXCUSED" },
    ]);
    expect(result).toEqual({ present: 1, absent: 1, excused: 1, pending: 1, expected: 4 });
  });

  // La distinción que motiva la función: sin pasar lista, el club no acumula
  // faltas inventadas en el historial de nadie.
  it("una sesión sin pase de lista no genera faltas, solo pendientes", () => {
    const result = attendanceSummary(convocados, []);
    expect(result.absent).toBe(0);
    expect(result.pending).toBe(4);
  });

  it("ignora marcas de quien no estaba convocado", () => {
    const result = attendanceSummary(["a"], [
      { membershipId: "a", status: "PRESENT" },
      { membershipId: "colado", status: "PRESENT" },
    ]);
    expect(result).toEqual({ present: 1, absent: 0, excused: 0, pending: 0, expected: 1 });
  });

  it("no cuenta dos veces a un convocado repetido", () => {
    const result = attendanceSummary(["a", "a"], [{ membershipId: "a", status: "PRESENT" }]);
    expect(result.expected).toBe(1);
    expect(result.present).toBe(1);
  });

  it("sin convocados, todo en cero", () => {
    expect(attendanceSummary([], [])).toEqual({
      present: 0,
      absent: 0,
      excused: 0,
      pending: 0,
      expected: 0,
    });
  });
});

describe("attendanceRate", () => {
  it("se calcula sobre lo registrado, no sobre los convocados", () => {
    // 1 presente y 1 falta de 4 convocados: 50%, no 25%. Los otros dos
    // todavía no se registran y no deben castigar el número.
    const summary = attendanceSummary(["a", "b", "c", "d"], [
      { membershipId: "a", status: "PRESENT" },
      { membershipId: "b", status: "ABSENT" },
    ]);
    expect(attendanceRate(summary)).toBe(50);
  });

  it("quien avisó cuenta como registrado, pero no como presente", () => {
    const summary = attendanceSummary(["a", "b"], [
      { membershipId: "a", status: "PRESENT" },
      { membershipId: "b", status: "EXCUSED" },
    ]);
    expect(attendanceRate(summary)).toBe(50);
  });

  it("devuelve null si no hay nada registrado, en vez de un 0% falso", () => {
    expect(attendanceRate(attendanceSummary(["a", "b"], []))).toBeNull();
  });
});

describe("ATTENDANCE_LABELS", () => {
  it("cubre todos los valores del enum de Prisma", () => {
    expect(Object.keys(ATTENDANCE_LABELS).sort()).toEqual(Object.values(AttendanceStatus).sort());
  });
});
