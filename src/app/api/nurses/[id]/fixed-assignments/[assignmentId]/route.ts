import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

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
      return NextResponse.json(
        { error: "שיבוץ קבוע לא נמצא" },
        { status: 404 },
      );
    }

    await db.fixedAssignment.delete({
      where: { id: params.assignmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
