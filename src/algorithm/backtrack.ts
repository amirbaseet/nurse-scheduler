import type { Grid, AlgoNurse, ClinicSlot, Budgets } from "./types";
import { getProb } from "../learning/models";

/** Don't swap a nurse away from a clinic they have strong historical affinity for. */
const BACKTRACK_PROTECTION_THRESHOLD = 0.4;

/**
 * Backtracking: when a slot has 0 candidates, try to recover by
 * swapping an already-assigned nurse into the failed slot and
 * finding a replacement for their original slot.
 *
 * Protects high-affinity assignments (P > 0.4) from being swapped,
 * preserving historically accurate pairings.
 *
 * Returns true if a swap was made, false if recovery failed.
 */
export function tryBacktrack(
  grid: Grid,
  failedSlot: ClinicSlot,
  nurses: AlgoNurse[],
  budgets: Budgets,
): boolean {
  const nurseMap = new Map(nurses.map((n) => [n.id, n]));

  // Look at all assigned (non-fixed) cells on the failed slot's day
  for (const [assignedNurseId, dayMap] of Array.from(grid)) {
    const cell = dayMap.get(failedSlot.day);
    if (!cell || cell.status !== "ASSIGNED" || cell.isFixed) continue;

    // Protect high-affinity assignments from being swapped
    if (cell.primaryClinicId) {
      const affinity = getProb(
        assignedNurseId,
        cell.primaryClinicId,
        failedSlot.day,
      );
      if (affinity > BACKTRACK_PROTECTION_THRESHOLD) continue;
    }

    const assignedNurse = nurseMap.get(assignedNurseId);
    if (!assignedNurse) continue;

    // Can this nurse do the failed slot?
    if (assignedNurse.blockedClinicIds.includes(failedSlot.clinicId)) continue;
    if (
      failedSlot.genderPref === "FEMALE_ONLY" &&
      assignedNurse.gender !== "FEMALE"
    ) {
      continue;
    }

    // Their current assignment details
    const originalClinicId = cell.primaryClinicId;
    const originalHours = cell.hours;
    const originalShiftStart = cell.shiftStart;
    const originalShiftEnd = cell.shiftEnd;
    if (!originalClinicId) continue;

    // Can we find a replacement for their current slot?
    const replacement = nurses.find((n) => {
      if (n.id === assignedNurseId) return false;
      const rCell = grid.get(n.id)?.get(failedSlot.day);
      if (!rCell || rCell.status !== "AVAILABLE") return false;
      if (n.blockedClinicIds.includes(originalClinicId)) return false;
      if ((budgets.get(n.id) ?? 0) < originalHours) return false;
      return true;
    });

    if (!replacement) continue;

    // Execute the swap:
    // 1. Move assigned nurse to the failed slot
    cell.primaryClinicId = failedSlot.clinicId;
    cell.shiftStart = failedSlot.shiftStart;
    cell.shiftEnd = failedSlot.shiftEnd;
    cell.hours = failedSlot.shiftHours;
    // isFixed stays false (this is a computed assignment)

    // 2. Assign replacement to the original slot
    const rCell = grid.get(replacement.id)?.get(failedSlot.day);
    if (!rCell) continue;

    rCell.status = "ASSIGNED";
    rCell.primaryClinicId = originalClinicId;
    rCell.shiftStart = originalShiftStart;
    rCell.shiftEnd = originalShiftEnd;
    rCell.hours = originalHours;
    rCell.isFixed = false;

    // 3. Update budgets
    // Assigned nurse: refund original hours, deduct failed slot hours
    const assignedBudget = budgets.get(assignedNurseId) ?? 0;
    budgets.set(
      assignedNurseId,
      assignedBudget + originalHours - failedSlot.shiftHours,
    );

    // Replacement: deduct original slot hours
    const replacementBudget = budgets.get(replacement.id) ?? 0;
    budgets.set(replacement.id, replacementBudget - originalHours);

    return true;
  }

  return false;
}
