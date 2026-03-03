import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPin } from "@/lib/pin";
import { signJwt } from "@/lib/auth";
import { apiError, API_ERRORS } from "@/lib/api-errors";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 5;

// ═══════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════

export async function POST(request: Request) {
  // Parse body
  const body = await request.json().catch(() => null);
  if (!body?.pin || typeof body.pin !== "string") {
    return apiError(API_ERRORS.PIN_REQUIRED, 400);
  }

  const { pin } = body;

  // Validate PIN format: 4 digits (nurse) or 6 digits (manager)
  if (!/^\d{4}$/.test(pin) && !/^\d{6}$/.test(pin)) {
    return apiError(API_ERRORS.PIN_INVALID_FORMAT, 400);
  }

  // 1. Fast filter by pinPrefix (first 2 digits)
  const prefix = pin.substring(0, 2);
  const candidates = await db.user.findMany({
    where: { pinPrefix: prefix, isActive: true },
  });

  // 2. Check if ALL candidates are locked out (per-user DB-backed rate limiting)
  const now = new Date();
  const allLocked =
    candidates.length > 0 &&
    candidates.every(
      (c) =>
        c.failedAttempts >= MAX_ATTEMPTS &&
        c.lockedUntil &&
        c.lockedUntil > now,
    );

  if (allLocked) {
    return apiError(API_ERRORS.ACCOUNT_LOCKED, 429);
  }

  // 3. Verify PIN — bcrypt on all matching candidates (constant-time: no early exit)
  let matchedUser = null;
  for (const candidate of candidates) {
    // Skip locked-out candidates
    if (
      candidate.failedAttempts >= MAX_ATTEMPTS &&
      candidate.lockedUntil &&
      candidate.lockedUntil > now
    ) {
      continue;
    }

    const isMatch = await verifyPin(pin, candidate.pinHash);
    if (isMatch && !matchedUser) {
      matchedUser = candidate;
      // Don't break — verify remaining candidates to prevent timing attacks
    }
  }

  // If no candidates at all, do a dummy bcrypt to keep response time consistent
  if (candidates.length === 0) {
    await verifyPin(
      pin,
      "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012",
    );
  }

  // 4. No match — increment failedAttempts on all non-locked candidates
  if (!matchedUser) {
    const lockoutTime = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
    await Promise.all(
      candidates
        .filter(
          (c) =>
            !(
              c.failedAttempts >= MAX_ATTEMPTS &&
              c.lockedUntil &&
              c.lockedUntil > now
            ),
        )
        .map((c) =>
          db.user.update({
            where: { id: c.id },
            data: {
              failedAttempts: c.failedAttempts + 1,
              lockedUntil:
                c.failedAttempts + 1 >= MAX_ATTEMPTS ? lockoutTime : null,
            },
          }),
        ),
    );
    return apiError(API_ERRORS.PIN_WRONG, 401);
  }

  // 5. Match — reset failures, update lastLogin, issue JWT, set cookie

  await db.user.update({
    where: { id: matchedUser.id },
    data: { lastLogin: new Date(), failedAttempts: 0, lockedUntil: null },
  });

  const token = await signJwt({
    userId: matchedUser.id,
    role: matchedUser.role as "MANAGER" | "NURSE",
    name: matchedUser.name,
  });

  const redirect = matchedUser.role === "MANAGER" ? "/manager" : "/nurse";

  const response = NextResponse.json({
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      role: matchedUser.role,
    },
    redirect,
  });

  const isProduction = process.env.NODE_ENV === "production";
  const isSecure = isProduction || process.env.VERCEL === "1";

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    maxAge: 86400, // 24 hours
    path: "/",
  });

  return response;
}
