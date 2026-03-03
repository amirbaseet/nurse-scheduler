import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { parseWeekParam, DAY_ORDER } from "@/lib/utils";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: { week: string } },
) {
  try {
    const user = await authGuard();
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return apiError(API_ERRORS.INVALID_DATE, 400);
    }

    if (!user.nurseProfile) {
      return NextResponse.json({
        assignments: [],
        weekStart,
        status: "NOT_PUBLISHED",
      });
    }

    const schedule = await db.weeklySchedule.findUnique({
      where: { weekStart },
    });

    if (!schedule || schedule.status !== "PUBLISHED") {
      return NextResponse.json({
        assignments: [],
        weekStart,
        status: "NOT_PUBLISHED",
      });
    }

    const assignments = await db.scheduleAssignment.findMany({
      where: {
        nurseId: user.nurseProfile.id,
        scheduleId: schedule.id,
      },
      include: { primaryClinic: true, secondaryClinic: true },
    });

    const sorted = assignments.sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
    );

    return NextResponse.json({
      assignments: sorted,
      weekStart,
      status: schedule.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
