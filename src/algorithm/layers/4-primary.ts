import type {
  Grid,
  AlgoNurse,
  ClinicSlot,
  Budgets,
  PreferenceEntry,
  Warning,
} from "../types";
import { calculateScore } from "../scoring";
import { buildDifficultyQueue, getCandidates } from "../difficulty-queue";

/**
 * Layer 4: Fill all primary clinic slots (core logic).
 * Uses difficulty queue (MCV heuristic), scoring formula (0-1000),
 * and picks the highest-scoring candidate per slot.
 *
 * Processes only genderPref=ANY (or undefined) slots — gender-restricted
 * slots were already handled by Layer 3.
 */
export function layer4_primary(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  preferences: PreferenceEntry[],
  warnings: Warning[],
): void {
  // Only process non-gender-restricted slots
  const anyGenderClinics = clinics.filter(
    (c) =>
      !c.genderPref ||
      c.genderPref === "ANY",
  );

  // Build difficulty queue (sorted: hardest slots first)
  const queue = buildDifficultyQueue(grid, nurses, anyGenderClinics, budgets);

  for (const slot of queue) {
    // Re-check: slot may have been filled by an earlier iteration
    const candidates = getCandidates(grid, nurses, slot, budgets);

    if (candidates.length === 0) {
      warnings.push({
        level: "error",
        message: `Cannot fill slot: no candidates available`,
        clinicId: slot.clinicId,
        day: slot.day,
      });
      continue;
    }

    // Score each candidate and pick the best
    const scored = candidates.map((nurse) => ({
      nurse,
      score: calculateScore(nurse, slot, grid, budgets, preferences),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].nurse;

    assignNurse(grid, best, slot, budgets);
  }
}

/** Assign a nurse to a clinic slot and deduct hours from budget. */
function assignNurse(
  grid: Grid,
  nurse: AlgoNurse,
  slot: ClinicSlot,
  budgets: Budgets,
): void {
  const cell = grid.get(nurse.id)?.get(slot.day);
  if (!cell) return;

  cell.status = "ASSIGNED";
  cell.primaryClinicId = slot.clinicId;
  cell.shiftStart = slot.shiftStart;
  cell.shiftEnd = slot.shiftEnd;
  cell.hours = slot.shiftHours;
  cell.isFixed = false;

  const current = budgets.get(nurse.id) ?? 0;
  budgets.set(nurse.id, current - slot.shiftHours);
}
