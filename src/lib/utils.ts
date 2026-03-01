import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { startOfWeek, parseISO, format, addDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical day order for DayOfWeek enum.
 * SQLite stores enums as strings, so alphabetical sort is wrong.
 */
export const DAY_ORDER = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

/**
 * Get the Sunday-based week start for a given date (UTC midnight).
 */
export function getWeekStart(date: Date = new Date()): Date {
  const sunday = startOfWeek(date, { weekStartsOn: 0 });
  return new Date(
    Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
  );
}

/**
 * Parse a "YYYY-MM-DD" week param into a UTC midnight Date.
 * Returns null if invalid.
 */
export function parseWeekParam(week: string): Date | null {
  try {
    const parsed = parseISO(week);
    if (isNaN(parsed.getTime())) return null;
    return new Date(
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
    );
  } catch {
    return null;
  }
}

/**
 * Format a Date to "YYYY-MM-DD" (for API responses).
 */
export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Format a day's date as DD.MM.YYYY, offset from a week start date.
 */
export function formatDayDate(weekStart: Date, dayIndex: number): string {
  const date = addDays(weekStart, dayIndex);
  return format(date, "dd.MM.yyyy");
}

/**
 * Determine correction type when a manager edits a schedule assignment.
 *
 * Types:
 *  - "swap"          — different nurse assigned to this slot
 *  - "change_clinic" — same nurse, different clinic
 *  - "change_shift"  — same nurse + clinic, shift times changed
 */
export function determineCorrectionType(
  old: {
    nurseId: string;
    primaryClinicId: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
  },
  input: {
    nurseId?: string;
    primaryClinicId?: string;
    shiftStart?: string;
    shiftEnd?: string;
  },
): string {
  if (input.nurseId && input.nurseId !== old.nurseId) return "swap";
  if (input.primaryClinicId && input.primaryClinicId !== old.primaryClinicId)
    return "change_clinic";
  if (
    (input.shiftStart && input.shiftStart !== old.shiftStart) ||
    (input.shiftEnd && input.shiftEnd !== old.shiftEnd)
  )
    return "change_shift";
  return "change_shift";
}
