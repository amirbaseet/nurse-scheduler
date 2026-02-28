import type { Grid, AlgoNurse, ClinicSlot, Budgets } from "./types";

/**
 * Get eligible candidates for a clinic slot: AVAILABLE, not blocked,
 * enough budget for the shift hours.
 */
export function getCandidates(
  grid: Grid,
  nurses: AlgoNurse[],
  slot: ClinicSlot,
  budgets: Budgets,
): AlgoNurse[] {
  return nurses.filter((n) => {
    const cell = grid.get(n.id)?.get(slot.day);
    if (!cell || cell.status !== "AVAILABLE") return false;
    if (n.blockedClinicIds.includes(slot.clinicId)) return false;
    if ((budgets.get(n.id) ?? 0) < slot.shiftHours) return false;
    return true;
  });
}

/** Count how many nurses are already assigned to a specific clinic+day. */
export function countFilledForSlot(
  grid: Grid,
  clinicId: string,
  day: ClinicSlot["day"],
): number {
  let count = 0;
  for (const [, dayMap] of Array.from(grid)) {
    const cell = dayMap.get(day);
    if (
      cell &&
      cell.status === "ASSIGNED" &&
      cell.primaryClinicId === clinicId
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Build a difficulty queue: expand each unfilled slot into individual
 * "seats" (one per nurse still needed), count candidates for each,
 * and sort ascending (fewest candidates first = hardest).
 */
export function buildDifficultyQueue(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
): ClinicSlot[] {
  const queue: ClinicSlot[] = [];

  for (const slot of clinics) {
    const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
    const remaining = slot.nursesNeeded - filled;

    if (remaining <= 0) continue;

    const candidateCount = getCandidates(grid, nurses, slot, budgets).length;

    // Add one entry per unfilled seat (all share the same candidate count)
    for (let i = 0; i < remaining; i++) {
      queue.push({ ...slot, candidateCount });
    }
  }

  // Sort ascending by candidate count (hardest first)
  queue.sort((a, b) => (a.candidateCount ?? 0) - (b.candidateCount ?? 0));

  return queue;
}
