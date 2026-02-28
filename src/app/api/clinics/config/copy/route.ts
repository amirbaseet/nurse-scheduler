import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { copyClinicConfigSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { fromWeek, toWeek } = copyClinicConfigSchema.parse(body);

    const fromDate = parseWeekParam(fromWeek);
    const toDate = parseWeekParam(toWeek);

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    const existing = await db.clinicWeeklyConfig.findMany({
      where: { weekStart: fromDate },
    });

    let copied = 0;
    for (const config of existing) {
      await db.clinicWeeklyConfig.upsert({
        where: {
          clinicId_weekStart_day: {
            clinicId: config.clinicId,
            weekStart: toDate,
            day: config.day,
          },
        },
        create: {
          clinicId: config.clinicId,
          weekStart: toDate,
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
      copied++;
    }

    return NextResponse.json({ success: true, copied });
  } catch (error) {
    return handleApiError(error);
  }
}
