import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF protection: verify Origin header on state-changing API requests
  if (
    pathname.startsWith("/api/") &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.endsWith(host)) {
      return NextResponse.json(
        { error: "Cross-origin request blocked" },
        { status: 403 },
      );
    }
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // /manager/* requires MANAGER role
    if (
      pathname.startsWith("/manager") ||
      pathname.startsWith("/api/manager")
    ) {
      if (payload.role !== "MANAGER") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "טוקן לא תקין" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
}

// Only protect these paths — login page and auth endpoints stay open
export const config = {
  matcher: ["/nurse/:path*", "/manager/:path*", "/api/((?!auth/).*)"],
};
