/**
 * Ritmos de entrenamiento calculados automáticamente a partir de un
 * resultado de carrera reciente, usando el modelo VDOT de Jack Daniels
 * (Daniels' Running Formula) — la misma fórmula publicada que usan la
 * mayoría de las calculadoras de VDOT conocidas. No es código propietario:
 * son las ecuaciones de Daniels-Gilbert, ampliamente publicadas.
 *
 * IMPORTANTE — solo aplica a carreras planas/pista/asfalto. El modelo
 * asume que "ritmo" es una unidad de esfuerzo comparable, lo cual se
 * rompe en trail (desnivel, terreno técnico, altitud cambian el costo
 * energético de forma no lineal). Para trail, usa RPE objetivo y/o
 * duración en vez de ritmo en los segmentos — ver workout-structure.ts.
 * Ver docs/PRODUCT_SPEC.md para la decisión de producto detrás de esto.
 */

// Coeficientes de la curva de costo de oxígeno (Daniels-Gilbert): el costo
// fisiológico (VO2, ml/kg/min) de correr a una velocidad dada.
const OXYGEN_COST_A = -4.6;
const OXYGEN_COST_B = 0.182258;
const OXYGEN_COST_C = 0.000104;

function velocityToVO2(metersPerMinute: number): number {
  return OXYGEN_COST_A + OXYGEN_COST_B * metersPerMinute + OXYGEN_COST_C * metersPerMinute ** 2;
}

// Inversa de velocityToVO2: despeja la velocidad (m/min) para un VO2 objetivo.
function vo2ToVelocity(vo2: number): number {
  const a = OXYGEN_COST_C;
  const b = OXYGEN_COST_B;
  const c = OXYGEN_COST_A - vo2;
  const discriminant = b * b - 4 * a * c;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

// Curva de duración (Daniels-Gilbert): qué fracción del VO2max se puede
// sostener durante T minutos — más corto = más cerca del 100%.
function percentMaxForDuration(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

/**
 * Calcula el VDOT (puntaje de fitness) a partir de un resultado de carrera
 * reciente. Entre más reciente y más "todo dado" haya sido la carrera, más
 * preciso el resultado.
 */
export function calculateVdot(distanceMeters: number, timeSeconds: number): number {
  const minutes = timeSeconds / 60;
  const metersPerMinute = distanceMeters / minutes;
  const vo2 = velocityToVO2(metersPerMinute);
  return vo2 / percentMaxForDuration(minutes);
}

function paceSecondsPerKm(metersPerMinute: number): number {
  return (1000 / metersPerMinute) * 60;
}

function paceForPercentVdot(vdot: number, percent: number): number {
  return paceSecondsPerKm(vo2ToVelocity(vdot * percent));
}

export type TrainingPaces = {
  /** Fondo/rodaje — Daniels lo da como rango, no un número fijo. */
  easy: { fastSecPerKm: number; slowSecPerKm: number };
  /** Ritmo maratón. */
  marathon: number;
  /** Ritmo umbral (~1h de esfuerzo sostenido). */
  threshold: number;
  /** Series de 3-5min (95-100% VDOT). */
  interval: number;
  /** Repeticiones cortas, 200-400m (105-110% VDOT) — menos precisa que las demás: la curva se comporta peor por encima del 100%. */
  repetition: number;
};

const ZONE_PERCENTS = {
  easyFast: 0.74,
  easySlow: 0.59,
  marathon: 0.82,
  threshold: 0.9,
  interval: 0.975,
  repetition: 1.075,
};

export function trainingPaces(vdot: number): TrainingPaces {
  return {
    easy: {
      fastSecPerKm: paceForPercentVdot(vdot, ZONE_PERCENTS.easyFast),
      slowSecPerKm: paceForPercentVdot(vdot, ZONE_PERCENTS.easySlow),
    },
    marathon: paceForPercentVdot(vdot, ZONE_PERCENTS.marathon),
    threshold: paceForPercentVdot(vdot, ZONE_PERCENTS.threshold),
    interval: paceForPercentVdot(vdot, ZONE_PERCENTS.interval),
    repetition: paceForPercentVdot(vdot, ZONE_PERCENTS.repetition),
  };
}

/**
 * Interpreta un tiempo de carrera escrito a mano ("42:15", "1:32:40", "3:30:00")
 * y lo convierte a segundos. Devuelve null si no es un tiempo válido — quien
 * llama decide qué mensaje mostrar.
 */
export function parseRaceTime(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d+$/.test(p))) return null;

  const numbers = parts.map(Number);
  // Solo la primera parte puede pasar de 59 ("90:00" = 90 minutos es válido).
  if (numbers.slice(1).some((n) => n > 59)) return null;

  const seconds =
    numbers.length === 3
      ? numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
      : numbers[0] * 60 + numbers[1];

  return seconds > 0 ? seconds : null;
}

/** Un rango como "5:56–7:05/km" — sin repetir "/km" dos veces. */
export function formatPaceRange(fastSecPerKm: number, slowSecPerKm: number): string {
  return `${formatPace(fastSecPerKm).replace("/km", "")}–${formatPace(slowSecPerKm)}`;
}

export type PaceOption = { key: keyof TrainingPaces; label: string; value: string };

/**
 * Los cinco ritmos listos para insertarse en el campo "ritmo objetivo" de un
 * segmento. El orden es de más lento a más rápido, que es como los piensa un
 * coach al armar una sesión.
 */
export function paceOptions(paces: TrainingPaces): PaceOption[] {
  return [
    { key: "easy", label: "Fácil", value: formatPaceRange(paces.easy.fastSecPerKm, paces.easy.slowSecPerKm) },
    { key: "marathon", label: "Maratón", value: formatPace(paces.marathon) },
    { key: "threshold", label: "Umbral", value: formatPace(paces.threshold) },
    { key: "interval", label: "Intervalo", value: formatPace(paces.interval) },
    { key: "repetition", label: "Repetición", value: formatPace(paces.repetition) },
  ];
}

/** Inversa de parseRaceTime: "1:32:40" para ≥1h, "42:15" si no. */
export function formatRaceTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Formatea segundos/km como "M:SS/km", igual que el resto de la app. */
export function formatPace(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}
