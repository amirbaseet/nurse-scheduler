import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { apiError, API_ERRORS } from "@/lib/api-errors";

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
      return apiError(API_ERRORS.TASK_NOT_FOUND, 404);
    }

    // Only the assigned nurse or any nurse (if isForAll) can mark done
    if (!existing.isForAll && existing.assignedToId !== user.id) {
      return apiError(API_ERRORS.TASK_NOT_AUTHORIZED, 403);
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
