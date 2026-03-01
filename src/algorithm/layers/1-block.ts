import type {
  Grid,
  AlgoNurse,
  TimeOffEntry,
  PreferenceEntry,
  DayOfWeek,
  Warning,
} from "../types";
import { loadModels } from "../../learning/models";

const DAY_INDEX: Record<DayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Resolve a DayOfWeek to an actual calendar Date for the given week.
 * weekStart is assumed to be a Sunday at 00:00.
 */
function dayToDate(weekStart: Date, day: DayOfWeek): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + DAY_INDEX[day]);
  return d;
}

/** Check if a calendar date falls within [startDate, endDate] (inclusive). */
function dateInRange(date: Date, start: Date, end: Date): boolean {
  // Compare date-only (strip time) by using year/month/day
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}

/**
 * Layer 1: Block unavailable nurses.
 * Marks cells as BLOCKED for: time-off, recurring off-days,
 * Friday/Saturday restrictions.
 */
export function layer1_block(
  grid: Grid,
  nurses: AlgoNurse[],
  timeOff: TimeOffEntry[],
  days: DayOfWeek[],
  weekStart: Date,
  warnings: Warning[],
  preferences: PreferenceEntry[] = [],
): void {
  for (const nurse of nurses) {
    const nurseTimeOff = timeOff.filter((t) => t.nurseUserId === nurse.userId);
    const nursePref = preferences.find((p) => p.nurseUserId === nurse.userId);
    const dayMap = grid.get(nurse.id);
    if (!dayMap) continue;

    for (const day of days) {
      const cell = dayMap.get(day);
      if (!cell) continue;

      // Already blocked by an earlier check → skip
      if (cell.status === "BLOCKED") continue;

      // 1. Time-off check
      const actualDate = dayToDate(weekStart, day);
      const hasTimeOff = nurseTimeOff.some((t) =>
        dateInRange(actualDate, t.startDate, t.endDate),
      );
      if (hasTimeOff) {
        cell.status = "BLOCKED";
        cell.blockReason = "time_off";
        continue;
      }

      // 2. Recurring off-day
      if (nurse.recurringOffDays.includes(day)) {
        cell.status = "BLOCKED";
        cell.blockReason = "recurring_off";
        continue;
      }

      // 3. Friday restriction
      if (day === "FRI" && !nurse.canWorkFriday) {
        cell.status = "BLOCKED";
        cell.blockReason = "no_friday";
        continue;
      }

      // 4. Saturday restriction
      if (day === "SAT" && !nurse.canWorkSaturday) {
        cell.status = "BLOCKED";
        cell.blockReason = "no_saturday";
        continue;
      }

      // 5. Weekly preferred day off (nurse requested this day off)
      if (nursePref?.preferredDaysOff.includes(day)) {
        cell.status = "BLOCKED";
        cell.blockReason = "preferred_off";
        continue;
      }
    }
  }

  // 6. Historical off-day patterns: block days where nurse is historically off
  //    (P > 0.60) but only if they still have enough days to fill their hours.
  applyHistoricalOffDays(grid, nurses, days);
}

/** Minimum off-day probability to trigger a historical block.
 *  Only block days where the nurse is off MORE than 60% of the time.
 *  At 0.15 (old value), nurses who work a day 80% of the time got blocked. */
const HISTORICAL_OFF_THRESHOLD = 0.6;

function applyHistoricalOffDays(
  grid: Grid,
  nurses: AlgoNurse[],
  days: DayOfWeek[],
): void {
  const models = loadModels();
  if (!models) return;

  for (const nurse of nurses) {
    const dayMap = grid.get(nurse.id);
    if (!dayMap) continue;

    const nurseOffPatterns = models.offDayPatterns[nurse.id];
    if (!nurseOffPatterns) continue;

    // Count how many days are still available
    let availableDays = 0;
    for (const day of days) {
      const cell = dayMap.get(day);
      if (cell && cell.status === "AVAILABLE") availableDays++;
    }

    // Minimum days needed to fill contract hours (assume ~7h/day average shift)
    const minDaysNeeded = Math.ceil(nurse.contractHours / 7);

    // Sort available days by off-probability descending — block highest first
    const blockCandidates = days
      .filter((day) => {
        const cell = dayMap.get(day);
        if (!cell || cell.status !== "AVAILABLE") return false;
        const offProb = nurseOffPatterns[day] ?? 0;
        return offProb > HISTORICAL_OFF_THRESHOLD;
      })
      .sort((a, b) => (nurseOffPatterns[b] ?? 0) - (nurseOffPatterns[a] ?? 0));

    for (const day of blockCandidates) {
      // Guard: don't block if it would leave too few days for contract hours
      if (availableDays <= minDaysNeeded) break;

      const cell = dayMap.get(day)!;
      cell.status = "BLOCKED";
      cell.blockReason = "historical_off";
      availableDays--;
    }
  }
}
