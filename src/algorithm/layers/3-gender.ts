import type { Grid, AlgoNurse, ClinicSlot, Budgets, Warning } from "../types";
import type { AdjustmentMap } from "../../learning/corrections";
import { calculateScore } from "../scoring";
import { getCandidates, countFilledForSlot } from "../difficulty-queue";

/**
 * Layer 3: Fill gender-restricted clinics.
 * Processes FEMALE_ONLY first, then FEMALE_PREFERRED.
 * Falls back to any gender if no female nurse is available
 * for FEMALE_PREFERRED slots.
 */
export function layer3_gender(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  warnings: Warning[],
  adjustments?: AdjustmentMap,
): void {
  const genderClinics = clinics
    .filter(
      (c) =>
        c.genderPref === "FEMALE_ONLY" || c.genderPref === "FEMALE_PREFERRED",
    )
    .sort((a, b) => {
      // FEMALE_ONLY first (priority 0), FEMALE_PREFERRED second (priority 1)
      const pa = a.genderPref === "FEMALE_ONLY" ? 0 : 1;
      const pb = b.genderPref === "FEMALE_ONLY" ? 0 : 1;
      return pa - pb;
    });

  for (const slot of genderClinics) {
    const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
    const remaining = slot.nursesNeeded - filled;

    for (let i = 0; i < remaining; i++) {
      // Try female candidates first
      let candidates = getCandidates(grid, nurses, slot, budgets).filter(
        (n) => n.gender === "FEMALE",
      );

      if (candidates.length === 0 && slot.genderPref === "FEMALE_ONLY") {
        warnings.push({
          level: "error",
          message: `No female nurse available for FEMALE_ONLY clinic`,
          clinicId: slot.clinicId,
          day: slot.day,
        });
        continue;
      }

      if (candidates.length === 0 && slot.genderPref === "FEMALE_PREFERRED") {
        // Fall back to any gender
        candidates = getCandidates(grid, nurses, slot, budgets);
        if (candidates.length > 0) {
          warnings.push({
            level: "warning",
            message: `Non-female nurse assigned to FEMALE_PREFERRED clinic`,
            clinicId: slot.clinicId,
            day: slot.day,
          });
        }
      }

      if (candidates.length === 0) {
        warnings.push({
          level: "error",
          message: `No nurse available for clinic slot`,
          clinicId: slot.clinicId,
          day: slot.day,
        });
        continue;
      }

      // Score candidates and pick the best
      const best = pickBest(candidates, slot, grid, budgets, adjustments);
      assignNurse(grid, best, slot, budgets);
    }
  }
}

/** Score all candidates and return the one with the highest score. */
function pickBest(
  candidates: AlgoNurse[],
  slot: ClinicSlot,
  grid: Grid,
  budgets: Budgets,
  adjustments?: AdjustmentMap,
): AlgoNurse {
  let bestNurse = candidates[0];
  let bestScore = -1;

  for (const nurse of candidates) {
    const score = calculateScore(nurse, slot, grid, budgets, [], adjustments);
    if (score > bestScore) {
      bestScore = score;
      bestNurse = nurse;
    }
  }

  return bestNurse;
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
