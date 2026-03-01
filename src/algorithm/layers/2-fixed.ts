import type {
  Grid,
  AlgoNurse,
  FixedEntry,
  ProgramEntry,
  Budgets,
  Warning,
} from "../types";

/**
 * Layer 2: Place fixed/locked assignments.
 * 2A: Fixed clinic assignments (permanent + one-week-only).
 * 2B: Pure patient programs (not clinic addons).
 */
export function layer2_fixed(
  grid: Grid,
  _nurses: AlgoNurse[],
  fixed: FixedEntry[],
  programs: ProgramEntry[],
  budgets: Budgets,
  warnings: Warning[],
): void {
  // ── 2A: Fixed clinic assignments ──
  for (const entry of fixed) {
    const dayMap = grid.get(entry.nurseId);
    if (!dayMap) continue;

    const cell = dayMap.get(entry.day);
    if (!cell) continue;

    if (cell.status === "BLOCKED") {
      warnings.push({
        level: "warning",
        message: `שיבוץ קבוע דולג: אחות ${entry.nurseId} חסומה ביום ${entry.day}`,
        nurseId: entry.nurseId,
        clinicId: entry.clinicId,
        day: entry.day,
      });
      continue;
    }

    const hours = entry.shiftHours ?? 7;
    cell.status = "ASSIGNED";
    cell.primaryClinicId = entry.clinicId;
    cell.shiftStart = entry.shiftStart ?? "08:00";
    cell.shiftEnd = entry.shiftEnd ?? "15:00";
    cell.hours = hours;
    cell.isFixed = true;

    const current = budgets.get(entry.nurseId) ?? 0;
    budgets.set(entry.nurseId, current - hours);
  }

  // ── 2B: Pure patient programs ──
  const purePrograms = programs.filter((p) => p.programType === "PURE_PROGRAM");

  for (const entry of purePrograms) {
    const dayMap = grid.get(entry.nurseId);
    if (!dayMap) continue;

    const cell = dayMap.get(entry.day);
    if (!cell) continue;

    if (cell.status === "BLOCKED") {
      warnings.push({
        level: "warning",
        message: `שיבוץ תוכנית דולג: אחות ${entry.nurseId} חסומה ביום ${entry.day}`,
        nurseId: entry.nurseId,
        day: entry.day,
      });
      continue;
    }

    const hours = entry.defaultHours ?? 7;
    cell.status = "ASSIGNED";
    cell.patientCallProgram = entry.programName;
    cell.patientCallCount = entry.patientCount ?? undefined;
    cell.shiftStart = entry.shiftStart ?? "08:00";
    cell.shiftEnd = entry.shiftEnd ?? "15:00";
    cell.hours = hours;
    cell.isFixed = true;

    const current = budgets.get(entry.nurseId) ?? 0;
    budgets.set(entry.nurseId, current - hours);
  }
}
