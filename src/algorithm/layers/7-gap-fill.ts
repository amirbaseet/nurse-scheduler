import type { Grid, AlgoNurse, Budgets, Warning, DayOfWeek } from "../types";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Add hours to a time string like "15:00" → "17:00". */
function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

/**
 * Layer 7: Fill remaining hours budget.
 * Extends shifts by up to 2 hours for nurses with remaining budget.
 * Warns about nurses with 4+ unfilled hours.
 */
export function layer7_gapFill(
  grid: Grid,
  nurses: AlgoNurse[],
  budgets: Budgets,
  warnings: Warning[],
): void {
  // Sort: nurses with most remaining budget first
  const nursesWithGap = nurses
    .filter((n) => (budgets.get(n.id) ?? 0) >= 2)
    .sort((a, b) => (budgets.get(b.id) ?? 0) - (budgets.get(a.id) ?? 0));

  for (const nurse of nursesWithGap) {
    const dayMap = grid.get(nurse.id);
    if (!dayMap) continue;

    for (const day of DAYS) {
      const cell = dayMap.get(day);
      if (!cell) continue;
      if (cell.status !== "ASSIGNED") continue;
      if ((budgets.get(nurse.id) ?? 0) < 1) break;
      if (cell.hours >= 8) continue;

      const maxExtend = 2;
      const roomInShift = 8 - cell.hours;
      const availableBudget = budgets.get(nurse.id) ?? 0;
      const extend = Math.min(maxExtend, roomInShift, availableBudget);

      if (extend <= 0) continue;

      cell.hours += extend;
      if (cell.shiftEnd) {
        cell.shiftEnd = addHoursToTime(cell.shiftEnd, extend);
      }
      budgets.set(nurse.id, availableBudget - extend);
    }

    // Warn if nurse still has significant unfilled hours
    const remaining = budgets.get(nurse.id) ?? 0;
    if (remaining >= 4) {
      warnings.push({
        level: "info",
        message: `${nurse.name} — ${remaining} שעות לא מאוישות`,
        nurseId: nurse.id,
      });
    }
  }
}
