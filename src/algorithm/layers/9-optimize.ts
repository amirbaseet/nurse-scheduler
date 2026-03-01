import type {
  Grid,
  AlgoNurse,
  ClinicSlot,
  Budgets,
  PreferenceEntry,
  DayOfWeek,
  Cell,
} from "../types";
import { calculateQualityScore } from "../scoring";
import { getProb } from "../../learning/models";

/** Don't swap a nurse away from a clinic with this much historical affinity. */
const SWAP_PROTECTION_THRESHOLD = 0.4;

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const ITERATIONS = 10_000;
const COOLING_RATE = 0.9997;

/**
 * Layer 9: Simulated annealing optimization.
 * Randomly swaps non-fixed assignments on the same day and keeps
 * improvements. Accepts some worse moves early (high temperature)
 * to escape local optima.
 */
export function layer9_optimize(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  _budgets: Budgets,
  preferences: PreferenceEntry[],
): void {
  if (nurses.length < 2) return;

  // Build clinic gender lookup: clinicId → genderPref
  const clinicGenderPref = new Map<string, ClinicSlot["genderPref"]>();
  for (const c of clinics) {
    if (c.genderPref && !clinicGenderPref.has(c.clinicId)) {
      clinicGenderPref.set(c.clinicId, c.genderPref);
    }
  }

  const nurseMap = new Map(nurses.map((n) => [n.id, n]));

  let currentScore = calculateQualityScore(grid, nurses, clinics, preferences);
  let temperature = 1.0;

  for (let i = 0; i < ITERATIONS; i++) {
    const day = DAYS[Math.floor(Math.random() * DAYS.length)];

    // Find assigned nurses on this day
    const assignedOnDay: string[] = [];
    for (const [nurseId, dayMap] of Array.from(grid)) {
      const cell = dayMap.get(day);
      if (cell && cell.status === "ASSIGNED") {
        assignedOnDay.push(nurseId);
      }
    }

    if (assignedOnDay.length < 2) {
      temperature *= COOLING_RATE;
      continue;
    }

    // Pick two random distinct nurses
    const idx1 = Math.floor(Math.random() * assignedOnDay.length);
    let idx2 = Math.floor(Math.random() * (assignedOnDay.length - 1));
    if (idx2 >= idx1) idx2++;

    const nurseId1 = assignedOnDay[idx1];
    const nurseId2 = assignedOnDay[idx2];

    const cell1 = grid.get(nurseId1)!.get(day)!;
    const cell2 = grid.get(nurseId2)!.get(day)!;

    // Never swap fixed assignments
    if (cell1.isFixed || cell2.isFixed) {
      temperature *= COOLING_RATE;
      continue;
    }

    // Protect high-affinity assignments from being swapped
    if (cell1.primaryClinicId) {
      const affinity1 = getProb(nurseId1, cell1.primaryClinicId, day);
      if (affinity1 > SWAP_PROTECTION_THRESHOLD) {
        temperature *= COOLING_RATE;
        continue;
      }
    }
    if (cell2.primaryClinicId) {
      const affinity2 = getProb(nurseId2, cell2.primaryClinicId, day);
      if (affinity2 > SWAP_PROTECTION_THRESHOLD) {
        temperature *= COOLING_RATE;
        continue;
      }
    }

    const nurse1 = nurseMap.get(nurseId1)!;
    const nurse2 = nurseMap.get(nurseId2)!;

    // Check blocked clinics
    if (
      cell2.primaryClinicId &&
      nurse1.blockedClinicIds.includes(cell2.primaryClinicId)
    ) {
      temperature *= COOLING_RATE;
      continue;
    }
    if (
      cell1.primaryClinicId &&
      nurse2.blockedClinicIds.includes(cell1.primaryClinicId)
    ) {
      temperature *= COOLING_RATE;
      continue;
    }

    // Check gender constraints
    const gp1 = cell1.primaryClinicId
      ? clinicGenderPref.get(cell1.primaryClinicId)
      : undefined;
    const gp2 = cell2.primaryClinicId
      ? clinicGenderPref.get(cell2.primaryClinicId)
      : undefined;

    if (gp1 === "FEMALE_ONLY" && nurse2.gender !== "FEMALE") {
      temperature *= COOLING_RATE;
      continue;
    }
    if (gp2 === "FEMALE_ONLY" && nurse1.gender !== "FEMALE") {
      temperature *= COOLING_RATE;
      continue;
    }

    // Execute swap
    swapCells(cell1, cell2);

    const newScore = calculateQualityScore(grid, nurses, clinics, preferences);
    const delta = newScore - currentScore;

    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      currentScore = newScore; // keep the swap
    } else {
      swapCells(cell1, cell2); // revert
    }

    temperature *= COOLING_RATE;
  }
}

/** Swap the primary assignment data between two cells. */
function swapCells(a: Cell, b: Cell): void {
  const tmpClinic = a.primaryClinicId;
  const tmpSecondary = a.secondaryClinicId;
  const tmpStart = a.shiftStart;
  const tmpEnd = a.shiftEnd;
  const tmpHours = a.hours;
  const tmpProgram = a.patientCallProgram;
  const tmpCount = a.patientCallCount;

  a.primaryClinicId = b.primaryClinicId;
  a.secondaryClinicId = b.secondaryClinicId;
  a.shiftStart = b.shiftStart;
  a.shiftEnd = b.shiftEnd;
  a.hours = b.hours;
  a.patientCallProgram = b.patientCallProgram;
  a.patientCallCount = b.patientCallCount;

  b.primaryClinicId = tmpClinic;
  b.secondaryClinicId = tmpSecondary;
  b.shiftStart = tmpStart;
  b.shiftEnd = tmpEnd;
  b.hours = tmpHours;
  b.patientCallProgram = tmpProgram;
  b.patientCallCount = tmpCount;
}
