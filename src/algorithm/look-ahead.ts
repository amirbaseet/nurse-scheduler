import type { Grid, AlgoNurse, ClinicSlot, Budgets } from "./types";
import { countFilledForSlot } from "./difficulty-queue";

/**
 * Look-ahead: check if assigning `candidate` to `slot` would leave
 * any of the next 5 hardest unfilled slots with 0 or 1 candidate.
 *
 * Returns a bonus clamped to [-100, +100].
 *   0 future candidates → -80
 *   1 future candidate  → -30
 *   ≥4 future candidates → +10
 */
export function checkLookAhead(
  grid: Grid,
  candidate: AlgoNurse,
  slot: ClinicSlot,
  allSlots: ClinicSlot[],
  nurses: AlgoNurse[],
  budgets: Budgets,
): number {
  let bonus = 0;

  // Simulate: candidate's budget after being assigned to `slot`
  const tempBudget = (budgets.get(candidate.id) ?? 0) - slot.shiftHours;

  // Get next 5 hardest unfilled slots (excluding the current one)
  const remainingSlots = allSlots
    .filter((s) => {
      if (s.clinicId === slot.clinicId && s.day === slot.day) return false;
      const filled = countFilledForSlot(grid, s.clinicId, s.day);
      return filled < s.nursesNeeded;
    })
    .slice(0, 5);

  for (const future of remainingSlots) {
    let futureCandidates = 0;

    for (const n of nurses) {
      const cell = grid.get(n.id)?.get(future.day);
      if (!cell) continue;

      if (n.id === candidate.id) {
        // For the candidate: use temp budget, and they can't be on
        // both `slot.day` and `future.day` if they're the same day
        if (slot.day === future.day) continue;
        if (cell.status !== "AVAILABLE") continue;
        if (tempBudget < future.shiftHours) continue;
        if (n.blockedClinicIds.includes(future.clinicId)) continue;
      } else {
        // For other nurses: use their real budget
        if (cell.status !== "AVAILABLE") continue;
        if ((budgets.get(n.id) ?? 0) < future.shiftHours) continue;
        if (n.blockedClinicIds.includes(future.clinicId)) continue;
      }

      futureCandidates++;
    }

    if (futureCandidates === 0) {
      bonus -= 80;
    } else if (futureCandidates === 1) {
      bonus -= 30;
    } else if (futureCandidates >= 4) {
      bonus += 10;
    }
  }

  return Math.max(-100, Math.min(100, bonus));
}
