# Authentication System — FIXED

## Overview
PIN-based login → pinPrefix filter → bcrypt verify → JWT token → httpOnly cookie

## PIN Rules
- Nurse: 4-digit PIN (e.g., "3847")
- Manager: 6-digit PIN (e.g., "482917")
- All PINs hashed with bcrypt (10 rounds)
- Each PIN must be unique across all users
- pinPrefix (first 2 digits) stored in plaintext for fast lookup

## Login Flow (FIXED: uses pinPrefix to avoid O(n) bcrypt)

```
POST /api/auth/login
  Input:  { pin: string }
  
  1. Rate limit check:
     IF user IP has 3+ failed attempts in last 5 min → return 429 "Locked for 5 minutes"
  
  2. Fast filter by pinPrefix:
     prefix = pin.substring(0, 2)
     candidates = DB.user.findMany({
       where: { pinPrefix: prefix, isActive: true }
     })
     // Typically 1-2 users match → only 1-2 bcrypt calls (~200ms max)
  
  3. Verify PIN:
     FOR EACH candidate:
       IF bcrypt.compare(pin, candidate.pinHash):
         matchedUser = candidate
         BREAK
  
  4. If no match:
     Increment failed attempts for this IP
     Return 401 { error: "PIN incorrect" }
  
  5. If match:
     Reset failed attempts to 0
     Update lastLogin = now()
     Generate JWT: { userId, role, name } signed with JWT_SECRET, expires 24h
     Set httpOnly cookie: "token" = JWT
       Options: { httpOnly: true, secure: true, sameSite: "strict", maxAge: 86400 }
     Return { user: { id, name, role }, redirect: role == "MANAGER" ? "/manager" : "/nurse" }
```

## Logout Flow
```
POST /api/auth/logout
  1. Clear "token" cookie (set maxAge=0)
  2. Return { success: true }
```

## JWT Token
- Library: jose (works in Edge runtime, NOT jsonwebtoken)
- Payload: { userId: string, role: "MANAGER" | "NURSE", name: string }
- Secret: JWT_SECRET env variable (64+ character random string)
- Expiry: 24 hours

## Middleware (src/lib/auth.ts)
```typescript
// requireAuth(request) → returns user or throws 401
//   1. Read "token" cookie from request
//   2. Verify JWT with jose.jwtVerify()
//   3. Fetch user from DB by userId (include nurseProfile)
//   4. If user not found or not active → throw 401
//   5. Return user object with nurseProfile

// requireRole(user, "MANAGER") → throws 403 if wrong role
```

## Next.js Middleware (src/middleware.ts)
```
Protected routes:
  /nurse/*    → must be NURSE or MANAGER
  /manager/*  → must be MANAGER only
  /api/* (except /api/auth/*) → must be logged in

Unprotected routes:
  /           → login page
  /api/auth/* → login/logout endpoints

On auth failure: redirect to / with 302
```

## Security
- PINs hashed with bcrypt (10 rounds)
- pinPrefix stored plaintext (only 2 digits — not a security risk, just optimization)
- JWT in httpOnly cookie (NOT localStorage — prevents XSS)
- Cookie flags: httpOnly, secure, sameSite=strict
- 3 failed attempts → 5 minute lockout (tracked per IP in memory or DB)
- HTTPS enforced (Vercel provides this)

## Environment Variables
```
JWT_SECRET="generate-a-random-64-char-string-here"
JWT_EXPIRES_IN="24h"
```
