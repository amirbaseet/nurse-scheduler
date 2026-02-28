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
