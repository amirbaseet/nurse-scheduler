import type {
  AlgoNurse,
  ClinicSlot,
  Grid,
  Budgets,
  PreferenceEntry,
  DayOfWeek,
} from "./types";
import { getProb, getDayAffinity } from "../learning/models";
import type { AdjustmentMap } from "../learning/corrections";
import { applyAdjustment } from "../learning/corrections";

/**
 * Score a candidate nurse for a clinic slot.
 * Returns 0-1300 via RAW ADDITION (no multiplied weights).
 *
 * S_hist (0-400) + S_pref (0-300) + S_budget (0-200) + S_fair (0-100)
 * + S_specialist (0-200) + S_dayAffinity (0-200)
 *
 * The caller may add S_lookahead (±100) separately for a total range of 0-1400.
 */
export function calculateScore(
  nurse: AlgoNurse,
  slot: ClinicSlot,
  grid: Grid,
  budgets: Budgets,
  preferences: PreferenceEntry[],
  adjustments?: AdjustmentMap,
): number {
  const sHist = calcHistoricalScore(
    nurse.id,
    slot.clinicId,
    slot.day,
    adjustments,
  );
  const sPref = calcPreferenceScore(nurse, slot, preferences);
  const sBudget = calcBudgetScore(nurse, budgets);
  const sFair = calcFairnessScore(nurse, grid);
  const sSpecialist = calcSpecialistBonus(
    nurse.id,
    slot.clinicId,
    slot.day,
    adjustments,
  );
  const sDayAffinity = calcDayAffinityScore(nurse.id, slot.clinicId, slot.day);

  return sHist + sPref + sBudget + sFair + sSpecialist + sDayAffinity;
}

// ── S_historical (0-400) ──

function calcHistoricalScore(
  nurseId: string,
  clinicId: string,
  day: string,
  adjustments?: AdjustmentMap,
): number {
  let probability = getProb(nurseId, clinicId, day);
  if (adjustments) {
    probability = applyAdjustment(probability, nurseId, clinicId, adjustments);
  }
  return Math.round(probability * 400);
}

// ── S_specialist (0-200) ──
// Bonus for near-exclusive nurse-clinic pairings (P > 0.85)

function calcSpecialistBonus(
  nurseId: string,
  clinicId: string,
  day: string,
  adjustments?: AdjustmentMap,
): number {
  let probability = getProb(nurseId, clinicId, day);
  if (adjustments) {
    probability = applyAdjustment(probability, nurseId, clinicId, adjustments);
  }
  return probability > 0.85 ? 200 : 0;
}

// ── S_dayAffinity (0-200) ──
// Bonus when this clinic is the nurse's top-ranked clinic for this specific day.
// Uses the probability matrix inverted: (nurse, day) → ranked clinic list.

function calcDayAffinityScore(
  nurseId: string,
  clinicId: string,
  day: string,
): number {
  const ranked = getDayAffinity(nurseId, day);
  if (ranked.length === 0) return 0;

  // Check if this clinic is #1 or #2 in the nurse's day ranking
  const rank = ranked.findIndex((r) => r.clinicId === clinicId);
  if (rank === -1) return 0;

  const prob = ranked[rank].prob;

  if (rank === 0 && prob > 0.5) return 200; // Strong #1 choice
  if (rank === 0 && prob > 0.3) return 150; // Moderate #1 choice
  if (rank === 0) return 100; // Weak #1 but still top
  if (rank === 1) return 80; // #2 choice
  if (rank === 2) return 30; // #3 choice
  return 0;
}

// ── S_preference (0-300) ──

function calcPreferenceScore(
  nurse: AlgoNurse,
  slot: ClinicSlot,
  preferences: PreferenceEntry[],
): number {
  const weeklyPref = preferences.find((p) => p.nurseUserId === nurse.userId);
  const pref = weeklyPref?.shiftPreference ?? nurse.shiftPreference;
  const shiftType = slot.shiftStart < "12:00" ? "MORNING" : "AFTERNOON";

  let score: number;
  if (pref === shiftType) {
    score = 300; // perfect match
  } else if (pref === "ANYTIME") {
    score = 200; // flexible
  } else {
    score = 30; // mismatch
  }

  // Penalty for working on a wished day-off
  if (isPreferredDayOff(nurse, slot.day, preferences)) {
    score = Math.max(0, score - 80);
  }

  return score;
}

// ── S_budget (0-200) ──

function calcBudgetScore(nurse: AlgoNurse, budgets: Budgets): number {
  const remaining = budgets.get(nurse.id) ?? 0;
  const ratio = Math.max(0, Math.min(1, remaining / nurse.contractHours));
  return Math.round(ratio * 200);
}

// ── S_fairness (0-100) ──

function calcFairnessScore(nurse: AlgoNurse, grid: Grid): number {
  const assigned = countAssignedDays(grid, nurse.id);
  const maxAssignable = nurse.maxDaysPerWeek;
  if (maxAssignable <= 0) return 100;
  const fairnessRatio = 1 - assigned / maxAssignable;
  return Math.round(Math.max(0, Math.min(1, fairnessRatio)) * 100);
}

// ── Helpers (exported for testing) ──

export function countAssignedDays(grid: Grid, nurseId: string): number {
  const dayMap = grid.get(nurseId);
  if (!dayMap) return 0;
  let count = 0;
  for (const [, cell] of Array.from(dayMap)) {
    if (cell.status === "ASSIGNED") count++;
  }
  return count;
}

export function isPreferredDayOff(
  nurse: AlgoNurse,
  day: DayOfWeek,
  preferences: PreferenceEntry[],
): boolean {
  const pref = preferences.find((p) => p.nurseUserId === nurse.userId);
  if (!pref) return false;
  return pref.preferredDaysOff.includes(day);
}

// ═══════════════════════════════════════════
// Quality Score (0-100) — used by Layer 9 and final output
// ═══════════════════════════════════════════

/**
 * Calculate overall schedule quality.
 * Starts at 100, deducts for:
 *   -5 per preference mismatch (shift type)
 *   -3 per wished day-off not honored
 *  -10 per unfilled required clinic slot
 *   -(stddev * 20) for hours fairness deviation
 * Returns 0-100 (clamped).
 */
export function calculateQualityScore(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  preferences: PreferenceEntry[],
): number {
  let score = 100.0;

  const nurseMap = new Map(nurses.map((n) => [n.id, n]));

  // -5 per preference mismatch (shift type)
  for (const [nurseId, dayMap] of Array.from(grid)) {
    const nurse = nurseMap.get(nurseId);
    if (!nurse) continue;

    for (const [day, cell] of Array.from(dayMap)) {
      if (cell.status !== "ASSIGNED" || !cell.shiftStart) continue;

      const weeklyPref = preferences.find(
        (p) => p.nurseUserId === nurse.userId,
      );
      const pref = weeklyPref?.shiftPreference ?? nurse.shiftPreference;
      if (pref === "ANYTIME") continue;

      const shiftType = cell.shiftStart < "12:00" ? "MORNING" : "AFTERNOON";
      if (pref !== shiftType) {
        score -= 5;
      }

      // -3 per wished day-off not honored
      if (isPreferredDayOff(nurse, day as DayOfWeek, preferences)) {
        score -= 3;
      }
    }
  }

  // -10 per unfilled required clinic slot
  for (const slot of clinics) {
    let filled = 0;
    for (const [, dayMap] of Array.from(grid)) {
      const cell = dayMap.get(slot.day);
      if (
        cell &&
        cell.status === "ASSIGNED" &&
        cell.primaryClinicId === slot.clinicId
      ) {
        filled++;
      }
    }
    if (filled < slot.nursesNeeded) {
      score -= 10 * (slot.nursesNeeded - filled);
    }
  }

  // -stddev * 20 for hours fairness deviation
  if (nurses.length > 1) {
    const ratios = nurses.map((n) => {
      let totalHours = 0;
      const dayMap = grid.get(n.id);
      if (dayMap) {
        for (const [, cell] of Array.from(dayMap)) {
          if (cell.status === "ASSIGNED") totalHours += cell.hours;
        }
      }
      return n.contractHours > 0 ? totalHours / n.contractHours : 0;
    });

    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const variance =
      ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
    const stddev = Math.sqrt(variance);
    score -= stddev * 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
