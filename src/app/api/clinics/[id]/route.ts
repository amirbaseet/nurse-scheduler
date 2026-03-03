import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { updateClinicSchema } from "@/lib/validations";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const input = updateClinicSchema.parse(body);

    const existing = await db.clinic.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return apiError(API_ERRORS.CLINIC_NOT_FOUND, 404);
    }

    const updated = await db.clinic.update({
      where: { id: params.id },
      data: input,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
