import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await authGuard();

    // Verify announcement exists and is targeted at this user
    const announcement = await db.announcement.findUnique({
      where: { id: params.id },
    });

    if (!announcement) {
      return apiError(API_ERRORS.ANNOUNCEMENT_NOT_FOUND, 404);
    }

    if (
      !announcement.targetAll &&
      !announcement.targetNurseIds.includes(user.id)
    ) {
      return apiError(API_ERRORS.ANNOUNCEMENT_NOT_AUTHORIZED, 403);
    }

    // Upsert to handle duplicate reads gracefully
    await db.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: params.id,
          userId: user.id,
        },
      },
      create: {
        announcementId: params.id,
        userId: user.id,
      },
      update: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
