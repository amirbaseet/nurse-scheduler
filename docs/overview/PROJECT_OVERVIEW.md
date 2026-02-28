# NurseScheduler Pro — Project Overview

## What Is This?
An automated weekly scheduling system for a medical clinic with 15 nurses
and 23 clinic types. Replaces a manual Excel process.

## Tech Stack
- **Frontend + Backend:** Next.js 14, TypeScript, App Router
- **Styling:** Tailwind CSS + shadcn/ui (RTL support for Hebrew/Arabic)
- **Database:** PostgreSQL (Neon free tier), Prisma ORM — SQLite for local dev
- **Auth:** PIN-based → bcrypt → JWT in httpOnly cookie
- **Hosting:** Vercel (free tier)
- **Package Manager:** pnpm

## Two User Roles
1. **Manager** (1 user, 6-digit PIN) — generates schedules, approves requests, assigns tasks
2. **Nurse** (15 users, 4-digit PIN) — views own schedule, submits requests/preferences

## Build Phases
```
Phase 5: Database + Auth + API routes
Phase 6: 9-layer scheduling algorithm
Phase 7: Manager web interface
Phase 8: Nurse mobile-first web interface
Phase 9: ML learning engine (optional for MVP)
Phase 10: Testing + deployment
```

## Key Business Rules
- All 15 nurses are female (confirmed from historical data)
- Manager is also a working nurse (self-schedules after generating for others)
- Some clinics require female nurses only (שד = FEMALE_ONLY)
- Nurses can work 2 clinics per day (primary + secondary)
- "+N" notation means patients to call (not clinic codes)
- מערך שד is a pure patient calling program (full day, no clinic)
- Wednesday is the hardest day (~10 nurses needed)
- Schedule generation must complete in < 3 seconds
- Both Hebrew and Arabic languages, RTL layout throughout
- Contract hours vary per nurse (8h to 40h/week) — NOT a simple full/part split
- 6 nurses are specialists (>50% in one clinic) — 2 of them are near-exclusive

## Important Data Notes
- Nurse data JSON does NOT contain gender, contractHours, or shiftPreference fields
  → These must be derived from historical patterns (see SEED_DATA.md mapping table)
- Two nurses share the first name "נסרין" (נסרין עלי and נסרין משני)
  → Always use full names everywhere
- Employment type in the data is unreliable (e.g., אינאס labeled full_time but works 18.5h/wk)
  → Use avg_weekly_hours as source of truth for contract hours

## Languages
- Primary: Hebrew (עברית) — all clinic names, nurse names
- Secondary: Arabic (العربية) — nurse names, UI labels
- Direction: RTL for both
