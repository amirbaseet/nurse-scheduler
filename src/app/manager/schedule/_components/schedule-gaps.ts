import type { ScheduleAssignment } from "@/types/schedule";

// ── Types ──

export type ClinicConfig = {
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
  isOverride: boolean;
};

export type UnfilledSlot = {
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  nursesAssigned: number;
  gap: number;
};

export type NurseRemaining = {
  nurseId: string;
  nurseName: string;
  contractHours: number;
  assignedHours: number;
  remainingHours: number;
  daysWorking: number;
  daysOff: number;
};

// ── Computation ──

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Compare clinic configs (demand) vs schedule assignments (supply).
 * Returns only slots where nursesAssigned < nursesNeeded.
 */
export function computeUnfilledSlots(
  configs: ClinicConfig[],
  assignments: ScheduleAssignment[],
): UnfilledSlot[] {
  // Count assigned nurses per clinic+day (exclude off-days)
  const assignedCount = new Map<string, number>();
  for (const a of assignments) {
    if (a.isOff || !a.primaryClinicId) continue;
    const key = `${a.primaryClinicId}:${a.day}`;
    assignedCount.set(key, (assignedCount.get(key) ?? 0) + 1);
  }

  const unfilled: UnfilledSlot[] = [];

  for (const cfg of configs) {
    if (!cfg.isActive || cfg.nursesNeeded <= 0) continue;

    const key = `${cfg.clinicId}:${cfg.day}`;
    const assigned = assignedCount.get(key) ?? 0;
    const gap = cfg.nursesNeeded - assigned;

    if (gap > 0) {
      unfilled.push({
        clinicId: cfg.clinicId,
        clinicName: cfg.clinicName,
        day: cfg.day,
        shiftStart: cfg.shiftStart,
        shiftEnd: cfg.shiftEnd,
        nursesNeeded: cfg.nursesNeeded,
        nursesAssigned: assigned,
        gap,
      });
    }
  }

  // Sort by day order, then clinic name
  return unfilled.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.clinicName.localeCompare(b.clinicName);
  });
}

/**
 * For each nurse, compute contractHours − assignedHours = remainingHours.
 * Only returns nurses with remaining > 0.
 */
export function computeNurseRemaining(
  nurseMap: Map<string, { id: string; name: string; contractHours: number }>,
  assignments: ScheduleAssignment[],
): NurseRemaining[] {
  const results: NurseRemaining[] = [];

  for (const [nurseId, info] of Array.from(nurseMap)) {
    const nurseAssignments = assignments.filter((a) => a.nurseId === nurseId);

    let assignedHours = 0;
    let daysWorking = 0;
    let daysOff = 0;

    for (const a of nurseAssignments) {
      if (a.isOff) {
        daysOff++;
      } else {
        assignedHours += a.hours;
        daysWorking++;
      }
    }

    const remaining = info.contractHours - assignedHours;

    if (remaining > 0) {
      results.push({
        nurseId,
        nurseName: info.name,
        contractHours: info.contractHours,
        assignedHours,
        remainingHours: remaining,
        daysWorking,
        daysOff,
      });
    }
  }

  // Sort by most remaining hours first
  return results.sort((a, b) => b.remainingHours - a.remainingHours);
}
