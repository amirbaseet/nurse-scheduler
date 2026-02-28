import type {
  AlgoNurse,
  ClinicSlot,
  Grid,
  Budgets,
  PreferenceEntry,
  DayOfWeek,
} from "./types";

/**
 * Score a candidate nurse for a clinic slot.
 * Returns 0-900 via RAW ADDITION (no multiplied weights).
 *
 * S_pref (0-350) + S_budget (0-250) + S_hist (75) + S_fair (0-150)
 *
 * The caller may add S_lookahead (±100) separately for a total range of 0-1000.
 */
export function calculateScore(
  nurse: AlgoNurse,
  slot: ClinicSlot,
  grid: Grid,
  budgets: Budgets,
  preferences: PreferenceEntry[],
): number {
  const sPref = calcPreferenceScore(nurse, slot, preferences);
  const sBudget = calcBudgetScore(nurse, budgets);
  const sHist = 75; // placeholder until Phase 9 learning engine
  const sFair = calcFairnessScore(nurse, grid);

  return sPref + sBudget + sHist + sFair;
}

// ── S_preference (0-350) ──

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
    score = 350; // perfect match
  } else if (pref === "ANYTIME") {
    score = 250; // flexible
  } else {
    score = 50; // mismatch
  }

  // Penalty for working on a wished day-off
  if (isPreferredDayOff(nurse, slot.day, preferences)) {
    score = Math.max(0, score - 100);
  }

  return score;
}

// ── S_budget (0-250) ──

function calcBudgetScore(nurse: AlgoNurse, budgets: Budgets): number {
  const remaining = budgets.get(nurse.id) ?? 0;
  const ratio = Math.max(0, Math.min(1, remaining / nurse.contractHours));
  return Math.round(ratio * 250);
}

// ── S_fairness (0-150) ──

function calcFairnessScore(nurse: AlgoNurse, grid: Grid): number {
  const assigned = countAssignedDays(grid, nurse.id);
  const maxAssignable = nurse.maxDaysPerWeek;
  if (maxAssignable <= 0) return 150;
  const fairnessRatio = 1 - assigned / maxAssignable;
  return Math.round(Math.max(0, Math.min(1, fairnessRatio)) * 150);
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
