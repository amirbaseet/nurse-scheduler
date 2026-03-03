import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    const existing = await db.timeOffRequest.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return apiError(API_ERRORS.REQUEST_NOT_FOUND, 404);
    }

    await db.timeOffRequest.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
