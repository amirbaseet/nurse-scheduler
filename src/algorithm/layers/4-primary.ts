import type {
  Grid,
  AlgoNurse,
  ClinicSlot,
  Budgets,
  PreferenceEntry,
  Warning,
} from "../types";
import type { AdjustmentMap } from "../../learning/corrections";
import { applyAdjustment } from "../../learning/corrections";
import { getProb } from "../../learning/models";
import { calculateScore } from "../scoring";
import {
  buildDifficultyQueue,
  getCandidates,
  countFilledForSlot,
} from "../difficulty-queue";
import { checkLookAhead } from "../look-ahead";
import { tryBacktrack } from "../backtrack";

/** Confidence threshold: auto-assign without scoring when P > this value. */
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Layer 4: Fill all primary clinic slots (core logic).
 *
 * Two-pass approach:
 * 1. **Fast path** — auto-assign high-confidence pairings (P > 0.7)
 * 2. **Full scoring** — difficulty queue + MCV heuristic + look-ahead + backtrack
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
  adjustments?: AdjustmentMap,
): void {
  // Only process non-gender-restricted slots
  const anyGenderClinics = clinics.filter(
    (c) => !c.genderPref || c.genderPref === "ANY",
  );

  // ── Pass 1: Confidence fast path ──
  // Auto-assign when historical data shows P > 0.7
  confidenceFastPath(grid, nurses, anyGenderClinics, budgets, adjustments);

  // ── Pass 2: Full scoring for remaining unfilled slots ──
  const queue = buildDifficultyQueue(grid, nurses, anyGenderClinics, budgets);

  for (const slot of queue) {
    const candidates = getCandidates(grid, nurses, slot, budgets);

    if (candidates.length === 0) {
      const recovered = tryBacktrack(grid, slot, nurses, budgets);
      if (!recovered) {
        warnings.push({
          level: "error",
          message: `Cannot fill slot: no candidates available`,
          clinicId: slot.clinicId,
          day: slot.day,
        });
      }
      continue;
    }

    // Score each candidate: base score + look-ahead bonus
    const scored = candidates.map((nurse) => ({
      nurse,
      score:
        calculateScore(nurse, slot, grid, budgets, preferences, adjustments) +
        checkLookAhead(grid, nurse, slot, queue, nurses, budgets),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].nurse;

    assignNurse(grid, best, slot, budgets);
  }
}

/**
 * Fast path: for each unfilled slot, find candidates with P > 0.7
 * and auto-assign the highest-probability one without full scoring.
 *
 * Respects: availability, blocked clinics, budget (via getCandidates).
 */
function confidenceFastPath(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  adjustments?: AdjustmentMap,
): void {
  for (const slot of clinics) {
    const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
    const remaining = slot.nursesNeeded - filled;
    if (remaining <= 0) continue;

    // Get eligible candidates
    const candidates = getCandidates(grid, nurses, slot, budgets);
    if (candidates.length === 0) continue;

    // Score by probability only, filter by threshold
    const highConf = candidates
      .map((nurse) => {
        let prob = getProb(nurse.id, slot.clinicId, slot.day);
        if (adjustments) {
          prob = applyAdjustment(prob, nurse.id, slot.clinicId, adjustments);
        }
        return { nurse, prob };
      })
      .filter((c) => c.prob > CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.prob - a.prob);

    // Auto-assign up to the remaining seats
    const toAssign = Math.min(remaining, highConf.length);
    for (let i = 0; i < toAssign; i++) {
      assignNurse(grid, highConf[i].nurse, slot, budgets);
    }
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
