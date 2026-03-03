import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { assignProgramSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const input = assignProgramSchema.parse(body);

    const weekStart = parseWeekParam(input.weekStart);

    if (!weekStart) {
      return apiError(API_ERRORS.INVALID_DATE, 400);
    }

    // Validate program and nurse exist
    const [program, nurse] = await Promise.all([
      db.patientProgram.findUnique({ where: { id: input.programId } }),
      db.user.findUnique({ where: { id: input.nurseId } }),
    ]);

    if (!program) {
      return apiError(API_ERRORS.PROGRAM_NOT_FOUND, 404);
    }

    if (!nurse || nurse.role !== "NURSE" || !nurse.isActive) {
      return apiError(API_ERRORS.NURSE_NOT_FOUND_OR_INACTIVE, 404);
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
