# Scheduling Algorithm — FIXED

## Fixes Applied:
- BUG 3: Scoring formula now returns 0-1000 (no multiplied weights)
- BUG 5: Config merge (ClinicDefaultConfig + ClinicWeeklyConfig)
- RISK 1: Look-ahead depth limited to next 5 slots
- RISK 2: Secondary demand tracking added to Layer 5
- QUALITY 2: DB↔Algorithm converters documented

## File Structure
```
src/algorithm/
├── index.ts              — Main generate() entry point
├── types.ts              — All TypeScript interfaces
├── converters.ts         — DB models ↔ Algorithm types  ← NEW
├── scoring.ts            — Candidate ranking (5 factors, 0-1000)
├── difficulty-queue.ts   — MCV heuristic (hardest slots first)
├── look-ahead.ts         — Downstream flexibility (max 5 slots deep)
├── backtrack.ts          — Recovery when stuck
└── layers/
    ├── 1-block.ts        — Block unavailable nurses
    ├── 2-fixed.ts        — Place fixed/locked assignments
    ├── 3-gender.ts       — Fill gender-restricted clinics
    ├── 4-primary.ts      — Fill all primary clinic slots
    ├── 5-secondary.ts    — Stack secondary clinics (with demand tracking)
    ├── 6-programs.ts     — Add patient call addons
    ├── 7-gap-fill.ts     — Fill remaining hours budget
    ├── 8-off-days.ts     — Mark empty cells as OFF
    └── 9-optimize.ts     — Simulated annealing polish
```

---

## converters.ts — DB ↔ Algorithm Types (NEW)

```typescript
// Convert Prisma models to algorithm-friendly types

function dbToAlgorithmConfig(
  nurseProfiles: NurseProfileWithRelations[],
  clinicDefaults: ClinicDefaultConfig[],
  clinicOverrides: ClinicWeeklyConfig[],
  timeOff: TimeOffRequest[],
  fixedAssignments: FixedAssignment[],
  programs: ProgramAssignment[],
  preferences: WeeklyPreference[]
): AlgorithmConfig {
  
  // Merge clinic configs: override wins over default
  const clinicConfigs = mergeClinicConfigs(clinicDefaults, clinicOverrides)
  
  return {
    nurses: nurseProfiles.map(np => ({
      id: np.id,
      userId: np.userId,
      name: np.user.name,
      gender: np.gender,
      contractHours: np.contractHours,
      shiftPreference: np.shiftPreference,
      canWorkFriday: np.canWorkFriday,
      canWorkSaturday: np.canWorkSaturday,
      maxDaysPerWeek: np.maxDaysPerWeek,
      isManager: np.isManager,
      managementHours: np.managementHours,
      recurringOffDays: parseJsonArray(np.recurringOffDays),
      blockedClinicIds: np.blockedClinics.map(bc => bc.clinicId),
    })),
    clinics: clinicConfigs,
    timeOff, fixedAssignments, programs, preferences
  }
}

function mergeClinicConfigs(defaults, overrides): ClinicSlot[] {
  const result = []
  const overrideMap = new Map()  // key: "clinicId-day"
  
  for (const o of overrides) {
    overrideMap.set(`${o.clinicId}-${o.day}`, o)
  }
  
  for (const d of defaults) {
    const key = `${d.clinicId}-${d.day}`
    const effective = overrideMap.get(key) ?? d
    if (effective.isActive) {
      result.push({
        clinicId: effective.clinicId,
        day: effective.day,
        shiftStart: effective.shiftStart,
        shiftEnd: effective.shiftEnd,
        nursesNeeded: effective.nursesNeeded,
        shiftHours: calcHours(effective.shiftStart, effective.shiftEnd)
      })
    }
    overrideMap.delete(key)  // processed
  }
  
  // Any overrides for clinics NOT in defaults (new one-off clinic)
  for (const [key, o] of overrideMap) {
    if (o.isActive) {
      result.push({ clinicId: o.clinicId, day: o.day, shiftStart: o.shiftStart, 
                     shiftEnd: o.shiftEnd, nursesNeeded: o.nursesNeeded,
                     shiftHours: calcHours(o.shiftStart, o.shiftEnd) })
    }
  }
  
  return result
}

function algorithmToDbAssignments(grid, scheduleId): ScheduleAssignmentCreateInput[] {
  const results = []
  for (const [nurseId, days] of grid) {
    for (const [day, cell] of days) {
      results.push({
        scheduleId, nurseId, day,
        primaryClinicId: cell.primaryClinicId ?? null,
        secondaryClinicId: cell.secondaryClinicId ?? null,
        shiftStart: cell.shiftStart ?? null,
        shiftEnd: cell.shiftEnd ?? null,
        hours: cell.hours,
        patientCallProgram: cell.patientCallProgram ?? null,
        patientCallCount: cell.patientCallCount ?? null,
        isOff: cell.status === "OFF",
        isFixed: cell.isFixed,
        isManagerSelf: cell.isManagerSelf,
      })
    }
  }
  return results
}
```

---

## types.ts — Core Interfaces

```typescript
type CellStatus = "AVAILABLE" | "BLOCKED" | "ASSIGNED" | "OFF"
type BlockReason = "time_off" | "no_friday" | "no_saturday" | "max_days" | "recurring_off"

interface Cell {
  status: CellStatus
  blockReason?: BlockReason
  primaryClinicId?: string
  secondaryClinicId?: string
  shiftStart?: string
  shiftEnd?: string
  hours: number
  patientCallProgram?: string
  patientCallCount?: number
  isFixed: boolean
  isManagerSelf: boolean
}

type Grid = Map<string, Map<DayOfWeek, Cell>>

interface ClinicSlot {
  clinicId: string
  day: DayOfWeek
  shiftStart: string
  shiftEnd: string
  shiftHours: number
  nursesNeeded: number
  genderPref?: GenderPref   // from Clinic model
  candidateCount?: number    // computed during difficulty queue
}

interface AlgoNurse {
  id: string
  userId: string
  name: string
  gender: Gender
  contractHours: number
  shiftPreference: ShiftPref
  canWorkFriday: boolean
  canWorkSaturday: boolean
  maxDaysPerWeek: number
  isManager: boolean
  managementHours: number | null
  recurringOffDays: DayOfWeek[]
  blockedClinicIds: string[]
}

interface Warning {
  level: "error" | "warning" | "info"
  message: string
  nurseId?: string
  clinicId?: string
  day?: DayOfWeek
}

interface Gap {
  clinicId: string
  clinicName: string
  day: DayOfWeek
  shiftStart: string
  shiftEnd: string
  hours: number
}

interface ScheduleResult {
  assignments: AssignmentData[]
  warnings: Warning[]
  qualityScore: number
  managerGaps: Gap[]
}
```

---

## index.ts — Main Entry Point

```
FUNCTION generateWeeklySchedule(weekStart, config) → ScheduleResult:

  days = [SUN, MON, TUE, WED, THU, FRI, SAT]
  grid = new Grid()
  budgets = {}
  warnings = []

  // Initialize
  FOR EACH nurse IN config.nurses:
    IF nurse.isManager: SKIP  // manager excluded
    budgets[nurse.id] = nurse.contractHours
    FOR EACH day IN days:
      grid[nurse.id][day] = { status: AVAILABLE, hours: 0, isFixed: false, isManagerSelf: false }

  regularNurses = config.nurses.FILTER(n => !n.isManager)

  // Execute 9 layers
  layer1_block(grid, regularNurses, config.timeOff, days, warnings)
  layer2_fixed(grid, regularNurses, config.fixedAssignments, config.programs, budgets, warnings)
  layer3_gender(grid, regularNurses, config.clinics, budgets, warnings)
  layer4_primary(grid, regularNurses, config.clinics, budgets, config.preferences, warnings)
  layer5_secondary(grid, regularNurses, config.clinics, budgets)
  layer6_programs(grid, regularNurses, config.programs, budgets, warnings)
  layer7_gapFill(grid, regularNurses, budgets, warnings)
  layer8_offDays(grid, regularNurses)
  layer9_optimize(grid, regularNurses, config.clinics, budgets, config.preferences)

  managerGaps = findUnfilledSlots(grid, config.clinics)
  qualityScore = calculateQuality(grid, config.clinics, config.preferences)
  assignments = algorithmToDbAssignments(grid)

  RETURN { assignments, warnings, qualityScore, managerGaps }
```

---

## Layer 1: Block Unavailable (FIXED: added recurringOffDays)

```
FUNCTION layer1_block(grid, nurses, timeOff, days, warnings):
  FOR EACH nurse IN nurses:
    daysAssigned = 0
    
    FOR EACH day IN days:
      // Time-off approved?
      IF timeOff.ANY(t => t.nurseId == nurse.userId AND overlaps(t, day)):
        grid[nurse.id][day].status = BLOCKED
        grid[nurse.id][day].blockReason = "time_off"
        CONTINUE

      // Recurring off-day?
      IF nurse.recurringOffDays.INCLUDES(day):
        grid[nurse.id][day].status = BLOCKED
        grid[nurse.id][day].blockReason = "recurring_off"
        CONTINUE

      // Friday restriction?
      IF day == FRI AND !nurse.canWorkFriday:
        grid[nurse.id][day].status = BLOCKED
        grid[nurse.id][day].blockReason = "no_friday"
        CONTINUE

      // Saturday restriction?
      IF day == SAT AND !nurse.canWorkSaturday:
        grid[nurse.id][day].status = BLOCKED
        grid[nurse.id][day].blockReason = "no_saturday"
        CONTINUE
```

---

## Layer 2: Fixed Assignments

```
FUNCTION layer2_fixed(grid, nurses, fixed, programs, budgets, warnings):
  // 2A: Fixed clinic assignments
  FOR EACH fix IN fixed:
    IF grid[fix.nurseId][fix.day].status == BLOCKED:
      warnings.ADD({ level: "warning", message: "Fixed conflicts with time-off", nurseId: fix.nurseId, day: fix.day })
      CONTINUE
    
    hours = fix.clinic.shiftHours or calcHours(fix)
    grid[fix.nurseId][fix.day] = {
      status: ASSIGNED, primaryClinicId: fix.clinicId,
      hours, isFixed: true,
      shiftStart: getShiftStart(fix.clinicId, fix.day),
      shiftEnd: getShiftEnd(fix.clinicId, fix.day)
    }
    budgets[fix.nurseId] -= hours

  // 2B: Pure patient programs
  FOR EACH prog IN programs.FILTER(p => p.type == PURE_PROGRAM):
    IF grid[prog.nurseId][prog.day].status == BLOCKED:
      warnings.ADD({ level: "warning", message: "Program conflicts with time-off" })
      CONTINUE
    
    grid[prog.nurseId][prog.day] = {
      status: ASSIGNED, isFixed: true,
      hours: prog.defaultHours || 7,
      patientCallProgram: prog.name, patientCallCount: prog.patientCount,
      shiftStart: prog.shiftStart || "08:00", shiftEnd: prog.shiftEnd || "15:00"
    }
    budgets[prog.nurseId] -= (prog.defaultHours || 7)
```

---

## Layer 3: Gender-Restricted Clinics

```
FUNCTION layer3_gender(grid, nurses, clinics, budgets, warnings):
  genderClinics = clinics.FILTER(c => c.genderPref IN [FEMALE_ONLY, FEMALE_PREFERRED])
    .SORT(c => c.genderPref == FEMALE_ONLY ? 0 : 1)
  
  FOR EACH slot IN genderClinics:
    FOR count FROM 1 TO slot.nursesNeeded:
      candidates = nurses.FILTER(n =>
        grid[n.id][slot.day].status == AVAILABLE
        AND n.gender == FEMALE
        AND !n.blockedClinicIds.INCLUDES(slot.clinicId)
        AND budgets[n.id] >= slot.shiftHours
      )
      
      IF candidates.LENGTH == 0 AND slot.genderPref == FEMALE_ONLY:
        warnings.ADD({ level: "error", message: "No female nurse available", clinicId: slot.clinicId, day: slot.day })
        CONTINUE
      
      IF candidates.LENGTH == 0 AND slot.genderPref == FEMALE_PREFERRED:
        candidates = nurses.FILTER(n =>
          grid[n.id][slot.day].status == AVAILABLE
          AND !n.blockedClinicIds.INCLUDES(slot.clinicId)
          AND budgets[n.id] >= slot.shiftHours
        )
        IF candidates.LENGTH > 0:
          warnings.ADD({ level: "warning", message: "Male assigned to female-preferred" })
      
      IF candidates.LENGTH == 0:
        warnings.ADD({ level: "error", message: "No nurse available", clinicId: slot.clinicId, day: slot.day })
        CONTINUE
      
      best = rankAndPick(candidates, slot, budgets)
      assignNurse(grid, best, slot, budgets)
```

---

## Layer 4: Primary Clinics (Core Logic)

```
FUNCTION layer4_primary(grid, nurses, clinics, budgets, preferences, warnings):
  // Build difficulty queue (hardest slots first)
  slots = []
  FOR EACH slot IN clinics.FILTER(c => c.genderPref == ANY AND !alreadyFilled(grid, c)):
    candidateCount = nurses.COUNT(n =>
      grid[n.id][slot.day].status == AVAILABLE
      AND !n.blockedClinicIds.INCLUDES(slot.clinicId)
      AND budgets[n.id] >= slot.shiftHours
    )
    slots.ADD({ ...slot, candidateCount })
  
  slots.SORT(s => s.candidateCount ASC)  // fewest candidates first
  
  FOR EACH slot IN slots:
    candidates = getCandidates(grid, nurses, slot, budgets)
    
    IF candidates.LENGTH == 0:
      recovered = tryBacktrack(grid, slot, nurses, budgets)
      IF !recovered:
        warnings.ADD({ level: "error", message: "Cannot fill slot", clinicId: slot.clinicId, day: slot.day })
      CONTINUE
    
    scored = candidates.MAP(n => ({
      nurse: n,
      score: calculateScore(n, slot, budgets, preferences) 
             + checkLookAhead(grid, n, slot, slots, nurses, budgets)
    }))
    
    scored.SORT(s => s.score DESC)
    best = scored[0].nurse
    assignNurse(grid, best, slot, budgets)
```

---

## Scoring Formula — FIXED (0-1000 range, no broken weights)

```
FUNCTION calculateScore(nurse, slot, budgets, preferences) → number:
  
  // S_preference (max: 350 points)
  pref = getWeeklyPref(nurse, preferences) || nurse.shiftPreference
  shiftType = slot.shiftStart < "12:00" ? MORNING : AFTERNOON
  
  S_pref = 200  // base
  IF pref == shiftType:      S_pref = 350   // perfect match
  ELSE IF pref == ANYTIME:   S_pref = 250   // flexible
  ELSE:                      S_pref = 50    // mismatch
  
  IF preferredDayOff(nurse, slot.day, preferences):
    S_pref = MAX(0, S_pref - 100)           // penalty for working wished day off

  // S_budget (max: 250 points)
  // Under-utilized nurses score higher (fill their hours first)
  ratio = budgets[nurse.id] / nurse.contractHours  // 0.0 to 1.0
  S_budget = ROUND(ratio * 250)

  // S_historical (max: 150 points)
  // Placeholder until Phase 9 learning engine
  S_hist = 75  // neutral for now

  // S_fairness (max: 150 points)
  // Fewer assigned days this week = higher score
  assignedDays = countAssignedDays(grid, nurse)
  maxAssignable = nurse.maxDaysPerWeek
  fairnessRatio = 1 - (assignedDays / maxAssignable)
  S_fair = ROUND(fairnessRatio * 150)

  // S_lookahead added separately by caller (max: 100 points)

  RETURN S_pref + S_budget + S_hist + S_fair
  // Range: 0 to 900 (without lookahead)
  // Range: 0 to 1000 (with lookahead)
```

---

## Look-Ahead — FIXED (limited to 5 slots depth)

```
FUNCTION checkLookAhead(grid, candidate, slot, allSlots, nurses, budgets) → number:
  bonus = 0
  
  tempBudget = budgets[candidate.id] - slot.shiftHours
  
  // Only check next 5 hardest unfilled slots (RISK 1 fix)
  remainingSlots = allSlots
    .FILTER(s => !isFilled(grid, s) AND s != slot)
    .SLICE(0, 5)
  
  FOR EACH future IN remainingSlots:
    futureCandidates = nurses.COUNT(n =>
      (n.id == candidate.id ? tempBudget >= future.shiftHours : budgets[n.id] >= future.shiftHours)
      AND grid[n.id][future.day].status == AVAILABLE
      AND (n.id != candidate.id OR future.day != slot.day)
      AND !n.blockedClinicIds.INCLUDES(future.clinicId)
    )
    
    IF futureCandidates == 0: bonus -= 80
    ELSE IF futureCandidates == 1: bonus -= 30
    ELSE IF futureCandidates >= 4: bonus += 10
  
  RETURN CLAMP(bonus, -100, 100)
```

---

## Backtracking

```
FUNCTION tryBacktrack(grid, failedSlot, nurses, budgets) → boolean:
  FOR EACH cell IN getAssignedCells(grid, failedSlot.day):
    IF cell.isFixed: CONTINUE
    
    assignedNurse = cell.nurseId
    IF isBlocked(assignedNurse, failedSlot.clinicId): CONTINUE
    IF failedSlot.genderPref == FEMALE_ONLY AND nurseGender(assignedNurse) != FEMALE: CONTINUE
    
    replacement = nurses.FIND(n =>
      grid[n.id][failedSlot.day].status == AVAILABLE
      AND !n.blockedClinicIds.INCLUDES(cell.clinicId)
      AND budgets[n.id] >= shiftHours(cell)
    )
    
    IF replacement:
      grid[assignedNurse][failedSlot.day] = makeAssignment(failedSlot)
      grid[replacement.id][failedSlot.day] = makeAssignment(cell)
      updateBudgets(budgets, assignedNurse, replacement, cell, failedSlot)
      RETURN true
  
  RETURN false
```

---

## Layer 5: Secondary Clinics — FIXED (demand tracking)

```
FUNCTION layer5_secondary(grid, nurses, clinics):
  // Secondary clinics are worked WITHIN the same shift — no extra hours, no budget consumed
  secondaryClinics = clinics.FILTER(c => c.clinic.canBeSecondary)

  // Build demand tracker: how many nurses needed per secondary clinic per day
  secondaryDemand = {}  // key: "clinicId-day" → remaining needed
  FOR EACH sec IN secondaryClinics:
    secondaryDemand[sec.clinicId + "-" + sec.day] = sec.clinic.secondaryNursesNeeded || 1

  FOR EACH nurse IN nurses:
    FOR EACH day IN days:
      cell = grid[nurse.id][day]
      IF cell.status != ASSIGNED: CONTINUE
      IF cell.secondaryClinicId: CONTINUE

      FOR EACH sec IN secondaryClinics:
        key = sec.clinicId + "-" + day
        IF (secondaryDemand[key] || 0) <= 0: CONTINUE    // demand filled
        IF sec.day != day: CONTINUE
        IF nurse.blockedClinicIds.INCLUDES(sec.clinicId): CONTINUE
        IF sec.clinic.genderPref == FEMALE_ONLY AND nurse.gender != FEMALE: CONTINUE

        // Assign secondary — within same shift, hours and budget unchanged
        cell.secondaryClinicId = sec.clinicId
        secondaryDemand[key] -= 1
        BREAK  // max 1 secondary per day
```

---

## Layer 6-8: Unchanged from original
(See previous version — programs, gap fill, off-days logic remains the same)

```
FUNCTION layer6_programs(grid, nurses, programs, budgets, warnings):
  FOR EACH addon IN programs.FILTER(p => p.type == CLINIC_ADDON):
    cell = grid[addon.nurseId][addon.day]
    IF cell.status != ASSIGNED:
      warnings.ADD({ level: "warning", message: "Cannot add calls: nurse not working" })
      CONTINUE
    cell.patientCallProgram = addon.programName
    cell.patientCallCount = addon.patientCount

FUNCTION layer7_gapFill(grid, nurses, budgets, warnings):
  nursesWithGap = nurses.FILTER(n => budgets[n.id] >= 2).SORT(n => budgets[n.id] DESC)
  FOR EACH nurse IN nursesWithGap:
    FOR EACH day IN days:
      cell = grid[nurse.id][day]
      IF cell.status != ASSIGNED: CONTINUE
      IF budgets[nurse.id] < 1: BREAK
      IF cell.hours >= 8: CONTINUE
      extend = MIN(2, 8 - cell.hours, budgets[nurse.id])
      cell.hours += extend
      cell.shiftEnd = addHours(cell.shiftEnd, extend)
      budgets[nurse.id] -= extend
    IF budgets[nurse.id] >= 4:
      warnings.ADD({ level: "info", message: nurse.name + " has " + budgets[nurse.id] + "h unfilled" })

FUNCTION layer8_offDays(grid, nurses):
  FOR EACH nurse IN nurses:
    FOR EACH day IN days:
      IF grid[nurse.id][day].status == AVAILABLE:
        grid[nurse.id][day] = { status: OFF, hours: 0 }
```

---

## Layer 9: Optimize (Simulated Annealing)

```
FUNCTION layer9_optimize(grid, nurses, clinics, budgets, preferences):
  currentScore = calculateQuality(grid, clinics, preferences)
  temperature = 1.0
  coolingRate = 0.9997
  
  FOR i FROM 1 TO 10000:
    day = randomDay()
    nurse1 = randomAssignedNurse(grid, day)
    nurse2 = randomAssignedNurse(grid, day)
    IF nurse1 == nurse2: CONTINUE
    
    cell1 = grid[nurse1][day]
    cell2 = grid[nurse2][day]
    IF cell1.isFixed OR cell2.isFixed: CONTINUE
    IF isBlocked(nurse1, cell2.clinicId) OR isBlocked(nurse2, cell1.clinicId): CONTINUE
    // Gender check for swap
    IF cell1.genderPref == FEMALE_ONLY AND nurse2.gender != FEMALE: CONTINUE
    IF cell2.genderPref == FEMALE_ONLY AND nurse1.gender != FEMALE: CONTINUE
    
    swap(grid, nurse1, nurse2, day)
    newScore = calculateQuality(grid, clinics, preferences)
    
    delta = newScore - currentScore
    IF delta > 0 OR RANDOM() < EXP(delta / temperature):
      currentScore = newScore
    ELSE:
      swap(grid, nurse1, nurse2, day)  // revert
    
    temperature *= coolingRate
```

---

## Quality Score (0-100) — FIXED (clearer deduction rules)

```
FUNCTION calculateQuality(grid, clinics, preferences) → number:
  score = 100.0
  
  // -5 per preference mismatch (shift type)
  FOR EACH assignment IN getAssigned(grid):
    nursePref = getNursePref(assignment.nurseId, preferences) || nurse.shiftPreference
    IF nursePref != ANYTIME AND nursePref != assignmentShiftType(assignment):
      score -= 5
  
  // -3 per wished day-off not honored
  FOR EACH assignment IN getAssigned(grid):
    IF preferredDayOff(assignment.nurseId, assignment.day, preferences):
      score -= 3
  
  // -10 per unfilled required clinic slot
  FOR EACH slot IN clinics:
    filled = countNursesAt(grid, slot.clinicId, slot.day)
    IF filled < slot.nursesNeeded:
      score -= 10 * (slot.nursesNeeded - filled)
  
  // -2 per standard deviation point of hours fairness
  ratios = nurses.MAP(n => assignedHours(grid, n) / n.contractHours)
  score -= stddev(ratios) * 20  // normalized to contract ratio
  
  RETURN CLAMP(ROUND(score), 0, 100)
```
