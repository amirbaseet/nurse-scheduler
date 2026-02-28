import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load seed PINs from .env.seed (gitignored) without requiring dotenv
const envSeedPath = resolve(__dirname, "../.env.seed");
try {
  const envContent = readFileSync(envSeedPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] = val;
  }
} catch {
  throw new Error(
    "Missing .env.seed file. Copy .env.seed.example to .env.seed and set real PIN values.",
  );
}

const prisma = new PrismaClient();

// ═══════════════════════════════════════════
// NURSE MAPPING TABLE (from SEED_DATA.md)
// Every value derived from 51 weeks of historical data.
// DO NOT read gender/contractHours from nurse_profiles.json — they don't exist there.
// ═══════════════════════════════════════════

type NurseData = {
  name: string;
  contractHours: number;
  canWorkFriday: boolean;
  canWorkSaturday: boolean;
  maxDaysPerWeek: number;
  employmentType: "FULL_TIME" | "PART_TIME";
};

const NURSE_MAPPING: NurseData[] = [
  {
    name: "כתיבה בסיט",
    contractHours: 36,
    canWorkFriday: true,
    canWorkSaturday: true,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "נגלא שוויקי",
    contractHours: 28,
    canWorkFriday: true,
    canWorkSaturday: true,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "נידאל ניגם",
    contractHours: 34,
    canWorkFriday: false,
    canWorkSaturday: true,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "רבחייה בראגיתי",
    contractHours: 34,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "היא חליל",
    contractHours: 30,
    canWorkFriday: false,
    canWorkSaturday: true,
    maxDaysPerWeek: 6,
    employmentType: "FULL_TIME",
  },
  {
    name: "אינאס גאעוני",
    contractHours: 18,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 5,
    employmentType: "PART_TIME",
  },
  {
    name: "רוואא משני",
    contractHours: 14,
    canWorkFriday: false,
    canWorkSaturday: true,
    maxDaysPerWeek: 3,
    employmentType: "PART_TIME",
  },
  {
    name: "הדיל סוריך",
    contractHours: 26,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "סאנדי צאיג",
    contractHours: 10,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 3,
    employmentType: "PART_TIME",
  },
  {
    name: "נסרין עלי",
    contractHours: 8,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 2,
    employmentType: "PART_TIME",
  },
  {
    name: "נסרין משני",
    contractHours: 26,
    canWorkFriday: false,
    canWorkSaturday: true,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "עלאא אבו סנינה",
    contractHours: 40,
    canWorkFriday: false,
    canWorkSaturday: true,
    maxDaysPerWeek: 6,
    employmentType: "FULL_TIME",
  },
  {
    name: "גמילה שקיראת",
    contractHours: 24,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 4,
    employmentType: "FULL_TIME",
  },
  {
    name: "אנוואר אדעיס",
    contractHours: 26,
    canWorkFriday: false,
    canWorkSaturday: true,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
  {
    name: "רוואן אבו סרור",
    contractHours: 26,
    canWorkFriday: false,
    canWorkSaturday: false,
    maxDaysPerWeek: 5,
    employmentType: "FULL_TIME",
  },
];

// PINs loaded from .env.seed (gitignored) — never hardcode credentials
const NURSE_PINS = (process.env.NURSE_PINS ?? "").split(",");
const MANAGER_PIN = process.env.MANAGER_PIN ?? "";

if (
  NURSE_PINS.length !== NURSE_MAPPING.length ||
  NURSE_PINS.some((p) => p.length !== 4)
) {
  throw new Error(
    `NURSE_PINS must have ${NURSE_MAPPING.length} comma-separated 4-digit PINs. ` +
      "Copy .env.seed.example to .env.seed and set real values.",
  );
}
if (MANAGER_PIN.length !== 6) {
  throw new Error(
    "MANAGER_PIN must be a 6-digit PIN. " +
      "Copy .env.seed.example to .env.seed and set real values.",
  );
}

// ═══════════════════════════════════════════
// CLINIC DATA (from clinic_profiles.json + SEED_DATA.md)
// ═══════════════════════════════════════════

type ClinicData = {
  name: string;
  code: string;
  genderPref: "FEMALE_ONLY" | "ANY";
  canBeSecondary: boolean;
  secondaryHours: number | null;
  secondaryNursesNeeded: number;
  avgShiftHours: number;
  typicalDays: string[]; // "Sun", "Mon", etc.
  dayDistribution: Record<string, number>; // Hebrew day name → shift count
  weeksActive: number;
};

const DAY_HEB_TO_ENUM: Record<string, string> = {
  ראשון: "SUN",
  שני: "MON",
  שלישי: "TUE",
  רביעי: "WED",
  חמישי: "THU",
  שישי: "FRI",
  שבת: "SAT",
};

const DAY_EN_TO_ENUM: Record<string, string> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

const CLINICS: ClinicData[] = [
  {
    name: "כירורגיה",
    code: "surgery",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 7.1,
    typicalDays: ["Sun", "Mon", "Tue", "Wed"],
    dayDistribution: { ראשון: 52, שני: 63, רביעי: 88, שלישי: 13 },
    weeksActive: 51,
  },
  {
    name: "עיניים",
    code: "ophthalmology",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.3,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    dayDistribution: {
      ראשון: 104,
      רביעי: 53,
      שלישי: 83,
      שני: 63,
      חמישי: 71,
      שבת: 29,
      שישי: 1,
    },
    weeksActive: 51,
  },
  {
    name: "מקצועית",
    code: "professional",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 7.7,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Sat"],
    dayDistribution: {
      שני: 44,
      שלישי: 46,
      חמישי: 40,
      ראשון: 30,
      רביעי: 17,
      שבת: 20,
    },
    weeksActive: 51,
  },
  {
    name: "זוליר",
    code: "xolair",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 7.7,
    typicalDays: ["Wed"],
    dayDistribution: { רביעי: 51 },
    weeksActive: 50,
  },
  {
    name: "העמסת סוכר",
    code: "sugar_load",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.3,
    typicalDays: ["Sun", "Tue"],
    dayDistribution: { ראשון: 94, שלישי: 100 },
    weeksActive: 50,
  },
  {
    name: "סכרת",
    code: "diabetes",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.7,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Sat"],
    dayDistribution: {
      ראשון: 70,
      שני: 112,
      שלישי: 92,
      רביעי: 101,
      חמישי: 106,
      שבת: 45,
    },
    weeksActive: 51,
  },
  {
    name: "א.א.ג",
    code: "ent",
    genderPref: "ANY",
    canBeSecondary: true,
    secondaryHours: 2,
    secondaryNursesNeeded: 1,
    avgShiftHours: 7.0,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
    dayDistribution: { רביעי: 46, שני: 46, שלישי: 39, ראשון: 48, חמישי: 26 },
    weeksActive: 51,
  },
  {
    name: "תעסוקתית",
    code: "occupational_therapy",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 4.0,
    typicalDays: ["Sun", "Wed"],
    dayDistribution: { ראשון: 49, רביעי: 48 },
    weeksActive: 50,
  },
  {
    name: "שד",
    code: "breast",
    genderPref: "FEMALE_ONLY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.7,
    typicalDays: ["Mon", "Tue", "Thu"],
    dayDistribution: { שני: 53, שלישי: 46, חמישי: 113, ראשון: 3, רביעי: 1 },
    weeksActive: 51,
  },
  {
    name: "מנטו",
    code: "mantoux",
    genderPref: "ANY",
    canBeSecondary: true,
    secondaryHours: 2,
    secondaryNursesNeeded: 1,
    avgShiftHours: 7.2,
    typicalDays: ["Mon", "Tue", "Thu"],
    dayDistribution: { שלישי: 3, חמישי: 37, שני: 30 },
    weeksActive: 46,
  },
  {
    name: "אי ספיקת לב",
    code: "heart_failure",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.1,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
    dayDistribution: { שלישי: 26, רביעי: 90, ראשון: 10, חמישי: 41, שני: 24 },
    weeksActive: 50,
  },
  {
    name: "א.ק.ג",
    code: "ecg",
    genderPref: "ANY",
    canBeSecondary: true,
    secondaryHours: 1,
    secondaryNursesNeeded: 1,
    avgShiftHours: 6.2,
    typicalDays: ["Mon", "Tue", "Wed", "Thu"],
    dayDistribution: { רביעי: 8, שני: 20, חמישי: 43, שלישי: 46 },
    weeksActive: 47,
  },
  {
    name: "אורטופידיה",
    code: "orthopedics",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 7.3,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    dayDistribution: {
      רביעי: 84,
      ראשון: 49,
      שבת: 43,
      שני: 87,
      שישי: 22,
      חמישי: 60,
      שלישי: 34,
    },
    weeksActive: 51,
  },
  {
    name: "אורטופיד ילדים",
    code: "pediatric_orthopedics",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 5.7,
    typicalDays: ["Tue"],
    dayDistribution: { שלישי: 34 },
    weeksActive: 34,
  },
  {
    name: "פלאסטיקה",
    code: "plastic_surgery",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.9,
    typicalDays: ["Mon", "Tue"],
    dayDistribution: { שני: 34, שלישי: 1 },
    weeksActive: 34,
  },
  {
    name: "עיניים ילדים",
    code: "pediatric_ophthalmology",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.8,
    typicalDays: ["Sun", "Wed"],
    dayDistribution: { רביעי: 25, ראשון: 46 },
    weeksActive: 38,
  },
  {
    name: "שטראוס",
    code: "strauss",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.4,
    typicalDays: ["Mon"],
    dayDistribution: { שני: 5 },
    weeksActive: 3,
  },
  {
    name: "Avastin",
    code: "avastin",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 8.6,
    typicalDays: ["Wed", "Sat"],
    dayDistribution: { רביעי: 21, שבת: 10 },
    weeksActive: 14,
  },
  {
    name: "סקלרותרפיה",
    code: "sclerotherapy",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 4.6,
    typicalDays: ["Sat"],
    dayDistribution: { שבת: 10 },
    weeksActive: 6,
  },
  {
    name: "מ.ש",
    code: "urinary_catheter",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.5,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
    dayDistribution: { שני: 23, שלישי: 24, רביעי: 2, ראשון: 9, חמישי: 4 },
    weeksActive: 21,
  },
  {
    name: "חיסון",
    code: "vaccination",
    genderPref: "ANY",
    canBeSecondary: true,
    secondaryHours: 1,
    secondaryNursesNeeded: 1,
    avgShiftHours: 6.3,
    typicalDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
    dayDistribution: { שני: 11, שלישי: 9, רביעי: 10, ראשון: 11, חמישי: 9 },
    weeksActive: 11,
  },
  {
    name: "Type 1 Diabetes",
    code: "type1_diabetes",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 8.0,
    typicalDays: ["Sun", "Mon", "Wed"],
    dayDistribution: { ראשון: 4, שני: 1, רביעי: 1 },
    weeksActive: 6,
  },
  {
    name: "כף יד",
    code: "hand_clinic",
    genderPref: "ANY",
    canBeSecondary: false,
    secondaryHours: null,
    secondaryNursesNeeded: 0,
    avgShiftHours: 6.4,
    typicalDays: ["Mon"],
    dayDistribution: { שני: 5 },
    weeksActive: 5,
  },
];

// ═══════════════════════════════════════════
// FIXED ASSIGNMENTS (5 specialist nurses — >80% historical)
// All use sentinel date 1970-01-01 = permanent
// ═══════════════════════════════════════════

type FixedData = {
  nurseName: string;
  clinicCode: string;
  days: string[]; // DayOfWeek enum values
};

const FIXED_ASSIGNMENTS: FixedData[] = [
  // נסרין עלי → עיניים (100%) — works Sun, Mon, Tue
  {
    nurseName: "נסרין עלי",
    clinicCode: "ophthalmology",
    days: ["SUN", "MON", "TUE"],
  },
  // נסרין משני → עיניים (99%) — works Sun-Thu + Sat
  {
    nurseName: "נסרין משני",
    clinicCode: "ophthalmology",
    days: ["SUN", "MON", "TUE", "WED", "THU", "SAT"],
  },
  // רבחייה בראגיתי → סכרת (96%) — works Sun-Thu
  {
    nurseName: "רבחייה בראגיתי",
    clinicCode: "diabetes",
    days: ["SUN", "MON", "TUE", "WED", "THU"],
  },
  // היא חליל → סכרת (91%) — works Sun-Thu + Sat
  {
    nurseName: "היא חליל",
    clinicCode: "diabetes",
    days: ["SUN", "MON", "TUE", "WED", "THU", "SAT"],
  },
  // עלאא אבו סנינה → אורטופידיה (82%) — works Sun-Thu + Sat
  {
    nurseName: "עלאא אבו סנינה",
    clinicCode: "orthopedics",
    days: ["SUN", "MON", "TUE", "WED", "THU", "SAT"],
  },
];

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function computeShiftEnd(avgHours: number): string {
  const hours = avgHours <= 0 ? 4 : avgHours;
  const halfHours = Math.round(hours * 2);
  const totalMinutes = halfHours * 30;
  const endHour = 8 + Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
}

function computeNursesNeeded(dayShifts: number, weeksActive: number): number {
  return Math.max(1, Math.round(dayShifts / weeksActive));
}

const SENTINEL_DATE = new Date("1970-01-01T00:00:00.000Z");

// ═══════════════════════════════════════════
// MAIN SEED
// ═══════════════════════════════════════════

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── 1. Manager ──────────────────────────
  console.log("── Creating manager ──");
  const managerPinHash = await bcrypt.hash(MANAGER_PIN, 10);
  const manager = await prisma.user.create({
    data: {
      name: "מנהלת",
      role: "MANAGER",
      pinHash: managerPinHash,
      pinPrefix: MANAGER_PIN.substring(0, 2),
      isActive: true,
    },
  });
  await prisma.nurseProfile.create({
    data: {
      userId: manager.id,
      gender: "FEMALE",
      contractHours: 40,
      shiftPreference: "ANYTIME",
      canWorkFriday: false,
      canWorkSaturday: false,
      maxDaysPerWeek: 5,
      employmentType: "FULL_TIME",
      isManager: true,
      managementHours: 12,
    },
  });
  console.log("  מנהלת (Manager): created");

  // ── 2. Nurses ───────────────────────────
  console.log("\n── Creating 15 nurses ──");
  const nurseMap: Record<string, string> = {}; // name → nurseProfile.id

  for (let i = 0; i < NURSE_MAPPING.length; i++) {
    const nurse = NURSE_MAPPING[i];
    const pin = NURSE_PINS[i];
    const pinHash = await bcrypt.hash(pin, 10);
    const user = await prisma.user.create({
      data: {
        name: nurse.name,
        role: "NURSE",
        pinHash,
        pinPrefix: pin.substring(0, 2),
        isActive: true,
      },
    });
    const profile = await prisma.nurseProfile.create({
      data: {
        userId: user.id,
        gender: "FEMALE",
        contractHours: nurse.contractHours,
        shiftPreference: "ANYTIME",
        canWorkFriday: nurse.canWorkFriday,
        canWorkSaturday: nurse.canWorkSaturday,
        maxDaysPerWeek: nurse.maxDaysPerWeek,
        employmentType: nurse.employmentType,
        isManager: false,
      },
    });
    nurseMap[nurse.name] = profile.id;
    console.log(
      `  ${nurse.name}: created (${nurse.contractHours}h/${nurse.employmentType})`,
    );
  }

  // ── 3. Clinics ──────────────────────────
  console.log("\n── Creating 23 clinics ──");
  const clinicMap: Record<string, string> = {}; // code → clinic.id

  for (const clinic of CLINICS) {
    const created = await prisma.clinic.create({
      data: {
        name: clinic.name,
        code: clinic.code,
        genderPref: clinic.genderPref,
        canBeSecondary: clinic.canBeSecondary,
        secondaryHours: clinic.secondaryHours,
        secondaryNursesNeeded: clinic.secondaryNursesNeeded,
        isActive: true,
      },
    });
    clinicMap[clinic.code] = created.id;
    const secondary = clinic.canBeSecondary
      ? ` [secondary: ${clinic.secondaryHours}h]`
      : "";
    const gender = clinic.genderPref !== "ANY" ? ` [${clinic.genderPref}]` : "";
    console.log(`  ${clinic.name} (${clinic.code})${gender}${secondary}`);
  }

  // ── 4. Clinic Default Configs ───────────
  console.log("\n── Creating clinic default configs ──");
  let configCount = 0;

  for (const clinic of CLINICS) {
    const clinicId = clinicMap[clinic.code];
    const shiftEnd = computeShiftEnd(clinic.avgShiftHours);

    for (const dayEn of clinic.typicalDays) {
      const dayEnum = DAY_EN_TO_ENUM[dayEn];
      // Find the corresponding Hebrew day name for shift count
      const hebDay = Object.entries(DAY_HEB_TO_ENUM).find(
        ([_, v]) => v === dayEnum,
      )?.[0];
      const dayShifts = hebDay ? (clinic.dayDistribution[hebDay] ?? 0) : 0;
      const nursesNeeded =
        dayShifts > 0 ? computeNursesNeeded(dayShifts, clinic.weeksActive) : 1;

      await prisma.clinicDefaultConfig.create({
        data: {
          clinicId,
          day: dayEnum as any,
          shiftStart: "08:00",
          shiftEnd,
          nursesNeeded,
          isActive: true,
        },
      });
      configCount++;
    }
  }
  console.log(`  Created ${configCount} default config entries`);

  // ── 5. Fixed Assignments ────────────────
  console.log("\n── Creating fixed assignments (5 specialists) ──");
  let fixedCount = 0;

  for (const fixed of FIXED_ASSIGNMENTS) {
    const nurseId = nurseMap[fixed.nurseName];
    const clinicId = clinicMap[fixed.clinicCode];

    for (const day of fixed.days) {
      await prisma.fixedAssignment.create({
        data: {
          nurseId,
          clinicId,
          day: day as any,
          weekStart: SENTINEL_DATE,
        },
      });
      fixedCount++;
    }
    console.log(
      `  ${fixed.nurseName} → ${fixed.clinicCode} (${fixed.days.length} days)`,
    );
  }
  console.log(`  Total: ${fixedCount} fixed assignment entries`);

  // ── 6. Patient Programs ─────────────────
  console.log("\n── Creating 4 patient programs ──");

  await prisma.patientProgram.create({
    data: { name: "מערך שד", type: "PURE_PROGRAM", defaultHours: 7 },
  });
  console.log("  מערך שד (PURE_PROGRAM, 7h)");

  await prisma.patientProgram.create({
    data: { name: "סכרת", type: "CLINIC_ADDON", linkedClinicCode: "diabetes" },
  });
  console.log("  סכרת (CLINIC_ADDON → diabetes)");

  await prisma.patientProgram.create({
    data: {
      name: "אי ספיקת לב",
      type: "CLINIC_ADDON",
      linkedClinicCode: "heart_failure",
    },
  });
  console.log("  אי ספיקת לב (CLINIC_ADDON → heart_failure)");

  await prisma.patientProgram.create({
    data: {
      name: "העמסת סוכר",
      type: "CLINIC_ADDON",
      linkedClinicCode: "sugar_load",
    },
  });
  console.log("  העמסת סוכר (CLINIC_ADDON → sugar_load)");

  // ── 7. Sample Test Data ─────────────────
  console.log("\n── Creating sample test data ──");

  // Find first two nurse user IDs for test data
  const firstNurseUser = await prisma.user.findFirst({
    where: { name: NURSE_MAPPING[0].name },
  });
  const secondNurseUser = await prisma.user.findFirst({
    where: { name: NURSE_MAPPING[1].name },
  });

  if (firstNurseUser && secondNurseUser) {
    // Next week's Sunday
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);

    const nextMon = new Date(nextSunday);
    nextMon.setDate(nextSunday.getDate() + 1);
    const nextWed = new Date(nextSunday);
    nextWed.setDate(nextSunday.getDate() + 3);
    const nextThu = new Date(nextSunday);
    nextThu.setDate(nextSunday.getDate() + 4);
    const nextFri = new Date(nextSunday);
    nextFri.setDate(nextSunday.getDate() + 5);

    // TimeOffRequest 1: first nurse, VACATION, Mon-Wed, PENDING
    await prisma.timeOffRequest.create({
      data: {
        nurseId: firstNurseUser.id,
        type: "VACATION",
        startDate: nextMon,
        endDate: nextWed,
        reason: "חופשה משפחתית",
        status: "PENDING",
      },
    });
    console.log(
      `  TimeOffRequest: ${NURSE_MAPPING[0].name} — VACATION Mon-Wed (PENDING)`,
    );

    // TimeOffRequest 2: second nurse, OFF_DAY, Thu, APPROVED
    await prisma.timeOffRequest.create({
      data: {
        nurseId: secondNurseUser.id,
        type: "OFF_DAY",
        startDate: nextThu,
        endDate: nextThu,
        status: "APPROVED",
      },
    });
    console.log(
      `  TimeOffRequest: ${NURSE_MAPPING[1].name} — OFF_DAY Thu (APPROVED)`,
    );

    // Announcement 1
    await prisma.announcement.create({
      data: {
        authorId: manager.id,
        title: "ברוכים הבאים ל-NurseScheduler",
        body: "מערכת השיבוץ החדשה זמינה כעת. אנא בדקו את הלוח שלכם.",
        priority: "NORMAL",
        targetAll: true,
      },
    });
    console.log("  Announcement: Welcome to NurseScheduler");

    // Task 1: assigned to first nurse
    await prisma.task.create({
      data: {
        assignedToId: firstNurseUser.id,
        createdById: manager.id,
        title: "השלמת הדרכה",
        description: "יש להשלים את ההדרכה על המערכת החדשה",
        dueDate: nextFri,
        priority: "NORMAL",
        isForAll: false,
      },
    });
    console.log(`  Task: ${NURSE_MAPPING[0].name} — "השלמת הדרכה"`);

    // Task 2: for all nurses
    await prisma.task.create({
      data: {
        createdById: manager.id,
        title: "בדיקת עגלת חירום",
        description: "לוודא שעגלת החירום מלאה ומעודכנת",
        dueDate: nextFri,
        priority: "NORMAL",
        isForAll: true,
      },
    });
    console.log('  Task: All nurses — "בדיקת עגלת חירום"');
  }

  // ── Summary ─────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    nurseProfiles: await prisma.nurseProfile.count(),
    clinics: await prisma.clinic.count(),
    defaultConfigs: await prisma.clinicDefaultConfig.count(),
    fixedAssignments: await prisma.fixedAssignment.count(),
    programs: await prisma.patientProgram.count(),
    timeOffRequests: await prisma.timeOffRequest.count(),
    announcements: await prisma.announcement.count(),
    tasks: await prisma.task.count(),
  };

  console.log("\n═══════════════════════════════════════════");
  console.log("SEED COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log(
    `  Users:             ${counts.users} (1 manager + ${counts.users - 1} nurses)`,
  );
  console.log(`  Nurse Profiles:    ${counts.nurseProfiles}`);
  console.log(`  Clinics:           ${counts.clinics}`);
  console.log(`  Default Configs:   ${counts.defaultConfigs}`);
  console.log(`  Fixed Assignments: ${counts.fixedAssignments}`);
  console.log(`  Patient Programs:  ${counts.programs}`);
  console.log(`  Time-Off Requests: ${counts.timeOffRequests}`);
  console.log(`  Announcements:     ${counts.announcements}`);
  console.log(`  Tasks:             ${counts.tasks}`);
  console.log("═══════════════════════════════════════════\n");

  console.log(
    "Seed complete. PINs are in .env.seed (not printed for security).",
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
