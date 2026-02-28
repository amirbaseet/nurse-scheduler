import type { Grid, AlgoNurse, TimeOffEntry, DayOfWeek, Warning } from "../types";

/**
 * Layer 1: Block unavailable nurses.
 * Marks cells as BLOCKED for: time-off, recurring off-days,
 * Friday/Saturday restrictions.
 */
export function layer1_block(
  _grid: Grid,
  _nurses: AlgoNurse[],
  _timeOff: TimeOffEntry[],
  _days: DayOfWeek[],
  _warnings: Warning[]
): void {
  // STUB — will be implemented with full logic
}
