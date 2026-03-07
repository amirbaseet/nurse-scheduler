// ═══════════════════════════════════════════
// V2: Clinic Gap Fill
// After nurse-first assignment, fill any
// remaining unfilled clinic demands
// ═══════════════════════════════════════════

import type {
  Grid,
  AlgoNurse,
  ClinicSlot,
  Budgets,
  PreferenceEntry,
  Warning,
} from "../types";
import type { AdjustmentMap } from "../../learning/corrections";
import {
  buildDifficultyQueue,
  getCandidates,
} from "../difficulty-queue";
import { scoreSlotForNurse } from "./nurse-scoring";
import { tryBacktrack } from "../backtrack";

/**
 * V2 clinic gap-fill: after nurse-first pass, some clinics may
 * still have unfilled slots. This uses the V1 difficulty-queue
 * approach to fill remaining gaps (hardest slots first).
 */
export function clinicGapFill(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  preferences: PreferenceEntry[],
  warnings: Warning[],
  adjustments?: AdjustmentMap,
): void {
  const anyGenderClinics = clinics.filter(
    (c) => !c.genderPref || c.genderPref === "ANY",
  );

  const queue = buildDifficultyQueue(grid, nurses, anyGenderClinics, budgets);

  for (const slot of queue) {
    const candidates = getCandidates(grid, nurses, slot, budgets);

    if (candidates.length === 0) {
      // Try backtracking: swap an existing assignment to free a candidate
      const recovered = tryBacktrack(grid, slot, nurses, budgets);
      if (!recovered) {
        warnings.push({
          level: "error",
          message: `לא ניתן לאייש משבצת: אין מועמדות זמינות`,
          clinicId: slot.clinicId,
          day: slot.day,
        });
      }
      continue;
    }

    // Use nurse-centric scoring even in gap-fill for consistency
    const dailyTarget = 7; // Reasonable default for gap-fill
    const scored = candidates.map((nurse) => ({
      nurse,
      score: scoreSlotForNurse(
        nurse,
        slot,
        dailyTarget,
        grid,
        budgets,
        preferences,
        anyGenderClinics,
        adjustments,
      ),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].nurse;

    // Assign
    const cell = grid.get(best.id)?.get(slot.day);
    if (!cell) continue;

    cell.status = "ASSIGNED";
    cell.primaryClinicId = slot.clinicId;
    cell.shiftStart = slot.shiftStart;
    cell.shiftEnd = slot.shiftEnd;
    cell.hours = slot.shiftHours;
    cell.isFixed = false;

    const current = budgets.get(best.id) ?? 0;
    budgets.set(best.id, current - slot.shiftHours);
  }
}
