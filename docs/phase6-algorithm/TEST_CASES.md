# Algorithm Test Cases — FIXED

Updated to match fixed algorithm (scoring 0-1000, config merge, demand tracking).

## 24 MUST-PASS Tests

### Category 1: Basic Constraints (5 tests)
```
1.1 Nurse on approved vacation → NOT assigned any day during vacation
1.2 Nurse at max contract hours → NOT assigned more work (budget 0)
1.3 Two clinics need 1 nurse each, only 1 nurse available → warning generated, 1 filled
1.4 Nurse with maxDaysPerWeek=3 → works max 3 days
1.5 Full week generation → all required slots filled (or warning per unfilled)
```

### Category 2: Gender Rules (3 tests)
```
2.1 FEMALE_ONLY clinic → only female nurse assigned
2.2 FEMALE_ONLY clinic + no female available → error warning, slot empty
2.3 FEMALE_PREFERRED clinic + no female → male assigned with warning
    NOTE: Currently all 15 nurses are female, so test with mock data
```

### Category 3: Fixed Assignments (3 tests)
```
3.1 Fixed assignment נסרין משני→עיניים → always assigned, never changed by algorithm
3.2 Fixed assignment on time-off day → warning generated, assignment skipped
3.3 Optimizer (Layer 9) → never swaps fixed assignments (cell.isFixed check)
```

### Category 4: Friday/Saturday (3 tests)
```
4.1 canWorkFriday=false → BLOCKED on Friday, not assigned
4.2 canWorkSaturday=false → BLOCKED on Saturday, not assigned
4.3 Only 2 nurses canWorkFriday=true → both assigned to Friday clinics
```

### Category 5: Config Merge (3 tests) — NEW
```
5.1 Clinic with default config only → algorithm uses default
5.2 Clinic with weekly override → algorithm uses override (not default)
5.3 Clinic with override isActive=false → clinic skipped for that week
```

### Category 6: Edge Cases (5 tests)
```
6.1 All nurses on vacation same day → all slots empty + warnings
6.2 0 clinics configured for a day → all nurses get OFF
6.3 Nurse with contractHours=8 and maxDaysPerWeek=2 → works exactly 1-2 days
6.4 1 nurse, 5 clinics same day → assigned to 1, 4 warned unfilled
6.5 Fixed + secondary on same day → both applied, hours correct
```

### Category 7: Recurring Off-Days (2 tests) — NEW
```
7.1 Nurse with recurringOffDays=["THU"] → BLOCKED every Thursday
7.2 Recurring off + approved vacation same day → BLOCKED (not double-counted)
```

## 11 SHOULD-PASS Tests

### Scoring (3 tests)
```
S.1 Morning-preference nurse → score > 300 for morning slot, < 100 for afternoon
S.2 Under-budget nurse (ratio 0.8) → S_budget=200 vs over-budget (0.1) → S_budget=25
S.3 Nurse preferring day off → S_pref reduced by 100 for that day
```

### Secondary Clinics (3 tests) — FIXED with demand tracking
```
S.4 Secondary clinic stacked on primary → assigned, shift hours unchanged
S.5 Secondary assigned regardless of remaining budget (within same shift)
S.6 Secondary demand exhausted (secondaryNursesNeeded=1) → only 1 nurse gets it
```

### Programs (2 tests)
```
S.7 Pure program (מערך שד) → full day, no primary clinic, hours=7
S.8 Clinic addon → call info added, hours NOT changed
```

### Quality & Optimization (3 tests)
```
S.9  Schedule honoring all preferences → qualityScore > 85
S.10 Schedule with 3 mismatches → qualityScore < 85
S.11 Optimizer improves score (after > before) within 2 seconds
```

## 3 NICE-TO-HAVE Tests
```
N.1 Look-ahead prevents dead-end (max 5 slots depth)
N.2 Backtracking recovers from 0-candidate slot via swap
N.3 Full 51-week historical data import processes without error
```

## Performance Requirements
- Full schedule generation: < 3 seconds
- Layer 9 optimizer alone: < 2 seconds (10,000 iterations)
- Quality score for normal week: 70+
