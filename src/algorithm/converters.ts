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
  recurringOffDays: DayOfWeek[];
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
    code: string;
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
    code: string;
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
  preferredDaysOff: DayOfWeek[];
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
// Monthly date types
// ═══════════════════════════════════════════

export type MonthlyDateRow = {
  clinicId: string;
  date: Date;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
  clinic: {
    code: string;
    genderPref: string;
    canBeSecondary: boolean;
    secondaryHours: number | null;
    secondaryNursesNeeded: number;
  };
};

// Day index → DayOfWeek (JS Date.getUTCDay(): 0=SUN, 1=MON, ...)
const DAY_INDEX_TO_DAY: DayOfWeek[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

// ═══════════════════════════════════════════
// Merge: MonthlyDates > WeeklyConfig > DefaultConfig
// ═══════════════════════════════════════════

export function mergeClinicConfigs(
  defaults: ClinicDefaultConfigRow[],
  overrides: ClinicWeeklyConfigRow[],
  monthlyDates?: MonthlyDateRow[],
  weekStart?: Date,
): ClinicSlot[] {
  const result: ClinicSlot[] = [];
  const overrideMap = new Map<string, ClinicWeeklyConfigRow>();

  for (const o of overrides) {
    overrideMap.set(`${o.clinicId}-${o.day}`, o);
  }

  // Build monthly date map: "clinicId-DAY" → MonthlyDateRow
  // Only if we have monthly dates for this week
  const monthlyMap = new Map<string, MonthlyDateRow>();
  const clinicsWithMonthly = new Set<string>();

  if (monthlyDates && weekStart) {
    for (const md of monthlyDates) {
      const dayOfWeek = DAY_INDEX_TO_DAY[md.date.getUTCDay()];
      monthlyMap.set(`${md.clinicId}-${dayOfWeek}`, md);
      clinicsWithMonthly.add(md.clinicId);
    }
  }

  for (const d of defaults) {
    const key = `${d.clinicId}-${d.day}`;

    // If this clinic has monthly dates defined, check if this day has one
    if (clinicsWithMonthly.has(d.clinicId)) {
      const monthly = monthlyMap.get(key);
      if (monthly) {
        // Monthly date exists — use it (highest priority)
        if (monthly.isActive) {
          result.push({
            clinicId: monthly.clinicId,
            clinicCode: monthly.clinic.code,
            day: d.day as DayOfWeek,
            shiftStart: monthly.shiftStart,
            shiftEnd: monthly.shiftEnd,
            nursesNeeded: monthly.nursesNeeded,
            shiftHours: calcHours(monthly.shiftStart, monthly.shiftEnd),
            genderPref: monthly.clinic.genderPref as ClinicSlot["genderPref"],
            canBeSecondary: monthly.clinic.canBeSecondary,
            secondaryHours: monthly.clinic.secondaryHours ?? undefined,
            secondaryNursesNeeded: monthly.clinic.secondaryNursesNeeded,
          });
        }
        // If monthly exists but !isActive → skip (clinic not active this day)
        monthlyMap.delete(key);
        overrideMap.delete(key);
        continue;
      }
      // Clinic has monthly dates but NOT for this day → skip
      overrideMap.delete(key);
      continue;
    }

    // No monthly dates for this clinic — fall back to weekly/default merge
    const effective = overrideMap.get(key) ?? d;

    if (effective.isActive) {
      result.push({
        clinicId: effective.clinicId,
        clinicCode: effective.clinic.code,
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
    // Skip if this clinic uses monthly dates and has no entry for this day
    if (clinicsWithMonthly.has(o.clinicId)) continue;

    if (o.isActive) {
      result.push({
        clinicId: o.clinicId,
        clinicCode: o.clinic.code,
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

  // Any monthly dates for clinics NOT in defaults (clinic with no default schedule)
  for (const [, md] of Array.from(monthlyMap)) {
    if (md.isActive) {
      const dayOfWeek = DAY_INDEX_TO_DAY[md.date.getUTCDay()];
      result.push({
        clinicId: md.clinicId,
        clinicCode: md.clinic.code,
        day: dayOfWeek,
        shiftStart: md.shiftStart,
        shiftEnd: md.shiftEnd,
        nursesNeeded: md.nursesNeeded,
        shiftHours: calcHours(md.shiftStart, md.shiftEnd),
        genderPref: md.clinic.genderPref as ClinicSlot["genderPref"],
        canBeSecondary: md.clinic.canBeSecondary,
        secondaryHours: md.clinic.secondaryHours ?? undefined,
        secondaryNursesNeeded: md.clinic.secondaryNursesNeeded,
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
  monthlyDates?: MonthlyDateRow[],
  weekStart?: Date,
): AlgorithmConfig {
  const clinics = mergeClinicConfigs(
    clinicDefaults,
    clinicOverrides,
    monthlyDates,
    weekStart,
  );

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
    recurringOffDays: np.recurringOffDays,
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
    preferredDaysOff: p.preferredDaysOff,
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
