import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validations";
import { hashPin } from "@/lib/pin";
import { verifyPin } from "@/lib/pin";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        nameAr: true,
        role: true,
        phone: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        nurseProfile: true,
        // pinHash and pinPrefix intentionally excluded
      },
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
      return apiError(API_ERRORS.NURSE_PIN_MUST_BE_4, 400);
    }
    if (input.role === "MANAGER" && input.pin.length !== 6) {
      return apiError(API_ERRORS.MANAGER_PIN_MUST_BE_6, 400);
    }

    // Check PIN uniqueness: find all users with same prefix, verify no collision
    const prefix = input.pin.substring(0, 2);
    const candidates = await db.user.findMany({
      where: { pinPrefix: prefix, isActive: true },
    });

    for (const candidate of candidates) {
      const isMatch = await verifyPin(input.pin, candidate.pinHash);
      if (isMatch) {
        return apiError(API_ERRORS.PIN_ALREADY_USED, 409);
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
      select: {
        id: true,
        name: true,
        nameAr: true,
        role: true,
        phone: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        nurseProfile: true,
      },
    });

    return NextResponse.json(fullUser, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
