/**
 * Historical data import pipeline.
 *
 * Parses 51 weeks from data/weekly_schedules.json and produces:
 * 1. probability-matrix.json — P(clinic | nurse, day)
 * 2. shift-preferences.json — morning vs afternoon % per nurse
 * 3. off-day-patterns.json — P(off | nurse, day)
 * 4. dual-clinic-combos.json — most common primary+secondary pairs
 * 5. meta.json — total weeks processed
 *
 * Run: npx tsx src/learning/import.ts
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { parseClinicRaw, mapDayName, parseHours } from "./clinic-mapper";
import type {
  ProbabilityMatrix,
  ShiftPreferences,
  OffDayPatterns,
  DualClinicCombo,
} from "./models";

import schedules from "../../data/weekly_schedules.json";

// ── Types for raw data ──────────────────────────────────────────────

type RawDay = {
  clinic_raw: string | null;
  hours: string | null;
  is_off: boolean;
};

type RawNurse = {
  name: string;
  section: string;
  note: string | null;
  days: Record<string, RawDay>;
};

type RawWeek = {
  sheet_name: string;
  dates: string[];
  notes: string[] | null;
  nurses: RawNurse[];
};

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MODELS_DIR = join(process.cwd(), "data", "models");

// ── Counters ────────────────────────────────────────────────────────

// P(clinic | nurse, day): nurseId → clinicCode → day → count
type CountMatrix = Record<string, Record<string, Record<string, number>>>;

// Shift: nurseId → { morning, afternoon }
type ShiftCounts = Record<string, { morning: number; afternoon: number }>;

// Off days: nurseId → day → count
type OffCounts = Record<string, Record<string, number>>;

// Weeks active: nurseId → day → totalWeeksPresent (for normalization)
type WeeksActive = Record<string, Record<string, number>>;

// Dual combos: "primary|secondary" → count
type ComboCounts = Record<string, number>;

function inc(obj: Record<string, number>, key: string, amount = 1): void {
  obj[key] = (obj[key] ?? 0) + amount;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("── Learning Engine: Historical Import ──\n");

  // Step 1: Connect to DB and build lookup maps
  const db = new PrismaClient();
  try {
    const nurses = await db.nurseProfile.findMany({
      include: { user: { select: { name: true } } },
    });
    const clinics = await db.clinic.findMany();

    const nurseByName = new Map<string, string>(); // name → nurseProfile.id
    for (const n of nurses) {
      nurseByName.set(n.user.name, n.id);
    }

    const clinicIdByCode = new Map<string, string>(); // code → clinic.id
    for (const c of clinics) {
      clinicIdByCode.set(c.code, c.id);
    }

    console.log(
      `Loaded ${nurseByName.size} nurses, ${clinicIdByCode.size} clinics from DB`,
    );

    // Step 2: Parse all weeks
    const weeks = Object.values(schedules) as RawWeek[];
    const totalWeeks = weeks.length;
    console.log(`Processing ${totalWeeks} weeks...\n`);

    const clinicCounts: CountMatrix = {};
    const shiftCounts: ShiftCounts = {};
    const offCounts: OffCounts = {};
    const weeksActive: WeeksActive = {};
    const comboCounts: ComboCounts = {};

    let parsedAssignments = 0;
    let skippedNoNurse = 0;
    let skippedNoClinic = 0;

    for (const week of weeks) {
      for (const rawNurse of week.nurses) {
        const nurseId = nurseByName.get(rawNurse.name);
        if (!nurseId) {
          skippedNoNurse++;
          continue;
        }

        // Initialize nurse maps if needed
        if (!clinicCounts[nurseId]) clinicCounts[nurseId] = {};
        if (!shiftCounts[nurseId])
          shiftCounts[nurseId] = { morning: 0, afternoon: 0 };
        if (!offCounts[nurseId]) offCounts[nurseId] = {};
        if (!weeksActive[nurseId]) weeksActive[nurseId] = {};

        for (const [rawDay, dayData] of Object.entries(rawNurse.days)) {
          const day = mapDayName(rawDay);
          if (!day) continue;

          // Track that this nurse was present this week for this day
          inc(weeksActive[nurseId], day);

          // Off day
          if (
            dayData.is_off ||
            !dayData.clinic_raw ||
            dayData.clinic_raw === "חופש"
          ) {
            inc(offCounts[nurseId], day);
            continue;
          }

          // Parse clinic
          const parsed = parseClinicRaw(dayData.clinic_raw);
          if (!parsed.primary) {
            skippedNoClinic++;
            continue;
          }

          // Count clinic assignment (keyed by clinicId for algorithm integration)
          const primaryId = clinicIdByCode.get(parsed.primary);
          if (!primaryId) {
            skippedNoClinic++;
            continue;
          }
          if (!clinicCounts[nurseId][primaryId]) {
            clinicCounts[nurseId][primaryId] = {};
          }
          inc(clinicCounts[nurseId][primaryId], day);
          parsedAssignments++;

          // Track dual-clinic combo
          if (parsed.secondary) {
            const key = `${parsed.primary}|${parsed.secondary}`;
            inc(comboCounts, key);
          }

          // Shift preference
          const hours = parseHours(dayData.hours);
          if (hours) {
            if (hours.isMorning) {
              shiftCounts[nurseId].morning++;
            } else {
              shiftCounts[nurseId].afternoon++;
            }
          }
        }
      }
    }

    console.log(`Parsed ${parsedAssignments} assignments`);
    console.log(
      `Skipped: ${skippedNoNurse} (unknown nurse), ${skippedNoClinic} (no clinic mapped)\n`,
    );

    // Step 3: Compute probability matrices
    console.log("Computing probability matrices...");

    // P(clinic | nurse, day) = clinicCount / weeksActive
    const probabilityMatrix: ProbabilityMatrix = {};
    for (const [nurseId, clinicMap] of Object.entries(clinicCounts)) {
      probabilityMatrix[nurseId] = {};
      for (const [clinicCode, dayCounts] of Object.entries(clinicMap)) {
        probabilityMatrix[nurseId][clinicCode] = {};
        for (const day of DAYS) {
          const count = dayCounts[day] ?? 0;
          const total = weeksActive[nurseId]?.[day] ?? totalWeeks;
          probabilityMatrix[nurseId][clinicCode][day] =
            total > 0 ? Math.round((count / total) * 1000) / 1000 : 0;
        }
      }
    }

    // Shift preferences: morning% and afternoon%
    const shiftPreferences: ShiftPreferences = {};
    for (const [nurseId, counts] of Object.entries(shiftCounts)) {
      const total = counts.morning + counts.afternoon;
      shiftPreferences[nurseId] = {
        morningPct:
          total > 0 ? Math.round((counts.morning / total) * 1000) / 1000 : 0,
        afternoonPct:
          total > 0 ? Math.round((counts.afternoon / total) * 1000) / 1000 : 0,
        totalShifts: total,
      };
    }

    // P(off | nurse, day) = offCount / weeksActive
    const offDayPatterns: OffDayPatterns = {};
    for (const [nurseId, dayCounts] of Object.entries(offCounts)) {
      offDayPatterns[nurseId] = {};
      for (const day of DAYS) {
        const offCount = dayCounts[day] ?? 0;
        const total = weeksActive[nurseId]?.[day] ?? totalWeeks;
        offDayPatterns[nurseId][day] =
          total > 0 ? Math.round((offCount / total) * 1000) / 1000 : 0;
      }
    }

    // Dual-clinic combos sorted by frequency
    const dualClinicCombos: DualClinicCombo[] = Object.entries(comboCounts)
      .map(([key, count]) => {
        const [primary, secondary] = key.split("|");
        return { primary, secondary, count };
      })
      .sort((a, b) => b.count - a.count);

    // Step 4: Write output files
    if (!existsSync(MODELS_DIR)) {
      mkdirSync(MODELS_DIR, { recursive: true });
    }

    const write = (name: string, data: unknown) => {
      const path = join(MODELS_DIR, name);
      writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
      console.log(`  Wrote ${path}`);
    };

    write("probability-matrix.json", probabilityMatrix);
    write("shift-preferences.json", shiftPreferences);
    write("off-day-patterns.json", offDayPatterns);
    write("dual-clinic-combos.json", dualClinicCombos);
    write("meta.json", { totalWeeks, generatedAt: new Date().toISOString() });

    // Step 5: Print summary
    console.log("\n── Summary ──");
    console.log(`Total weeks: ${totalWeeks}`);
    console.log(`Nurses tracked: ${Object.keys(probabilityMatrix).length}`);
    console.log(`Dual-clinic combos: ${dualClinicCombos.length}`);

    console.log("\nTop 10 dual-clinic combos:");
    for (const combo of dualClinicCombos.slice(0, 10)) {
      console.log(`  ${combo.primary} + ${combo.secondary}: ${combo.count}x`);
    }

    console.log("\nSample probabilities:");
    for (const nurse of nurses.slice(0, 3)) {
      const nurseProbs = probabilityMatrix[nurse.id];
      if (!nurseProbs) continue;
      const topClinic = Object.entries(nurseProbs).sort(
        ([, a], [, b]) =>
          Math.max(...Object.values(b)) - Math.max(...Object.values(a)),
      )[0];
      if (topClinic) {
        const maxDay = Object.entries(topClinic[1]).sort(
          ([, a], [, b]) => b - a,
        )[0];
        console.log(
          `  ${nurse.user.name}: P(${topClinic[0]} | ${maxDay[0]}) = ${maxDay[1]}`,
        );
      }
    }

    console.log("\n✓ Import complete");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
