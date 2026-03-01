import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export type JwtPayload = {
  userId: string;
  role: "MANAGER" | "NURSE";
  name: string;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

// ═══════════════════════════════════════════
// JWT helpers (jose — works in Edge runtime)
// ═══════════════════════════════════════════

// Validate JWT_SECRET eagerly at module load (fails fast instead of during a request)
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW && process.env.NODE_ENV !== "test") {
  throw new Error(
    "JWT_SECRET environment variable is not set. " +
      "Add it to .env before starting the server.",
  );
}

function getSecret() {
  if (!JWT_SECRET_RAW) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(JWT_SECRET_RAW);
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    userId: payload.userId as string,
    role: payload.role as "MANAGER" | "NURSE",
    name: payload.name as string,
  };
}

// ═══════════════════════════════════════════
// Auth middleware for API routes
// ═══════════════════════════════════════════

/**
 * Read JWT from httpOnly cookie, verify it, fetch user from DB.
 * Throws AuthError (401/403) if anything fails.
 *
 * Usage in API routes:
 *   const user = await requireAuth();
 */
export async function requireAuth() {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    throw new AuthError("לא מחובר/ת", 401);
  }

  let payload: JwtPayload;
  try {
    payload = await verifyJwt(token);
  } catch {
    throw new AuthError("טוקן לא תקין", 401);
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { nurseProfile: true },
  });

  if (!user || !user.isActive) {
    throw new AuthError("משתמש לא נמצא או לא פעיל", 401);
  }

  return user;
}

/**
 * Check that a user has the required role.
 * Throws AuthError 403 if not.
 */
export function requireRole(user: { role: string }, role: "MANAGER" | "NURSE") {
  if (user.role !== role) {
    throw new AuthError("אין הרשאה מספקת", 403);
  }
}
