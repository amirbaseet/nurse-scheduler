import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { parseWeekParam } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: { week: string } }
) {
  try {
    const user = await authGuard();
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    const preference = await db.weeklyPreference.findUnique({
      where: {
        nurseId_weekStart: {
          nurseId: user.id,
          weekStart,
        },
      },
    });

    return NextResponse.json(preference);
  } catch (error) {
    return handleApiError(error);
  }
}
