# Seed Data — FIXED

## Critical: Field Mapping

The nurse_profiles.json does NOT contain gender, contractHours, or shiftPreference.
These must be derived from the data or hardcoded based on analysis.

## Complete Nurse Mapping Table

Every value below was derived from analyzing 51 weeks of historical data.
Manager should verify contract hours after first run.

```
NAME                 GENDER  CONTRACT  SHIFT_PREF  FRI    SAT    MAX_DAYS  EMPLOYMENT  SPECIALIST
──────────────────── ─────── ───────── ─────────── ────── ────── ───────── ─────────── ──────────────
כתיבה בסיט           FEMALE  36h       ANYTIME     true   true   5         FULL_TIME   מקצועית (68%)
נגלא שוויקי          FEMALE  28h       ANYTIME     true   true   5         FULL_TIME   —
נידאל ניגם           FEMALE  34h       ANYTIME     false  true   5         FULL_TIME   —
רבחייה בראגיתי       FEMALE  34h       ANYTIME     false  false  5         FULL_TIME   סכרת (96%) ★FIXED
היא חליל             FEMALE  30h       ANYTIME     false  true   6         FULL_TIME   סכרת (91%) ★FIXED
אינאס גאעוני         FEMALE  18h       ANYTIME     false  false  5         PART_TIME   —
רוואא משני           FEMALE  14h       ANYTIME     false  true   3         PART_TIME   —
הדיל סוריך           FEMALE  26h       ANYTIME     false  false  5         FULL_TIME   אי ספיקת לב (57%)
סאנדי צאיג           FEMALE  10h       ANYTIME     false  false  3         PART_TIME   אורטופידיה (53%)
נסרין עלי            FEMALE  8h        ANYTIME     false  false  2         PART_TIME   עיניים (100%) ★FIXED
נסרין משני           FEMALE  26h       ANYTIME     false  true   5         FULL_TIME   עיניים (99%) ★FIXED
עלאא אבו סנינה      FEMALE  40h       ANYTIME     false  true   6         FULL_TIME   אורטופידיה (82%) ★FIXED
גמילה שקיראת         FEMALE  24h       ANYTIME     false  false  4         FULL_TIME   —
אנוואר אדעיס        FEMALE  26h       ANYTIME     false  true   5         FULL_TIME   —
רוואן אבו סרור      FEMALE  26h       ANYTIME     false  false  5         FULL_TIME   —
```

### How values were derived:
- **gender**: All 15 names are Arabic female names → FEMALE
- **contractHours**: avg_weekly_hours rounded to nearest standard tier (8,10,14,18,20,24,26,28,30,34,36,40)
- **shiftPreference**: All set to ANYTIME (historical data doesn't have shift times, manager can adjust)
- **canWorkFriday**: true if Fri count > 3 out of 51 weeks
- **canWorkSaturday**: true if Sat count > 3 out of 51 weeks
- **maxDaysPerWeek**: avg_days_per_week rounded up, capped at 6
- **employmentType**: Reclassified using contract hours (≤18h = PART_TIME, >18h = FULL_TIME)
  Note: אינאס was labeled full_time in data but only averages 18.5h → reclassified to PART_TIME
- **specialist**: If any clinic > 50% of total shifts → candidate for FixedAssignment (★FIXED = >90%)

---

## Import Order (respect foreign keys)

1. **Users** (16: 1 manager + 15 nurses)
2. **NurseProfiles** (linked to Users via userId)
3. **Clinics** (23 clinics)
4. **ClinicDefaultConfig** (template: clinics × days)
5. **NurseBlockedClinics** (very few)
6. **FixedAssignments** (5 specialist nurses with >80% history)
7. **PatientPrograms** (4 programs)
8. **Sample data** (for testing)

---

## 1. Manager Account
```
Name: "מנהלת"
Role: MANAGER
PIN: "482917" (6-digit)
pinPrefix: "48"
NurseProfile: isManager=true, managementHours=12, gender=FEMALE, contractHours=40
```

## 2. Nurse Accounts
Use the mapping table above. For each nurse:
```typescript
// Generate unique random 4-digit PIN for each
const pin = generateUnique4DigitPin()
const pinHash = await bcrypt.hash(pin, 10)
const pinPrefix = pin.substring(0, 2)

// Create User
const user = await db.user.create({
  data: { name, role: "NURSE", pinHash, pinPrefix, isActive: true }
})

// Create NurseProfile (use mapping table values)
await db.nurseProfile.create({
  data: {
    userId: user.id, gender: "FEMALE",
    contractHours, shiftPreference: "ANYTIME",
    canWorkFriday, canWorkSaturday, maxDaysPerWeek,
    employmentType, isManager: false
  }
})

// Print PIN for manager reference
console.log(`${name}: PIN = ${pin}`)
```

## 3. Clinics (23)
Map from clinic_profiles.json:
```
name_heb → Clinic.name
name_en → generate code (lowercase, e.g. "surgery", "ophthalmology")
```

Gender-restricted clinics:
```
שד (breast)         → FEMALE_ONLY
נשים (if exists)    → FEMALE_ONLY
All others           → ANY
```

Secondary-capable clinics (from historical combo analysis):
```
א.א.ג     → canBeSecondary=true, secondaryHours=2
מנטו       → canBeSecondary=true, secondaryHours=2
א.ק.ג     → canBeSecondary=true, secondaryHours=1
חיסון      → canBeSecondary=true, secondaryHours=1
```

## 4. ClinicDefaultConfig (Template)
Based on most common weekly pattern from 51 weeks. Create one entry per clinic per active day:
```typescript
// Example: כירורגיה runs Sun-Wed, 08:00-14:00, needs 1 nurse
await db.clinicDefaultConfig.create({
  data: { clinicId: surgeryId, day: "SUN", shiftStart: "08:00", shiftEnd: "14:00", nursesNeeded: 1, isActive: true }
})
// Repeat for MON, TUE, WED
// Thu, Fri, Sat → isActive: false (or don't create entry)
```

Use clinic_profiles.json → `typical_days` and `avg_shift_hours` to populate.

## 5. FixedAssignments (5 nurses — all with >80% specialist history)
```
נסרין עלי     → עיניים    (every working day) — 100% historical
נסרין משני    → עיניים    (every working day) — 99% historical
רבחייה בראגיתי → סכרת     (every working day) — 96% historical
היא חליל      → סכרת     (every working day) — 91% historical
עלאא אבו סנינה → אורטופידיה (every working day) — 82% historical
```

Use sentinel weekStart for "every week":
```typescript
await db.fixedAssignment.create({
  data: {
    nurseId, clinicId, day: "SUN",
    weekStart: new Date("1970-01-01T00:00:00.000Z") // sentinel = permanent
  }
})
// Repeat for each working day of the nurse
```

## 6. Patient Programs
```
1. מערך שד        — type: PURE_PROGRAM, defaultHours: 7
2. סכרת           — type: CLINIC_ADDON, linkedClinicCode: "diabetes"
3. אי ספיקת לב    — type: CLINIC_ADDON, linkedClinicCode: "heart_failure"
4. העמסת סוכר     — type: CLINIC_ADDON, linkedClinicCode: "sugar_load"
```

## 7. Sample Test Data
```
TimeOffRequest 1: first nurse, VACATION, next week Mon-Wed, status: PENDING
TimeOffRequest 2: second nurse, OFF_DAY, next week Thu, status: APPROVED
Announcement 1: "Welcome to NurseScheduler", priority: NORMAL, targetAll: true
Task 1: assigned to first nurse, "Complete training", due: next week
Task 2: isForAll: true, "Check emergency cart", due: next week
```
