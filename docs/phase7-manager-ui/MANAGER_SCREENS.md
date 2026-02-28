# Manager Interface — FIXED

## Fixes:
- Added nurse config screen with all editable fields
- Added clinic config screen with default vs weekly override
- Added program assignment screen
- Added "Copy Previous Week" button for clinic config
- Added Excel export button
- Added impact analysis for request approvals

## Layout
- **Desktop-first** (manager works at computer)
- Left sidebar navigation
- Top bar: app name, notification bell, user menu
- RTL layout (dir="rtl")

## Sidebar Navigation
```
📊 Dashboard        /manager
📅 Schedule         /manager/schedule
⚡ Generate         /manager/schedule/generate
👤 Self-Assign      /manager/schedule/self-assign
👥 Nurses           /manager/nurses
🏥 Clinics          /manager/clinics
📋 Programs         /manager/programs
📝 Requests         /manager/requests
⚙️ Preferences      /manager/preferences
✅ Tasks            /manager/tasks
📢 Announcements    /manager/announcements
👤 Users            /manager/users
```

---

## Screen: Dashboard (/manager)
```
2-column grid:

LEFT:
┌──────────────────────────────────┐
│ ⚠ Pending Actions               │
│ 3 time-off requests    [Review]  │
│ 5/15 preferences submitted [View]│
│ Week 9 not generated   [Create]  │
└──────────────────────────────────┘

RIGHT:
┌──────────────────────────────────┐
│ 📊 This Week                     │
│ Nurses active:    12/15          │
│ Clinics covered:  100%           │
│ Quality score:    87/100         │
│ Warnings:         2              │
└──────────────────────────────────┘
```

---

## Screen: Schedule Grid (/manager/schedule)
```
Week navigator: ← Week 8 →
Status badge: DRAFT / GENERATED / PUBLISHED
[Export to Excel] button → calls GET /api/schedule/week/[week]/export

Grid: rows=nurses, columns=days
┌─────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│         │ SUN      │ MON      │ TUE      │ WED      │ THU      │
├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ נגלא    │ כירורגיה │ מקצועית  │ כירורגיה │ שד+מנטו  │ OFF      │
│ 28h     │ 08-16    │ 08-14    │ 08-16    │ 08-14    │          │
├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ נסרין מ │ עיניים 🔒│ עיניים 🔒│ עיניים 🔒│ עיניים 🔒│ OFF      │
│ 26h     │ 08-14    │ 08-14    │ 08-14    │ 08-14    │          │
└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Color coding:
  🔒 Blue border   = fixed (locked)
  🟢 Green         = algorithm-generated
  ⬜ Gray          = OFF day
  🟡 Orange border = preference mismatch
  🟣 Purple        = manager self-assigned
  
Left column shows nurse name + weekly contract hours
```

---

## Screen: Generate Wizard (/manager/schedule/generate)
```
4-step wizard:

STEP 1: Select Week
  - Date picker (select Sunday)
  - Summary: X active nurses, Y approved time-offs, Z preferences submitted

STEP 2: Review Configuration  
  - Clinic grid: days × clinics (from merged default + weekly config)
  - Approved time-off list
  - Fixed assignments
  - Nurse preferences (with notes)
  - [← Back] [Generate ⚡]

STEP 3: Review & Edit
  - Same grid as schedule page, but EDITABLE
  - Drag-and-drop: @dnd-kit library
  - On drop: validate constraints in real-time (show red border if invalid)
  - RIGHT sidebar: quality score, warnings list, unfilled gaps
  - [← Regenerate] [Publish ✅]

STEP 4: Published
  - "X nurses will be notified"
  - Link to view schedule
```

---

## Screen: Self-Assign (/manager/schedule/self-assign)
```
Split layout:

LEFT: Unfilled gaps (from managerGaps in generate result)
┌──────────────────────────────────┐
│ Unfilled Slots                   │
│ ☐ WED כירורגיה 08:00-14:00 (6h) │
│ ☐ THU מנטו 08:00-12:00 (4h)     │
│ [Auto-Suggest]                   │
└──────────────────────────────────┘

RIGHT: Manager's week view
┌──────────────────────────────────┐
│ Your Week                        │
│ Available: 28h (40h - 12h mgmt)  │
│ Assigned:  14h                   │
│ Remaining: 14h                   │
│ SUN: —                           │
│ MON: כירורגיה 08-16 (8h)        │
│ [Save & Done]                    │
└──────────────────────────────────┘
```

---

## Screen: Nurses (/manager/nurses) — FIXED: full config
```
Table:
| Name     | Contract | Shift Pref | Fri | Sat | MaxDays | Fixed       |
|----------|----------|------------|-----|-----|---------|-------------|
| נגלא     | 28h      | Anytime    | ✓   | ✓   | 5       | —           |
| נסרין מ  | 26h      | Anytime    | ✗   | ✓   | 5       | עיניים 🔒  |

Click row → /manager/nurses/[id] profile page

PROFILE PAGE for each nurse:
  Editable fields (calls PUT /api/nurses/[id]):
    - Contract hours (number input)
    - Shift preference (Morning / Afternoon / Anytime)
    - Can work Friday (toggle)
    - Can work Saturday (toggle)
    - Max days per week (1-6)
    - Recurring off days (multi-select: SUN-SAT)
    
  Blocked clinics section (calls PUT /api/nurses/[id]/blocked-clinics):
    - Multi-select dropdown: add/remove blocked clinics
    
  Fixed assignments (displayed, managed via FixedAssignment model):
    - List of clinic + day pairs
    - [Add Fixed] [Remove]
    
  Account actions:
    - [Reset PIN] — confirmation dialog
    - [Deactivate] — confirmation dialog
```

---

## Screen: Clinics (/manager/clinics) — FIXED: default + weekly
```
Two sections:

SECTION 1: Default Schedule (template for every week)
  Expandable list, each clinic shows:

  ▼ סכרת (Diabetes)
    Gender: ANY | Secondary: Yes (2h, need 1) | Status: Active
    
    DEFAULT TEMPLATE:
    | Day | Active | Start | End   | Nurses |
    |-----|--------|-------|-------|--------|
    | SUN | ✅     | 08:00 | 14:00 | 1      |
    | MON | ✅     | 08:00 | 14:00 | 1      |
    | TUE | ❌     |       |       |        |
    | WED | ✅     | 08:00 | 16:00 | 2      |
    | THU | ✅     | 08:00 | 14:00 | 1      |
    [Save Default]

SECTION 2: Weekly Overrides
  Week selector: ← Week 9 →
  [Copy From Previous Week] button → calls POST /api/clinics/config/copy
  
  Only show clinics with overrides for this week.
  [Add Override] button to create exception for a specific clinic+day.
  
  Each override shows diff from default:
  "סכרת WED: changed 08:00-16:00 (2 nurses) → 08:00-14:00 (1 nurse)"
```

---

## Screen: Programs (/manager/programs) — FIXED: complete
```
List of patient programs:

┌──────────────────────────────────────────────┐
│ מערך שד (Breast Cancer Program)              │
│ Type: PURE_PROGRAM | Hours: 7 | Active       │
│                                              │
│ This Week's Assignments:                     │
│ SUN: נגלא (5 patients)                       │
│ WED: הדיל (3 patients)                       │
│ [Assign Nurse to Day]                        │
└──────────────────────────────────────────────┘

[Assign Nurse to Day] opens dialog:
  Program: [dropdown]
  Nurse: [dropdown]
  Day: [dropdown]
  Patient count: [number]
  Calls POST /api/programs/assign
```

---

## Screen: Requests (/manager/requests)
```
Tabs: Pending | History

PENDING:
┌──────────────────────────────────────────────┐
│ 🏖 נגלא שוויקי — Vacation                    │
│ Feb 22-26 (5 days)                           │
│ Reason: "Family event"                       │
│                                              │
│ ⚠ Impact: Week 9 → 11 nurses available      │
│   WED may be short-staffed (10 needed)       │
│                                              │
│ Note: [________________]                     │
│ [✅ Approve]  [❌ Reject]                     │
└──────────────────────────────────────────────┘

Impact analysis: count available nurses for that week per day,
flag days where available < clinics needing nurses.
```

---

## Screen: Tasks, Announcements, Users — same as before
(See original design — no changes needed)

---

## Shared Components
```
- ScheduleGrid       — weekly grid (reused in schedule + generate)
- DayCell            — single cell (clinic + time + icons)
- NurseBadge         — nurse name (ALWAYS full name, never abbreviated)
- StatusBadge        — PENDING/APPROVED/REJECTED/PUBLISHED
- WeekNavigator      — ← Week N → with date range
- NotificationBell   — bell + unread count + dropdown
- Sidebar            — nav links with icons
- ImpactAnalysis     — "If approved, Week 9 has 11 nurses, WED short"
- ConfigMergeView    — shows default vs override for clinic config
```
