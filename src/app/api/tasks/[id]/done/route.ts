import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function PUT(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await authGuard();

    const existing = await db.task.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
    }

    // Only the assigned nurse or any nurse (if isForAll) can mark done
    if (!existing.isForAll && existing.assignedToId !== user.id) {
      return NextResponse.json(
        { error: "אין הרשאה לסמן משימה זו" },
        { status: 403 },
      );
    }

    const task = await db.task.update({
      where: { id: params.id },
      data: { status: "DONE", completedAt: new Date() },
    });

    // Notify the task creator
    await db.notification.create({
      data: {
        userId: task.createdById,
        type: "task_completed",
        title: `${user.name} השלימ/ה: ${task.title}`,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error);
  }
}
