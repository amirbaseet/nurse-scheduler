import type { Grid, AlgoNurse, ProgramEntry, Budgets, Warning } from "../types";

/**
 * Layer 6: Add patient call program addons (CLINIC_ADDON type).
 * Adds patient call info to existing assigned cells.
 * Does NOT change hours or shift times.
 */
export function layer6_programs(
  grid: Grid,
  _nurses: AlgoNurse[],
  programs: ProgramEntry[],
  _budgets: Budgets,
  warnings: Warning[],
): void {
  const addons = programs.filter((p) => p.programType === "CLINIC_ADDON");

  for (const addon of addons) {
    const cell = grid.get(addon.nurseId)?.get(addon.day);

    if (!cell || cell.status !== "ASSIGNED") {
      warnings.push({
        level: "warning",
        message: `Cannot add calls: nurse ${addon.nurseId} not working on ${addon.day}`,
        nurseId: addon.nurseId,
        day: addon.day,
      });
      continue;
    }

    cell.patientCallProgram = addon.programName;
    cell.patientCallCount = addon.patientCount ?? undefined;
  }
}
