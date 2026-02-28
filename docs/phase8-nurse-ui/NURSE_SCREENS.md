# Nurse Interface — FIXED

## Fixes:
- GAP 3: Added "no published schedule" state handling
- Added Fri/Sat → show next week logic
- Two nurses named נסרין: always show full name

## Layout
- **Mobile-first** (nurses use phones)
- Bottom navigation bar with 5 tabs
- Top bar: app name + notification bell
- RTL layout (dir="rtl")
- Touch targets: minimum 44px
- Must work at 375px width

## Bottom Navigation
```
📅 Dashboard    /nurse
📅 Schedule     /nurse/schedule
🏖 Requests     /nurse/requests
⚙️ Preferences  /nurse/preferences
📋 Tasks        /nurse/tasks
```

---

## Screen: Login (/)
```
┌─────────────────────────────┐
│    NurseScheduler Pro       │
│                             │
│    Enter your PIN:          │
│    ┌──┐ ┌──┐ ┌──┐ ┌──┐    │
│    │  │ │  │ │  │ │  │    │
│    └──┘ └──┘ └──┘ └──┘    │
│                             │
│    [Login]                  │
│    Error: "PIN incorrect"   │
│    [עברית / العربية]         │
└─────────────────────────────┘

Behavior:
  - 4 large boxes (auto-detect 6 for manager)
  - Auto-focus next on input
  - Backspace goes to previous
  - Auto-submit when all filled
  - Shake animation on error
  - 3 attempts → "Locked for 5 minutes" message
```

---

## Screen: Dashboard (/nurse) — FIXED: no-schedule states
```
┌─────────────────────────────┐
│ NurseScheduler        [🔔 2]│
├─────────────────────────────┤
│ שלום, נגלא שוויקי 👋        │  ← ALWAYS full name
│                             │
│ STATE A: Schedule published │
│ ┌─────────────────────────┐ │
│ │ 📅 TODAY — Sun, Feb 15  │ │
│ │ כירורגיה + א.א.ג        │ │
│ │ 08:00 — 16:00 (8h)     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 📅 TOMORROW — Mon       │ │
│ │ מקצועית                  │ │
│ │ 08:00 — 14:00 (6h)     │ │
│ └─────────────────────────┘ │
│                             │
│ STATE B: No schedule yet    │
│ ┌─────────────────────────┐ │
│ │ 📅 This week's schedule │ │
│ │ not yet published.      │ │
│ │ Check back later.       │ │
│ └─────────────────────────┘ │
│                             │
│ STATE C: It's Fri/Sat      │
│ Show NEXT WEEK prominently: │
│ ┌─────────────────────────┐ │
│ │ 📅 NEXT WEEK            │ │
│ │ SUN: כירורגיה 08-16     │ │
│ │ MON: מקצועית 08-14      │ │
│ └─────────────────────────┘ │
│ + smaller "This Week" below │
│                             │
│ 🔔 Announcements (latest 3)│
│ 📋 Tasks (pending count)   │
├─────────────────────────────┤
│ [📅][📅][🏖][⚙️][📋]       │
└─────────────────────────────┘

Logic:
  response = GET /api/schedule/nurse/me
  IF response.status == "NOT_PUBLISHED":
    Show State B
  ELSE IF today is FRI or SAT:
    Show State C (next week + current week)
  ELSE:
    Show State A (today + tomorrow)
```

---

## Screen: Weekly Schedule (/nurse/schedule)
```
┌─────────────────────────────┐
│ ← Back     My Schedule   →  │
│         Feb 15-21           │
├─────────────────────────────┤
│                             │
│ ┌─────────────────────────┐ │
│ │ SUN 15          TODAY ● │ │
│ │ כירורגיה + א.א.ג        │ │
│ │ 08:00 — 16:00 (8h)     │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ WED 18                  │ │
│ │ שד + מנטו               │ │
│ │ 08:00 — 14:00 (6h)     │ │
│ │ +2 patients (סכרת)      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ THU 19    🏖 OFF        │ │
│ └─────────────────────────┘ │
│                             │
│ Total: 28h / 28h contract   │
│ 4 days on, 3 days off       │
│                             │
│ IF no published schedule:   │
│ "הלו״ז טרם פורסם"           │
│ "Schedule not yet published" │
├─────────────────────────────┤
│ [📅][📅][🏖][⚙️][📋]       │
└─────────────────────────────┘

Features:
  - Week navigator (← →)
  - Today highlighted with dot
  - Patient calls shown as "+N patients (program)"
  - Weekly summary: assigned hours / contract hours
  - Only PUBLISHED schedules visible
```

---

## Screen: Requests (/nurse/requests)
```
CREATE REQUEST:
  Type: [🏖 Vacation] [📅 Off Day] [🏥 Sick]
  
  IF Vacation/Sick:
    From: [Date picker]  To: [Date picker]
  IF Off Day:
    Date: [Date picker] (single day)
  
  Reason: [optional text]
  [Submit Request]

Validation:
  - Date must be in future
  - No duplicate pending request for same dates
  - Confirmation dialog before submit

MY REQUESTS:
  ⏳ Feb 22-26 — Vacation — PENDING
  ✅ Feb 10 — Off Day — APPROVED
  ❌ Jan 15 — Off Day — REJECTED
     Manager note: "Short staffed, need you Wednesday"
```

---

## Screen: Preferences (/nurse/preferences)
```
┌─────────────────────────────┐
│ Preferences — Week of       │
│ Feb 22-28                   │
│                             │
│ ⚠ Submit before Thursday    │
│                             │
│ SHIFT PREFERENCE:           │
│ ○ Morning (08:00-14:00)    │
│ ● Afternoon (13:00-19:00)  │
│ ○ Anytime                   │
│ ○ Keep my default           │
│                             │
│ PREFERRED DAYS OFF:         │
│ (select up to 2)            │
│ □Sun □Mon ■Tue □Wed □Thu   │
│ ■Fri □Sat                   │
│                             │
│ NOTES TO MANAGER:           │
│ [Text area]                 │
│                             │
│ [Save Preferences]          │
│ ✓ Saved Feb 12, 14:30      │
│                             │
│ IF deadline passed:         │
│ "Preferences locked"        │
└─────────────────────────────┘
```

---

## Screen: Tasks (/nurse/tasks)
```
PENDING:
  ☐ Check emergency cart — due Feb 17 — [Mark as Done ✅]
  
COMPLETED (collapsed):
  ☑ CPR training — done Feb 10
```

---

## Screen: Announcements (from dashboard)
```
🔴 URGENT — Schedule Change This Week (Feb 12)
⚪ INFO — Staff Meeting Thursday (Feb 10)

Auto-mark as read when scrolled into view (IntersectionObserver).
```

---

## Shared Components (Nurse)
```
- PinInput          — 4/6 digit boxes with auto-focus
- BottomNav         — 5 tabs, highlight active
- DayCard           — single day: clinic + time + extras
- WeekNavigator     — ← Week →
- RequestForm       — type + dates + reason
- PreferencesForm   — shift + days + notes
- StatusBadge       — PENDING/APPROVED/REJECTED
- NotificationBell  — bell + count
- LanguageToggle    — Hebrew/Arabic switch
- EmptyState        — "No schedule published" / "No tasks" etc.
```

## RTL Notes
- All text right-aligned by default
- Tailwind logical properties: ms-/me-/ps-/pe-/text-start/text-end
- Calendar: week starts Sunday
- Numbers remain LTR (dates, times)
