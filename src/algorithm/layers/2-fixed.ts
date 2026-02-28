import type { Grid, AlgoNurse, FixedEntry, ProgramEntry, Budgets, Warning } from "../types";

/**
 * Layer 2: Place fixed/locked assignments.
 * 2A: Fixed clinic assignments (permanent + one-week-only).
 * 2B: Pure patient programs (not clinic addons).
 */
export function layer2_fixed(
  _grid: Grid,
  _nurses: AlgoNurse[],
  _fixed: FixedEntry[],
  _programs: ProgramEntry[],
  _budgets: Budgets,
  _warnings: Warning[]
): void {
  // STUB — will be implemented with full logic
}
