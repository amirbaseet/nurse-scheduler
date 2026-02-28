import type { Clinic, ClinicDefaultConfig } from "@prisma/client";

/**
 * Clinic with its default schedule configs eagerly loaded.
 * Matches: db.clinic.findMany({ include: { defaultConfigs: true } })
 */
export type ClinicWithDefaults = Clinic & {
  defaultConfigs: ClinicDefaultConfig[];
};

/**
 * Merged config returned by GET /api/clinics/config/[week].
 * For each clinic+day: uses weekly override if it exists, else falls back to default.
 */
export type MergedConfig = {
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
  isOverride: boolean;
};
