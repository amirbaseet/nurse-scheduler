# Learning Engine

## Overview
Pre-trained on 51 weeks of historical data. Improves algorithm scoring with real patterns.

## What to Build

### 1. Historical Import (src/learning/import.ts)
Read `data/weekly_schedules.json` (51 weeks) and compute:

**Probability Matrix: P(clinic | nurse, day)**
```
For each nurse × clinic × day combo, count occurrences / total weeks.
Example: P(עיניים | נסרין, SUN) = 48/51 = 0.94
Store as: { nurseId: { clinicCode: { SUN: 0.94, MON: 0.92, ... } } }
```

**Shift Preference Scores**
```
For each nurse, what % of shifts were morning vs afternoon.
Example: נגלא: morning=82%, afternoon=18%
```

**Off-Day Patterns**
```
For each nurse × day, what % of weeks they had off.
Example: P(off | נגלא, THU) = 0.65
```

**Common Dual-Clinic Combos**
```
Top combos: סכרת+א.א.ג (34 times), כירורגיה+א.א.ג (28 times), etc.
```

Save all matrices as JSON in `data/models/`.

### 2. Integration with Algorithm
In scoring.ts, replace S_historical = 75 with:
```
probability = models.getProb(nurse, clinic, day)
S_hist = probability * 150  // 0 to 150 range
```

### 3. Correction Tracking
When manager edits a generated schedule (drag-and-drop):
```
Save ScheduleCorrection:
  - originalNurseId, originalClinicId, day
  - correctedNurseId, correctedClinicId
  - correctionType: "swap" | "remove" | "add" | "change_shift"
```

After 3+ identical corrections, adjust probability:
```
IF manager always removes nurse A from clinic X:
  P(clinic X | nurse A) *= 0.8  // reduce by 20%

IF manager always adds nurse B to clinic Y on WED:
  P(clinic Y | nurse B, WED) *= 1.2  // increase by 20%
```

## Expected Accuracy Progression
- Week 1: ~65% auto-correct (pre-trained on history)
- Week 10: ~80% (learning from corrections)
- Week 50: ~96% (minimal manager edits needed)
