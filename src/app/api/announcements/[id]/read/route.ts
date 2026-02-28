import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authGuard();

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
