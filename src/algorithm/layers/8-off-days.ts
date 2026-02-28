import type { Grid, AlgoNurse, DayOfWeek } from "../types";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Layer 8: Mark empty cells as OFF.
 * Any AVAILABLE cell that wasn't filled becomes an OFF day.
 */
export function layer8_offDays(grid: Grid, nurses: AlgoNurse[]): void {
  for (const nurse of nurses) {
    const dayMap = grid.get(nurse.id);
    if (!dayMap) continue;

    for (const day of DAYS) {
      const cell = dayMap.get(day);
      if (!cell) continue;

      if (cell.status === "AVAILABLE") {
        cell.status = "OFF";
        cell.hours = 0;
      }
    }
  }
}
