import type { Grid, AlgoNurse, ClinicSlot, Budgets, Warning } from "../types";

/**
 * Layer 3: Fill gender-restricted clinics.
 * Processes FEMALE_ONLY first, then FEMALE_PREFERRED.
 * Falls back to any gender if no female nurse is available
 * for FEMALE_PREFERRED slots.
 */
export function layer3_gender(
  _grid: Grid,
  _nurses: AlgoNurse[],
  _clinics: ClinicSlot[],
  _budgets: Budgets,
  _warnings: Warning[]
): void {
  // STUB — will be implemented with full logic
}
