/**
 * Test script: Generate schedule for Jan 5, 2025 and compare with archived data.
 * Run with: npx tsx scripts/test-generate.ts
 */
import { PrismaClient } from "@prisma/client";
import { dbToAlgorithmConfig } from "../src/algorithm/converters";
import { generateWeeklySchedule } from "../src/algorithm/index";

const db = new PrismaClient();

// Archive uses raw Hebrew clinic names — map to DB clinic codes for fuzzy matching
const ARCHIVE_TO_CODE: Record<string, string> = {
  כירורגיה: "surgery",
  מקצועית: "professional",
  זוליר: "xolair",
  אווסטין: "avastin",
  "העמסת סכרת": "sugar_load",
  "העמסת סוכר": "sugar_load",
  סכרת: "diabetes",
  "א.א.ג": "ent",
  תעסוקתית: "occupational_therapy",
  שד: "breast",
  "מערך שד": "breast",
  מנטו: "mantoux",
  "אי ספיקת לב": "heart_failure",
  "א.ק.ג": "ecg",
  אורטופידיה: "orthopedics",
  "אורטופיד ילדים": "pediatric_orthopedics",
  "עיניים ילדיים": "pediatric_ophthalmology",
  "עיניים ילדים": "pediatric_ophthalmology",
  עיניים: "ophthalmology",
  פלאסטיקה: "plastic_surgery",
  סקלרותרפיה: "sclerotherapy",
  חיסון: "vaccination",
  "כף רגל": "hand_clinic", // foot clinic mapped to hand
  "כף יד": "hand_clinic",
  פרקטלוג: "plastic_surgery", // approximate
};

const ARCHIVED_JAN5: Record<string, Record<string, string>> = {
  "כתיבה בסיט": {
    SUN: "surgery",
    MON: "professional",
    TUE: "professional",
    WED: "xolair",
    THU: "professional",
    SAT: "avastin",
  },
  "נגלא שוויקי": {
    SUN: "sugar_load",
    MON: "surgery",
    TUE: "OFF",
    WED: "surgery",
    THU: "OFF",
  },
  "נידאל ניגם": {
    SUN: "OFF",
    MON: "OFF",
    TUE: "OFF",
    WED: "OFF",
    THU: "OFF",
    SAT: "OFF",
  },
  "רבחייה בראגיתי": {
    SUN: "diabetes",
    MON: "diabetes",
    TUE: "diabetes",
    WED: "diabetes",
    THU: "diabetes",
  },
  "היא חליל": {
    SUN: "sugar_load",
    MON: "diabetes",
    TUE: "sugar_load",
    WED: "diabetes",
    THU: "OFF",
    SAT: "diabetes",
  },
  "אינאס גאעוני": {
    SUN: "occupational_therapy",
    MON: "breast",
    TUE: "breast",
    WED: "occupational_therapy",
    THU: "breast",
  },
  "רוואא משני": {
    TUE: "plastic_surgery",
    WED: "pediatric_ophthalmology",
    THU: "breast",
  },
  "הדיל סוריך": {
    SUN: "pediatric_ophthalmology",
    MON: "breast",
    TUE: "sugar_load",
    WED: "heart_failure",
    THU: "diabetes",
  },
  "סאנדי צאיג": {
    SUN: "sugar_load",
    MON: "ecg",
    TUE: "sugar_load",
    WED: "orthopedics",
  },
  "נסרין עלי": { SUN: "ophthalmology", TUE: "ophthalmology" },
  "נסרין משני": {
    SUN: "ophthalmology",
    MON: "ophthalmology",
    TUE: "ophthalmology",
    WED: "ophthalmology",
    THU: "ophthalmology",
  },
  "עלאא אבו סנינה": {
    SUN: "orthopedics",
    MON: "ophthalmology",
    TUE: "pediatric_orthopedics",
    WED: "orthopedics",
    THU: "ophthalmology",
    SAT: "orthopedics",
  },
};

async function main() {
  const weekStart = new Date("2025-01-05T00:00:00.000Z");
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Load all config from DB (same as generate route)
  const [
    nurseProfiles,
    clinicDefaults,
    clinicOverrides,
    timeOff,
    fixedAssignments,
    programs,
    preferences,
    allClinics,
  ] = await Promise.all([
    db.nurseProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: true, blockedClinics: true },
    }),
    db.clinicDefaultConfig.findMany({
      where: { isActive: true },
      include: {
        clinic: {
          select: {
            code: true,
            genderPref: true,
            canBeSecondary: true,
            secondaryHours: true,
            secondaryNursesNeeded: true,
          },
        },
      },
    }),
    db.clinicWeeklyConfig.findMany({
      where: { weekStart },
      include: {
        clinic: {
          select: {
            code: true,
            genderPref: true,
            canBeSecondary: true,
            secondaryHours: true,
            secondaryNursesNeeded: true,
          },
        },
      },
    }),
    db.timeOffRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
    }),
    db.fixedAssignment.findMany({
      where: {
        OR: [
          { weekStart: new Date("1970-01-01T00:00:00.000Z") },
          { weekStart },
        ],
      },
      include: {
        clinic: {
          select: {
            defaultConfigs: {
              select: { day: true, shiftStart: true, shiftEnd: true },
            },
          },
        },
      },
    }),
    db.programAssignment.findMany({
      where: { weekStart },
      include: {
        program: {
          select: { name: true, type: true, defaultHours: true },
        },
      },
    }),
    db.weeklyPreference.findMany({ where: { weekStart } }),
    db.clinic.findMany({ select: { id: true, name: true, code: true } }),
  ]);

  console.log(`\n📊 DB Stats:`);
  console.log(`  Nurses: ${nurseProfiles.length}`);
  console.log(`  Clinic configs: ${clinicDefaults.length} defaults`);
  console.log(`  Fixed assignments: ${fixedAssignments.length}`);
  console.log(`  Total clinics: ${allClinics.length}`);

  const config = dbToAlgorithmConfig(
    nurseProfiles,
    clinicDefaults,
    clinicOverrides,
    timeOff,
    fixedAssignments,
    programs,
    preferences,
  );

  console.log(`  Algorithm nurses: ${config.nurses.length} (excl. manager)`);
  console.log(`  Algorithm clinic slots: ${config.clinics.length}`);

  // Generate
  console.log(`\n⚙️  Generating schedule...`);
  const start = Date.now();
  const result = generateWeeklySchedule(weekStart, config);
  const elapsed = Date.now() - start;

  console.log(`  ✅ Done in ${elapsed}ms`);
  console.log(`  Quality score: ${result.qualityScore}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log(`  Manager gaps: ${result.managerGaps.length}`);

  // Build lookups
  const clinicNameMap = new Map(allClinics.map((c) => [c.id, c.name]));
  const clinicCodeMap = new Map(allClinics.map((c) => [c.id, c.code]));
  const nurseNameMap = new Map(nurseProfiles.map((n) => [n.id, n.user.name]));

  // Display generated schedule
  console.log(`\n📋 Generated Schedule:`);
  console.log(`${"─".repeat(120)}`);

  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

  // Group by nurse
  const nurseAssignments = new Map<
    string,
    Map<string, (typeof result.assignments)[0]>
  >();
  for (const a of result.assignments) {
    if (!nurseAssignments.has(a.nurseId)) {
      nurseAssignments.set(a.nurseId, new Map());
    }
    nurseAssignments.get(a.nurseId)!.set(a.day, a);
  }

  let totalMatches = 0;
  let totalComparisons = 0;
  const perNurseStats: Array<{ name: string; matches: number; total: number }> =
    [];

  for (const [nurseId, dayMap] of Array.from(nurseAssignments)) {
    const name = nurseNameMap.get(nurseId) ?? nurseId;
    const archivedNurse = ARCHIVED_JAN5[name];

    let nurseMatches = 0;
    let nurseTotal = 0;
    const dayStrs: string[] = [];

    for (const day of DAYS) {
      const a = dayMap.get(day);
      const genCode =
        a && !a.isOff && a.primaryClinicId
          ? (clinicCodeMap.get(a.primaryClinicId) ?? "?")
          : "OFF";
      const genName =
        a && !a.isOff && a.primaryClinicId
          ? (clinicNameMap.get(a.primaryClinicId) ?? "?")
          : "OFF";
      const secondary =
        a && !a.isOff && a.secondaryClinicId
          ? ` + ${clinicNameMap.get(a.secondaryClinicId) ?? "?"}`
          : "";

      // Compare with archived (using clinic codes)
      let marker = "";
      if (archivedNurse && archivedNurse[day]) {
        nurseTotal++;
        totalComparisons++;
        const archivedCode = archivedNurse[day];
        const matched =
          (archivedCode === "OFF" && genCode === "OFF") ||
          (archivedCode !== "OFF" && genCode === archivedCode);
        if (matched) {
          nurseMatches++;
          totalMatches++;
          marker = " ✅";
        } else {
          marker = ` ❌(exp:${archivedCode})`;
        }
      }

      dayStrs.push(`${day}: ${genName}${secondary}${marker}`);
    }

    if (archivedNurse) {
      perNurseStats.push({ name, matches: nurseMatches, total: nurseTotal });
      const pct =
        nurseTotal > 0 ? Math.round((nurseMatches / nurseTotal) * 100) : 0;
      console.log(`${name}  [${nurseMatches}/${nurseTotal} = ${pct}%]`);
    } else {
      console.log(`${name}  (not in archived)`);
    }
    console.log(`  ${dayStrs.join(" | ")}`);
  }

  console.log(`\n${"═".repeat(120)}`);
  const pct =
    totalComparisons > 0
      ? Math.round((totalMatches / totalComparisons) * 100)
      : 0;
  console.log(
    `📊 Overall Match Rate: ${totalMatches}/${totalComparisons} (${pct}%)`,
  );

  // Per-nurse breakdown sorted by match rate
  console.log(`\n📋 Per-Nurse Breakdown:`);
  perNurseStats.sort(
    (a, b) => b.matches / (b.total || 1) - a.matches / (a.total || 1),
  );
  for (const s of perNurseStats) {
    const p = s.total > 0 ? Math.round((s.matches / s.total) * 100) : 0;
    const bar =
      "█".repeat(Math.round(p / 5)) + "░".repeat(20 - Math.round(p / 5));
    console.log(
      `  ${s.name.padEnd(20)} ${bar} ${p}% (${s.matches}/${s.total})`,
    );
  }

  // Detailed analysis: working-day clinic accuracy
  // Only count days where BOTH archive and algorithm show the nurse WORKING
  let workingMatches = 0;
  let workingTotal = 0;
  let offCorrect = 0;
  let offTotal = 0;
  let algoOffArchiveWorking = 0; // nurse OFF in algo but working in archive
  let algoWorkingArchiveOff = 0; // nurse working in algo but OFF in archive

  for (const [nurseId, dayMap] of Array.from(nurseAssignments)) {
    const name = nurseNameMap.get(nurseId) ?? nurseId;
    const archivedNurse = ARCHIVED_JAN5[name];
    if (!archivedNurse) continue;

    for (const day of DAYS) {
      if (!archivedNurse[day]) continue;
      const a = dayMap.get(day);
      const genCode =
        a && !a.isOff && a.primaryClinicId
          ? (clinicCodeMap.get(a.primaryClinicId) ?? "?")
          : "OFF";
      const archivedCode = archivedNurse[day];

      if (archivedCode === "OFF" && genCode === "OFF") {
        offCorrect++;
        offTotal++;
      } else if (archivedCode === "OFF" && genCode !== "OFF") {
        algoWorkingArchiveOff++;
        offTotal++;
      } else if (archivedCode !== "OFF" && genCode === "OFF") {
        algoOffArchiveWorking++;
      } else {
        // Both working — check clinic match
        workingTotal++;
        if (genCode === archivedCode) workingMatches++;
      }
    }
  }

  console.log(`\n📊 Detailed Analysis:`);
  console.log(
    `  Both working → clinic match: ${workingMatches}/${workingTotal} (${workingTotal > 0 ? Math.round((workingMatches / workingTotal) * 100) : 0}%)`,
  );
  console.log(`  Both OFF (correct):          ${offCorrect}/${offTotal}`);
  console.log(
    `  Algo OFF, archive working:   ${algoOffArchiveWorking} (capacity gap — manager fills these)`,
  );
  console.log(
    `  Algo working, archive OFF:   ${algoWorkingArchiveOff} (over-assignment)`,
  );

  // Show warnings
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    for (const w of result.warnings.slice(0, 10)) {
      const clinicName = w.clinicId
        ? (clinicNameMap.get(w.clinicId) ?? w.clinicId)
        : "";
      console.log(`  [${w.level}] ${w.message} ${clinicName} ${w.day ?? ""}`);
    }
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
