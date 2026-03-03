import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; dateId: string } },
) {
  try {
    await authGuard("MANAGER");

    const entry = await db.clinicMonthlyDate.findFirst({
      where: { id: params.dateId, clinicId: params.id },
    });

    if (!entry) {
      return apiError(API_ERRORS.MONTHLY_DATE_NOT_FOUND, 404);
    }

    await db.clinicMonthlyDate.delete({
      where: { id: params.dateId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
