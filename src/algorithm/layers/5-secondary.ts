import type { Grid, AlgoNurse, ClinicSlot, Budgets, DayOfWeek } from "../types";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Layer 5: Stack secondary clinics on assigned nurses.
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

      for (const sec of secondaryClinics) {
        if (sec.day !== day) continue;

        const key = `${sec.clinicId}-${day}`;
        const remaining = secondaryDemand.get(key) ?? 0;
        if (remaining <= 0) continue; // demand filled

        if (nurse.blockedClinicIds.includes(sec.clinicId)) continue;
        if (sec.genderPref === "FEMALE_ONLY" && nurse.gender !== "FEMALE") {
          continue;
        }

        const secHours = sec.secondaryHours ?? 2;
        if ((budgets.get(nurse.id) ?? 0) < secHours) continue;

        // Assign secondary
        cell.secondaryClinicId = sec.clinicId;
        cell.hours += secHours;
        budgets.set(nurse.id, (budgets.get(nurse.id) ?? 0) - secHours);
        secondaryDemand.set(key, remaining - 1);
        break; // max 1 secondary per day
      }
    }
  }
}
