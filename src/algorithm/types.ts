// ═══════════════════════════════════════════
// Algorithm Types — All interfaces for the
// 9-layer scheduling engine
// ═══════════════════════════════════════════

import type { DayOfWeek, GenderPref, Gender, ShiftPref } from "@prisma/client";

export type { DayOfWeek, GenderPref, Gender, ShiftPref };

// ── Cell (one nurse × one day) ──

export type CellStatus = "AVAILABLE" | "BLOCKED" | "ASSIGNED" | "OFF";

export type BlockReason =
  | "time_off"
  | "no_friday"
  | "no_saturday"
  | "max_days"
  | "recurring_off"
  | "preferred_off"
  | "historical_off";

export interface Cell {
  status: CellStatus;
  blockReason?: BlockReason;
  primaryClinicId?: string;
  secondaryClinicId?: string;
  shiftStart?: string;
  shiftEnd?: string;
  hours: number;
  patientCallProgram?: string;
  patientCallCount?: number;
  isFixed: boolean;
  isManagerSelf: boolean;
}

// Grid: nurseProfileId → day → cell
export type Grid = Map<string, Map<DayOfWeek, Cell>>;

// ── Clinic Slot (one clinic × one day after config merge) ──

export interface ClinicSlot {
  clinicId: string;
  clinicCode?: string;
  day: DayOfWeek;
  shiftStart: string;
  shiftEnd: string;
  shiftHours: number;
  nursesNeeded: number;
  genderPref?: GenderPref;
  canBeSecondary?: boolean;
  secondaryHours?: number;
  secondaryNursesNeeded?: number;
  candidateCount?: number;
}

// ── Nurse (algorithm-friendly) ──

export interface AlgoNurse {
  id: string; // NurseProfile.id
  userId: string; // User.id
  name: string;
  gender: Gender;
  contractHours: number;
  shiftPreference: ShiftPref;
  canWorkFriday: boolean;
  canWorkSaturday: boolean;
  maxDaysPerWeek: number;
  isManager: boolean;
  managementHours: number | null;
  recurringOffDays: DayOfWeek[];
  blockedClinicIds: string[];
}

// ── Algorithm Config (all inputs for one week) ──

export interface AlgorithmConfig {
  nurses: AlgoNurse[];
  clinics: ClinicSlot[];
  timeOff: TimeOffEntry[];
  fixedAssignments: FixedEntry[];
  programs: ProgramEntry[];
  preferences: PreferenceEntry[];
  /** Correction-based probability adjustments (from learning engine). */
  adjustments?: Map<string, number>;
}

export interface TimeOffEntry {
  nurseUserId: string;
  startDate: Date;
  endDate: Date;
}

export interface FixedEntry {
  nurseId: string; // NurseProfile.id
  clinicId: string;
  day: DayOfWeek;
  shiftStart?: string;
  shiftEnd?: string;
  shiftHours?: number;
}

export interface ProgramEntry {
  nurseId: string; // NurseProfile.id
  programName: string;
  programType: "PURE_PROGRAM" | "CLINIC_ADDON";
  day: DayOfWeek;
  patientCount?: number | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  defaultHours?: number | null;
}

export interface PreferenceEntry {
  nurseUserId: string;
  shiftPreference?: ShiftPref | null;
  preferredDaysOff: DayOfWeek[];
}

// ── Output types ──

export interface Warning {
  level: "error" | "warning" | "info";
  message: string;
  nurseId?: string;
  clinicId?: string;
  day?: DayOfWeek;
}

export interface Gap {
  clinicId: string;
  clinicName: string;
  day: DayOfWeek;
  shiftStart: string;
  shiftEnd: string;
  hours: number;
}

export interface AssignmentData {
  nurseId: string;
  day: DayOfWeek;
  primaryClinicId: string | null;
  secondaryClinicId: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  hours: number;
  patientCallProgram: string | null;
  patientCallCount: number | null;
  isOff: boolean;
  isFixed: boolean;
  isManagerSelf: boolean;
}

export interface ScheduleResult {
  assignments: AssignmentData[];
  warnings: Warning[];
  qualityScore: number;
  managerGaps: Gap[];
}

// ── Budget map ──

export type Budgets = Map<string, number>;
