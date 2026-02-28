# API Routes — FIXED (38 Endpoints, was 28)

## Fixes Applied:
- QUALITY 3: Route structure fixed (no /schedule/my vs /schedule/[week] conflict)
- GAP 1: Added 10 missing config endpoints (nurses, clinics, programs)
- GAP 2: Added "copy week" endpoint for clinic config
- GAP 8: Added Excel export endpoint
- QUALITY 4: Algorithm endpoint wrapped in try/catch
- QUALITY 5: Preference notification debounced (thresholds only)

## Pattern
Every API route follows:
1. Auth check (requireAuth)
2. Role check (requireRole)
3. Input validation (Zod)
4. Business logic (Prisma)
5. Side effects (notifications)
6. Response (JSON + status code)

Error handling: All routes return `{ error: string, details?: string }` on failure.

---

## GROUP 1: AUTH (2 endpoints)

### POST /api/auth/login
```
Auth: none (public)
Input: { pin: string }
Logic: See AUTH_SYSTEM.md (pinPrefix lookup → bcrypt → JWT)
Returns: { user: { id, name, role }, redirect: string }
Errors: 401 (bad PIN), 429 (locked out)
```

### POST /api/auth/logout
```
Auth: requireAuth()
Logic: Clear JWT cookie
Returns: { success: true }
```

---

## GROUP 2: SCHEDULE (7 endpoints, was 6)

### GET /api/schedule/nurse/me
```
Auth: requireAuth()
Logic:
  currentWeek = getWeekStart(today)
  assignments = DB.scheduleAssignment.findMany({
    where: { 
      nurseId: currentUser.nurseProfile.id,
      schedule: { weekStart: currentWeek, status: PUBLISHED }
    },
    include: { primaryClinic: true, secondaryClinic: true },
    orderBy: { day: asc }
  })
  
  IF no published schedule for current week:
    Return { assignments: [], weekStart: currentWeek, status: "NOT_PUBLISHED" }

Returns: { assignments: ScheduleAssignment[], weekStart, status }
```

### GET /api/schedule/nurse/me/[week]
```
Auth: requireAuth()
Params: week (date string, e.g. "2026-02-22")
Logic: Same as above but for specific week
Returns: { assignments, weekStart, status }
```

### GET /api/schedule/week/[week]
```
Auth: requireAuth(MANAGER)
Params: week (date string)
Logic:
  schedule = DB.weeklySchedule.findUnique({
    where: { weekStart: parseDate(week) },
    include: { 
      assignments: { 
        include: { nurse: { include: { user: true } }, primaryClinic: true, secondaryClinic: true }
      } 
    }
  })
Returns: WeeklySchedule with all assignments and relations, or null
```

### POST /api/schedule/generate
```
Auth: requireAuth(MANAGER)
Input: { weekStart: string }
Logic:
  TRY:
    // Load all config from DB
    nurses = DB.nurseProfile.findMany({
      where: { user: { isActive: true }, isManager: false },
      include: { user: true, blockedClinics: true, fixedAssignments: true }
    })
    
    // Merge default + weekly clinic configs
    defaults = DB.clinicDefaultConfig.findMany({ where: { isActive: true } })
    overrides = DB.clinicWeeklyConfig.findMany({ where: { weekStart } })
    clinics = mergeClinicConfigs(defaults, overrides)
    // mergeClinicConfigs: for each clinic+day, use override if exists, else default
    
    timeOff = DB.timeOffRequest.findMany({
      where: { status: APPROVED, startDate: { lte: weekEnd }, endDate: { gte: weekStart } }
    })
    
    fixed = DB.fixedAssignment.findMany({
      where: { OR: [
        { weekStart: new Date("1970-01-01") },  // permanent
        { weekStart: weekStart }                  // this week only
      ]},
      include: { clinic: true }
    })
    
    programs = DB.programAssignment.findMany({ where: { weekStart } })
    preferences = DB.weeklyPreference.findMany({ where: { weekStart } })
    
    // Run algorithm
    result = generateWeeklySchedule(weekStart, { nurses, clinics, timeOff, fixed, programs, preferences })
    
    // Save results (upsert schedule, replace assignments)
    schedule = DB.weeklySchedule.upsert({
      where: { weekStart },
      create: { weekStart, status: GENERATED, qualityScore: result.qualityScore, generatedAt: now() },
      update: { status: GENERATED, qualityScore: result.qualityScore, generatedAt: now() }
    })
    
    await DB.$transaction([
      DB.scheduleAssignment.deleteMany({ where: { scheduleId: schedule.id } }),
      DB.scheduleAssignment.createMany({ data: result.assignments.map(a => ({ ...a, scheduleId: schedule.id })) })
    ])
    
    Returns: { schedule, warnings, qualityScore, managerGaps }

  CATCH error:
    Returns 500: { error: "Schedule generation failed", details: error.message }
```

### PUT /api/schedule/[id]/assign
```
Auth: requireAuth(MANAGER)
Input: { assignmentId: string, nurseId?: string, primaryClinicId?: string, 
         secondaryClinicId?: string, shiftStart?: string, shiftEnd?: string, notes?: string }
Logic:
  old = DB.scheduleAssignment.findUnique({ where: { id: assignmentId } })
  
  updated = DB.scheduleAssignment.update({
    where: { id: assignmentId },
    data: { ...input, modifiedBy: currentUser.id, modifiedAt: now() }
  })
  
  // Save correction for learning engine
  IF old.nurseId != input.nurseId OR old.primaryClinicId != input.primaryClinicId:
    DB.scheduleCorrection.create({
      data: {
        scheduleId: old.scheduleId, day: old.day,
        originalNurseId: old.nurseId, originalClinicId: old.primaryClinicId,
        correctedNurseId: input.nurseId, correctedClinicId: input.primaryClinicId,
        correctionType: determineType(old, input) // "swap", "remove", "add", "change_shift"
      }
    })

Returns: Updated ScheduleAssignment
```

### POST /api/schedule/[id]/publish
```
Auth: requireAuth(MANAGER)
Logic:
  DB.weeklySchedule.update({ where: { id }, data: { status: PUBLISHED, publishedAt: now() } })
  
  nurses = DB.user.findMany({ where: { role: NURSE, isActive: true } })
  FOR EACH nurse:
    DB.notification.create({
      userId: nurse.id, type: "schedule_published",
      title: "הלו״ז השבועי פורסם", link: "/nurse/schedule"
    })

Returns: { success: true }
```

### GET /api/schedule/week/[week]/export — NEW
```
Auth: requireAuth(MANAGER)
Logic:
  schedule = load full schedule with all assignments
  Generate .xlsx file using xlsx library:
    - Row per nurse, column per day
    - Each cell: clinic name, shift time, secondary, patient calls
    - Format to match manager's current Excel layout
  Return file as download

Returns: .xlsx file (Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
```

---

## GROUP 3: NURSE MANAGEMENT (3 endpoints) — NEW

### GET /api/nurses
```
Auth: requireAuth(MANAGER)
Logic: DB.nurseProfile.findMany({
  include: { user: true, blockedClinics: { include: { clinic: true } }, fixedAssignments: { include: { clinic: true } } },
  where: { user: { isActive: true } }
})
Returns: NurseProfile[] with user info, blocked clinics, fixed assignments
```

### PUT /api/nurses/[id]
```
Auth: requireAuth(MANAGER)
Input: { contractHours?: number, shiftPreference?: ShiftPref, canWorkFriday?: boolean,
         canWorkSaturday?: boolean, maxDaysPerWeek?: number, employmentType?: Employment,
         recurringOffDays?: DayOfWeek[] }
Validate: contractHours > 0, maxDaysPerWeek 1-7
Logic:
  DB.nurseProfile.update({
    where: { id },
    data: { ...input, recurringOffDays: toJsonArray(input.recurringOffDays) }
  })
Returns: Updated NurseProfile
```

### PUT /api/nurses/[id]/blocked-clinics
```
Auth: requireAuth(MANAGER)
Input: { clinicIds: string[] }
Logic:
  // Replace all blocked clinics
  DB.$transaction([
    DB.nurseBlockedClinic.deleteMany({ where: { nurseId: id } }),
    DB.nurseBlockedClinic.createMany({ data: clinicIds.map(c => ({ nurseId: id, clinicId: c })) })
  ])
Returns: { success: true }
```

---

## GROUP 4: CLINIC MANAGEMENT (5 endpoints) — NEW

### GET /api/clinics
```
Auth: requireAuth(MANAGER)
Logic: DB.clinic.findMany({
  include: { defaultConfigs: true },
  orderBy: { name: asc }
})
Returns: Clinic[] with default configs
```

### PUT /api/clinics/[id]
```
Auth: requireAuth(MANAGER)
Input: { name?: string, genderPref?: GenderPref, canBeSecondary?: boolean,
         secondaryHours?: number, secondaryNursesNeeded?: number, isActive?: boolean }
Logic: DB.clinic.update({ where: { id }, data: { ...input } })
Returns: Updated Clinic
```

### GET /api/clinics/config/[week]
```
Auth: requireAuth(MANAGER)
Params: week (date string)
Logic:
  defaults = DB.clinicDefaultConfig.findMany({ include: { clinic: true } })
  overrides = DB.clinicWeeklyConfig.findMany({ where: { weekStart: parseDate(week) }, include: { clinic: true } })
  
  // Merge: for each clinic+day, return override if exists, else default
  merged = mergeClinicConfigs(defaults, overrides)

Returns: MergedClinicConfig[] (each has: clinicId, clinicName, day, shiftStart, shiftEnd, nursesNeeded, isActive, isOverride)
```

### PUT /api/clinics/config/[week]
```
Auth: requireAuth(MANAGER)
Input: { configs: [{ clinicId, day, shiftStart, shiftEnd, nursesNeeded, isActive }] }
Logic:
  FOR EACH config IN input.configs:
    DB.clinicWeeklyConfig.upsert({
      where: { clinicId_weekStart_day: { clinicId: config.clinicId, weekStart: parseDate(week), day: config.day } },
      create: { ...config, weekStart: parseDate(week) },
      update: { ...config }
    })
Returns: { success: true, count: number }
```

### POST /api/clinics/config/copy — NEW
```
Auth: requireAuth(MANAGER)
Input: { fromWeek: string, toWeek: string }
Logic:
  // Copy overrides from one week to another
  existing = DB.clinicWeeklyConfig.findMany({ where: { weekStart: parseDate(fromWeek) } })
  FOR EACH config IN existing:
    DB.clinicWeeklyConfig.upsert({
      where: { clinicId_weekStart_day: { clinicId: config.clinicId, weekStart: parseDate(toWeek), day: config.day } },
      create: { ...config, id: undefined, weekStart: parseDate(toWeek) },
      update: { shiftStart: config.shiftStart, shiftEnd: config.shiftEnd, nursesNeeded: config.nursesNeeded, isActive: config.isActive }
    })
Returns: { success: true, copied: number }
```

---

## GROUP 5: PROGRAM MANAGEMENT (3 endpoints) — NEW

### GET /api/programs
```
Auth: requireAuth(MANAGER)
Logic: DB.patientProgram.findMany({ orderBy: { name: asc } })
Returns: PatientProgram[]
```

### PUT /api/programs/[id]
```
Auth: requireAuth(MANAGER)
Input: { name?, type?, linkedClinicCode?, defaultHours? }
Logic: DB.patientProgram.update({ where: { id }, data: { ...input } })
Returns: Updated PatientProgram
```

### POST /api/programs/assign
```
Auth: requireAuth(MANAGER)
Input: { programId, nurseId, weekStart, day, patientCount?, shiftStart?, shiftEnd? }
Logic: DB.programAssignment.create({ data: { ...input } })
Returns: ProgramAssignment (201)
```

---

## GROUP 6: REQUESTS (5 endpoints)

### GET /api/requests/my
```
Auth: requireAuth()
Logic: DB.timeOffRequest.findMany({ where: { nurseId: currentUser.id }, orderBy: { requestedAt: desc } })
Returns: TimeOffRequest[]
```

### POST /api/requests
```
Auth: requireAuth(NURSE)
Input: { type: RequestType, startDate: string, endDate: string, reason?: string }
Validate:
  - startDate must be in the future
  - endDate >= startDate
  - If type == OFF_DAY: startDate must equal endDate
  - No duplicate pending request for same dates
Logic:
  request = DB.timeOffRequest.create({ nurseId: currentUser.id, ...input, status: PENDING })
  
  manager = DB.user.findFirst({ where: { role: MANAGER } })
  DB.notification.create({
    userId: manager.id, type: "new_request",
    title: currentUser.name + " — בקשת " + type, link: "/manager/requests"
  })

Returns: TimeOffRequest (201)
```

### GET /api/requests/pending
```
Auth: requireAuth(MANAGER)
Logic: DB.timeOffRequest.findMany({
  where: { status: PENDING },
  include: { nurse: true },
  orderBy: { requestedAt: asc }
})
Returns: TimeOffRequest[] with nurse info
```

### PUT /api/requests/[id]/approve
```
Auth: requireAuth(MANAGER)
Input: { managerNote?: string }
Logic:
  request = DB.timeOffRequest.update({ where: { id }, data: { status: APPROVED, managerNote, respondedAt: now() } })
  DB.notification.create({
    userId: request.nurseId, type: "request_approved",
    title: "הבקשה שלך אושרה ✅", link: "/nurse/requests"
  })
Returns: TimeOffRequest
```

### PUT /api/requests/[id]/reject
```
Auth: requireAuth(MANAGER)
Input: { managerNote?: string }
Logic:
  request = DB.timeOffRequest.update({ where: { id }, data: { status: REJECTED, managerNote, respondedAt: now() } })
  DB.notification.create({
    userId: request.nurseId, type: "request_rejected",
    title: "הבקשה שלך נדחתה ❌", body: managerNote, link: "/nurse/requests"
  })
Returns: TimeOffRequest
```

---

## GROUP 7: PREFERENCES (3 endpoints)

### GET /api/preferences/my/[week]
```
Auth: requireAuth()
Logic: DB.weeklyPreference.findUnique({
  where: { nurseId_weekStart: { nurseId: currentUser.id, weekStart: parseDate(week) } }
})
Returns: WeeklyPreference | null
```

### POST /api/preferences
```
Auth: requireAuth(NURSE)
Input: { weekStart: string, shiftPreference?: ShiftPref, preferredDaysOff?: DayOfWeek[], notes?: string }
Validate: weekStart is a Sunday, weekStart >= current week
Logic:
  pref = DB.weeklyPreference.upsert({
    where: { nurseId_weekStart: { nurseId: currentUser.id, weekStart } },
    create: { nurseId: currentUser.id, ...input, preferredDaysOff: toJsonArray(input.preferredDaysOff), submittedAt: now() },
    update: { ...input, preferredDaysOff: toJsonArray(input.preferredDaysOff), submittedAt: now() }
  })
  
  // Debounced notification: only at thresholds
  count = DB.weeklyPreference.count({ where: { weekStart } })
  total = DB.user.count({ where: { role: NURSE, isActive: true } })
  IF count IN [5, 10, total]:  // only notify at milestones
    manager = DB.user.findFirst({ where: { role: MANAGER } })
    DB.notification.create({
      userId: manager.id, type: "preference_submitted",
      title: count + "/" + total + " העדפות הוגשו"
    })

Returns: WeeklyPreference
```

### GET /api/preferences/week/[week]
```
Auth: requireAuth(MANAGER)
Logic: DB.weeklyPreference.findMany({
  where: { weekStart: parseDate(week) },
  include: { nurse: true }
})
Returns: WeeklyPreference[] with nurse info
```

---

## GROUP 8: TASKS (4 endpoints)

### GET /api/tasks/my
```
Auth: requireAuth()
Logic: DB.task.findMany({ 
  where: { OR: [{ assignedToId: currentUser.id }, { isForAll: true }] },
  orderBy: { createdAt: desc }
})
Returns: Task[]
```

### POST /api/tasks
```
Auth: requireAuth(MANAGER)
Input: { title, description?, assignedToId?, isForAll, dueDate?, priority }
Validate: If !isForAll, assignedToId is required
Logic:
  task = DB.task.create({ ...input, createdById: currentUser.id, status: PENDING })
  
  IF isForAll:
    nurses = DB.user.findMany({ where: { role: NURSE, isActive: true } })
    FOR EACH nurse:
      DB.notification.create({ userId: nurse.id, type: "task_assigned", title: "משימה חדשה: " + title })
  ELSE:
    DB.notification.create({ userId: assignedToId, type: "task_assigned", title: "משימה חדשה: " + title })

Returns: Task (201)
```

### PUT /api/tasks/[id]/done
```
Auth: requireAuth()
Logic:
  task = DB.task.update({ where: { id }, data: { status: DONE, completedAt: now() } })
  DB.notification.create({
    userId: task.createdById, type: "task_completed",
    title: currentUser.name + " השלים/ה: " + task.title
  })
Returns: Task
```

### GET /api/tasks
```
Auth: requireAuth(MANAGER)
Logic: DB.task.findMany({ include: { assignedTo: true }, orderBy: { createdAt: desc } })
Returns: Task[] with assignee info
```

---

## GROUP 9: ANNOUNCEMENTS (3 endpoints)

### GET /api/announcements
```
Auth: requireAuth()
Logic:
  DB.announcement.findMany({
    where: {
      AND: [
        { OR: [{ targetAll: true }, { targetNurseIds: { contains: currentUser.id } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] }
      ]
    },
    include: { author: true, reads: { where: { userId: currentUser.id } } },
    orderBy: { createdAt: desc }
  })
Returns: Announcement[] (with isRead computed from reads)
```

### POST /api/announcements
```
Auth: requireAuth(MANAGER)
Input: { title, body, priority, targetAll, targetNurseIds?, expiresAt? }
Logic:
  announcement = DB.announcement.create({
    ...input, authorId: currentUser.id, targetNurseIds: toJsonArray(input.targetNurseIds)
  })
  
  targets = targetAll ? 
    DB.user.findMany({ where: { role: NURSE, isActive: true } }) :
    DB.user.findMany({ where: { id: { in: targetNurseIds } } })
  
  FOR EACH nurse IN targets:
    DB.notification.create({
      userId: nurse.id, type: "new_announcement",
      title: (priority == "URGENT" ? "🔴 " : "") + title, link: "/nurse/announcements"
    })
Returns: Announcement (201)
```

### PUT /api/announcements/[id]/read
```
Auth: requireAuth()
Logic: DB.announcementRead.upsert({
  where: { announcementId_userId: { announcementId: id, userId: currentUser.id } },
  create: { announcementId: id, userId: currentUser.id },
  update: { readAt: now() }
})
Returns: { success: true }
```

---

## GROUP 10: USERS (4 endpoints)

### GET /api/users
```
Auth: requireAuth(MANAGER)
Logic: DB.user.findMany({ include: { nurseProfile: true }, orderBy: { name: asc } })
Returns: User[] with profiles
```

### POST /api/users
```
Auth: requireAuth(MANAGER)
Input: { name, nameAr?, role, pin, gender, contractHours, phone? }
Validate: PIN is 4 digits (nurse) or 6 digits (manager), PIN not already used
Logic:
  pinHash = bcrypt.hash(pin, 10)
  pinPrefix = pin.substring(0, 2)
  user = DB.user.create({ name, nameAr, role, pinHash, pinPrefix, phone })
  DB.nurseProfile.create({ userId: user.id, gender, contractHours })
Returns: User (201) — PIN returned in response only once, never stored plaintext
```

### PUT /api/users/[id]/pin
```
Auth: requireAuth(MANAGER)
Input: { newPin: string }
Validate: PIN length, uniqueness
Logic: DB.user.update({
  where: { id },
  data: { pinHash: bcrypt.hash(newPin, 10), pinPrefix: newPin.substring(0, 2) }
})
Returns: { success: true }
```

### PUT /api/users/[id]/deactivate
```
Auth: requireAuth(MANAGER)
Logic: DB.user.update({ where: { id }, data: { isActive: false } })
Returns: { success: true }
```

---

## GROUP 11: NOTIFICATIONS (2 endpoints)

### GET /api/notifications
```
Auth: requireAuth()
Logic:
  notifications = DB.notification.findMany({
    where: { userId: currentUser.id, isRead: false },
    orderBy: { createdAt: desc },
    take: 20
  })
  unreadCount = DB.notification.count({ where: { userId: currentUser.id, isRead: false } })
Returns: { notifications, unreadCount }
```

### PUT /api/notifications/[id]/read
```
Auth: requireAuth()
Logic: DB.notification.update({ where: { id, userId: currentUser.id }, data: { isRead: true } })
Returns: { success: true }
```

---

## TOTAL: 38 Endpoints

```
Auth:          2   (login, logout)
Schedule:      7   (my, my/week, week, generate, assign, publish, export)
Nurses:        3   (list, update, blocked-clinics)    ← NEW
Clinics:       5   (list, update, config/get, config/set, config/copy)  ← NEW
Programs:      3   (list, update, assign)             ← NEW
Requests:      5   (my, create, pending, approve, reject)
Preferences:   3   (my, submit, all)
Tasks:         4   (my, create, done, all)
Announcements: 3   (list, create, read)
Users:         4   (list, create, pin, deactivate)
Notifications: 2   (list, read)
```
