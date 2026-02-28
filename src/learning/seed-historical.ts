/**
 * Seeds historical WeeklySchedule + ScheduleAssignment records from weekly_schedules.json.
 *
 * Creates 51 ARCHIVED schedules with assignments for each nurse×day.
 * Uses clinic mapper to resolve raw clinic strings to clinic IDs.
 *
 * Run: npx tsx src/learning/seed-historical.ts
 */
import { PrismaClient } from "@prisma/client";
import { parseClinicRaw, mapDayName, parseHours } from "./clinic-mapper";
import schedules from "../../data/weekly_schedules.json";

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

/**
 * Parse a date string in multiple formats:
 * - "DD.MM.YYYY" (e.g. "05.01.2025")
 * - "YYYY-MM-DD" (e.g. "2025-03-16")
 * Returns null if unparseable (e.g. Hebrew text headers).
 */
function parseWeekDate(dateStr: string): Date | null {
  // Try YYYY-MM-DD (ISO-like)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number);
    return new Date(y, m - 1, d);
  }

  // Try DD.MM.YYYY
  const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch.map(Number);
    return new Date(y, m - 1, d);
  }

  return null; // Unparseable (e.g. "ימי השבוע")
}

async function main() {
  console.log("── Seeding Historical Schedules ──\n");

  const db = new PrismaClient();
  try {
    // Build lookup maps
    const nurses = await db.nurseProfile.findMany({
      include: { user: { select: { name: true } } },
    });
    const clinics = await db.clinic.findMany();

    const nurseByName = new Map<string, string>();
    for (const n of nurses) {
      nurseByName.set(n.user.name, n.id);
    }

    const clinicByCode = new Map<string, string>();
    for (const c of clinics) {
      clinicByCode.set(c.code, c.id);
    }

    console.log(
      `Loaded ${nurseByName.size} nurses, ${clinicByCode.size} clinics`,
    );

    // Check for existing historical schedules
    const existingCount = await db.weeklySchedule.count({
      where: { status: "ARCHIVED" },
    });
    if (existingCount > 0) {
      console.log(`\nFound ${existingCount} existing ARCHIVED schedules.`);
      console.log(
        "Skipping seed to avoid duplicates. Delete them first to re-seed.",
      );
      return;
    }

    const weeks = Object.values(schedules) as RawWeek[];
    let schedulesCreated = 0;
    let assignmentsCreated = 0;

    for (const week of weeks) {
      // Parse weekStart from first date (try multiple formats)
      if (!week.dates || week.dates.length === 0) continue;
      const weekStart = parseWeekDate(week.dates[0]);
      if (!weekStart) continue; // Skip unparseable (e.g. Hebrew headers)

      // Create or find WeeklySchedule (weekStart is unique)
      const schedule = await db.weeklySchedule.upsert({
        where: { weekStart },
        create: {
          weekStart,
          status: "ARCHIVED",
          generatedAt: weekStart,
        },
        update: {}, // Don't overwrite if already exists
      });
      schedulesCreated++;

      // Track (nurseId, day) to avoid unique constraint violations
      // (a nurse may appear in multiple sections within the same week)
      const seenKeys = new Set<string>();

      // Create assignments for each nurse×day
      for (const rawNurse of week.nurses) {
        const nurseId = nurseByName.get(rawNurse.name);
        if (!nurseId) continue;

        for (const [rawDay, dayData] of Object.entries(rawNurse.days)) {
          const day = mapDayName(rawDay);
          if (!day) continue;

          const key = `${nurseId}:${day}`;
          if (seenKeys.has(key)) continue; // Skip duplicate
          seenKeys.add(key);

          const isOff =
            dayData.is_off ||
            !dayData.clinic_raw ||
            dayData.clinic_raw === "חופש";

          let primaryClinicId: string | null = null;
          let secondaryClinicId: string | null = null;
          let shiftStart: string | null = null;
          let shiftEnd: string | null = null;
          let hours = 0;

          if (!isOff && dayData.clinic_raw) {
            const parsed = parseClinicRaw(dayData.clinic_raw);
            if (parsed.primary) {
              primaryClinicId = clinicByCode.get(parsed.primary) ?? null;
            }
            if (parsed.secondary) {
              secondaryClinicId = clinicByCode.get(parsed.secondary) ?? null;
            }

            const parsedHours = parseHours(dayData.hours);
            if (parsedHours) {
              shiftStart = parsedHours.start;
              shiftEnd = parsedHours.end;
              hours = parsedHours.hours;
            }
          }

          try {
            await db.scheduleAssignment.create({
              data: {
                scheduleId: schedule.id,
                nurseId,
                day: day as
                  | "SUN"
                  | "MON"
                  | "TUE"
                  | "WED"
                  | "THU"
                  | "FRI"
                  | "SAT",
                primaryClinicId,
                secondaryClinicId,
                shiftStart,
                shiftEnd,
                hours,
                isOff,
                isFixed: false,
                isManagerSelf: false,
              },
            });
            assignmentsCreated++;
          } catch (e: unknown) {
            const err = e as { code?: string };
            if (err.code === "P2002") {
              // Duplicate — skip silently (nurse appeared twice in same section)
              continue;
            }
            throw e;
          }
        }
      }

      // Progress indicator
      if (schedulesCreated % 10 === 0) {
        console.log(`  ${schedulesCreated} weeks processed...`);
      }
    }

    console.log(`\n✓ Created ${schedulesCreated} WeeklySchedule records`);
    console.log(`✓ Created ${assignmentsCreated} ScheduleAssignment records`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
