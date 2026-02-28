/**
 * Types and loader for learning probability matrices.
 * Stored as JSON in data/models/.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ───────────────────────────────────────────────────────────

/** P(clinic | nurse, day): nurseId → clinicCode → day → probability */
export type ProbabilityMatrix = Record<
  string, // nurseId
  Record<string, Record<string, number>> // clinicCode → day → probability
>;

/** Per-nurse shift preference breakdown */
export type ShiftPreferences = Record<
  string, // nurseId
  { morningPct: number; afternoonPct: number; totalShifts: number }
>;

/** P(off | nurse, day): nurseId → day → probability */
export type OffDayPatterns = Record<string, Record<string, number>>;

/** Common dual-clinic combinations */
export type DualClinicCombo = {
  primary: string;
  secondary: string;
  count: number;
};

export type LearningModels = {
  probabilityMatrix: ProbabilityMatrix;
  shiftPreferences: ShiftPreferences;
  offDayPatterns: OffDayPatterns;
  dualClinicCombos: DualClinicCombo[];
  totalWeeks: number;
};

// ── Loader ──────────────────────────────────────────────────────────

const MODELS_DIR = join(process.cwd(), "data", "models");

let cached: LearningModels | null = null;

function loadJson<T>(filename: string): T | null {
  const path = join(MODELS_DIR, filename);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/** Load all learning models from data/models/. Returns null if not yet generated. */
export function loadModels(): LearningModels | null {
  if (cached) return cached;

  const probabilityMatrix = loadJson<ProbabilityMatrix>(
    "probability-matrix.json",
  );
  const shiftPreferences = loadJson<ShiftPreferences>("shift-preferences.json");
  const offDayPatterns = loadJson<OffDayPatterns>("off-day-patterns.json");
  const dualClinicCombos = loadJson<DualClinicCombo[]>(
    "dual-clinic-combos.json",
  );
  const meta = loadJson<{ totalWeeks: number }>("meta.json");

  if (
    !probabilityMatrix ||
    !shiftPreferences ||
    !offDayPatterns ||
    !dualClinicCombos ||
    !meta
  ) {
    return null;
  }

  cached = {
    probabilityMatrix,
    shiftPreferences,
    offDayPatterns,
    dualClinicCombos,
    totalWeeks: meta.totalWeeks,
  };

  return cached;
}

/**
 * Get the probability that a nurse works at a clinic on a given day.
 * The clinicKey is a clinic ID (as stored in the probability matrix).
 * Returns 0 if no data available.
 */
export function getProb(
  nurseId: string,
  clinicId: string,
  day: string,
): number {
  const models = loadModels();
  if (!models) return 0;
  return models.probabilityMatrix[nurseId]?.[clinicId]?.[day] ?? 0;
}

/** Reset cached models (for testing or after regeneration). */
export function resetCache(): void {
  cached = null;
}
