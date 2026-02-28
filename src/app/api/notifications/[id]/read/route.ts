import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authGuard();

    const notification = await db.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification || notification.userId !== user.id) {
      return NextResponse.json(
        { error: "התראה לא נמצאה" },
        { status: 404 }
      );
    }

    await db.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
