// ═══════════════════════════════════════════
// V2 Core: Nurse-First Assignment
// Iterates nurses (most constrained first),
// assigns each nurse's days using daily hour target
// ═══════════════════════════════════════════

import type {
  Grid,
  AlgoNurse,
  ClinicSlot,
  Budgets,
  PreferenceEntry,
  Warning,
  DayOfWeek,
} from "../types";
import type { AdjustmentMap } from "../../learning/corrections";
import { scoreSlotForNurse } from "./nurse-scoring";
import { getCandidates, countFilledForSlot } from "../difficulty-queue";
import { getProb } from "../../learning/models";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * V2 Layer NF: Nurse-first primary assignment.
 *
 * 1. Calculate each nurse's daily hour target
 * 2. Sort nurses by constraint level (fewest available days first)
 * 3. For each nurse, for each available day:
 *    → find unfilled clinic slots for that day
 *    → score each slot from the nurse's perspective
 *    → assign the best-matching slot
 */
export function nurseFirstAssign(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  preferences: PreferenceEntry[],
  warnings: Warning[],
  adjustments?: AdjustmentMap,
): void {
  // Filter to non-gender-restricted slots (gender slots handled separately)
  const anyGenderClinics = clinics.filter(
    (c) => !c.genderPref || c.genderPref === "ANY",
  );

  // Build slot lookup for quick access: day → ClinicSlot[]
  const slotsByDay = new Map<DayOfWeek, ClinicSlot[]>();
  for (const day of DAYS) {
    slotsByDay.set(
      day,
      anyGenderClinics.filter((c) => c.day === day),
    );
  }

  // Sort nurses: most constrained first
  const sortedNurses = [...nurses].sort((a, b) => {
    const aAvail = countAvailableDays(grid, a.id);
    const bAvail = countAvailableDays(grid, b.id);

    // Fewer available days = more constrained = process first
    if (aAvail !== bAvail) return aAvail - bAvail;

    // Tie-break: higher contract hours first (fuller schedules)
    return b.contractHours - a.contractHours;
  });

  // Assign each nurse
  for (const nurse of sortedNurses) {
    const remaining = budgets.get(nurse.id) ?? 0;
    if (remaining <= 0) continue;

    // Calculate daily hour target
    const availDays = countAvailableDays(grid, nurse.id);
    if (availDays === 0) continue;
    const dailyTarget = remaining / availDays;

    // Get this nurse's available days, sorted by affinity strength
    // (assign days where nurse has strongest clinic match first)
    const availableDays = DAYS.filter((day) => {
      const cell = grid.get(nurse.id)?.get(day);
      return cell && cell.status === "AVAILABLE";
    }).sort((a, b) => {
      // Sort by best clinic probability for that day (descending)
      const bestA = getBestSlotProb(nurse, a, slotsByDay.get(a) ?? []);
      const bestB = getBestSlotProb(nurse, b, slotsByDay.get(b) ?? []);
      return bestB - bestA;
    });

    for (const day of availableDays) {
      const budget = budgets.get(nurse.id) ?? 0;
      if (budget <= 0) break;

      const cell = grid.get(nurse.id)?.get(day);
      if (!cell || cell.status !== "AVAILABLE") continue;

      // Get unfilled clinic slots for this day
      const daySlots = slotsByDay.get(day) ?? [];
      const candidates = daySlots.filter((slot) => {
        // Slot still needs nurses
        const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
        if (filled >= slot.nursesNeeded) return false;
        // Nurse isn't blocked from this clinic
        if (nurse.blockedClinicIds.includes(slot.clinicId)) return false;
        // Nurse has enough budget
        if (budget < slot.shiftHours) return false;
        return true;
      });

      if (candidates.length === 0) continue;

      // Score each slot from the nurse's perspective
      const scored = candidates.map((slot) => ({
        slot,
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
      const bestSlot = scored[0].slot;

      // Assign nurse to this slot
      cell.status = "ASSIGNED";
      cell.primaryClinicId = bestSlot.clinicId;
      cell.shiftStart = bestSlot.shiftStart;
      cell.shiftEnd = bestSlot.shiftEnd;
      cell.hours = bestSlot.shiftHours;
      cell.isFixed = false;

      budgets.set(nurse.id, budget - bestSlot.shiftHours);
    }
  }
}

/** Count available (unblocked, unassigned) days for a nurse. */
function countAvailableDays(grid: Grid, nurseId: string): number {
  const dayMap = grid.get(nurseId);
  if (!dayMap) return 0;

  let count = 0;
  for (const [, cell] of Array.from(dayMap)) {
    if (cell.status === "AVAILABLE") count++;
  }
  return count;
}

/** Get the highest historical probability for a nurse on a given day. */
function getBestSlotProb(
  nurse: AlgoNurse,
  day: DayOfWeek,
  slots: ClinicSlot[],
): number {
  let best = 0;
  for (const slot of slots) {
    if (nurse.blockedClinicIds.includes(slot.clinicId)) continue;
    const prob = getProb(nurse.id, slot.clinicId, day);
    if (prob > best) best = prob;
  }
  return best;
}
