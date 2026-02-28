# Entity Relationships

## 18 Entities (was 16, added ClinicDefaultConfig + json-array utilities)

### Core (6)
1. **User** — Anyone who logs in. Has pinPrefix for fast lookup.
2. **NurseProfile** — Scheduling config. Has recurringOffDays for weekly patterns.
3. **Clinic** — A clinic type (סכרת, עיניים, etc.)
4. **WeeklySchedule** — One week's complete schedule
5. **ScheduleAssignment** — One nurse's assignment for one day. Has modifiedBy audit trail.
6. **PatientProgram** — A patient calling program

### Supporting (6)
7. **TimeOffRequest** — Nurse asks for time off
8. **WeeklyPreference** — Nurse's wishes for next week
9. **Task** — Manager assigns work to nurse
10. **Announcement** — Manager broadcasts message
11. **Notification** — System alert to a user
12. **ScheduleCorrection** — Learning from manager edits

### Configuration (6) — was 4, added ClinicDefaultConfig and demand tracking
13. **ClinicDefaultConfig** — Template: which clinics run which days EVERY week
14. **ClinicWeeklyConfig** — Override: exceptions for a specific week only
15. **NurseBlockedClinic** — Nurse CANNOT work at this clinic
16. **FixedAssignment** — Nurse ALWAYS works here (locked). Uses sentinel date for permanent.
17. **ProgramAssignment** — Nurse assigned to call program
18. **ClinicSecondaryDemand** — How many nurses needed for secondary clinics (stored in ClinicDefaultConfig)

## All Relationships

```
RELATIONSHIP                            TYPE     RULE
─────────────────────────────────────── ──────── ─────────────────────────────
User → NurseProfile                     1:1      Cascade delete.
User → TimeOffRequest                   1:many   Nurse can have many requests.
User → WeeklyPreference                 1:many   Unique(nurseId, weekStart).
User → Task (assignedTo)                1:many   NULL when isForAll=true.
User → Task (createdBy)                 1:many   Only manager creates.
User → Announcement (author)            1:many   Only manager creates.
User → AnnouncementRead                 1:many   Unique(announcementId, userId).
User → Notification                     1:many   Both roles receive.
NurseProfile → NurseBlockedClinic       1:many   Unique(nurseId, clinicId).
NurseProfile → FixedAssignment          1:many   Unique(nurseId, clinicId, day).
NurseProfile → ScheduleAssignment       1:many   Unique(scheduleId, nurseId, day).
Clinic → ClinicDefaultConfig            1:many   Unique(clinicId, day). Template.
Clinic → ClinicWeeklyConfig             1:many   Unique(clinicId, weekStart, day). Override.
Clinic → NurseBlockedClinic             1:many   Which nurses are blocked.
Clinic → FixedAssignment                1:many   Which nurses are locked in.
Clinic → ScheduleAssignment (primary)   1:many   Primary clinic assignments.
Clinic → ScheduleAssignment (secondary) 1:many   Secondary clinic assignments.
WeeklySchedule → ScheduleAssignment     1:many   ~75 per week. Cascade delete.
PatientProgram → ProgramAssignment      1:many   Program→nurse per day.
Announcement → AnnouncementRead         1:many   Cascade delete.
```

## Cascade Delete Rules
- Delete User → delete NurseProfile
- Delete WeeklySchedule → delete all its ScheduleAssignments
- Delete Announcement → delete all its AnnouncementReads

## Config Merge Rule (Critical for Algorithm)
For each clinic+day, the effective config is:
```
effectiveConfig = ClinicWeeklyConfig(clinicId, weekStart, day) 
                  ?? ClinicDefaultConfig(clinicId, day)
```
Weekly config OVERRIDES the default. If no weekly config exists, use default.
