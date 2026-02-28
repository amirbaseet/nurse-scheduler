# Testing & Deployment — FIXED

## 1. Switch SQLite → PostgreSQL

### Schema changes:
```prisma
// Change provider
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Convert JSON string fields to real arrays:
// NurseProfile:
recurringOffDays DayOfWeek[]  // was String @default("[]")

// WeeklyPreference:
preferredDaysOff DayOfWeek[]  // was String @default("[]")
preferredDaysOn  DayOfWeek[]
preferredClinics String[]
avoidClinics     String[]

// Announcement:
targetNurseIds   String[]     // was String @default("[]")
```

### Migration steps:
```bash
# 1. Update schema.prisma with changes above
# 2. Delete old SQLite migration
rm -rf prisma/migrations
# 3. Set DATABASE_URL to Neon connection string
# 4. Generate fresh migration
npx prisma migrate dev --name init_postgresql
# 5. Seed the database
npx prisma db seed
```

### Code changes:
- Remove `src/lib/json-arrays.ts` utility
- Find/replace all `parseJsonArray()` calls → direct array access
- Find/replace all `toJsonArray()` calls → direct array assignment

## 2. Neon Database Setup
1. Go to neon.tech → create free account
2. Create project "nurse-scheduler"
3. Copy connection string: `postgresql://user:pass@host/dbname?sslmode=require`
4. Set as `DATABASE_URL` in .env and Vercel

## 3. Vercel Deployment
1. Push code to GitHub
2. Import repo at vercel.com
3. Set environment variables:
   - `DATABASE_URL` = Neon connection string
   - `JWT_SECRET` = random 64-char string
   - `NEXT_PUBLIC_APP_NAME` = "NurseScheduler Pro"
   - `NEXT_PUBLIC_DEFAULT_LOCALE` = "he"
4. Deploy (auto on git push)

## 4. Post-Deploy Checklist
```
AUTH:
  □ Login works with nurse PIN
  □ Login works with manager PIN
  □ Wrong PIN shows error
  □ 3 wrong attempts → lockout message
  □ Logout clears session

MANAGER:
  □ Dashboard shows correct counts
  □ Nurse config: edit hours, shift pref, blocked clinics
  □ Clinic config: default template works
  □ Clinic config: weekly override works
  □ Generate schedule → see result with quality score
  □ Drag-drop edit → saves correctly
  □ Publish → nurses notified
  □ Self-assign → see unfilled gaps
  □ Approve/reject request → nurse notified
  □ Create task → assigned nurse notified
  □ Post announcement → all nurses notified
  □ Export to Excel → downloads .xlsx file

NURSE:
  □ Dashboard shows today + tomorrow
  □ Dashboard shows "not published" when appropriate
  □ Fri/Sat → shows next week prominently
  □ Weekly schedule view with week navigator
  □ Submit time-off request → manager notified
  □ Submit preferences → saved with timestamp
  □ View tasks, mark done → manager notified
  □ View announcements, auto-mark read

ALGORITHM:
  □ All 24 MUST-PASS tests pass
  □ Schedule generates in < 3 seconds
  □ Quality score > 70 for normal week
  □ Fixed assignments never changed
  □ Gender constraints respected

UI/UX:
  □ RTL layout correct (sidebar on right, text right-aligned)
  □ Hebrew text displays properly
  □ Arabic text displays properly (switch language)
  □ Mobile responsive (test at 375px width)
  □ No console errors
  □ Notification bell shows unread count
```

## 5. Performance Targets
- Page load: < 2 seconds (first load)
- Schedule generation: < 3 seconds
- API response: < 500ms
- Mobile: works on 3G connection

## 6. Free Tier Limits
```
Vercel:  100GB bandwidth/month → plenty for 16 users
Neon:    0.5GB storage → years of schedules
GitHub:  unlimited private repos
Total:   $0/month
```
