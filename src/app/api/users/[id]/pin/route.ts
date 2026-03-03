import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { changePinSchema } from "@/lib/validations";
import { hashPin, verifyPin } from "@/lib/pin";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { newPin } = changePinSchema.parse(body);

    const existing = await db.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return apiError(API_ERRORS.USER_NOT_FOUND, 404);
    }

    // Check PIN uniqueness
    const prefix = newPin.substring(0, 2);
    const candidates = await db.user.findMany({
      where: { pinPrefix: prefix, isActive: true, id: { not: params.id } },
    });

    for (const candidate of candidates) {
      const isMatch = await verifyPin(newPin, candidate.pinHash);
      if (isMatch) {
        return apiError(API_ERRORS.PIN_ALREADY_USED, 409);
      }
    }

    const pinHash = await hashPin(newPin);

    await db.user.update({
      where: { id: params.id },
      data: { pinHash, pinPrefix: prefix },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
