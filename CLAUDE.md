# NurseScheduler Pro

## Project Summary
Automated weekly scheduling system for a medical clinic.
15 nurses, 23 clinic types, Hebrew/Arabic bilingual, RTL layout.
Replaces manual Excel scheduling process.

## Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** SQLite (dev) → PostgreSQL/Neon (prod), Prisma ORM
- **Auth:** PIN → bcrypt → JWT (httpOnly cookie)
- **Hosting:** Vercel (free tier)
- **Package Manager:** pnpm

## Documentation — READ BEFORE EVERY TASK
All specs are in the `docs/` folder. Before working on ANY phase:
1. ALWAYS read `docs/overview/` first (5 files — project context, entities, permissions)
2. THEN read the specific `docs/phase{N}/` folder for the current task
3. Follow the specs EXACTLY — every field, every endpoint, every constraint

## Critical Rules — NEVER Violate These

### Data Rules
- nurse_profiles.json has NO gender, contractHours, or shiftPreference fields
  → Use the mapping table in docs/phase5-database/SEED_DATA.md (every value pre-computed)
- Two nurses share first name "נסרין" (נסרין עלי and נסרין משני)
  → ALWAYS use full names everywhere in code, UI, seed data, logs
- Employment type in data is unreliable (אינאס labeled full_time but works 18.5h/wk)
  → Use the contract hours from the mapping table, NOT from employment_type

### Schema Rules
- ClinicDefaultConfig = template (set once, used every week)
  ClinicWeeklyConfig = override (only when manager changes something for one week)
  → Algorithm merges them: weekly override wins, else use default
- FixedAssignment with weekStart = "1970-01-01T00:00:00.000Z" means PERMANENT (sentinel value)
  FixedAssignment with weekStart = specific Sunday means ONE WEEK ONLY
- JSON array fields (SQLite doesn't support arrays):
  Use parseJsonArray() to read, toJsonArray() to write
  See src/lib/json-arrays.ts utility documented in DATABASE_SCHEMA.md

### Auth Rules
- User.pinPrefix stores first 2 digits of PIN in plaintext for fast lookup
  → On login: filter by pinPrefix first (fast), THEN bcrypt.compare (slow) on 1-2 matches
  → This avoids O(n) bcrypt calls across all users
- Nurse PIN = 4 digits, Manager PIN = 6 digits
- JWT stored in httpOnly cookie (NOT localStorage)

### Algorithm Rules
- Scoring formula returns 0-1000 via RAW ADDITION (no multiplied weights)
  S_pref(0-350) + S_budget(0-250) + S_hist(0-150) + S_fair(0-150) + S_look(-100 to +100)
- Look-ahead checks max 5 future slots (not all remaining)
- Layer 5 (secondary clinics) tracks demand: secondaryNursesNeeded per clinic
  → Don't over-assign secondaries
- Manager is EXCLUDED from algorithm — self-schedules after via managerGaps

### API Route Rules
- NO route conflicts: use /api/schedule/nurse/me and /api/schedule/week/[week]
  (NOT /api/schedule/my and /api/schedule/[week] — Next.js can't distinguish them)
- 38 total endpoints documented in docs/phase5-database/API_ROUTES.md
- Every endpoint follows: auth → role check → Zod validate → Prisma query → notify → respond

### UI Rules
- RTL layout throughout (dir="rtl" on <html>)
- Tailwind logical properties: ms-/me-/ps-/pe-/text-start/text-end (NOT ml/mr/pl/pr)
- Hebrew primary, Arabic secondary — see docs/overview/TRANSLATIONS.md
- Manager = desktop-first (sidebar nav), Nurse = mobile-first (bottom nav, min 375px)
- All 15 nurses are female (confirmed from historical data)

## File Structure
```
nurse-scheduler/
├── prisma/schema.prisma          — Copy from docs/phase5-database/DATABASE_SCHEMA.md
├── prisma/seed.ts                — Follow docs/phase5-database/SEED_DATA.md
├── src/app/                      — Next.js pages (see docs/overview/PROJECT_STRUCTURE.md)
├── src/app/api/                  — 38 API routes (see docs/phase5-database/API_ROUTES.md)
├── src/algorithm/                — 9-layer engine (see docs/phase6-algorithm/)
├── src/lib/                      — Shared: db, auth, pin, json-arrays, validations
├── src/components/               — UI components
├── src/i18n/                     — he.json + ar.json
├── docs/                         — These spec files (read-only reference)
├── data/                         — Seed data JSON files
└── tests/                        — Algorithm + API tests
```

## Current Phase
Phase 5: Database + Auth + API Setup

## Testing
- Algorithm: 24 MUST-PASS + 11 SHOULD-PASS + 3 NICE-TO-HAVE (see docs/phase6-algorithm/TEST_CASES.md)
- Schedule generation must complete in < 3 seconds
- Quality score for normal week: 70+
