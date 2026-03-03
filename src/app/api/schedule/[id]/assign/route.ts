import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { assignScheduleSchema } from "@/lib/validations";
import { determineCorrectionType } from "@/lib/utils";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await authGuard("MANAGER");

    const body = await request.json();
    const input = assignScheduleSchema.parse(body);

    // Verify schedule exists
    const schedule = await db.weeklySchedule.findUnique({
      where: { id: params.id },
    });

    if (!schedule) {
      return apiError(API_ERRORS.SCHEDULE_NOT_FOUND, 404);
    }

    // Fetch original assignment
    const old = await db.scheduleAssignment.findUnique({
      where: { id: input.assignmentId },
    });

    if (!old || old.scheduleId !== params.id) {
      return apiError(API_ERRORS.ASSIGNMENT_NOT_FOUND, 404);
    }

    // Update the assignment
    const updated = await db.scheduleAssignment.update({
      where: { id: input.assignmentId },
      data: {
        nurseId: input.nurseId,
        primaryClinicId: input.primaryClinicId,
        secondaryClinicId: input.secondaryClinicId,
        shiftStart: input.shiftStart,
        shiftEnd: input.shiftEnd,
        notes: input.notes,
        modifiedBy: user.id,
        modifiedAt: new Date(),
      },
      include: { primaryClinic: true, secondaryClinic: true, nurse: true },
    });

    // Save correction for learning engine
    const nurseChanged = input.nurseId && input.nurseId !== old.nurseId;
    const clinicChanged =
      input.primaryClinicId && input.primaryClinicId !== old.primaryClinicId;
    const shiftChanged =
      (input.shiftStart && input.shiftStart !== old.shiftStart) ||
      (input.shiftEnd && input.shiftEnd !== old.shiftEnd);

    if (nurseChanged || clinicChanged || shiftChanged) {
      await db.scheduleCorrection.create({
        data: {
          scheduleId: old.scheduleId,
          day: old.day,
          originalNurseId: old.nurseId,
          originalClinicId: old.primaryClinicId ?? "",
          correctedNurseId: input.nurseId ?? old.nurseId,
          correctedClinicId: input.primaryClinicId ?? old.primaryClinicId,
          correctionType: determineCorrectionType(old, input),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
