import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { getWeekStart, DAY_ORDER } from "@/lib/utils";

export async function GET() {
  try {
    const user = await authGuard();
    const weekStart = getWeekStart();

    if (!user.nurseProfile) {
      return NextResponse.json(
        { assignments: [], weekStart, status: "NOT_PUBLISHED" }
      );
    }

    const schedule = await db.weeklySchedule.findUnique({
      where: { weekStart },
    });

    if (!schedule || schedule.status !== "PUBLISHED") {
      return NextResponse.json(
        { assignments: [], weekStart, status: "NOT_PUBLISHED" }
      );
    }

    const assignments = await db.scheduleAssignment.findMany({
      where: {
        nurseId: user.nurseProfile.id,
        scheduleId: schedule.id,
      },
      include: { primaryClinic: true, secondaryClinic: true },
    });

    const sorted = assignments.sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
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
