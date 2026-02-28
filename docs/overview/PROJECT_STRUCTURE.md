# Project Structure

```
nurse-scheduler/
├── prisma/
│   ├── schema.prisma              — Database schema (all tables)
│   ├── migrations/                — Auto-generated migration files
│   └── seed.ts                    — Import 15 nurses + clinic data
│
├── src/
│   ├── app/                       — Next.js App Router
│   │   ├── layout.tsx             — Root layout (RTL, fonts, providers)
│   │   ├── page.tsx               — Login page (PIN entry)
│   │   │
│   │   ├── nurse/                 — NURSE pages
│   │   │   ├── layout.tsx         — Bottom nav, auth check
│   │   │   ├── page.tsx           — Dashboard
│   │   │   ├── schedule/page.tsx  — Weekly schedule
│   │   │   ├── requests/page.tsx  — Time-off requests
│   │   │   ├── preferences/page.tsx — Weekly preferences
│   │   │   ├── tasks/page.tsx     — My tasks
│   │   │   └── announcements/page.tsx — Announcements
│   │   │
│   │   ├── manager/               — MANAGER pages
│   │   │   ├── layout.tsx         — Sidebar nav, auth check
│   │   │   ├── page.tsx           — Dashboard
│   │   │   ├── schedule/page.tsx  — View/edit schedule
│   │   │   ├── schedule/generate/page.tsx — Generate wizard
│   │   │   ├── schedule/self-assign/page.tsx — Manager gaps
│   │   │   ├── nurses/page.tsx    — Nurse list
│   │   │   ├── nurses/[id]/page.tsx — Nurse profile
│   │   │   ├── clinics/page.tsx   — Clinic config
│   │   │   ├── programs/page.tsx  — Patient programs
│   │   │   ├── requests/page.tsx  — Approve/reject
│   │   │   ├── preferences/page.tsx — View all prefs
│   │   │   ├── tasks/page.tsx     — Assign tasks
│   │   │   ├── announcements/page.tsx — Post announcements
│   │   │   └── users/page.tsx     — Manage PINs
│   │   │
│   │   └── api/                   — API routes
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── schedule/
│   │       │   ├── nurse/me/route.ts        — My schedule
│   │       │   ├── nurse/me/[week]/route.ts — My schedule for week
│   │       │   ├── week/[week]/route.ts     — Full grid (manager)
│   │       │   ├── week/[week]/export/route.ts — Excel export
│   │       │   ├── generate/route.ts        — Run algorithm
│   │       │   └── [id]/
│   │       │       ├── publish/route.ts
│   │       │       └── assign/route.ts
│   │       ├── nurses/
│   │       │   ├── route.ts                 — List / create
│   │       │   └── [id]/route.ts            — Update profile
│   │       ├── clinics/
│   │       │   ├── route.ts                 — List clinics
│   │       │   ├── [id]/route.ts            — Update clinic
│   │       │   ├── config/[week]/route.ts   — Get/set weekly config
│   │       │   └── config/copy/route.ts     — Copy week config
│   │       ├── programs/
│   │       │   ├── route.ts                 — List / create programs
│   │       │   ├── [id]/route.ts            — Update program
│   │       │   └── assign/route.ts          — Assign to nurse
│   │       ├── requests/
│   │       │   ├── route.ts                 — Create (nurse)
│   │       │   ├── my/route.ts              — My requests
│   │       │   ├── pending/route.ts         — Pending (manager)
│   │       │   └── [id]/
│   │       │       ├── approve/route.ts
│   │       │       └── reject/route.ts
│   │       ├── preferences/
│   │       │   ├── route.ts                 — Submit (nurse)
│   │       │   ├── my/[week]/route.ts       — My prefs
│   │       │   └── week/[week]/route.ts     — All prefs (manager)
│   │       ├── tasks/
│   │       │   ├── route.ts                 — Create (manager) / list all
│   │       │   ├── my/route.ts              — My tasks
│   │       │   └── [id]/done/route.ts       — Mark done
│   │       ├── announcements/
│   │       │   ├── route.ts                 — Create / list
│   │       │   └── [id]/read/route.ts       — Mark read
│   │       ├── users/
│   │       │   ├── route.ts                 — List / create
│   │       │   └── [id]/
│   │       │       ├── pin/route.ts         — Reset PIN
│   │       │       └── deactivate/route.ts
│   │       └── notifications/
│   │           ├── route.ts                 — Get unread
│   │           └── [id]/read/route.ts       — Mark read
│   │
│   ├── lib/                       — Shared libraries
│   │   ├── db.ts                  — Prisma client singleton
│   │   ├── auth.ts                — JWT sign/verify/middleware
│   │   ├── pin.ts                 — bcrypt hash/verify
│   │   ├── permissions.ts         — Role-based access
│   │   ├── validations.ts         — Zod schemas
│   │   ├── json-arrays.ts         — Parse/stringify JSON array fields (SQLite compat)
│   │   └── utils.ts               — Date helpers, formatting
│   │
│   ├── algorithm/                 — Scheduling engine
│   │   ├── index.ts               — Main generate() function
│   │   ├── types.ts               — Algorithm types & interfaces
│   │   ├── converters.ts          — DB ↔ Algorithm data conversion
│   │   ├── scoring.ts             — Candidate ranking formula
│   │   ├── difficulty-queue.ts    — MCV heuristic
│   │   ├── look-ahead.ts          — Downstream flexibility check
│   │   ├── backtrack.ts           — Recovery when stuck
│   │   └── layers/
│   │       ├── 1-block.ts         — Block unavailable
│   │       ├── 2-fixed.ts         — Fixed assignments
│   │       ├── 3-gender.ts        — Gender clinics
│   │       ├── 4-primary.ts       — Primary clinics
│   │       ├── 5-secondary.ts     — Secondary clinics
│   │       ├── 6-programs.ts      — Patient call addons
│   │       ├── 7-gap-fill.ts      — Hours gap filling
│   │       ├── 8-off-days.ts      — Off-days
│   │       └── 9-optimize.ts      — Simulated annealing
│   │
│   ├── learning/                  — ML engine (Phase 9)
│   ├── components/                — UI components
│   ├── hooks/                     — React hooks
│   ├── i18n/                      — Translations (he.json, ar.json)
│   └── types/                     — TypeScript types
│
├── tests/                         — Test files
├── data/                          — Seed data (JSON files)
├── docs/                          — These documentation files
└── package.json
```
