# NurseScheduler Pro — Documentation for Claude Code

## How to Use These Docs

Each phase has its own folder. Before each phase, tell Claude Code:
```
Read the files in docs/overview/ for project context,
then read all files in docs/phase{N}-{name}/ for this phase's specs.
```

---

## Folder Structure

```
docs/
├── overview/                    ← READ FIRST (always)
│   ├── PROJECT_OVERVIEW.md      — What, why, tech stack, key rules
│   ├── PROJECT_STRUCTURE.md     — Every folder & file  
│   ├── ENTITY_RELATIONSHIPS.md  — 18 entities, relationships, config merge rule
│   ├── PERMISSIONS.md           — Who can do what (28 actions)
│   └── TRANSLATIONS.md          — Hebrew + Arabic strings
│
├── phase5-database/             ← Database + Auth + APIs
│   ├── DATABASE_SCHEMA.md       — Complete Prisma schema (18 models)
│   ├── AUTH_SYSTEM.md           — PIN → pinPrefix → bcrypt → JWT
│   ├── API_ROUTES.md            — All 38 endpoints with pseudocode
│   └── SEED_DATA.md             — Complete nurse mapping table + import order
│
├── phase6-algorithm/            ← Scheduling engine
│   ├── ALGORITHM_PSEUDOCODE.md  — 9 layers, scoring (0-1000), converters
│   └── TEST_CASES.md            — 38 test scenarios
│
├── phase7-manager-ui/           ← Manager desktop interface
│   └── MANAGER_SCREENS.md       — All screens with wireframes + config
│
├── phase8-nurse-ui/             ← Nurse mobile interface
│   └── NURSE_SCREENS.md         — All screens, state handling, mobile-first
│
├── phase9-learning/             ← ML learning engine (optional for MVP)
│   └── LEARNING_ENGINE.md       — Models + correction tracking
│
├── phase10-deploy/              ← Testing + go live
│   └── DEPLOYMENT.md            — SQLite→PostgreSQL, Neon, Vercel, checklist
│
└── data/                        ← Seed data from analysis
    ├── nurse_profiles.json      — 15 nurses (NO gender/hours — see SEED_DATA.md mapping)
    ├── clinic_profiles.json     — 23 clinics
    └── weekly_schedules.json    — 51 weeks historical
```

## Build Order

### Phase 5: Database & API (~6 sessions)
1. Project scaffold: `npx create-next-app` + deps
2. Database: Copy schema from DATABASE_SCHEMA.md → `prisma migrate`
3. Seed: Follow SEED_DATA.md mapping table exactly
4. Auth: PIN login with pinPrefix fast-lookup, JWT, middleware
5. API routes: All 38 endpoints from API_ROUTES.md
6. Git: Initialize + push to GitHub

### Phase 6: Algorithm (~6 sessions)
1. Types + converters (DB ↔ Algorithm)
2. Layers 1-2 (block + fixed)
3. Layers 3-4 + scoring (gender + primary, 0-1000 formula)
4. Look-ahead (5-slot depth) + backtracking
5. Layers 5-8 (secondary with demand tracking, programs, gap, off)
6. Layer 9 optimizer + quality score + test suite

### Phase 7: Manager UI (~6 sessions)
1. Layout + sidebar + shadcn/ui setup
2. Dashboard
3. Nurse config + clinic config (default + weekly override)
4. Generate wizard (4 steps, drag-drop)
5. Self-scheduling
6. Requests, tasks, announcements

### Phase 8: Nurse UI (~3 sessions)
1. PIN login + bottom nav + mobile layout
2. Dashboard (with no-schedule states) + weekly schedule
3. Requests, preferences, tasks

### Phase 9: Learning (~2 sessions, optional)
1. Historical import (51 weeks → probability matrices)
2. Correction tracking (manager edits → update models)

### Phase 10: Deploy (~3 sessions)
1. Full test suite
2. SQLite → PostgreSQL + Vercel deploy
3. Polish + checklist + handoff

## Critical Notes for Claude Code
- nurse_profiles.json has NO gender/contractHours → use SEED_DATA.md mapping table
- Two nurses named "נסרין" → always use FULL names everywhere
- JSON array fields (SQLite) → use parseJsonArray/toJsonArray helpers
- ClinicDefaultConfig = template, ClinicWeeklyConfig = override → merge them
- FixedAssignment weekStart="1970-01-01" means permanent (sentinel value)
- Scoring is 0-1000 (raw addition, NO multiplied weights)
- Route structure: /api/schedule/nurse/me vs /api/schedule/week/[week] (NO conflicts)
