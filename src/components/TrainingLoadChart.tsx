"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { WeeklyLoadPoint } from "@/lib/training-load";

/**
 * Carga semanal (sRPE = RPE × duración) con una línea de referencia del
 * promedio móvil de 4 semanas — la idea es ver si una semana rompió el
 * patrón de construcción/descarga (ver conversación de producto). SVG a
 * mano en vez de una librería de charts: un bar+line simple no lo justifica.
 *
 * Colores: paleta validada del skill de dataviz (un solo hue para la barra,
 * gris para la línea de referencia — no es una segunda serie categórica).
 */
const COLORS = {
  bar: "#2a78d6",
  avgLine: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  textMuted: "#898781",
};

export function TrainingLoadChart({ data }: { data: WeeklyLoadPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.every((d) => !d.hasData)) {
    return (
      <p className="text-sm text-zinc-500">
        Todavía no hay entrenamientos completados con duración y RPE para calcular carga.
      </p>
    );
  }

  const width = 720;
  const height = 220;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 28;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxValue = Math.max(...data.map((d) => Math.max(d.load, d.chronicAvg)), 1);
  const yMax = niceCeil(maxValue);

  const colWidth = plotWidth / data.length;
  const barWidth = Math.min(24, colWidth * 0.5);

  function yFor(value: number) {
    return paddingTop + plotHeight * (1 - value / yMax);
  }
  function xForCenter(i: number) {
    return paddingLeft + colWidth * i + colWidth / 2;
  }

  const linePoints = data.map((d, i) => `${xForCenter(i)},${yFor(d.chronicAvg)}`).join(" ");
  const gridLines = [0, 0.5, 1].map((f) => ({ value: yMax * f, y: yFor(yMax * f) }));
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Carga de entrenamiento semanal, con promedio móvil de 4 semanas"
      >
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={g.y}
              y2={g.y}
              stroke={COLORS.grid}
              strokeWidth={1}
            />
            <text
              x={paddingLeft - 8}
              y={g.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={COLORS.textMuted}
            >
              {Math.round(g.value)}
            </text>
          </g>
        ))}
        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={yFor(0)}
          y2={yFor(0)}
          stroke={COLORS.baseline}
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const x = xForCenter(i) - barWidth / 2;
          const barHeight = Math.max(plotHeight * (d.load / yMax), d.hasData && d.load > 0 ? 2 : 0);
          const y = yFor(d.load);
          const isHovered = hoverIndex === i;
          const weekLabel = format(d.weekStart, "d 'de' MMMM", { locale: es });
          const loadLabel = d.hasData ? `carga ${Math.round(d.load)}` : "sin datos registrados";

          return (
            <g key={i}>
              {d.hasData ? (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={COLORS.bar}
                  opacity={isHovered ? 1 : 0.85}
                  pointerEvents="none"
                />
              ) : (
                <rect
                  x={x}
                  y={yFor(0) - 6}
                  width={barWidth}
                  height={6}
                  rx={2}
                  fill="none"
                  stroke={COLORS.baseline}
                  strokeDasharray="2,2"
                  pointerEvents="none"
                />
              )}
              {/* hit target: toda la columna, no solo la barra, para poder ver
                  el tooltip incluso en semanas sin datos o carga cero */}
              <rect
                x={paddingLeft + colWidth * i}
                y={paddingTop}
                width={colWidth}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`Semana del ${weekLabel}: ${loadLabel}`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
              />
            </g>
          );
        })}

        <polyline
          points={linePoints}
          fill="none"
          stroke={COLORS.avgLine}
          strokeWidth={2}
          strokeDasharray="4,3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((d, i) => {
          if (i !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={xForCenter(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill={COLORS.textMuted}
            >
              {format(d.weekStart, "d MMM", { locale: es })}
            </text>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: COLORS.bar }}
          />
          Carga semanal (RPE × min)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLORS.avgLine }} />
          Promedio 4 semanas
        </span>
      </div>

      {hovered && (
        <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
          <p className="font-medium">Semana del {format(hovered.weekStart, "d MMM", { locale: es })}</p>
          <p>
            Carga:{" "}
            <span className="font-semibold">
              {hovered.hasData ? Math.round(hovered.load) : "sin datos"}
            </span>
          </p>
          <p className="text-zinc-500">Promedio 4 semanas: {Math.round(hovered.chronicAvg)}</p>
        </div>
      )}
    </div>
  );
}

function niceCeil(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}
