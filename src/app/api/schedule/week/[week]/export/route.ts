import { NextResponse } from "next/server";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    await authGuard("MANAGER");

    // STUB: Excel export will be implemented later (requires xlsx library)
    return NextResponse.json(
      { error: "ייצוא אקסל עדיין לא מיושם" },
      { status: 501 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
