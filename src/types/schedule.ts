/**
 * Schedule types for the Generate Wizard UI.
 * These mirror the algorithm output types but use plain strings
 * (serialized from API responses) instead of Prisma enums.
 */

// ── Warning (matches algorithm Warning, but day is plain string over JSON) ──

export type ScheduleWarning = {
  level: "error" | "warning" | "info";
  message: string;
  nurseId?: string;
  clinicId?: string;
  clinicName?: string;
  day?: string;
};

// ── Gap — unfilled slot for manager self-assign ──

export type ScheduleGap = {
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  hours: number;
};

// ── Response from POST /api/schedule/generate ──

export type GenerateResponse = {
  schedule: {
    id: string;
    weekStart: string;
    status: string;
    qualityScore: number | null;
  };
  warnings: ScheduleWarning[];
  qualityScore: number;
  managerGaps: ScheduleGap[];
};

// ── Assignment within a full schedule ──

export type ScheduleAssignment = {
  id: string;
  nurseId: string;
  day: string;
  primaryClinicId: string | null;
  primaryClinic: { id: string; name: string } | null;
  secondaryClinicId: string | null;
  secondaryClinic: { id: string; name: string } | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  hours: number;
  isOff: boolean;
  isFixed: boolean;
  isManagerSelf: boolean;
  notes?: string | null;
  nurse: {
    id: string;
    user: { id: string; name: string };
  };
};

// ── Full schedule from GET /api/schedule/week/[week] ──

export type ScheduleWithAssignments = {
  id: string;
  weekStart: string;
  status: string;
  qualityScore: number | null;
  assignments: ScheduleAssignment[];
};
