// ═══════════════════════════════════════════
// Shift Builder — Pre-algorithm phase
// Splits long clinic shifts into AM/PM halves
// so part-time nurses can be assigned.
// ═══════════════════════════════════════════

import type { ClinicSlot, AlgoNurse, DayOfWeek } from "./types";

/** Minimum hours for a split segment (don't create tiny shifts). */
const DEFAULT_MIN_SPLIT_HOURS = 3.0;

/**
 * Analyze nurse pool and split long clinic shifts into halves
 * when it would help part-time nurses get assigned.
 *
 * Decision logic per splittable slot:
 * 1. Check if any nurse CAN take the full shift (has enough daily budget)
 * 2. If yes, keep the original (no benefit from splitting)
 * 3. If no full-shift candidates exist but half-shift candidates do, split
 *
 * Split replaces the original slot with two halves:
 *   morning: shiftStart → midpoint
 *   afternoon: midpoint → shiftEnd
 * Each half needs nursesNeeded nurses (same as original).
 */
export function buildShiftVariants(
  clinics: ClinicSlot[],
  nurses: AlgoNurse[],
): ClinicSlot[] {
  const regularNurses = nurses.filter((n) => !n.isManager);
  if (regularNurses.length === 0) return clinics;

  // Compute each nurse's approximate daily budget
  const dailyBudgets = regularNurses.map((n) => {
    const workDays = Math.min(n.maxDaysPerWeek, 5);
    return workDays > 0 ? n.contractHours / workDays : 0;
  });

  const result: ClinicSlot[] = [];

  for (const slot of clinics) {
    if (!slot.canSplit || slot.shiftHours < DEFAULT_MIN_SPLIT_HOURS * 2) {
      // Can't split or too short to split meaningfully
      result.push(slot);
      continue;
    }

    // Count nurses who can afford the full shift
    const fullCandidates = dailyBudgets.filter(
      (db) => db >= slot.shiftHours,
    ).length;

    // Count nurses who could afford a half shift
    const halfHours = slot.shiftHours / 2;
    const halfCandidates = dailyBudgets.filter(
      (db) => db >= halfHours && db < slot.shiftHours,
    ).length;

    // Only split if:
    // - Few nurses can take the full shift (< nursesNeeded * 2)
    // - Half-shift candidates exist
    // - Each half would be >= minimum hours
    const shouldSplit =
      fullCandidates < slot.nursesNeeded * 2 &&
      halfCandidates > 0 &&
      halfHours >= DEFAULT_MIN_SPLIT_HOURS;

    if (!shouldSplit) {
      result.push(slot);
      continue;
    }

    // Split into morning + afternoon halves
    const midpoint = calcMidpoint(slot.shiftStart, slot.shiftEnd);

    const morningSlot: ClinicSlot = {
      ...slot,
      shiftEnd: midpoint,
      shiftHours: calcHoursBetween(slot.shiftStart, midpoint),
      isSplit: true,
    };

    const afternoonSlot: ClinicSlot = {
      ...slot,
      shiftStart: midpoint,
      shiftHours: calcHoursBetween(midpoint, slot.shiftEnd),
      isSplit: true,
    };

    result.push(morningSlot, afternoonSlot);
  }

  return result;
}

/** Calculate midpoint time between two HH:MM strings. */
function calcMidpoint(start: string, end: string): string {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  const mid = Math.round((startMin + endMin) / 2);
  // Round to nearest 30 minutes for clean shift boundaries
  const rounded = Math.round(mid / 30) * 30;
  return fromMinutes(rounded);
}

/** Convert HH:MM to minutes since midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight to HH:MM. */
function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Calculate hours between two HH:MM strings. */
function calcHoursBetween(start: string, end: string): number {
  return (toMinutes(end) - toMinutes(start)) / 60;
}
