import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createFixedAssignmentSchema } from "@/lib/validations";

const PERMANENT_SENTINEL = new Date("1970-01-01T00:00:00.000Z");

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { clinicId, day, weekStart } = createFixedAssignmentSchema.parse(body);

    // Check nurse exists
    const nurse = await db.nurseProfile.findUnique({
      where: { id: params.id },
    });
    if (!nurse) {
      return NextResponse.json({ error: "אחות לא נמצאה" }, { status: 404 });
    }

    // Check clinic exists
    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
    });
    if (!clinic) {
      return NextResponse.json({ error: "מרפאה לא נמצאה" }, { status: 404 });
    }

    const resolvedWeekStart = weekStart
      ? new Date(weekStart + "T00:00:00.000Z")
      : PERMANENT_SENTINEL;

    // Check for duplicate
    const existing = await db.fixedAssignment.findUnique({
      where: {
        nurseId_clinicId_day_weekStart: {
          nurseId: params.id,
          clinicId,
          day,
          weekStart: resolvedWeekStart,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "שיבוץ קבוע זהה כבר קיים" },
        { status: 409 },
      );
    }

    const assignment = await db.fixedAssignment.create({
      data: {
        nurseId: params.id,
        clinicId,
        day,
        weekStart: resolvedWeekStart,
      },
      include: { clinic: true },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
