import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validations";
import { hashPin } from "@/lib/pin";
import { verifyPin } from "@/lib/pin";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const users = await db.user.findMany({
      include: { nurseProfile: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const input = createUserSchema.parse(body);

    // Validate PIN length matches role
    if (input.role === "NURSE" && input.pin.length !== 4) {
      return NextResponse.json(
        { error: "PIN של אחות חייב להיות 4 ספרות" },
        { status: 400 }
      );
    }
    if (input.role === "MANAGER" && input.pin.length !== 6) {
      return NextResponse.json(
        { error: "PIN של מנהלת חייב להיות 6 ספרות" },
        { status: 400 }
      );
    }

    // Check PIN uniqueness: find all users with same prefix, verify no collision
    const prefix = input.pin.substring(0, 2);
    const candidates = await db.user.findMany({
      where: { pinPrefix: prefix, isActive: true },
    });

    for (const candidate of candidates) {
      const isMatch = await verifyPin(input.pin, candidate.pinHash);
      if (isMatch) {
        return NextResponse.json(
          { error: "קוד PIN כבר בשימוש" },
          { status: 409 }
        );
      }
    }

    const pinHash = await hashPin(input.pin);

    const user = await db.user.create({
      data: {
        name: input.name,
        nameAr: input.nameAr,
        role: input.role,
        pinHash,
        pinPrefix: prefix,
        phone: input.phone,
      },
    });

    await db.nurseProfile.create({
      data: {
        userId: user.id,
        gender: input.gender,
        contractHours: input.contractHours,
      },
    });

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: { nurseProfile: true },
    });

    return NextResponse.json(fullUser, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
