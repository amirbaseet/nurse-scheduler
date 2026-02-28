# NurseScheduler Pro — Complete Command-by-Command Roadmap

Every single command you need to type, in order. Nothing skipped.

---

## BEFORE YOU START — One-Time Setup

### Install Prerequisites (if not already installed)

```bash
# Install Node.js 20+ (if you don't have it)
# macOS:
brew install node

# Windows: download from https://nodejs.org/en/download
# Pick LTS version (20+)

# Verify Node.js
node --version
# Should show v20.x.x or higher

# Install pnpm (our package manager)
npm install -g pnpm

# Verify pnpm
pnpm --version

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify Claude Code
claude --version

# Install Git (if not already)
# macOS:
brew install git
# Windows: download from https://git-scm.com/download/win

# Verify Git
git --version
```

---

## STEP 0: Create Project & Unzip Docs (5 minutes)

```bash
# Create project folder (pick where you want it)
# macOS/Linux:
mkdir -p ~/projects/nurse-scheduler
cd ~/projects/nurse-scheduler

# Windows (PowerShell):
mkdir C:\projects\nurse-scheduler
cd C:\projects\nurse-scheduler
```

Now unzip `NurseScheduler-ClaudeCode-Complete.zip` into this folder.

After unzipping, verify:
```bash
ls -la
# You should see:
#   CLAUDE.md
#   ROADMAP.md
#   docs/

ls docs/
# You should see:
#   README.md  data/  overview/  phase10-deploy/  phase5-database/
#   phase6-algorithm/  phase7-manager-ui/  phase8-nurse-ui/  phase9-learning/

ls docs/data/
# You should see:
#   clinic_profiles.json  nurse_profiles.json  weekly_schedules.json
```

Initialize Git right now:
```bash
git init
git add .
git commit -m "docs: initial project documentation"
```

---

## PHASE 5: DATABASE + AUTH + API

---

### STEP 5.1 — Project Scaffold (Session 1)

```bash
# Open Claude Code in your project folder
cd ~/projects/nurse-scheduler
claude
```

**Paste this into Claude Code:**

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

**Wait for Claude Code to finish. Then verify:**

```bash
# Exit Claude Code (type /exit or Ctrl+C)

# Verify project was created
ls package.json
cat package.json | head -5

# Verify dependencies installed
ls node_modules/.package-lock.json

# Verify folder structure
ls src/
ls src/app/
ls src/lib/

# Verify environment file
cat .env

# Test the dev server starts
pnpm dev
# Should show "Ready" at http://localhost:3000
# Press Ctrl+C to stop

# Commit
git add .
git commit -m "feat: project scaffold with Next.js 14 + dependencies"
```

---

### STEP 5.2 — Database Schema + Migration (Session 2)

```bash
claude
```

**Paste this into Claude Code:**

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

**Wait for Claude Code to finish. Then verify:**

```bash
# Verify schema exists
cat prisma/schema.prisma | head -20

# Verify migration ran (database file should exist)
ls prisma/dev.db
ls prisma/migrations/

# Verify utility files
cat src/lib/json-arrays.ts
cat src/lib/db.ts

# Test schema is valid
pnpm prisma validate
# Should say "The schema is valid"

# Open Prisma Studio to see empty tables
pnpm prisma studio
# Opens browser at http://localhost:5555
# You should see all 18 tables (empty)
# Press Ctrl+C to close

# Commit
git add .
git commit -m "feat: database schema with 18 models + migration"
```

---

### STEP 5.3 — Seed Data (Session 3)

```bash
claude
```

**Paste this into Claude Code:**

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

**Wait for Claude Code to finish. Then verify:**

```bash
# Check seed file exists
ls prisma/seed.ts

# Check data files copied
ls data/
# Should show: clinic_profiles.json  nurse_profiles.json  weekly_schedules.json

# Re-run seed manually to see PINs printed
pnpm prisma db seed
# SAVE THE PRINTED PINs! You need them to log in later.

# Verify data in Prisma Studio
pnpm prisma studio
# Click "User" → should see 16 users
# Click "NurseProfile" → should see 15 profiles
# Click "Clinic" → should see 23 clinics
# Click "ClinicDefaultConfig" → should see entries
# Click "FixedAssignment" → should see 5 specialist assignments
# Click "PatientProgram" → should see 4 programs
# Press Ctrl+C to close

# Commit
git add .
git commit -m "feat: seed data — 16 users, 23 clinics, configs, programs"
```

---

### STEP 5.4 — Authentication System (Session 4)

```bash
claude
```

**Paste this into Claude Code:**

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

**Wait for Claude Code to finish. Then verify:**

```bash
# Verify files created
ls src/lib/pin.ts
ls src/lib/auth.ts
ls src/middleware.ts
ls src/app/api/auth/login/route.ts
ls src/app/api/auth/logout/route.ts

# Start dev server
pnpm dev &

# Test login with a nurse PIN (replace 1234 with an actual PIN from seed output)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}' \
  -v
# Should return 200 with user info and Set-Cookie header

# Test wrong PIN
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"9999"}' \
  -v
# Should return 401

# Stop dev server
kill %1
# Or: fg then Ctrl+C

# Commit
git add .
git commit -m "feat: PIN authentication with JWT cookies"
```

---

### STEP 5.5 — API Routes Part 1 (Session 5)

```bash
claude
```

**Paste this into Claude Code:**

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

**Wait for Claude Code to finish. Then verify:**

```bash
# Verify route files exist
find src/app/api -name "route.ts" | sort
# Should show 18+ route files

# Start dev server
pnpm dev &

# Test nurses list (need auth cookie — login first)
# Save the cookie from login:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"482917"}' \
  -c cookies.txt

# Use cookie to call protected routes:
curl http://localhost:3000/api/nurses -b cookies.txt
# Should return list of 15 nurse profiles

curl http://localhost:3000/api/clinics -b cookies.txt
# Should return list of 23 clinics

curl http://localhost:3000/api/programs -b cookies.txt
# Should return list of 4 programs

# Stop dev server
kill %1

# Commit
git add .
git commit -m "feat: API routes — schedule, nurses, clinics, programs (18 endpoints)"
```

---

### STEP 5.6 — API Routes Part 2 (Session 6)

```bash
claude
```

**Paste this into Claude Code:**

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

**Wait for Claude Code to finish. Then verify:**

```bash
# Count all route files
find src/app/api -name "route.ts" | wc -l
# Should be around 30+ files (some routes share files)

# Test full flow
pnpm dev &

# Login as manager
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"482917"}' \
  -c cookies.txt

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Test task","isForAll":true,"priority":"NORMAL"}'

# Check notifications were created
curl http://localhost:3000/api/notifications -b cookies.txt

# List users
curl http://localhost:3000/api/users -b cookies.txt

# Stop dev server
kill %1

# Clean up
rm cookies.txt

# Commit
git add .
git commit -m "feat: all 38 API endpoints complete"

# Tag Phase 5 done
git tag phase5-complete
```

---

## PHASE 6: SCHEDULING ALGORITHM

---

### STEP 6.1 — Types + Converters + Skeleton (Session 7)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
ls src/algorithm/
# Should show: types.ts  converters.ts  index.ts  scoring.ts  difficulty-queue.ts  look-ahead.ts  backtrack.ts  layers/

ls src/algorithm/layers/
# Should show: 1-block.ts  2-fixed.ts  3-gender.ts  4-primary.ts  5-secondary.ts  6-programs.ts  7-gap-fill.ts  8-off-days.ts  9-optimize.ts

git add . && git commit -m "feat: algorithm skeleton with types and converters"
```

---

### STEP 6.2 — Layers 1-2: Block + Fixed (Session 8)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
# Run the tests
pnpm vitest run --reporter=verbose
# All layer 1-2 tests should pass

git add . && git commit -m "feat: algorithm layers 1-2 (block + fixed) with tests"
```

---

### STEP 6.3 — Layers 3-4 + Scoring (Session 9)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm vitest run --reporter=verbose
git add . && git commit -m "feat: algorithm layers 3-4 + scoring + difficulty queue"
```

---

### STEP 6.4 — Look-Ahead + Backtracking (Session 10)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm vitest run --reporter=verbose
git add . && git commit -m "feat: look-ahead (5-slot depth) + backtracking"
```

---

### STEP 6.5 — Layers 5-8 (Session 11)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm vitest run --reporter=verbose
git add . && git commit -m "feat: algorithm layers 5-8 (secondary, programs, gap, off)"
```

---

### STEP 6.6 — Layer 9 + Quality + Full Tests (Session 12)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
# Run full test suite
pnpm vitest run --reporter=verbose

# Test actual schedule generation via API
pnpm dev &

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"482917"}' \
  -c cookies.txt

# Generate a schedule for next Sunday
curl -X POST http://localhost:3000/api/schedule/generate \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"weekStart":"2026-03-01"}'
# Should return schedule with qualityScore > 70

kill %1 && rm cookies.txt

git add . && git commit -m "feat: algorithm complete — all 9 layers, optimizer, quality score"
git tag phase6-complete
```

---

## PHASE 7: MANAGER INTERFACE

---

### STEP 7.1 — Layout + Dashboard (Session 13)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm dev
# Open http://localhost:3000 → should see login page
# Login with manager PIN → should redirect to /manager with sidebar + dashboard
# Ctrl+C to stop

git add . && git commit -m "feat: manager layout + dashboard + shadcn/ui"
```

---

### STEP 7.2 — Nurse + Clinic Config (Session 14)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm dev
# Login as manager → go to /manager/nurses → see 15 nurses
# Click a nurse → edit their profile → save → verify changes stick
# Go to /manager/clinics → see 23 clinics with config grids
# Ctrl+C

git add . && git commit -m "feat: nurse config + clinic config screens"
```

---

### STEP 7.3 — Schedule Generation Wizard (Session 15)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm dev
# Login as manager → go to /manager/schedule/generate
# Step 1: pick a week → Step 2: review → click Generate
# Step 3: should see schedule grid with nurses × days
# Quality score should appear (70+)
# Ctrl+C

git add . && git commit -m "feat: schedule generation wizard (4 steps)"
```

---

### STEP 7.4 — Schedule Grid + Drag-and-Drop (Session 16)

```bash
claude
```

**Paste this into Claude Code:**

```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — Schedule Grid section.

Build:
- /manager/schedule — full schedule grid (nurses × days)
- Install @dnd-kit for drag-and-drop: pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
- Color coding: blue=fixed, green=generated, gray=off, orange=mismatch, purple=manager-self
- Click cell → edit dialog (change nurse, clinic, shift, notes)
- Edits call PUT /api/schedule/[id]/assign
- Week navigator (← →)
- Export to Excel button (calls GET /api/schedule/week/[week]/export)
  Implement the export endpoint using xlsx library: pnpm add xlsx
```

**Verify:**

```bash
pnpm dev
# Login → generate a schedule → go to /manager/schedule
# Should see color-coded grid
# Try dragging a nurse from one cell to another
# Click a cell → edit dialog should open
# Click Export → should download .xlsx file
# Ctrl+C

git add . && git commit -m "feat: schedule grid with drag-drop + Excel export"
```

---

### STEP 7.5 — Manager Self-Scheduling (Session 17)

```bash
claude
```

**Paste this into Claude Code:**

```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — Self-Assign section.

Build /manager/schedule/self-assign:
- Left: unfilled gaps from managerGaps (checkboxes to claim)
- Right: manager's week view with assigned hours / remaining budget
- Auto-suggest button that picks gaps fitting manager's remaining hours
- Save assigns manager to selected gaps via PUT /api/schedule/[id]/assign
```

**Verify:**

```bash
pnpm dev
# Generate a schedule → go to /manager/schedule/self-assign
# Should see unfilled gaps on left, manager's week on right
# Claim some gaps → save → verify they appear in main schedule
# Ctrl+C

git add . && git commit -m "feat: manager self-scheduling panel"
```

---

### STEP 7.6 — Requests + Tasks + Announcements + Users (Session 18)

```bash
claude
```

**Paste this into Claude Code:**

```
Read docs/phase7-manager-ui/MANAGER_SCREENS.md — remaining screens.

Build:
- /manager/requests — pending list with impact analysis, approve/reject buttons
- /manager/tasks — create task form (assign to nurse or all), task list with status
- /manager/announcements — create form (title, body, priority, targets), list
- /manager/programs — program list, "Assign Nurse to Day" dialog
- /manager/users — user list, reset PIN dialog, deactivate button

All screens follow the wireframes in the doc and call the matching API endpoints.
```

**Verify:**

```bash
pnpm dev
# Test each screen:
# /manager/requests — should show any pending requests
# /manager/tasks — create a task → should appear in list
# /manager/announcements — post one → should appear
# /manager/users — see all 16 users
# Ctrl+C

git add . && git commit -m "feat: requests, tasks, announcements, programs, users screens"
git tag phase7-complete
```

---

## PHASE 8: NURSE INTERFACE

---

### STEP 8.1 — Login + Dashboard (Session 19)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm dev
# Open on your phone or use Chrome DevTools mobile view (375px)
# Login with a nurse PIN → should see dashboard
# Bottom nav should have 5 tabs
# If no schedule published: "Schedule not yet published" message
# If schedule exists: today + tomorrow cards
# Ctrl+C

git add . && git commit -m "feat: nurse login + mobile dashboard"
```

---

### STEP 8.2 — Schedule + Requests + Preferences (Session 20)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm dev
# Login as nurse → test each screen on mobile view
# /nurse/schedule → should show weekly schedule or "not published"
# /nurse/requests → create a request → should appear in history
# /nurse/preferences → submit preferences → should save
# Ctrl+C

git add . && git commit -m "feat: nurse schedule, requests, preferences"
```

---

### STEP 8.3 — Tasks + Notifications + Polish (Session 21)

```bash
claude
```

**Paste this into Claude Code:**

```
Read docs/phase8-nurse-ui/NURSE_SCREENS.md and docs/overview/TRANSLATIONS.md.

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
```

**Verify:**

```bash
pnpm dev
# Full flow test:
# 1. Login as manager → create task + announcement → generate + publish schedule
# 2. Logout → login as nurse
# 3. Dashboard shows today's assignment
# 4. Notification bell shows unread
# 5. Tasks page shows the task → mark done
# 6. Announcements shows the announcement
# 7. Toggle to Arabic → verify RTL still works
# 8. Test on mobile (375px)
# Ctrl+C

git add . && git commit -m "feat: nurse tasks, notifications, translations, RTL polish"
git tag phase8-complete
```

---

## PHASE 9: LEARNING ENGINE (Optional)

---

### STEP 9.1 — Historical Import (Session 22)

```bash
claude
```

**Paste this into Claude Code:**

```
Read docs/phase9-learning/LEARNING_ENGINE.md.

Build the historical data import pipeline:
- Parse 51 weeks from data/weekly_schedules.json
- For each week: create WeeklySchedule + ScheduleAssignments in DB
- Build probability matrices: P(nurse, clinic, day) from historical frequency
- Store in a learningData JSON file or DB table
```

**Verify:**

```bash
# Check historical data imported
pnpm prisma studio
# WeeklySchedule table should have 51 entries
# ScheduleAssignment table should have thousands of entries
# Ctrl+C

git add . && git commit -m "feat: historical data import (51 weeks)"
```

---

### STEP 9.2 — Correction Tracking (Session 23)

```bash
claude
```

**Paste this into Claude Code:**

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

**Verify:**

```bash
pnpm vitest run --reporter=verbose
git add . && git commit -m "feat: learning engine — corrections + historical scoring"
git tag phase9-complete
```

---

## PHASE 10: TESTING + DEPLOYMENT

---

### STEP 10.1 — Full Test Suite (Session 24)

```bash
claude
```

**Paste this into Claude Code:**

```
Read docs/phase6-algorithm/TEST_CASES.md and docs/phase10-deploy/DEPLOYMENT.md.

Run all 38 test cases. Fix any failures.
Add API integration tests for critical paths:
- Login → generate → edit → publish → nurse sees schedule
- Create request → approve → reflected in next generation
Test performance: schedule generation < 3 seconds.
Test mobile: all nurse screens at 375px width.
```

**Verify:**

```bash
pnpm vitest run --reporter=verbose
# ALL tests should pass
# Note any failures and fix them

git add . && git commit -m "test: full test suite passing"
```

---

### STEP 10.2 — Deploy to Production (Session 25)

```bash
# ---- OUTSIDE Claude Code — do these in your terminal ----

# 1. Create Neon database
# Go to https://neon.tech → sign up → create project "nurse-scheduler"
# Copy the connection string (looks like: postgresql://user:pass@host/dbname?sslmode=require)

# 2. Create Vercel account
# Go to https://vercel.com → sign up with GitHub
# Import your nurse-scheduler repo

# 3. Now open Claude Code for the migration
claude
```

**Paste this into Claude Code:**

```
Read docs/phase10-deploy/DEPLOYMENT.md completely.

1. Update schema.prisma: provider = "postgresql", convert JSON strings to real arrays
2. Remove json-arrays utility, update all parseJsonArray/toJsonArray calls to direct array access
3. Update .env.example with PostgreSQL DATABASE_URL template
4. Make sure all code works with the new array types
5. Test locally by running: pnpm prisma migrate dev --name postgresql
```

**Then back in your terminal:**

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://your-neon-connection-string-here"

# Run migration against Neon
pnpm prisma migrate deploy

# Seed production database
pnpm prisma db seed

# Push to GitHub (Vercel auto-deploys)
git add .
git commit -m "feat: PostgreSQL migration for production"
git push origin main

# ---- In Vercel dashboard ----
# Set environment variables:
#   DATABASE_URL = your Neon connection string
#   JWT_SECRET = (generate a random 64-char string)
#   NEXT_PUBLIC_APP_NAME = NurseScheduler Pro
#   NEXT_PUBLIC_DEFAULT_LOCALE = he
# Click Deploy
```

**Verify deployment:**

```bash
# After Vercel deploys (usually 1-2 minutes):
curl https://your-app.vercel.app/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"pin":"482917"}'
# Should return 200 with user info

# Open in browser:
# https://your-app.vercel.app
# Login with manager PIN → should work!
```

---

### STEP 10.3 — Final Polish (Session 26)

```bash
claude
```

**Paste this into Claude Code:**

```
Run through the complete post-deploy checklist from docs/phase10-deploy/DEPLOYMENT.md.
Fix any issues found:
- RTL layout problems
- Mobile responsive issues
- Missing translations
- Console errors
- Broken navigation links
```

**Final verification:**

```bash
pnpm dev

# Run through the complete checklist manually:
# AUTH:
#   ✓ Login nurse, login manager, wrong PIN, lockout, logout
# MANAGER:
#   ✓ Dashboard, nurse config, clinic config, generate, edit, publish
#   ✓ Self-assign, requests, tasks, announcements, export
# NURSE:
#   ✓ Dashboard (today, no-schedule, Fri/Sat states)
#   ✓ Schedule, requests, preferences, tasks, notifications
# UI:
#   ✓ RTL correct, Hebrew, Arabic, mobile 375px

git add . && git commit -m "polish: final fixes from deployment checklist"
git tag v1.0.0
git push origin main --tags
```

---

## DONE! 🎉

```
Total sessions:  26
Total commands:  ~200
Result:          Full working NurseScheduler Pro

What you have:
  ✅ 38 API endpoints
  ✅ 9-layer scheduling algorithm
  ✅ Manager desktop interface
  ✅ Nurse mobile interface
  ✅ Hebrew + Arabic bilingual
  ✅ Learning engine (optional)
  ✅ Deployed on Vercel + Neon
  ✅ Cost: $0/month
```
