import type { Grid, AlgoNurse, ClinicSlot, Budgets, DayOfWeek } from "../types";
import { loadModels } from "../../learning/models";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Build a lookup: primaryClinicId → preferred secondaryClinicId[] (sorted by frequency).
 * Uses dual-clinic combo data from the learning models.
 */
function buildComboLookup(clinics: ClinicSlot[]): Map<string, string[]> {
  const models = loadModels();
  if (!models) return new Map();

  // Build code → ID map from the clinic slots
  const codeToId = new Map<string, string>();
  for (const c of clinics) {
    if (c.clinicCode) {
      codeToId.set(c.clinicCode, c.clinicId);
    }
  }

  // Group combos by primary clinic ID, sorted by count descending
  const lookup = new Map<string, string[]>();
  const sorted = [...models.dualClinicCombos].sort((a, b) => b.count - a.count);

  for (const combo of sorted) {
    const primaryId = codeToId.get(combo.primary);
    const secondaryId = codeToId.get(combo.secondary);
    if (!primaryId || !secondaryId) continue;

    const existing = lookup.get(primaryId) ?? [];
    existing.push(secondaryId);
    lookup.set(primaryId, existing);
  }

  return lookup;
}

/**
 * Layer 5: Stack secondary clinics on assigned nurses.
 * Prioritizes historically common primary+secondary combos.
 * Tracks demand per clinic per day to avoid over-assigning.
 * Max 1 secondary clinic per nurse per day.
 */
export function layer5_secondary(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
): void {
  const secondaryClinics = clinics.filter((c) => c.canBeSecondary);
  const comboLookup = buildComboLookup(clinics);

  // Build demand tracker: "clinicId-day" → remaining nurses needed
  const secondaryDemand = new Map<string, number>();
  for (const sec of secondaryClinics) {
    const key = `${sec.clinicId}-${sec.day}`;
    secondaryDemand.set(key, sec.secondaryNursesNeeded ?? 1);
  }

  for (const nurse of nurses) {
    const dayMap = grid.get(nurse.id);
    if (!dayMap) continue;

    for (const day of DAYS) {
      const cell = dayMap.get(day);
      if (!cell) continue;
      if (cell.status !== "ASSIGNED") continue;
      if (cell.secondaryClinicId) continue; // already has a secondary
      if ((budgets.get(nurse.id) ?? 0) < 1) continue;

      const primaryId = cell.primaryClinicId;

      // Try preferred combos first (sorted by historical frequency)
      const preferredSecondaryIds = primaryId
        ? (comboLookup.get(primaryId) ?? [])
        : [];

      const assigned = tryAssignSecondary(
        nurse,
        day,
        cell,
        preferredSecondaryIds,
        secondaryClinics,
        secondaryDemand,
        budgets,
      );

      // Fall back to any valid secondary if no preferred combo matched
      if (!assigned) {
        tryAssignSecondary(
          nurse,
          day,
          cell,
          [],
          secondaryClinics,
          secondaryDemand,
          budgets,
        );
      }
    }
  }
}

/** Try assigning a secondary clinic from the given preferred list (or all if empty). */
function tryAssignSecondary(
  nurse: AlgoNurse,
  day: DayOfWeek,
  cell: { secondaryClinicId?: string; hours: number },
  preferredIds: string[],
  secondaryClinics: ClinicSlot[],
  secondaryDemand: Map<string, number>,
  budgets: Budgets,
): boolean {
  const candidates =
    preferredIds.length > 0
      ? secondaryClinics.filter(
          (sec) => sec.day === day && preferredIds.includes(sec.clinicId),
        )
      : secondaryClinics.filter((sec) => sec.day === day);

  for (const sec of candidates) {
    const key = `${sec.clinicId}-${day}`;
    const remaining = secondaryDemand.get(key) ?? 0;
    if (remaining <= 0) continue;

    if (nurse.blockedClinicIds.includes(sec.clinicId)) continue;
    if (sec.genderPref === "FEMALE_ONLY" && nurse.gender !== "FEMALE") continue;

    const secHours = sec.secondaryHours ?? 2;
    if ((budgets.get(nurse.id) ?? 0) < secHours) continue;

    // Assign secondary
    cell.secondaryClinicId = sec.clinicId;
    cell.hours += secHours;
    budgets.set(nurse.id, (budgets.get(nurse.id) ?? 0) - secHours);
    secondaryDemand.set(key, remaining - 1);
    return true;
  }

  return false;
}
