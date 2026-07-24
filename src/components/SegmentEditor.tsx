"use client";

import type { WorkoutSegment } from "@/lib/workout-structure";

/**
 * Editor controlado de segmentos (calentamiento, series, enfriamiento...).
 * Compartido entre la creación de plantillas y la asignación ad hoc al
 * calendario — ambas producen el mismo WorkoutStructure (ver
 * src/lib/workout-structure.ts).
 *
 * Distancia/duración/ritmo son independientes entre sí — puedes llenar solo
 * uno (ej. un fondo solo con duración, o unas series solo con distancia).
 * durationSeconds se guarda en segundos, pero aquí se captura en minutos
 * porque así piensa un coach de running.
 */
const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm";
const fieldLabelClass = "flex flex-col gap-1 text-xs text-zinc-500";

export function SegmentEditor({
  segments,
  onChange,
}: {
  segments: WorkoutSegment[];
  onChange: (segments: WorkoutSegment[]) => void;
}) {
  function updateSegment(index: number, patch: Partial<WorkoutSegment>) {
    onChange(segments.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSegment(index: number) {
    onChange(segments.filter((_, i) => i !== index));
  }

  function addSegment() {
    onChange([...segments, { label: "", repeat: 1 }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Distancia, duración y ritmo son independientes: llena solo lo que aplique a cada
        segmento (ej. un fondo solo necesita duración; unas series solo distancia y ritmo).
      </p>

      {segments.map((segment, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3"
        >
          <div className="grid grid-cols-3 gap-2">
            <label className={`${fieldLabelClass} col-span-2`}>
              Etiqueta
              <input
                placeholder="Ej. Serie 1, Calentamiento..."
                value={segment.label}
                onChange={(e) => updateSegment(i, { label: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className={fieldLabelClass}>
              Repeticiones
              <input
                type="number"
                min={1}
                value={segment.repeat}
                onChange={(e) => updateSegment(i, { repeat: Number(e.target.value) || 1 })}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className={fieldLabelClass}>
              Distancia (metros)
              <input
                type="number"
                min={0}
                placeholder="Ej. 400"
                value={segment.distanceMeters ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateSegment(i, { distanceMeters: e.target.value && n > 0 ? n : undefined });
                }}
                className={inputClass}
              />
            </label>
            <label className={fieldLabelClass}>
              Duración (minutos)
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="Ej. 20"
                value={segment.durationSeconds ? segment.durationSeconds / 60 : ""}
                onChange={(e) => {
                  const minutes = Number(e.target.value);
                  updateSegment(i, {
                    durationSeconds: e.target.value && minutes > 0 ? Math.round(minutes * 60) : undefined,
                  });
                }}
                className={inputClass}
              />
            </label>
            <label className={fieldLabelClass}>
              Ritmo objetivo
              <input
                placeholder="Ej. 4:30/km"
                value={segment.targetPace ?? ""}
                onChange={(e) => updateSegment(i, { targetPace: e.target.value || undefined })}
                className={inputClass}
              />
            </label>
          </div>

          <label className={fieldLabelClass}>
            Nota (opcional)
            <input
              placeholder="Ej. Correr por sensaciones, no forzar el ritmo"
              value={segment.note ?? ""}
              onChange={(e) => updateSegment(i, { note: e.target.value || undefined })}
              className={inputClass}
            />
          </label>

          <button
            type="button"
            onClick={() => removeSegment(i)}
            className="self-start rounded-md border border-red-300 px-3 py-1 text-xs text-red-600"
          >
            Quitar segmento
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addSegment}
        className="self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium"
      >
        + Agregar segmento
      </button>
    </div>
  );
}
