// ═══════════════════════════════════════════
// DB ↔ Algorithm Type Converters
// ═══════════════════════════════════════════

import type { DayOfWeek } from "@prisma/client";
import type {
  AlgorithmConfig,
  AlgoNurse,
  ClinicSlot,
  TimeOffEntry,
  FixedEntry,
  ProgramEntry,
  PreferenceEntry,
  AssignmentData,
} from "./types";
import { parseJsonArray } from "@/lib/json-arrays";

// ── Input types (Prisma query results) ──

type NurseProfileWithRelations = {
  id: string;
  userId: string;
  gender: string;
  contractHours: number;
  shiftPreference: string;
  canWorkFriday: boolean;
  canWorkSaturday: boolean;
  maxDaysPerWeek: number;
  isManager: boolean;
  managementHours: number | null;
  recurringOffDays: string;
  user: { name: string };
  blockedClinics: Array<{ clinicId: string }>;
};

type ClinicDefaultConfigRow = {
  clinicId: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
  clinic: {
    genderPref: string;
    canBeSecondary: boolean;
    secondaryHours: number | null;
    secondaryNursesNeeded: number;
  };
};

type ClinicWeeklyConfigRow = {
  clinicId: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
  clinic: {
    genderPref: string;
    canBeSecondary: boolean;
    secondaryHours: number | null;
    secondaryNursesNeeded: number;
  };
};

type TimeOffRow = {
  nurseId: string; // this is User.id
  startDate: Date;
  endDate: Date;
};

type FixedAssignmentRow = {
  nurseId: string; // NurseProfile.id
  clinicId: string;
  day: string;
  clinic: {
    defaultConfigs: Array<{
      day: string;
      shiftStart: string;
      shiftEnd: string;
    }>;
  };
};

type ProgramAssignmentRow = {
  nurseId: string; // NurseProfile.id
  day: string;
  patientCount: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  program: {
    name: string;
    type: string;
    defaultHours: number | null;
  };
};

type WeeklyPreferenceRow = {
  nurseId: string; // User.id
  shiftPreference: string | null;
  preferredDaysOff: string;
};

// ═══════════════════════════════════════════
// Calculate hours from time strings
// ═══════════════════════════════════════════

export function calcHours(shiftStart: string, shiftEnd: string): number {
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return Math.max(0, diff);
}

// ═══════════════════════════════════════════
// Merge ClinicDefaultConfig + ClinicWeeklyConfig
// ═══════════════════════════════════════════

export function mergeClinicConfigs(
  defaults: ClinicDefaultConfigRow[],
  overrides: ClinicWeeklyConfigRow[],
): ClinicSlot[] {
  const result: ClinicSlot[] = [];
  const overrideMap = new Map<string, ClinicWeeklyConfigRow>();

  for (const o of overrides) {
    overrideMap.set(`${o.clinicId}-${o.day}`, o);
  }

  for (const d of defaults) {
    const key = `${d.clinicId}-${d.day}`;
    const effective = overrideMap.get(key) ?? d;

    if (effective.isActive) {
      result.push({
        clinicId: effective.clinicId,
        day: effective.day as DayOfWeek,
        shiftStart: effective.shiftStart,
        shiftEnd: effective.shiftEnd,
        nursesNeeded: effective.nursesNeeded,
        shiftHours: calcHours(effective.shiftStart, effective.shiftEnd),
        genderPref: effective.clinic.genderPref as ClinicSlot["genderPref"],
        canBeSecondary: effective.clinic.canBeSecondary,
        secondaryHours: effective.clinic.secondaryHours ?? undefined,
        secondaryNursesNeeded: effective.clinic.secondaryNursesNeeded,
      });
    }

    overrideMap.delete(key);
  }

  // Any overrides for clinics NOT in defaults (new one-off clinic for this week)
  for (const [, o] of Array.from(overrideMap)) {
    if (o.isActive) {
      result.push({
        clinicId: o.clinicId,
        day: o.day as DayOfWeek,
        shiftStart: o.shiftStart,
        shiftEnd: o.shiftEnd,
        nursesNeeded: o.nursesNeeded,
        shiftHours: calcHours(o.shiftStart, o.shiftEnd),
        genderPref: o.clinic.genderPref as ClinicSlot["genderPref"],
        canBeSecondary: o.clinic.canBeSecondary,
        secondaryHours: o.clinic.secondaryHours ?? undefined,
        secondaryNursesNeeded: o.clinic.secondaryNursesNeeded,
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════
// DB → Algorithm Config
// ═══════════════════════════════════════════

export function dbToAlgorithmConfig(
  nurseProfiles: NurseProfileWithRelations[],
  clinicDefaults: ClinicDefaultConfigRow[],
  clinicOverrides: ClinicWeeklyConfigRow[],
  timeOff: TimeOffRow[],
  fixedAssignments: FixedAssignmentRow[],
  programs: ProgramAssignmentRow[],
  preferences: WeeklyPreferenceRow[],
): AlgorithmConfig {
  const clinics = mergeClinicConfigs(clinicDefaults, clinicOverrides);

  const nurses: AlgoNurse[] = nurseProfiles.map((np) => ({
    id: np.id,
    userId: np.userId,
    name: np.user.name,
    gender: np.gender as AlgoNurse["gender"],
    contractHours: np.contractHours,
    shiftPreference: np.shiftPreference as AlgoNurse["shiftPreference"],
    canWorkFriday: np.canWorkFriday,
    canWorkSaturday: np.canWorkSaturday,
    maxDaysPerWeek: np.maxDaysPerWeek,
    isManager: np.isManager,
    managementHours: np.managementHours,
    recurringOffDays: parseJsonArray(np.recurringOffDays) as DayOfWeek[],
    blockedClinicIds: np.blockedClinics.map((bc) => bc.clinicId),
  }));

  const timeOffEntries: TimeOffEntry[] = timeOff.map((t) => ({
    nurseUserId: t.nurseId,
    startDate: t.startDate,
    endDate: t.endDate,
  }));

  const fixedEntries: FixedEntry[] = fixedAssignments.map((f) => {
    const configForDay = f.clinic.defaultConfigs.find((c) => c.day === f.day);
    return {
      nurseId: f.nurseId,
      clinicId: f.clinicId,
      day: f.day as DayOfWeek,
      shiftStart: configForDay?.shiftStart,
      shiftEnd: configForDay?.shiftEnd,
      shiftHours: configForDay
        ? calcHours(configForDay.shiftStart, configForDay.shiftEnd)
        : undefined,
    };
  });

  const programEntries: ProgramEntry[] = programs.map((p) => ({
    nurseId: p.nurseId,
    programName: p.program.name,
    programType: p.program.type as ProgramEntry["programType"],
    day: p.day as DayOfWeek,
    patientCount: p.patientCount,
    shiftStart: p.shiftStart,
    shiftEnd: p.shiftEnd,
    defaultHours: p.program.defaultHours,
  }));

  const prefEntries: PreferenceEntry[] = preferences.map((p) => ({
    nurseUserId: p.nurseId,
    shiftPreference: p.shiftPreference as PreferenceEntry["shiftPreference"],
    preferredDaysOff: parseJsonArray(p.preferredDaysOff) as DayOfWeek[],
  }));

  return {
    nurses,
    clinics,
    timeOff: timeOffEntries,
    fixedAssignments: fixedEntries,
    programs: programEntries,
    preferences: prefEntries,
  };
}

// ═══════════════════════════════════════════
// Algorithm → DB Assignments
// ═══════════════════════════════════════════

export function algorithmToDbAssignments(
  assignments: AssignmentData[],
  scheduleId: string,
): Array<AssignmentData & { scheduleId: string }> {
  return assignments.map((a) => ({ ...a, scheduleId }));
}
