import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { parseWeekParam } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: { week: string } },
) {
  try {
    await authGuard("MANAGER");
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    }

    const weekEnd = addDays(weekStart, 6); // Saturday

    const [schedule, timeOffRows] = await Promise.all([
      db.weeklySchedule.findUnique({
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
      }),
      db.timeOffRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: weekEnd },
          endDate: { gte: weekStart },
        },
        select: {
          nurseId: true,
          type: true,
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    if (!schedule) {
      return NextResponse.json(null);
    }

    const timeOff = timeOffRows.map((r) => ({
      nurseUserId: r.nurseId,
      type: r.type,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
    }));

    return NextResponse.json({ ...schedule, timeOff });
  } catch (error) {
    return handleApiError(error);
  }
}
