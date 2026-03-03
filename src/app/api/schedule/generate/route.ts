import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { generateScheduleSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";
import {
  dbToAlgorithmConfig,
  algorithmToDbAssignments,
} from "@/algorithm/converters";
import { generateWeeklySchedule } from "@/algorithm/index";
import { loadCorrectionAdjustments } from "@/learning/corrections";

export async function POST(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { weekStart: weekStr } = generateScheduleSchema.parse(body);
    const weekStart = parseWeekParam(weekStr);

    if (!weekStart) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    }

    // Compute weekEnd (Saturday end of week)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // ── Load all config from DB ──

    const [
      nurseProfiles,
      clinicDefaults,
      clinicOverrides,
      timeOff,
      fixedAssignments,
      programs,
      preferences,
      allClinics,
      adjustments,
      monthlyDates,
    ] = await Promise.all([
      db.nurseProfile.findMany({
        where: { user: { isActive: true } },
        include: {
          user: true,
          blockedClinics: true,
        },
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
            { weekStart: new Date("1970-01-01T00:00:00.000Z") }, // permanent
            { weekStart }, // this week only
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

      db.weeklyPreference.findMany({
        where: { weekStart },
      }),

      db.clinic.findMany({
        select: { id: true, name: true, code: true },
      }),

      loadCorrectionAdjustments(),

      db.clinicMonthlyDate.findMany({
        where: {
          date: { gte: weekStart, lte: weekEnd },
          isActive: true,
        },
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
    ]);

    // ── Convert DB → Algorithm types ──

    const config = dbToAlgorithmConfig(
      nurseProfiles,
      clinicDefaults,
      clinicOverrides,
      timeOff,
      fixedAssignments,
      programs,
      preferences,
      monthlyDates,
      weekStart,
    );

    // Wire correction-learning adjustments into the algorithm config
    if (adjustments.size > 0) {
      config.adjustments = adjustments;
    }

    // ── Run algorithm ──

    const result = generateWeeklySchedule(weekStart, config);

    // ── Save results ──

    const schedule = await db.weeklySchedule.upsert({
      where: { weekStart },
      create: {
        weekStart,
        status: "GENERATED",
        qualityScore: result.qualityScore,
        generatedAt: new Date(),
      },
      update: {
        status: "GENERATED",
        qualityScore: result.qualityScore,
        generatedAt: new Date(),
      },
    });

    // Replace all assignments in a transaction
    const dbAssignments = algorithmToDbAssignments(
      result.assignments,
      schedule.id,
    );

    await db.$transaction([
      db.scheduleAssignment.deleteMany({
        where: { scheduleId: schedule.id },
      }),
      db.scheduleAssignment.createMany({
        data: dbAssignments,
      }),
    ]);

    // ── Enrich clinic names in gaps & warnings ──

    const clinicNameMap = new Map(allClinics.map((c) => [c.id, c.name]));

    const enrichedGaps = result.managerGaps.map((gap) => ({
      ...gap,
      clinicName: clinicNameMap.get(gap.clinicId) ?? gap.clinicId,
    }));

    const enrichedWarnings = result.warnings.map((w) => ({
      ...w,
      clinicName: w.clinicId
        ? (clinicNameMap.get(w.clinicId) ?? undefined)
        : undefined,
    }));

    return NextResponse.json({
      schedule,
      warnings: enrichedWarnings,
      qualityScore: result.qualityScore,
      managerGaps: enrichedGaps,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
