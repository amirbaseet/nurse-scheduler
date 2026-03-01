import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "./auth";

type Role = "MANAGER" | "NURSE";

/**
 * Auth guard for API routes.
 * Verifies JWT, fetches user from DB, checks role.
 * Returns the authenticated user or a JSON error response.
 */
export async function authGuard(role?: Role) {
  const user = await requireAuth();
  if (role) {
    requireRole(user, role);
  }
  return user;
}

/**
 * Wraps an API handler with consistent error handling.
 * Catches AuthError → proper status code, ZodError → 400, other → 500.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  // Zod validation error
  if (
    error instanceof Error &&
    error.name === "ZodError" &&
    "issues" in error
  ) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return NextResponse.json(
      {
        error: "נתונים לא תקינים",
        details: issues.map((i) => i.message).join(", "),
      },
      { status: 400 },
    );
  }

  console.error(
    "Unhandled API error:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json({ error: "שגיאת שרת פנימית" }, { status: 500 });
}
