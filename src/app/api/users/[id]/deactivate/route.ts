import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { apiError, API_ERRORS } from "@/lib/api-errors";

const cuidParam = z.string().cuid();

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    if (!cuidParam.safeParse(params.id).success) {
      return apiError(API_ERRORS.INVALID_ID, 400);
    }

    const existing = await db.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return apiError(API_ERRORS.USER_NOT_FOUND, 404);
    }

    // Only allow toggling nurses — managers cannot be deactivated via this endpoint
    if (existing.role === "MANAGER") {
      return apiError(API_ERRORS.CANNOT_DEACTIVATE_MANAGER, 403);
    }

    // Toggle: if body has isActive, use it; otherwise deactivate (backwards compatible)
    let newIsActive = false;
    try {
      const body = await request.json();
      if (typeof body.isActive === "boolean") {
        newIsActive = body.isActive;
      }
    } catch {
      // No body or invalid JSON → default to deactivate
    }

    const updated = await db.user.update({
      where: { id: params.id },
      data: { isActive: newIsActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({ success: true, isActive: updated.isActive });
  } catch (error) {
    return handleApiError(error);
  }
}
