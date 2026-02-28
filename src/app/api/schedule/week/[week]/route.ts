import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { parseWeekParam } from "@/lib/utils";

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

    const schedule = await db.weeklySchedule.findUnique({
      where: { weekStart },
      include: {
        assignments: {
          include: {
            nurse: { include: { user: true } },
            primaryClinic: true,
            secondaryClinic: true,
          },
        },
      },
    });

    return NextResponse.json(schedule);
  } catch (error) {
    return handleApiError(error);
  }
}
