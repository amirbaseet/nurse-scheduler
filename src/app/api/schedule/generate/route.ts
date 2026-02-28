import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { generateScheduleSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { weekStart: weekStr } = generateScheduleSchema.parse(body);
    const weekStart = parseWeekParam(weekStr);

    if (!weekStart) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    // STUB: Algorithm will be implemented in Phase 6.
    // For now, create an empty GENERATED schedule.
    const schedule = await db.weeklySchedule.upsert({
      where: { weekStart },
      create: {
        weekStart,
        status: "GENERATED",
        qualityScore: 0,
        generatedAt: new Date(),
      },
      update: {
        status: "GENERATED",
        qualityScore: 0,
        generatedAt: new Date(),
      },
    });

    return NextResponse.json({
      schedule,
      warnings: ["Algorithm stub — no assignments generated yet (Phase 6)"],
      qualityScore: 0,
      managerGaps: [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
