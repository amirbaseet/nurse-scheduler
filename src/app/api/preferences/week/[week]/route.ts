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

    const preferences = await db.weeklyPreference.findMany({
      where: { weekStart },
      include: { nurse: true },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    return handleApiError(error);
  }
}
