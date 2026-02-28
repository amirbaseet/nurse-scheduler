import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { updateClinicConfigSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";

type MergedConfig = {
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
  isOverride: boolean;
};

/**
 * Merge default + weekly overrides.
 * For each clinic+day, use the override if one exists, otherwise fall back to default.
 */
function mergeClinicConfigs(
  defaults: Array<{
    clinicId: string;
    clinic: { name: string };
    day: string;
    shiftStart: string;
    shiftEnd: string;
    nursesNeeded: number;
    isActive: boolean;
  }>,
  overrides: Array<{
    clinicId: string;
    clinic: { name: string };
    day: string;
    shiftStart: string;
    shiftEnd: string;
    nursesNeeded: number;
    isActive: boolean;
  }>
): MergedConfig[] {
  const overrideMap = new Map<string, (typeof overrides)[number]>();
  for (const o of overrides) {
    overrideMap.set(`${o.clinicId}:${o.day}`, o);
  }

  return defaults.map((d) => {
    const key = `${d.clinicId}:${d.day}`;
    const override = overrideMap.get(key);

    if (override) {
      return {
        clinicId: override.clinicId,
        clinicName: override.clinic.name,
        day: override.day,
        shiftStart: override.shiftStart,
        shiftEnd: override.shiftEnd,
        nursesNeeded: override.nursesNeeded,
        isActive: override.isActive,
        isOverride: true,
      };
    }

    return {
      clinicId: d.clinicId,
      clinicName: d.clinic.name,
      day: d.day,
      shiftStart: d.shiftStart,
      shiftEnd: d.shiftEnd,
      nursesNeeded: d.nursesNeeded,
      isActive: d.isActive,
      isOverride: false,
    };
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { week: string } }
) {
  try {
    await authGuard("MANAGER");
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    const defaults = await db.clinicDefaultConfig.findMany({
      include: { clinic: true },
    });

    const overrides = await db.clinicWeeklyConfig.findMany({
      where: { weekStart },
      include: { clinic: true },
    });

    const merged = mergeClinicConfigs(defaults, overrides);

    return NextResponse.json(merged);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { week: string } }
) {
  try {
    await authGuard("MANAGER");
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { configs } = updateClinicConfigSchema.parse(body);

    let count = 0;
    for (const config of configs) {
      await db.clinicWeeklyConfig.upsert({
        where: {
          clinicId_weekStart_day: {
            clinicId: config.clinicId,
            weekStart,
            day: config.day,
          },
        },
        create: {
          clinicId: config.clinicId,
          weekStart,
          day: config.day,
          shiftStart: config.shiftStart,
          shiftEnd: config.shiftEnd,
          nursesNeeded: config.nursesNeeded,
          isActive: config.isActive,
        },
        update: {
          shiftStart: config.shiftStart,
          shiftEnd: config.shiftEnd,
          nursesNeeded: config.nursesNeeded,
          isActive: config.isActive,
        },
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    return handleApiError(error);
  }
}
