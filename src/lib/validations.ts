import { z } from "zod";

// ═══════════════════════════════════════════
// Shared enums (match Prisma schema exactly)
// ═══════════════════════════════════════════

const DayOfWeekEnum = z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);
const ShiftPrefEnum = z.enum(["MORNING", "AFTERNOON", "ANYTIME"]);
const EmploymentEnum = z.enum(["FULL_TIME", "PART_TIME", "TEMPORARY"]);
const GenderPrefEnum = z.enum(["FEMALE_ONLY", "FEMALE_PREFERRED", "ANY"]);
const ProgramTypeEnum = z.enum(["PURE_PROGRAM", "CLINIC_ADDON"]);
const RequestTypeEnum = z.enum(["VACATION", "SICK", "PERSONAL", "OFF_DAY"]);
const PriorityEnum = z.enum(["LOW", "NORMAL", "URGENT"]);
const GenderEnum = z.enum(["MALE", "FEMALE"]);
const RoleEnum = z.enum(["MANAGER", "NURSE"]);

// ═══════════════════════════════════════════
// Schedule
// ═══════════════════════════════════════════

export const AlgorithmVersionEnum = z.enum([
  "v1-clinic-first",
  "v2-nurse-first",
]);

export const ShiftBuilderEnum = z.enum(["off", "on"]);

export const generateScheduleSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  algorithmVersion: AlgorithmVersionEnum.optional(),
  shiftBuilder: ShiftBuilderEnum.optional(),
});

export const assignScheduleSchema = z.object({
  assignmentId: z.string().min(1),
  nurseId: z.string().optional(),
  primaryClinicId: z.string().optional(),
  secondaryClinicId: z.string().nullable().optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════
// Nurses
// ═══════════════════════════════════════════

export const updateNurseSchema = z.object({
  contractHours: z
    .number()
    .positive("שעות חוזה חייבות להיות חיוביות")
    .optional(),
  shiftPreference: ShiftPrefEnum.optional(),
  canWorkFriday: z.boolean().optional(),
  canWorkSaturday: z.boolean().optional(),
  maxDaysPerWeek: z.number().int().min(1).max(7).optional(),
  employmentType: EmploymentEnum.optional(),
  recurringOffDays: z.array(DayOfWeekEnum).optional(),
});

export const updateBlockedClinicsSchema = z.object({
  clinicIds: z.array(z.string().min(1)),
});

// Reusable validated time string (HH:MM, 00:00–23:59)
const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "שעה בפורמט HH:MM")
  .refine((val) => {
    const [h, m] = val.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "שעה לא תקינה (00:00–23:59)");

// Reusable validated date that checks calendar rollover
const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD")
  .refine((val) => {
    const d = new Date(val + "T00:00:00.000Z");
    if (isNaN(d.getTime())) return false;
    const [y, m, day] = val.split("-").map(Number);
    return (
      d.getUTCFullYear() === y &&
      d.getUTCMonth() + 1 === m &&
      d.getUTCDate() === day
    );
  }, "תאריך לא תקין");

export const createFixedAssignmentSchema = z.object({
  clinicId: z.string().min(1, "יש לבחור מרפאה"),
  day: DayOfWeekEnum,
  weekStart: validDate
    .refine((val) => {
      const d = new Date(val + "T00:00:00.000Z");
      return d.getUTCDay() === 0; // Must be Sunday
    }, "weekStart חייב להיות יום ראשון")
    .optional(),
});

// ═══════════════════════════════════════════
// Monthly Dates
// ═══════════════════════════════════════════

const monthlyDateItemSchema = z
  .object({
    date: validDate,
    shiftStart: timeString,
    shiftEnd: timeString,
    nursesNeeded: z.number().int().min(0).max(15).default(1),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.shiftEnd > d.shiftStart, {
    message: "שעת סיום חייבת להיות אחרי שעת התחלה",
    path: ["shiftEnd"],
  });

export const upsertMonthlyDatesSchema = z.object({
  dates: z
    .array(monthlyDateItemSchema)
    .min(1, "יש לשלוח לפחות תאריך אחד")
    .max(62, "לא ניתן לשלוח יותר מ-62 תאריכים בבקשה אחת"),
  deleteIds: z.array(z.string().cuid()).max(62).optional(),
});

// ═══════════════════════════════════════════
// Clinics
// ═══════════════════════════════════════════

export const updateClinicSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nameAr: z.string().max(255).optional(),
  genderPref: GenderPrefEnum.optional(),
  canBeSecondary: z.boolean().optional(),
  secondaryHours: z.number().optional(),
  secondaryNursesNeeded: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const createClinicSchema = z.object({
  name: z.string().min(1).max(255),
  nameAr: z.string().max(255).optional(),
  code: z.string().min(1).max(50),
  genderPref: GenderPrefEnum.optional(),
  canBeSecondary: z.boolean().optional(),
  secondaryHours: z.number().optional(),
  secondaryNursesNeeded: z.number().int().min(0).optional(),
});

const clinicConfigItemSchema = z.object({
  clinicId: z.string().min(1),
  day: DayOfWeekEnum,
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/, "שעה בפורמט HH:MM"),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/, "שעה בפורמט HH:MM"),
  nursesNeeded: z.number().int().min(0),
  isActive: z.boolean(),
});

export const updateClinicConfigSchema = z.object({
  configs: z.array(clinicConfigItemSchema).min(1, "יש לשלוח לפחות תצורה אחת"),
});

export const copyClinicConfigSchema = z.object({
  fromWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  toWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
});

// ═══════════════════════════════════════════
// Programs
// ═══════════════════════════════════════════

export const updateProgramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: ProgramTypeEnum.optional(),
  linkedClinicCode: z.string().nullable().optional(),
  defaultHours: z.number().positive().nullable().optional(),
});

export const assignProgramSchema = z.object({
  programId: z.string().min(1),
  nurseId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  day: DayOfWeekEnum,
  patientCount: z.number().int().min(0).optional(),
  shiftStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  shiftEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

// ═══════════════════════════════════════════
// Requests
// ═══════════════════════════════════════════

export const createRequestSchema = z.object({
  type: RequestTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  reason: z.string().max(1000).optional(),
});

export const respondRequestSchema = z.object({
  managerNote: z.string().max(1000).optional(),
});

export const recordAbsenceSchema = z.object({
  nurseId: z.string().min(1),
  type: RequestTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  reason: z.string().max(1000).optional(),
  managerNote: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════
// Preferences
// ═══════════════════════════════════════════

export const submitPreferenceSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD"),
  shiftPreference: ShiftPrefEnum.optional(),
  preferredDaysOff: z.array(DayOfWeekEnum).optional(),
  notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════
// Tasks
// ═══════════════════════════════════════════

export const createTaskSchema = z.object({
  title: z.string().min(1, "כותרת נדרשת").max(255),
  description: z.string().max(5000).optional(),
  assignedToId: z.string().optional(),
  isForAll: z.boolean(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  priority: PriorityEnum,
});

// ═══════════════════════════════════════════
// Announcements
// ═══════════════════════════════════════════

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "כותרת נדרשת").max(255),
  body: z.string().min(1, "תוכן נדרש").max(5000),
  priority: PriorityEnum,
  targetAll: z.boolean(),
  targetNurseIds: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

// ═══════════════════════════════════════════
// Users
// ═══════════════════════════════════════════

export const createUserSchema = z.object({
  name: z.string().min(1, "שם נדרש").max(255),
  nameAr: z.string().max(255).optional(),
  role: RoleEnum,
  pin: z.string().regex(/^(\d{4}|\d{6})$/, "PIN חייב להיות 4 או 6 ספרות"),
  gender: GenderEnum,
  contractHours: z.number().positive("שעות חוזה חייבות להיות חיוביות"),
  phone: z.string().optional(),
});

export const changePinSchema = z.object({
  newPin: z.string().regex(/^(\d{4}|\d{6})$/, "PIN חייב להיות 4 או 6 ספרות"),
});
