import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createTaskSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const tasks = await db.task.findMany({
      include: { assignedTo: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authGuard("MANAGER");

    const body = await request.json();
    const input = createTaskSchema.parse(body);

    // If not for all, assignedToId is required
    if (!input.isForAll && !input.assignedToId) {
      return NextResponse.json(
        { error: "יש לבחור אחות או לסמן כמשימה לכולן" },
        { status: 400 },
      );
    }

    // Validate assignee exists and is an active nurse
    if (input.assignedToId) {
      const assignee = await db.user.findUnique({
        where: { id: input.assignedToId },
      });
      if (!assignee || assignee.role !== "NURSE" || !assignee.isActive) {
        return NextResponse.json(
          { error: "אחות לא נמצאה או לא פעילה" },
          { status: 400 },
        );
      }
    }

    const dueDate = input.dueDate ? parseWeekParam(input.dueDate) : undefined;

    const task = await db.task.create({
      data: {
        title: input.title,
        description: input.description,
        assignedToId: input.assignedToId,
        isForAll: input.isForAll,
        dueDate: dueDate ?? undefined,
        priority: input.priority,
        createdById: user.id,
        status: "PENDING",
      },
    });

    // Notifications
    if (input.isForAll) {
      const nurses = await db.user.findMany({
        where: { role: "NURSE", isActive: true },
      });

      await db.notification.createMany({
        data: nurses.map((nurse) => ({
          userId: nurse.id,
          type: "task_assigned",
          title: `משימה חדשה: ${input.title}`,
        })),
      });
    } else if (input.assignedToId) {
      await db.notification.create({
        data: {
          userId: input.assignedToId,
          type: "task_assigned",
          title: `משימה חדשה: ${input.title}`,
        },
      });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
