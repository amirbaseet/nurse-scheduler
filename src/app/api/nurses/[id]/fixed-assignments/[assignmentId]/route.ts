import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; assignmentId: string } },
) {
  try {
    await authGuard("MANAGER");

    // Verify assignment exists and belongs to this nurse
    const assignment = await db.fixedAssignment.findFirst({
      where: { id: params.assignmentId, nurseId: params.id },
    });

    if (!assignment) {
      return apiError(API_ERRORS.FIXED_ASSIGNMENT_NOT_FOUND, 404);
    }

    await db.fixedAssignment.delete({
      where: { id: params.assignmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
