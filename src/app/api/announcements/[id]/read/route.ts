import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authGuard();

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
      update: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
