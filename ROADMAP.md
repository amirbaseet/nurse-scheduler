# NurseScheduler Pro — Claude Code Roadmap

## How to Use This File
Each step below is ONE Claude Code session. Copy the prompt, paste it into Claude Code.
Claude Code will automatically read CLAUDE.md from the project root, then follow the prompt.

Before you start: make sure your project folder has this structure:
```
nurse-scheduler/
├── CLAUDE.md              ← Claude Code reads this automatically
├── docs/                  ← All spec files
│   ├── overview/          (5 files)
│   ├── phase5-database/   (4 files)
│   ├── phase6-algorithm/  (2 files)
│   ├── phase7-manager-ui/ (1 file)
│   ├── phase8-nurse-ui/   (1 file)
│   ├── phase9-learning/   (1 file)
│   ├── phase10-deploy/    (1 file)
│   ├── data/              (3 JSON files)
│   └── README.md
└── (nothing else yet — Claude Code creates everything)
```

---

## PHASE 5: DATABASE + AUTH + API (6 sessions)

### Step 5.1 — Project Scaffold
```
Read docs/overview/PROJECT_OVERVIEW.md and docs/overview/PROJECT_STRUCTURE.md.

Create a new Next.js 14 project with:
- pnpm as package manager
- TypeScript
- App Router
- Tailwind CSS
- src/ directory

Install these dependencies:
- prisma + @prisma/client (database)
- bcryptjs + @types/bcryptjs (PIN hashing)
- jose (JWT — works in Edge runtime, not jsonwebtoken)
- zod (validation)
- date-fns (dates)

Install these dev dependencies:
- @types/node
- vitest (testing)

Create the folder structure from PROJECT_STRUCTURE.md (just empty folders, no files yet).
Initialize git with .gitignore for node_modules, .env, .next, prisma/dev.db.
Create .env with DATABASE_URL="file:./dev.db" and JWT_SECRET="dev-secret-change-in-prod-64chars-minimum-xxxxxxxxxxxxxxxxxxxxxxxx".
```

### Step 5.2 — Database Schema + Migration
```
Read docs/phase5-database/DATABASE_SCHEMA.md completely.

Copy the ENTIRE Prisma schema into prisma/schema.prisma exactly as documented.
This includes 18 models: User, NurseProfile, Clinic, ClinicDefaultConfig, ClinicWeeklyConfig,
NurseBlockedClinic, FixedAssignment, PatientProgram, ProgramAssignment, WeeklySchedule,
ScheduleAssignment, TimeOffRequest, WeeklyPreference, Task, Announcement, AnnouncementRead,
Notification, ScheduleCorrection.

Run: pnpm prisma migrate dev --name init

Create the json-arrays utility at src/lib/json-arrays.ts as documented in the schema file.
Create the Prisma client singleton at src/lib/db.ts.
```

### Step 5.3 — Seed Data
```
Read docs/phase5-database/SEED_DATA.md completely — especially the nurse mapping table.

Create prisma/seed.ts that imports all 15 nurses, 1 manager, 23 clinics,
clinic default configs, fixed assignments, and patient programs.

CRITICAL: Use the mapping table from SEED_DATA.md for nurse values.
Do NOT try to read gender or contractHours from nurse_profiles.json — those fields don't exist.
Every nurse is FEMALE. Contract hours range from 8 to 40 based on the table.

Also copy the 3 JSON data files from docs/data/ into a data/ folder at project root.

The seed must:
1. Create 16 users (1 manager + 15 nurses) with bcrypt-hashed PINs and pinPrefix
2. Create 15 NurseProfiles with correct mapping table values
3. Create 23 clinics with codes
4. Create ClinicDefaultConfig entries for each clinic's active days
5. Create 5 FixedAssignments for specialist nurses (use sentinel date 1970-01-01)
6. Create 4 PatientPrograms
7. Print all PINs to console (manager can reference them)

Add "prisma": { "seed": "tsx prisma/seed.ts" } to package.json.
Install tsx as dev dependency.
Run: pnpm prisma db seed
Verify with: pnpm prisma studio
```

### Step 5.4 — Authentication System
```
Read docs/phase5-database/AUTH_SYSTEM.md completely.

Create these files:
- src/lib/pin.ts — hashPin(pin) and verifyPin(pin, hash) using bcryptjs
- src/lib/auth.ts — signJwt(payload), verifyJwt(token), requireAuth(request), requireRole(user, role) using jose
- src/middleware.ts — Next.js middleware that protects /nurse/* and /manager/* routes

Create the auth API routes:
- src/app/api/auth/login/route.ts — POST: pinPrefix lookup → bcrypt verify → JWT cookie
- src/app/api/auth/logout/route.ts — POST: clear cookie

The login route MUST:
1. Extract pinPrefix (first 2 digits) from submitted PIN
2. Query users by pinPrefix (fast, no bcrypt yet)
3. bcrypt.compare only on the 1-2 matching users
4. Return 401 if no match, 429 if locked out
5. Set httpOnly cookie with JWT on success

Test by running the dev server and POSTing to /api/auth/login with a nurse's PIN from the seed.
```

### Step 5.5 — All API Routes (Part 1: Schedule + Nurses + Clinics + Programs)
```
Read docs/phase5-database/API_ROUTES.md completely.

Create shared validation schemas at src/lib/validations.ts using Zod.
Create permissions helper at src/lib/permissions.ts.

Build these API route groups (follow the pseudocode in API_ROUTES.md exactly):

GROUP 2 — Schedule (7 endpoints):
- GET  /api/schedule/nurse/me
- GET  /api/schedule/nurse/me/[week]
- GET  /api/schedule/week/[week]
- POST /api/schedule/generate (STUB — return empty schedule for now, algorithm in Phase 6)
- PUT  /api/schedule/[id]/assign
- POST /api/schedule/[id]/publish
- GET  /api/schedule/week/[week]/export (STUB — return 501 for now)

GROUP 3 — Nurses (3 endpoints):
- GET  /api/nurses
- PUT  /api/nurses/[id]
- PUT  /api/nurses/[id]/blocked-clinics

GROUP 4 — Clinics (5 endpoints):
- GET  /api/clinics
- PUT  /api/clinics/[id]
- GET  /api/clinics/config/[week]
- PUT  /api/clinics/config/[week]
- POST /api/clinics/config/copy

GROUP 5 — Programs (3 endpoints):
- GET  /api/programs
- PUT  /api/programs/[id]
- POST /api/programs/assign

Every route must: requireAuth → requireRole → validate input with Zod → Prisma query → return JSON.
```

### Step 5.6 — All API Routes (Part 2: Requests + Preferences + Tasks + Announcements + Users + Notifications)
```
Read docs/phase5-database/API_ROUTES.md — groups 6-11.

Build these remaining API route groups:

GROUP 6 — Requests (5 endpoints):
- GET  /api/requests/my
- POST /api/requests
- GET  /api/requests/pending
- PUT  /api/requests/[id]/approve
- PUT  /api/requests/[id]/reject

GROUP 7 — Preferences (3 endpoints):
- GET  /api/preferences/my/[week]
- POST /api/preferences
- GET  /api/preferences/week/[week]

GROUP 8 — Tasks (4 endpoints):
- GET  /api/tasks/my
- POST /api/tasks
- PUT  /api/tasks/[id]/done
- GET  /api/tasks

GROUP 9 — Announcements (3 endpoints):
- GET  /api/announcements
- POST /api/announcements
- PUT  /api/announcements/[id]/read

GROUP 10 — Users (4 endpoints):
- GET  /api/users
- POST /api/users
- PUT  /api/users/[id]/pin
- PUT  /api/users/[id]/deactivate

GROUP 11 — Notifications (2 endpoints):
- GET  /api/notifications
- PUT  /api/notifications/[id]/read

Total should be 38 endpoints. Include notification side-effects as documented.
Create one notification per approve/reject/publish action (don't spam on preferences — only at 5/10/15 thresholds).

Test a few endpoints manually with curl or Prisma Studio to verify data flow.
Commit everything to git.
```

---

## PHASE 6: SCHEDULING ALGORITHM (6 sessions)

### Step 6.1 — Types + Converters + Skeleton
```
Read docs/phase6-algorithm/ALGORITHM_PSEUDOCODE.md — the types.ts and converters.ts sections.

Create:
- src/algorithm/types.ts — All interfaces: Cell, Grid, ClinicSlot, AlgoNurse, Warning, Gap, ScheduleResult
- src/algorithm/converters.ts — dbToAlgorithmConfig() and algorithmToDbAssignments()
  Including mergeClinicConfigs() that merges ClinicDefaultConfig + ClinicWeeklyConfig
- src/algorithm/index.ts — Main generateWeeklySchedule() skeleton that calls all 9 layers
  (each layer is a stub returning immediately for now)
- src/algorithm/layers/1-block.ts through 9-optimize.ts — empty stub functions

Wire the generate endpoint: update /api/schedule/generate to call the real algorithm
(using converters to transform DB data → algorithm → DB assignments).
```

### Step 6.2 — Layers 1-2 (Block + Fixed)
```
Read docs/phase6-algorithm/ALGORITHM_PSEUDOCODE.md — Layer 1 and Layer 2 sections.

Implement:
- src/algorithm/layers/1-block.ts — Block unavailable nurses
  Checks: approved time-off, recurringOffDays, canWorkFriday/Saturday, maxDaysPerWeek
  Sets cell.status = BLOCKED with blockReason

- src/algorithm/layers/2-fixed.ts — Place fixed/locked assignments
  2A: FixedAssignment (specialist nurses locked to their clinics)
  2B: Pure patient programs (מערך שד — entire shift calling patients)
  Deducts hours from budgets
  Warns if fixed conflicts with blocked

Write tests for:
- Nurse on vacation → BLOCKED
- Nurse with recurringOffDays=["THU"] → BLOCKED every Thursday
- Fixed assignment placed correctly with hours deducted
- Fixed on blocked day → warning generated
```

### Step 6.3 — Layer 3-4 + Scoring + Difficulty Queue
```
Read docs/phase6-algorithm/ALGORITHM_PSEUDOCODE.md — Layers 3-4, Scoring, Difficulty Queue.

Implement:
- src/algorithm/layers/3-gender.ts — Fill gender-restricted clinics (FEMALE_ONLY first)
- src/algorithm/scoring.ts — Score 0-1000 via RAW ADDITION:
  S_pref (0-350) + S_budget (0-250) + S_hist (75 placeholder) + S_fair (0-150)
  DO NOT multiply by weights. Just add the raw sub-scores.
- src/algorithm/difficulty-queue.ts — MCV heuristic: count candidates per slot, sort ascending
- src/algorithm/layers/4-primary.ts — Fill all primary clinic slots
  Uses difficulty queue (hardest first), scores candidates, picks best

Write tests for:
- Gender-only clinic gets female nurse
- Scoring: morning-preference nurse scores higher for morning slot
- Difficulty queue: slot with 2 candidates processed before slot with 8
- All required slots filled for a simple day
```

### Step 6.4 — Look-Ahead + Backtracking
```
Read docs/phase6-algorithm/ALGORITHM_PSEUDOCODE.md — Look-Ahead and Backtracking sections.

Implement:
- src/algorithm/look-ahead.ts — Check next 5 hardest unfilled slots
  If assigning this nurse would leave a future slot with 0 candidates → penalty -80
  If future slot has only 1 candidate → penalty -30
  Returns bonus clamped to [-100, +100]

- src/algorithm/backtrack.ts — When a slot has 0 candidates:
  Find an already-assigned nurse who CAN do this slot
  Find a replacement for their current slot
  Swap them

Integrate look-ahead into Layer 4 scoring (added to base score).
Integrate backtracking into Layer 4 (called when candidates.length == 0).

Write tests for:
- Look-ahead prevents assigning nurse that would create dead-end
- Backtracking recovers from 0-candidate slot
```

### Step 6.5 — Layers 5-8 (Secondary, Programs, Gap Fill, Off-Days)
```
Read docs/phase6-algorithm/ALGORITHM_PSEUDOCODE.md — Layers 5-8.

Implement:
- src/algorithm/layers/5-secondary.ts — Stack secondary clinics on primary assignments
  WITH demand tracking: secondaryNursesNeeded per clinic per day
  Don't assign secondary if demand exhausted, nurse blocked, or budget insufficient

- src/algorithm/layers/6-programs.ts — Add patient call addons (CLINIC_ADDON type)
  Adds call info to existing assignment, does NOT change hours

- src/algorithm/layers/7-gap-fill.ts — Extend shifts for under-budget nurses
  Max 2h extension per day, max 8h per shift, warn if nurse still has 4h+ unfilled

- src/algorithm/layers/8-off-days.ts — Mark all remaining AVAILABLE cells as OFF

Write tests for:
- Secondary assigned only when demand > 0
- Secondary demand exhausted → next nurse doesn't get it
- Gap fill extends shift by correct amount
- All AVAILABLE cells become OFF after Layer 8
```

### Step 6.6 — Layer 9 (Optimizer) + Quality Score + Full Test Suite
```
Read docs/phase6-algorithm/ALGORITHM_PSEUDOCODE.md — Layer 9 and Quality Score.
Read docs/phase6-algorithm/TEST_CASES.md completely.

Implement:
- src/algorithm/layers/9-optimize.ts — Simulated annealing (10,000 iterations)
  Random same-day swaps, accept improvements + some worse moves early
  Never swap fixed or gender-invalid assignments
  Must complete in < 2 seconds

- Add calculateQuality() to scoring.ts:
  Start at 100, deduct for preference mismatches (-5), wished day-off violations (-3),
  unfilled slots (-10), fairness deviation (-2 per stddev point)
  Clamp to 0-100

Run ALL 24 MUST-PASS test cases from TEST_CASES.md.
Run the 11 SHOULD-PASS tests.
Verify: full schedule generation < 3 seconds, quality score > 70 for normal week.

Commit and push.
```

---

## PHASE 7: MANAGER INTERFACE (6 sessions)

### Step 7.1 — Layout + Dashboard + shadcn/ui
```
Read docs/overview/TRANSLATIONS.md and docs/phase7-manager-ui/MANAGER_SCREENS.md.

Set up:
- Root layout (src/app/layout.tsx): RTL, Hebrew font, providers
- Manager layout (src/app/manager/layout.tsx): sidebar nav, auth check, notification bell
- Install shadcn/ui components: button, card, input, dialog, badge, table, tabs, select, calendar
- Create RTL provider and language toggle (Hebrew/Arabic)
- Build the manager dashboard page with pending actions + this week stats
- Create reusable components: StatusBadge, WeekNavigator, NotificationBell
```

### Step 7.2 — Nurse + Clinic Config Screens
```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — Nurses and Clinics sections.

Build:
- /manager/nurses — table of all nurses with key info
- /manager/nurses/[id] — editable nurse profile:
  Contract hours, shift preference, Fri/Sat toggles, max days, recurring off-days,
  blocked clinics multi-select, fixed assignments list
  Calls PUT /api/nurses/[id] and PUT /api/nurses/[id]/blocked-clinics

- /manager/clinics — expandable list with default template + weekly overrides
  Default template: editable grid (day × active/start/end/nurses)
  Weekly overrides: week selector, "Copy From Previous Week" button
  Calls GET/PUT /api/clinics/config/[week] and POST /api/clinics/config/copy
```

### Step 7.3 — Schedule Generation Wizard
```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — Generate Wizard section.

Build the 4-step wizard at /manager/schedule/generate:
Step 1: Select week (date picker, summary of nurses/time-offs/preferences)
Step 2: Review config (clinic grid, time-offs, fixed assignments, preferences)
Step 3: Review & Edit (schedule grid, quality score, warnings sidebar)
Step 4: Published confirmation

The generate button calls POST /api/schedule/generate and displays results.
Include warnings panel and quality score badge.
```

### Step 7.4 — Schedule Grid + Drag-and-Drop
```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — Schedule Grid section.

Build:
- /manager/schedule — full schedule grid (nurses × days)
- Install @dnd-kit for drag-and-drop
- Color coding: blue=fixed, green=generated, gray=off, orange=mismatch, purple=manager-self
- Click cell → edit dialog (change nurse, clinic, shift, notes)
- Edits call PUT /api/schedule/[id]/assign
- Week navigator (← →)
- Export to Excel button (calls GET /api/schedule/week/[week]/export)
```

### Step 7.5 — Manager Self-Scheduling
```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — Self-Assign section.

Build /manager/schedule/self-assign:
- Left: unfilled gaps from managerGaps (checkboxes to claim)
- Right: manager's week view with assigned hours / remaining budget
- Auto-suggest button that picks gaps fitting manager's remaining hours
- Save assigns manager to selected gaps via PUT /api/schedule/[id]/assign
```

### Step 7.6 — Requests + Tasks + Announcements + Programs + Users
```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — remaining screens.

Build:
- /manager/requests — pending list with impact analysis, approve/reject buttons
- /manager/tasks — create task form (assign to nurse or all), task list with status
- /manager/announcements — create form (title, body, priority, targets), list
- /manager/programs — program list, "Assign Nurse to Day" dialog
- /manager/users — user list, reset PIN dialog, deactivate button

All screens follow the wireframes in the doc and call the matching API endpoints.
Commit and push.
```

---

## PHASE 8: NURSE INTERFACE (3 sessions)

### Step 8.1 — Login + Layout + Dashboard
```
Read docs/phase8-nurse-ui/NURSE_SCREENS.md completely.

Build:
- Login page (src/app/page.tsx): 4-digit PIN input (auto-detect 6 for manager)
  Large touch targets, auto-focus next, shake on error, auto-submit when filled
  
- Nurse layout (src/app/nurse/layout.tsx): bottom nav (5 tabs), auth check
  Must work at 375px width (mobile-first)

- Dashboard (/nurse): 
  STATE A (schedule published): today + tomorrow cards
  STATE B (no schedule): "Schedule not yet published" message
  STATE C (Fri/Sat): show next week prominently, current week smaller
  Plus: latest 3 announcements, pending tasks count
```

### Step 8.2 — Schedule + Requests + Preferences
```
Read docs/phase8-nurse-ui/NURSE_SCREENS.md — Schedule, Requests, Preferences screens.

Build:
- /nurse/schedule — weekly view with day cards
  Shows clinic name, secondary, shift time, patient calls, OFF days
  Weekly summary: assigned hours / contract hours
  Week navigator, today highlighted
  "Schedule not yet published" empty state

- /nurse/requests — create request form (vacation/sick/off-day) + my request history
  Date validation, duplicate check, confirmation dialog

- /nurse/preferences — weekly preferences form
  Shift preference radio buttons, preferred days off checkboxes (max 2), notes
  Submit deadline awareness, "saved" confirmation
```

### Step 8.3 — Tasks + Announcements + Notifications + Polish
```
Build:
- /nurse/tasks — my tasks list, mark as done button
- /nurse/announcements — feed with priority badges, auto-mark read on scroll
- Notification bell component — unread count, dropdown with recent notifications
- Language toggle (Hebrew ↔ Arabic) — reads from i18n/he.json and i18n/ar.json

Create translation files:
- src/i18n/he.json — all Hebrew strings from docs/overview/TRANSLATIONS.md
- src/i18n/ar.json — all Arabic strings from docs/overview/TRANSLATIONS.md

RTL polish:
- Verify all Tailwind uses logical properties (ms/me/ps/pe/text-start/text-end)
- Test at 375px width
- Test with Arabic language selected

Commit and push.
```

---

## PHASE 9: LEARNING ENGINE (2 sessions, optional for MVP)

### Step 9.1 — Historical Data Import
```
Read docs/phase9-learning/LEARNING_ENGINE.md.

Build the historical data import pipeline:
- Parse 51 weeks from docs/data/weekly_schedules.json
- For each week: create WeeklySchedule + ScheduleAssignments
- Build probability matrices: P(nurse, clinic, day) from historical frequency
- Store in a learningData JSON file or DB table
```

### Step 9.2 — Correction Tracking + Integration
```
Read docs/phase9-learning/LEARNING_ENGINE.md — correction tracking section.

Build:
- When manager edits a generated schedule (PUT /api/schedule/[id]/assign),
  compare original vs corrected and create ScheduleCorrection records
- Update S_hist in scoring formula to use historical probability:
  S_hist = P(nurse, clinic, day) * 150 (was hardcoded 75)
- Add a simple confidence threshold:
  If P(nurse, clinic, day) > 0.7 → auto-assign without scoring (fast path)
```

---

## PHASE 10: TESTING + DEPLOYMENT (3 sessions)

### Step 10.1 — Full Test Suite
```
Read docs/phase6-algorithm/TEST_CASES.md and docs/phase10-deploy/DEPLOYMENT.md.

Run all 38 test cases. Fix any failures.
Add API integration tests for critical paths:
- Login → generate → edit → publish → nurse sees schedule
- Create request → approve → reflected in next generation
Test performance: schedule generation < 3 seconds.
Test mobile: all nurse screens at 375px width.
```

### Step 10.2 — SQLite → PostgreSQL + Deploy
```
Read docs/phase10-deploy/DEPLOYMENT.md completely.

1. Create Neon account → create database → get connection string
2. Update schema.prisma: provider = "postgresql", convert JSON strings to real arrays
3. Remove json-arrays utility, update all parseJsonArray/toJsonArray calls
4. Run prisma migrate on Neon
5. Seed the production database
6. Create Vercel account → import GitHub repo
7. Set environment variables (DATABASE_URL, JWT_SECRET)
8. Deploy → verify HTTPS works
```

### Step 10.3 — Final Polish + Handoff
```
- Run the full post-deploy checklist from docs/phase10-deploy/DEPLOYMENT.md
- Fix any RTL issues
- Fix any mobile responsive issues
- Test with actual nurse/manager PINs
- Add custom domain (when ready)
- Document final PINs for manager handoff
```

---

## Quick Reference: Which Docs for Which Phase

| Phase | Read overview/ + ... | Sessions |
|-------|---------------------|----------|
| 5     | phase5-database/ (4 files) | 6 |
| 6     | phase6-algorithm/ (2 files) | 6 |
| 7     | phase7-manager-ui/ (1 file) + overview/TRANSLATIONS.md | 6 |
| 8     | phase8-nurse-ui/ (1 file) + overview/TRANSLATIONS.md | 3 |
| 9     | phase9-learning/ (1 file) | 2 |
| 10    | phase10-deploy/ (1 file) + phase6-algorithm/TEST_CASES.md | 3 |
| **TOTAL** | | **~26 sessions** |
