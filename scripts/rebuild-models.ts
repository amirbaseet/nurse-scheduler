/**
 * Rebuild learning models (probability-matrix, off-day-patterns, etc.)
 * using the CURRENT database IDs.
 *
 * Parses weekly_schedules.json (51 weeks of nurse×day→clinic data),
 * maps Hebrew names → current DB IDs, and writes fresh model files.
 *
 * Run with: npx tsx scripts/rebuild-models.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();
const ANALYSIS_DIR = join(process.cwd(), "archived", "analysis_output");
const MODELS_DIR = join(process.cwd(), "data", "models");

// Hebrew clinic name (from Excel) → DB clinic code
const CLINIC_RAW_TO_CODE: Record<string, string> = {
  כירורגיה: "surgery",
  עיניים: "ophthalmology",
  מקצועית: "professional",
  זוליר: "xolair",
  "העמסת סוכר": "sugar_load",
  "העמסת סכרת": "sugar_load",
  סכרת: "diabetes",
  "א.א.ג": "ent",
  תעסוקתית: "occupational_therapy",
  שד: "breast",
  "מערך שד": "breast",
  מנטו: "mantoux",
  "אי ספיקת לב": "heart_failure",
  "א.ק.ג": "ecg",
  אורטופידיה: "orthopedics",
  אורטופד: "orthopedics",
  "אורטופיד ילדים": "pediatric_orthopedics",
  "אורטופד ילדים": "pediatric_orthopedics",
  "עיניים ילדיים": "pediatric_ophthalmology",
  "עיניים ילדים": "pediatric_ophthalmology",
  פלאסטיקה: "plastic_surgery",
  סקלרותרפיה: "sclerotherapy",
  חיסון: "vaccination",
  "כף רגל": "hand_clinic",
  "כף יד": "hand_clinic",
  שטראוס: "strauss",
  Avastin: "avastin",
  אווסטין: "avastin",
  "Type 1 Diabetes": "type1_diabetes",
  "מ.ש": "urinary_catheter",
  פרקטלוג: "plastic_surgery",
};

const DAYS_MAP: Record<string, string> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

type WeekNurse = {
  name: string;
  days: Record<
    string,
    { clinic_raw: string; hours: string; is_off: boolean } | null
  >;
};

type WeekData = {
  nurses: WeekNurse[];
};

/**
 * Parse a clinic_raw string like "כירורגיה+ עיניים ילדיים" or "מקצועית"
 * Returns { primary: clinicCode, secondary?: clinicCode }
 */
function parseClinicRaw(raw: string): {
  primary: string | null;
  secondary: string | null;
} {
  if (!raw || raw.trim() === "") return { primary: null, secondary: null };

  // Split on + or ,
  const parts = raw
    .split(/[+,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const resolve = (name: string): string | null => {
    // Try direct match first
    if (CLINIC_RAW_TO_CODE[name]) return CLINIC_RAW_TO_CODE[name];
    // Try partial match
    for (const [key, code] of Object.entries(CLINIC_RAW_TO_CODE)) {
      if (name.includes(key) || key.includes(name)) return code;
    }
    return null;
  };

  return {
    primary: parts[0] ? resolve(parts[0]) : null,
    secondary: parts[1] ? resolve(parts[1]) : null,
  };
}

async function main() {
  // Load current DB entities
  const [dbClinics, dbNurses] = await Promise.all([
    db.clinic.findMany({ select: { id: true, code: true, name: true } }),
    db.nurseProfile.findMany({
      where: { user: { isActive: true } },
      select: { id: true, user: { select: { name: true } } },
    }),
  ]);

  const clinicCodeToId = new Map(dbClinics.map((c) => [c.code, c.id]));
  const nurseNameToId = new Map(dbNurses.map((n) => [n.user.name, n.id]));

  console.log(`DB: ${dbClinics.length} clinics, ${dbNurses.length} nurses`);

  // Load weekly schedules
  const weeklySchedules: Record<string, WeekData> = JSON.parse(
    readFileSync(join(ANALYSIS_DIR, "weekly_schedules.json"), "utf-8"),
  );

  const totalWeeks = Object.keys(weeklySchedules).length;
  console.log(`Weekly schedules: ${totalWeeks} weeks`);

  // Count nurse×clinic×day occurrences
  // nurseId → clinicId → day → count
  const counts: Record<string, Record<string, Record<string, number>>> = {};
  // nurseId → day → weeksWorked
  const nurseWeeksWorked: Record<string, Record<string, number>> = {};
  // nurseId → day → weeksOff
  const nurseWeeksOff: Record<string, Record<string, number>> = {};
  // nurseId → totalWeeks seen
  const nurseWeeksSeen: Record<string, number> = {};
  // Dual clinic combos: "primary|secondary" → count
  const comboCounts: Record<string, number> = {};
  // Unmapped clinics for debugging
  const unmappedClinics = new Set<string>();

  for (const weekData of Object.values(weeklySchedules)) {
    if (!weekData.nurses || !Array.isArray(weekData.nurses)) continue;

    for (const nurse of weekData.nurses) {
      if (!nurse.name || !nurse.days) continue;

      const nurseId = nurseNameToId.get(nurse.name);
      if (!nurseId) continue;

      nurseWeeksSeen[nurseId] = (nurseWeeksSeen[nurseId] ?? 0) + 1;

      if (!counts[nurseId]) counts[nurseId] = {};
      if (!nurseWeeksWorked[nurseId]) nurseWeeksWorked[nurseId] = {};
      if (!nurseWeeksOff[nurseId]) nurseWeeksOff[nurseId] = {};

      for (const [dayShort, dayData] of Object.entries(nurse.days)) {
        const day = DAYS_MAP[dayShort];
        if (!day || !dayData) continue;

        if (dayData.is_off || !dayData.clinic_raw) {
          nurseWeeksOff[nurseId][day] = (nurseWeeksOff[nurseId][day] ?? 0) + 1;
          continue;
        }

        nurseWeeksWorked[nurseId][day] =
          (nurseWeeksWorked[nurseId][day] ?? 0) + 1;

        const { primary, secondary } = parseClinicRaw(dayData.clinic_raw);

        if (primary) {
          const clinicId = clinicCodeToId.get(primary);
          if (clinicId) {
            if (!counts[nurseId][clinicId]) counts[nurseId][clinicId] = {};
            counts[nurseId][clinicId][day] =
              (counts[nurseId][clinicId][day] ?? 0) + 1;
          } else {
            unmappedClinics.add(primary);
          }
        } else {
          unmappedClinics.add(dayData.clinic_raw);
        }

        // Track dual-clinic combos
        if (primary && secondary) {
          const key = `${primary}|${secondary}`;
          comboCounts[key] = (comboCounts[key] ?? 0) + 1;
        }
      }
    }
  }

  if (unmappedClinics.size > 0) {
    console.log(
      `\n⚠️  Unmapped clinic codes: ${Array.from(unmappedClinics).join(", ")}`,
    );
  }

  // ── Build probability matrix ──
  const probabilityMatrix: Record<
    string,
    Record<string, Record<string, number>>
  > = {};

  for (const [nurseId, clinicMap] of Object.entries(counts)) {
    const totalWeeksSeen = nurseWeeksSeen[nurseId] ?? 1;
    probabilityMatrix[nurseId] = {};

    for (const [clinicId, dayMap] of Object.entries(clinicMap)) {
      probabilityMatrix[nurseId][clinicId] = {};
      for (const [day, count] of Object.entries(dayMap)) {
        const prob = Math.round((count / totalWeeksSeen) * 1000) / 1000;
        if (prob > 0) {
          probabilityMatrix[nurseId][clinicId][day] = prob;
        }
      }
    }
  }

  // ── Build off-day patterns ──
  const offDayPatterns: Record<string, Record<string, number>> = {};

  for (const [nurseId, _] of Object.entries(counts)) {
    const totalWeeksSeen = nurseWeeksSeen[nurseId] ?? 1;
    offDayPatterns[nurseId] = {};

    for (const day of ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]) {
      const offCount = nurseWeeksOff[nurseId]?.[day] ?? 0;
      const workedCount = nurseWeeksWorked[nurseId]?.[day] ?? 0;
      const totalDayWeeks = offCount + workedCount;
      const offProb =
        totalDayWeeks > 0
          ? Math.round((offCount / totalDayWeeks) * 1000) / 1000
          : 0;
      offDayPatterns[nurseId][day] = offProb;
    }
  }

  // ── Build shift preferences ──
  const shiftPreferences: Record<
    string,
    { morningPct: number; afternoonPct: number; totalShifts: number }
  > = {};

  for (const [nurseId, _] of Object.entries(counts)) {
    // Most clinics are morning — default to 85/15 split
    shiftPreferences[nurseId] = {
      morningPct: 0.85,
      afternoonPct: 0.15,
      totalShifts: Object.values(nurseWeeksWorked[nurseId] ?? {}).reduce(
        (a, b) => a + b,
        0,
      ),
    };
  }

  // ── Build dual-clinic combos ──
  const dualClinicCombos = Object.entries(comboCounts)
    .map(([key, count]) => {
      const [primary, secondary] = key.split("|");
      return { primary, secondary, count };
    })
    .sort((a, b) => b.count - a.count);

  // ── Meta ──
  const meta = { totalWeeks, generatedAt: new Date().toISOString() };

  // Write all files
  writeFileSync(
    join(MODELS_DIR, "probability-matrix.json"),
    JSON.stringify(probabilityMatrix, null, 2),
  );
  writeFileSync(
    join(MODELS_DIR, "off-day-patterns.json"),
    JSON.stringify(offDayPatterns, null, 2),
  );
  writeFileSync(
    join(MODELS_DIR, "shift-preferences.json"),
    JSON.stringify(shiftPreferences, null, 2),
  );
  writeFileSync(
    join(MODELS_DIR, "dual-clinic-combos.json"),
    JSON.stringify(dualClinicCombos, null, 2),
  );
  writeFileSync(join(MODELS_DIR, "meta.json"), JSON.stringify(meta, null, 2));

  console.log(`\n✅ All models regenerated in ${MODELS_DIR}/`);
  console.log(
    `   ${Object.keys(probabilityMatrix).length} nurses, ${totalWeeks} weeks`,
  );

  // Spot checks
  const spotChecks = [
    { nurse: "רבחייה בראגיתי", clinic: "diabetes", day: "SUN" },
    { nurse: "נסרין משני", clinic: "ophthalmology", day: "MON" },
    { nurse: "עלאא אבו סנינה", clinic: "orthopedics", day: "SUN" },
    { nurse: "כתיבה בסיט", clinic: "professional", day: "MON" },
    { nurse: "סאנדי צאיג", clinic: "sugar_load", day: "SUN" },
  ];

  console.log(`\n📊 Spot checks:`);
  for (const { nurse, clinic, day } of spotChecks) {
    const nId = nurseNameToId.get(nurse);
    const cId = clinicCodeToId.get(clinic);
    if (nId && cId) {
      const prob = probabilityMatrix[nId]?.[cId]?.[day] ?? 0;
      console.log(`  ${nurse} → ${clinic} ${day}: P=${prob}`);
    }
  }

  // Show top dual-clinic combos
  console.log(`\n📋 Top 10 dual-clinic combos:`);
  for (const combo of dualClinicCombos.slice(0, 10)) {
    console.log(`  ${combo.primary} + ${combo.secondary}: ${combo.count}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
