import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function PUT(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await authGuard();

    const task = await db.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
    }

    // Only the assigned nurse or any nurse (if isForAll) can complete
    if (!task.isForAll && task.assignedToId !== user.id) {
      return NextResponse.json(
        { error: "אין הרשאה לסמן משימה זו" },
        { status: 403 },
      );
    }

    const updated = await db.task.update({
      where: { id: params.id },
      data: {
        status: "DONE",
        completedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
