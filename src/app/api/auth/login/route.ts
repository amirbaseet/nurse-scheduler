import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPin } from "@/lib/pin";
import { signJwt } from "@/lib/auth";

// ═══════════════════════════════════════════
// In-memory rate limiting (per IP)
// In production, use Redis or a proper rate limiter.
// ═══════════════════════════════════════════

const failedAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

function isLockedOut(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record || record.count < MAX_ATTEMPTS) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return true;
}

function recordFailure(ip: string): void {
  const record = failedAttempts.get(ip);
  if (record && Date.now() - record.lastAttempt < LOCKOUT_MS) {
    record.count++;
    record.lastAttempt = Date.now();
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: Date.now() });
  }
}

function resetFailures(ip: string): void {
  failedAttempts.delete(ip);
}

// ═══════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // 1. Rate limit check
  if (isLockedOut(ip)) {
    return NextResponse.json(
      { error: "נחסמת ל-5 דקות עקב ניסיונות כושלים" },
      { status: 429 }
    );
  }

  // Parse body
  const body = await request.json().catch(() => null);
  if (!body?.pin || typeof body.pin !== "string") {
    return NextResponse.json(
      { error: "יש להזין קוד PIN" },
      { status: 400 }
    );
  }

  const { pin } = body;

  // Validate PIN format: 4 digits (nurse) or 6 digits (manager)
  if (!/^\d{4}$/.test(pin) && !/^\d{6}$/.test(pin)) {
    return NextResponse.json(
      { error: "קוד PIN חייב להיות 4 או 6 ספרות" },
      { status: 400 }
    );
  }

  // 2. Fast filter by pinPrefix (first 2 digits)
  const prefix = pin.substring(0, 2);
  const candidates = await db.user.findMany({
    where: { pinPrefix: prefix, isActive: true },
  });

  // 3. Verify PIN — bcrypt only on 1-2 matching candidates
  let matchedUser = null;
  for (const candidate of candidates) {
    const isMatch = await verifyPin(pin, candidate.pinHash);
    if (isMatch) {
      matchedUser = candidate;
      break;
    }
  }

  // 4. No match
  if (!matchedUser) {
    recordFailure(ip);
    return NextResponse.json(
      { error: "קוד PIN שגוי" },
      { status: 401 }
    );
  }

  // 5. Match — update lastLogin, issue JWT, set cookie
  resetFailures(ip);

  await db.user.update({
    where: { id: matchedUser.id },
    data: { lastLogin: new Date(), failedAttempts: 0 },
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

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 86400, // 24 hours
    path: "/",
  });

  return response;
}
