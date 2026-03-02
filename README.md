# NurseScheduler Pro

Automated weekly scheduling system for a medical clinic.
15 nurses, 23 clinic types, Hebrew/Arabic bilingual, RTL layout.
Replaces manual Excel scheduling with a 9-layer algorithm engine.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Docker Deployment](#docker-deployment)
- [Local Development](#local-development)
- [Database Schema (17 models)](#database-schema-17-models)
- [Authentication System](#authentication-system)
- [API Routes (44 endpoints)](#api-routes-44-endpoints)
- [Scheduling Algorithm (9 layers)](#scheduling-algorithm-9-layers)
- [Learning Engine](#learning-engine)
- [Manager UI (Desktop)](#manager-ui-desktop)
- [Nurse UI (Mobile)](#nurse-ui-mobile)
- [Internationalization](#internationalization-hebrarabic)
- [Testing](#testing)
- [Recent Features](#recent-features)
- [File Structure](#file-structure)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Database | PostgreSQL 16 via Prisma ORM |
| Auth | PIN → bcrypt → JWT (httpOnly cookie) |
| Drag & Drop | @dnd-kit/core |
| Excel Export | ExcelJS (RTL, 2 rows per nurse) |
| Package Manager | pnpm |
| Deployment | Docker Compose (3-stage build) |

---

## Architecture

```
┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│   App :3000  │
│  (RTL UI)    │     │  (Next.js)   │
└──────────────┘     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   DB :5432   │
                     │ (PostgreSQL) │
                     └──────────────┘
```

**Security:**
- App runs as non-root user (`nextjs`, UID 1001)
- DB port NOT exposed externally
- `no-new-privileges` on both containers
- Resource limits: App 1GB/1CPU, DB 512MB/0.5CPU
- CSRF protection via Origin/Host header validation on all mutations
- JWT in httpOnly cookie (not localStorage)
- Account lockout after 3 failed PIN attempts (5-minute cooldown)

---

## Docker Deployment

### Prerequisites

- Docker Engine 20+ and Docker Compose v2

### 1. Create environment file

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

```env
POSTGRES_DB=nurse_scheduler
POSTGRES_USER=nurse_app
POSTGRES_PASSWORD=<generate a strong password>
JWT_SECRET=<generate with: openssl rand -hex 64>
APP_PORT=3000
SEED_ON_STARTUP=true
```

### 2. Build and start

```bash
docker compose --env-file .env.production up -d --build
```

This will:
1. Start PostgreSQL 16 and wait until healthy
2. Build the Next.js app (3-stage Docker build)
3. Run database migrations
4. Seed all nurse/clinic data (if `SEED_ON_STARTUP=true`)
5. Start the server

### 3. Verify

```bash
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

### 4. Disable seeding after first run

```bash
# In .env.production, set:
SEED_ON_STARTUP=false

# Then restart:
docker compose --env-file .env.production up -d
```

### Seeded Data

| Entity | Count | Details |
|--------|-------|---------|
| Users | 16 | 1 manager + 15 nurses |
| Clinics | 23 | All types with Hebrew/Arabic names |
| Default Configs | 78 | Weekly clinic scheduling templates |
| Fixed Assignments | 29 | Permanent nurse-clinic assignments |
| Patient Programs | 4 | Breast unit, diabetes, heart failure, sugar load |
| Sample Schedule | 1 | Published week with 105 assignments |
| Time-Off Requests | 2 | Sample vacation + day off |

### Login PINs

PINs are in `.env.seed` (copied into the Docker image at build time).

- **Manager:** 6-digit PIN (`MANAGER_PIN`)
- **Nurses:** 4-digit PINs (`NURSE_PINS`, comma-separated)

Nurse order: כתיבה, נגלא, נידאל, רבחייה, היא, אינאס, רוואא, הדיל, סאנדי, נסרין-עלי, נסרין-משני, עלאא, גמילה, אנוואר, רוואן

### Common Operations

```bash
# View logs
docker compose --env-file .env.production logs app -f

# Stop
docker compose --env-file .env.production down

# Stop and delete all data
docker compose --env-file .env.production down -v

# Rebuild after code changes
docker compose --env-file .env.production up -d --build

# Run migrations only
docker compose --env-file .env.production exec app npx prisma migrate deploy
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `POSTGRES_PASSWORD is missing` | Create `.env.production` from the example |
| `Authentication failed` on DB | Delete volume: `docker compose down -v` then `up -d` |
| Health check failing | Check logs: `docker compose logs app --tail 50` |
| Port 3000 in use | Set `APP_PORT=3001` in `.env.production` |

---

## Local Development

```bash
pnpm install
cp .env.example .env    # SQLite for local dev
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                # http://localhost:3000
```

---

## Database Schema (17 models)

All models in `prisma/schema.prisma`, managed via Prisma ORM on PostgreSQL.

### Core Models

| Model | Purpose |
|-------|---------|
| `User` | Auth entity — name (he/ar), role (MANAGER/NURSE), pinHash, pinPrefix, failedAttempts, lockedUntil |
| `NurseProfile` | Work attributes — gender, contractHours (8–40), shiftPreference, canWorkFriday/Saturday, maxDaysPerWeek, recurringOffDays |
| `Clinic` | 23 clinic types — name (he/ar), code, genderPref (FEMALE_ONLY/FEMALE_PREFERRED/ANY), canBeSecondary, secondaryNursesNeeded |

### Schedule Configuration

| Model | Purpose |
|-------|---------|
| `ClinicDefaultConfig` | Template: per-clinic per-day schedule (shiftStart, shiftEnd, nursesNeeded). Set once, used every week. |
| `ClinicWeeklyConfig` | Override: per-clinic per-day per-week. Only created when manager changes something for one specific week. Algorithm merges: weekly override wins, else default. |
| `NurseBlockedClinic` | Nurse cannot work at certain clinics |
| `FixedAssignment` | Permanent (`weekStart = 1970-01-01` sentinel) or one-week-only nurse-clinic locks |
| `PatientProgram` | Programs: PURE_PROGRAM or CLINIC_ADDON (breast unit, diabetes, heart failure, sugar load) |
| `ProgramAssignment` | Nurse assigned to a program for a specific week + day |

### Schedule Output

| Model | Purpose |
|-------|---------|
| `WeeklySchedule` | One record per week — status (DRAFT/GENERATED/PUBLISHED/ARCHIVED), qualityScore |
| `ScheduleAssignment` | Per-nurse per-day cell — primaryClinic, secondaryClinic, shiftStart/End, hours, isOff, isFixed, isManagerSelf, modifiedBy |

### Operational

| Model | Purpose |
|-------|---------|
| `TimeOffRequest` | Vacation/sick/personal/off-day — status (PENDING/APPROVED/REJECTED), `createdById` for manager-recorded absences |
| `WeeklyPreference` | Nurse's weekly shift/day/clinic preferences |
| `Task` | Tasks assigned to individual nurses or all |
| `Announcement` + `AnnouncementRead` | Manager announcements with per-nurse read tracking |
| `Notification` | Per-user in-app notifications |
| `ScheduleCorrection` | Learning engine — tracks manager edits for probability adjustment |

### Migrations

| Migration | Change |
|-----------|--------|
| `20260301132827_init_postgresql` | Full initial schema |
| `20260302120000_add_created_by_to_time_off` | Added `createdById` to `TimeOffRequest` |

---

## Authentication System

### Flow

```
PIN input → extract pinPrefix (first 2 digits)
         → query users by pinPrefix (fast, no bcrypt)
         → bcrypt.compare on 1-2 matches only
         → JWT signed with jose → httpOnly cookie (24h)
```

- **PIN-prefix lookup** avoids O(n) bcrypt calls. First 2 digits in plaintext for fast filter, then bcrypt on 1-2 candidates.
- **Nurse PIN:** 4 digits. **Manager PIN:** 6 digits.
- **Lockout:** 3 failed attempts → 5-minute lock.
- **Middleware** (`src/middleware.ts`): CSRF + JWT + role enforcement on `/nurse/*`, `/manager/*`, `/api/*` (excluding `/api/auth/` and `/api/health`).

### Files

| File | Purpose |
|------|---------|
| `src/lib/pin.ts` | `hashPin()`, `verifyPin()` via bcryptjs |
| `src/lib/auth.ts` | `signJwt()`, `verifyJwt()`, `requireAuth()`, `requireRole()` |
| `src/lib/permissions.ts` | `authGuard(role?)`, `handleApiError()` |
| `src/middleware.ts` | CSRF + JWT + role middleware |

---

## API Routes (44 endpoints)

### Auth (2)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/login` | PIN login → JWT cookie |
| POST | `/api/auth/logout` | Clear JWT cookie |

### Health (1)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | `{"status":"ok"}` |

### Schedule (8)

| Method | Route | Access | Purpose |
|--------|-------|--------|---------|
| POST | `/api/schedule/generate` | Manager | Run 9-layer algorithm |
| GET | `/api/schedule/week/[week]` | Manager | Fetch schedule + assignments + time-off overlaps |
| GET | `/api/schedule/week/[week]/export` | Manager | Excel export (RTL) |
| PUT | `/api/schedule/[id]/publish` | Manager | Publish + notify nurses |
| PUT | `/api/schedule/[id]/assign` | Manager | Edit assignment (tracks correction) |
| PUT | `/api/schedule/[id]/self-assign` | Manager | Self-assign to gaps |
| GET | `/api/schedule/nurse/me` | Nurse | Current week schedule |
| GET | `/api/schedule/nurse/me/[week]` | Nurse | Specific week schedule |

### Nurses (3)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/nurses` | List all nurse profiles |
| GET/PATCH | `/api/nurses/[id]` | Get/update nurse profile |
| PUT | `/api/nurses/[id]/blocked-clinics` | Set blocked clinics |

### Clinics (6)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/clinics` | List/create clinics |
| GET/PATCH | `/api/clinics/[id]` | Get/update clinic |
| GET/PUT | `/api/clinics/config/defaults` | Default weekly config |
| GET/PUT | `/api/clinics/config/[week]` | Weekly override config |
| POST | `/api/clinics/config/copy` | Copy config between weeks |

### Programs (4)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/programs` | List/create programs |
| GET/PATCH | `/api/programs/[id]` | Get/update program |
| POST/DELETE | `/api/programs/assign` | Assign/remove nurse from program |

### Time-Off Requests (8)

| Method | Route | Access | Purpose |
|--------|-------|--------|---------|
| GET/POST | `/api/requests` | Nurse | List own / submit new |
| GET | `/api/requests/my` | Nurse | Own requests |
| GET | `/api/requests/pending` | Manager | All pending |
| GET | `/api/requests/history` | Manager | All resolved (approved/rejected) |
| POST | `/api/requests/record` | Manager | Record absence directly (auto-approved) |
| PUT | `/api/requests/[id]/approve` | Manager | Approve + optional note |
| PUT | `/api/requests/[id]/reject` | Manager | Reject + optional note |
| DELETE | `/api/requests/[id]/delete` | Manager | Delete request |

### Reports (1)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/reports/absences?month=YYYY-MM` | Per-nurse monthly absence breakdown |

### Preferences (3)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/preferences` | Submit weekly preferences |
| GET | `/api/preferences/my/[week]` | Own preferences for a week |
| GET | `/api/preferences/week/[week]` | All nurse preferences (manager) |

### Tasks (4)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/tasks` | List all / create (manager) |
| GET | `/api/tasks/my` | My tasks (nurse) |
| PUT | `/api/tasks/[id]/done` | Mark done |

### Announcements (2)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/announcements` | List / create |
| POST | `/api/announcements/[id]/read` | Mark as read |

### Notifications (2)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/notifications` | List unread |
| PUT | `/api/notifications/[id]/read` | Mark read |

### Users (3)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/users` | List/create users |
| PUT | `/api/users/[id]/pin` | Reset PIN |
| PUT | `/api/users/[id]/deactivate` | Deactivate user |

---

## Scheduling Algorithm (9 layers)

Located in `src/algorithm/`. Deterministic pipeline transforming configuration into a complete weekly schedule.

### Input/Output

- **Input:** `AlgorithmConfig` — nurses, clinics (merged default + weekly), time-off, fixed assignments, programs, preferences, learning probabilities, correction adjustments.
- **Output:** `ScheduleResult` — assignments[], warnings[], qualityScore (0-100), managerGaps[] (unfilled slots for self-scheduling).

### Layer Pipeline

| # | Layer | File | Purpose |
|---|-------|------|---------|
| 1 | Block | `layers/1-block.ts` | Block unavailable cells: approved time-off, recurringOffDays, Fri/Sat restrictions, historical off-day patterns |
| 2 | Fixed | `layers/2-fixed.ts` | Place fixed/locked assignments (permanent + week-specific). Handle program time. Deduct budget. |
| 3 | Gender | `layers/3-gender.ts` | Fill FEMALE_ONLY clinics with high-probability female nurses |
| 4 | Primary | `layers/4-primary.ts` | Fill remaining primary slots via scoring + difficulty queue (hardest-first) |
| 5 | Secondary | `layers/5-secondary.ts` | Stack secondary clinic roles on primaries (tracks demand per clinic) |
| 6 | Programs | `layers/6-programs.ts` | Assign patient call addons (CLINIC_ADDON type) |
| 7 | Gap Fill | `layers/7-gap-fill.ts` | Extend shifts for under-budget nurses (max 2h/day, 8h/shift) |
| 8 | Off Days | `layers/8-off-days.ts` | Mark remaining AVAILABLE cells as OFF |
| 9 | Optimize | `layers/9-optimize.ts` | Simulated annealing: 10K iterations of same-day swaps |

### Scoring (0-1300, raw addition)

| Component | Range | Measures |
|-----------|-------|----------|
| S_hist | 0-400 | Historical probability from learning model |
| S_pref | 0-300 | Shift preference match |
| S_budget | 0-200 | Remaining budget vs contract hours |
| S_fair | 0-100 | Fairness — penalizes over-worked nurses |
| S_specialist | 0-200 | Specialist affinity bonus |
| S_dayAffinity | 0-200 | Day-of-week affinity from history |

### Quality Score (0-100)

Starts at 100. Deductions: preference mismatch (-5), day-off violations (-3), unfilled slots (-10), fairness deviation (-2/stddev).

### Supporting Modules

| File | Purpose |
|------|---------|
| `scoring.ts` | `calculateScore()` + `calculateQualityScore()` |
| `converters.ts` | DB-to-algorithm conversions, `mergeClinicConfigs()` |
| `difficulty-queue.ts` | Priority queue: fewest candidates first |
| `look-ahead.ts` | Checks 5 future slots for dead-ends |
| `backtrack.ts` | Recovers 0-candidate situations via swaps |

### Performance

- Full generation: **< 3 seconds**
- Quality for normal week: **> 70**

---

## Learning Engine

Located in `src/learning/` with pre-built models in `data/models/`.

### Models (5 JSON files)

| File | Contents |
|------|----------|
| `probability-matrix.json` | P(clinic | nurse, day) probabilities |
| `shift-preferences.json` | Per-nurse morning/afternoon breakdown |
| `off-day-patterns.json` | P(off | nurse, day) patterns |
| `dual-clinic-combos.json` | Common primary + secondary combinations |
| `meta.json` | `totalWeeks` used to build models |

### Runtime

| File | Purpose |
|------|---------|
| `src/learning/models.ts` | `loadModels()`, `getProb()`, `getHighConfidenceAssignments()`, `getDayAffinity()` |
| `src/learning/corrections.ts` | Reads `ScheduleCorrection` records → multipliers: 3+ removals = x0.8, 3+ additions = x1.2 |

### Rebuild

`scripts/rebuild-models.ts` — Rebuilds from 51 weeks of historical data in `data/weekly_schedules.json`.

---

## Manager UI (Desktop)

Desktop-first with sidebar navigation. Located in `src/app/manager/`.

### Screens

| Screen | Path | Key Features |
|--------|------|-------------|
| Dashboard | `/manager` | Pending actions, this-week stats |
| Schedule Grid | `/manager/schedule` | Nurse x Day grid, drag-and-drop, week navigator, Excel export, publish. Color coding: blue=fixed, green=generated, gray=off, orange=mismatch, purple=manager-self. **Time-off indicators**: red=sick, amber=vacation, violet=personal with emoji + label. |
| Generate Wizard | `/manager/schedule/generate` | 3-step: (1) select week, (2) review config, (3) view result + quality + warnings |
| Self-Assign | `/manager/schedule/self-assign` | Unfilled gaps, auto-suggest, hours tracker |
| Nurses | `/manager/nurses` | Nurse table |
| Nurse Profile | `/manager/nurses/[id]` | Edit contract hours, shift pref, Fri/Sat, off-days, blocked clinics, fixed assignments |
| Clinics | `/manager/clinics` | Default template grid + weekly overrides + copy between weeks |
| Programs | `/manager/programs` | Program list, assign nurse dialog |
| Requests | `/manager/requests` | Pending tab (approve/reject), History tab (delete), Record Absence dialog |
| Reports | `/manager/reports` | Monthly absence report: month picker, per-nurse table, expandable rows |
| Preferences | `/manager/preferences` | All nurses' preferences for selected week |
| Tasks | `/manager/tasks` | Create + assign tasks, status tracking |
| Announcements | `/manager/announcements` | Create + list with read counts |
| Users | `/manager/users` | PIN reset, deactivate |

---

## Nurse UI (Mobile)

Mobile-first (min 375px) with bottom navigation. Located in `src/app/nurse/`.

### Screens

| Screen | Path | Key Features |
|--------|------|-------------|
| Dashboard | `/nurse` | Today/tomorrow cards, "not published" state, next-week on Fri/Sat, announcements, task count |
| Schedule | `/nurse/schedule` | Weekly day cards: clinic, secondary, shift, calls, OFF. Hours summary. Week nav. |
| Requests | `/nurse/requests` | Submit request (vacation/sick/personal/off-day) + history. Date validation. |
| Preferences | `/nurse/preferences` | Shift pref, preferred days off (max 2), clinic preferences, notes |
| Tasks | `/nurse/tasks` | My tasks + mark done |
| Announcements | `/nurse/announcements` | Feed with priority badges, auto-mark read |

---

## Internationalization (Hebrew/Arabic)

| File | Purpose |
|------|---------|
| `src/i18n/he.json` | ~200+ Hebrew translation keys |
| `src/i18n/ar.json` | ~200+ Arabic translation keys |
| `src/i18n/provider.tsx` | Context provider (locale state) |
| `src/i18n/use-translation.ts` | `useTranslation()` hook |

- RTL layout: `dir="rtl"` on root `<html>`
- Tailwind logical properties only: `ms-`/`me-`/`ps-`/`pe-`/`text-start`/`text-end`
- Language toggle in sidebar

---

## Testing

### Algorithm Tests (~120 tests in 16 files)

| Category | Tests |
|----------|-------|
| Must-pass | 24 core constraint tests |
| Should-pass | 11 preference/fairness tests |
| Per-layer | 9 files (one per algorithm layer) |
| Scoring | Score formula unit tests |
| Backtracking | Dead-end recovery |
| Difficulty queue | MCV ordering |
| Look-ahead | Future dead-end detection |

### Integration Tests (2 flows)

| Flow | Coverage |
|------|----------|
| Schedule | Login → Generate → Edit → Publish → Nurse sees schedule |
| Requests | Time-off submit → manager approve/reject |

### E2E (Playwright)

| Spec | Coverage |
|------|----------|
| `nurse-mobile.spec.ts` | Login, schedule, requests at 375px. Overflow check. |

### Run

```bash
pnpm test               # ~120 tests (algorithm + integration)
pnpm tsc --noEmit       # Type check
```

---

## Recent Features

### Manager Absence Recording (2026-03-02)

Manager can record absences directly without waiting for nurse submissions:
- "Record Absence" dialog on requests page
- `POST /api/requests/record` — auto-approved with `createdById`
- Migration added `createdById` FK to `TimeOffRequest`
- History tab with delete capability
- `GET /api/requests/history` + `DELETE /api/requests/[id]/delete`

### Monthly Absence Report (2026-03-02)

- `/manager/reports` with month picker
- `GET /api/reports/absences?month=YYYY-MM`
- Per-nurse breakdown with expandable rows (type, dates, clipped days, reason)

### Time-Off Indicators on Schedule Grid (2026-03-02)

Schedule grid now shows typed, colored time-off cells instead of generic gray:

| Type | Color | Icon | Hebrew | Arabic |
|------|-------|------|--------|--------|
| SICK | Red (`bg-red-50`) | 🤒 | מחלה | مرضية |
| VACATION | Amber (`bg-amber-50`) | 🏖️ | חופשה | إجازة |
| PERSONAL | Violet (`bg-violet-50`) | 👤 | אישי | شخصي |
| OFF_DAY | Gray (`bg-gray-100`) | 📅 | יום חופש | يوم إجازة |

API returns `timeOff[]` alongside assignments. Client builds lookup map. Grid threads type through to cells.

### Error Boundaries & Loading Skeletons (2026-03-02)

- Root, manager, and nurse error boundaries
- Loading skeletons for schedule pages

### Docker Hardening (2026-03-02)

- Health endpoint excluded from auth
- `no-new-privileges`, resource caps
- Non-root container user
- 3-stage build

---

## File Structure

```
nurse-scheduler/
├── prisma/
│   ├── schema.prisma              — 17 models, PostgreSQL
│   ├── seed.ts                    — Seeds all reference data
│   └── migrations/                — 2 migrations
├── src/
│   ├── app/
│   │   ├── page.tsx               — Login page
│   │   ├── layout.tsx             — Root layout (RTL, i18n)
│   │   ├── error.tsx              — Root error boundary
│   │   ├── api/                   — 44 API routes
│   │   ├── manager/               — 15+ manager screens
│   │   └── nurse/                 — 6 nurse screens
│   ├── algorithm/
│   │   ├── index.ts               — Main entry
│   │   ├── types.ts               — Algorithm types
│   │   ├── scoring.ts             — Score formula
│   │   ├── converters.ts          — DB <-> algorithm conversions
│   │   ├── look-ahead.ts          — Dead-end detection
│   │   ├── backtrack.ts           — Dead-end recovery
│   │   ├── difficulty-queue.ts    — MCV priority queue
│   │   └── layers/                — 9 algorithm layers
│   ├── learning/
│   │   ├── models.ts              — Probability model loader
│   │   └── corrections.ts         — Correction adjustments
│   ├── lib/
│   │   ├── auth.ts                — JWT sign/verify
│   │   ├── db.ts                  — Prisma singleton
│   │   ├── permissions.ts         — Auth guard + error handler
│   │   ├── pin.ts                 — PIN hash/verify
│   │   ├── utils.ts               — Shared utilities
│   │   └── validations.ts         — All Zod schemas
│   ├── components/                — Shared UI components
│   ├── i18n/                      — Hebrew + Arabic translations
│   └── types/                     — TypeScript types
├── data/
│   ├── models/                    — Pre-built learning models
│   ├── nurse_profiles.json
│   ├── clinic_profiles.json
│   └── weekly_schedules.json
├── tests/
│   ├── algorithm/                 — 16 test files
│   ├── integration/               — 2 flow tests
│   └── e2e/                       — Playwright spec
├── scripts/
│   ├── rebuild-models.ts          — Rebuild learning models
│   └── test-generate.ts           — CLI schedule test
├── docs/                          — Spec files (read-only)
├── Dockerfile                     — 3-stage build
├── docker-compose.yml             — PostgreSQL + App
└── docker/entrypoint.sh           — Migrate + seed + start
```
