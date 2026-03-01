import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createAnnouncementSchema } from "@/lib/validations";
import { parseJsonArray, toJsonArray } from "@/lib/json-arrays";

export async function GET() {
  try {
    const user = await authGuard();

    // Fetch non-expired announcements, then filter targeting in memory
    // (SQLite stores targetNurseIds as JSON string — `contains` does LIKE match which is unsafe)
    const allAnnouncements = await db.announcement.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        author: true,
        reads: { where: { userId: user.id } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter: targetAll OR user.id is in the parsed JSON array
    const targeted = allAnnouncements.filter(
      (a) => a.targetAll || parseJsonArray(a.targetNurseIds).includes(user.id),
    );

    // Add computed isRead field
    const withReadStatus = targeted.map(({ reads, ...rest }) => ({
      ...rest,
      isRead: reads.length > 0,
    }));

    return NextResponse.json(withReadStatus);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authGuard("MANAGER");

    const body = await request.json();
    const input = createAnnouncementSchema.parse(body);

    // Validate target nurse IDs exist
    if (input.targetNurseIds && input.targetNurseIds.length > 0) {
      const nurses = await db.user.findMany({
        where: { id: { in: input.targetNurseIds } },
        select: { id: true },
      });
      if (nurses.length !== input.targetNurseIds.length) {
        return NextResponse.json(
          { error: "אחת או יותר מהאחיות לא נמצאו" },
          { status: 400 },
        );
      }
    }

    const announcement = await db.announcement.create({
      data: {
        authorId: user.id,
        title: input.title,
        body: input.body,
        priority: input.priority,
        targetAll: input.targetAll,
        targetNurseIds: input.targetNurseIds
          ? toJsonArray(input.targetNurseIds)
          : "[]",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    // Notify targets
    const targets = input.targetAll
      ? await db.user.findMany({
          where: { role: "NURSE", isActive: true },
        })
      : input.targetNurseIds
        ? await db.user.findMany({
            where: { id: { in: input.targetNurseIds } },
          })
        : [];

    if (targets.length > 0) {
      const prefix = input.priority === "URGENT" ? "🔴 " : "";
      await db.notification.createMany({
        data: targets.map((nurse) => ({
          userId: nurse.id,
          type: "new_announcement",
          title: `${prefix}${input.title}`,
          link: "/nurse/announcements",
        })),
      });
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
