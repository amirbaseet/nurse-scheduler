import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { assignProgramSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const input = assignProgramSchema.parse(body);

    const weekStart = parseWeekParam(input.weekStart);

    if (!weekStart) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    const assignment = await db.programAssignment.create({
      data: {
        programId: input.programId,
        nurseId: input.nurseId,
        weekStart,
        day: input.day,
        patientCount: input.patientCount,
        shiftStart: input.shiftStart,
        shiftEnd: input.shiftEnd,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
