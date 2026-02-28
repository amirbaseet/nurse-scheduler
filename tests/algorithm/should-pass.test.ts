import { describe, it, expect, beforeEach } from "vitest";
import { generateWeeklySchedule } from "@/algorithm/index";
import { calculateScore, calculateQualityScore } from "@/algorithm/scoring";
import { layer9_optimize } from "@/algorithm/layers/9-optimize";
import type {
  AlgorithmConfig,
  DayOfWeek,
  PreferenceEntry,
} from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  getCell,
  makeClinicSlot,
  resetNurseCounter,
} from "./helpers";

const WEEK_START = new Date("2026-03-01T00:00:00");

function makeConfig(overrides?: Partial<AlgorithmConfig>): AlgorithmConfig {
  return {
    nurses: [],
    clinics: [],
    timeOff: [],
    fixedAssignments: [],
    programs: [],
    preferences: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// Scoring (3 tests)
// ═══════════════════════════════════════════

describe("SHOULD-PASS — Scoring", () => {
  beforeEach(() => resetNurseCounter());

  it("S.1 morning-preference nurse → higher score for morning slot than afternoon", () => {
    const nurse = makeNurse({ shiftPreference: "MORNING" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const morningSlot = makeClinicSlot({
      shiftStart: "08:00",
      shiftEnd: "15:00",
      shiftHours: 7,
    });
    const afternoonSlot = makeClinicSlot({
      shiftStart: "13:00",
      shiftEnd: "20:00",
      shiftHours: 7,
    });

    const morningScore = calculateScore(nurse, morningSlot, grid, budgets, []);
    const afternoonScore = calculateScore(
      nurse,
      afternoonSlot,
      grid,
      budgets,
      [],
    );

    // Morning match: S_pref=350, Afternoon mismatch: S_pref=50 → difference of 300
    expect(morningScore).toBeGreaterThan(afternoonScore);
    expect(morningScore - afternoonScore).toBe(300);
  });

  it("S.2 under-budget nurse scores higher than over-budget nurse", () => {
    const underBudget = makeNurse({ id: "n1", contractHours: 36 });
    const overBudget = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([underBudget, overBudget]);

    // 80% remaining vs 10% remaining
    const budgets = new Map([
      ["n1", 36 * 0.8], // 28.8h remaining
      ["n2", 36 * 0.1], // 3.6h remaining
    ]);

    const slot = makeClinicSlot();

    const score1 = calculateScore(underBudget, slot, grid, budgets, []);
    const score2 = calculateScore(overBudget, slot, grid, budgets, []);

    expect(score1).toBeGreaterThan(score2);

    // S_budget: 0.8*250=200 vs 0.1*250=25
    expect(score1 - score2).toBe(175);
  });

  it("S.3 nurse preferring day off → score reduced by 100 for that day", () => {
    const nurse = makeNurse({ userId: "u1", shiftPreference: "ANYTIME" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);
    const slot = makeClinicSlot({ day: "MON" });

    const prefs: PreferenceEntry[] = [
      { nurseUserId: "u1", preferredDaysOff: ["MON"] },
    ];

    const scoreWithPref = calculateScore(nurse, slot, grid, budgets, prefs);
    const scoreWithout = calculateScore(nurse, slot, grid, budgets, []);

    expect(scoreWithPref).toBeLessThan(scoreWithout);
    expect(scoreWithout - scoreWithPref).toBe(100);
  });
});

// ═══════════════════════════════════════════
// Secondary Clinics (3 tests)
// ═══════════════════════════════════════════

describe("SHOULD-PASS — Secondary Clinics", () => {
  beforeEach(() => resetNurseCounter());

  it("S.4 secondary clinic stacked on primary → hours added correctly", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const primary = makeClinicSlot({ clinicId: "c1", day: "MON" });
    const secondary = makeClinicSlot({
      clinicId: "c2",
      day: "MON",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [primary, secondary],
    });
    const result = generateWeeklySchedule(WEEK_START, config);

    const mon = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "MON",
    );
    expect(mon?.primaryClinicId).toBe("c1");
    expect(mon?.secondaryClinicId).toBe("c2");
    expect(mon?.hours).toBe(9); // 7 + 2
  });

  it("S.5 no secondary if budget < secondaryHours", () => {
    // contractHours=7: just enough for 1 primary (7h), no room for secondary (2h)
    const nurse = makeNurse({ id: "n1", contractHours: 7 });
    const primary = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      shiftHours: 7,
    });
    const secondary = makeClinicSlot({
      clinicId: "c2",
      day: "MON",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [primary, secondary],
    });
    const result = generateWeeklySchedule(WEEK_START, config);

    const mon = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "MON",
    );
    expect(mon?.primaryClinicId).toBe("c1");
    expect(mon?.secondaryClinicId).toBeNull();
    expect(mon?.hours).toBe(7);
  });

  it("S.6 secondary demand exhausted → only 1 nurse gets secondary", () => {
    const n1 = makeNurse({ id: "n1", contractHours: 36 });
    const n2 = makeNurse({ id: "n2", contractHours: 36 });
    const primary1 = makeClinicSlot({ clinicId: "c1", day: "MON" });
    const primary2 = makeClinicSlot({ clinicId: "c1-b", day: "MON" });
    const secondary = makeClinicSlot({
      clinicId: "c-sec",
      day: "MON",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    const config = makeConfig({
      nurses: [n1, n2],
      clinics: [primary1, primary2, secondary],
    });
    const result = generateWeeklySchedule(WEEK_START, config);

    const withSecondary = result.assignments.filter(
      (a) => a.day === "MON" && a.secondaryClinicId === "c-sec",
    );
    expect(withSecondary).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════
// Programs (2 tests)
// ═══════════════════════════════════════════

describe("SHOULD-PASS — Programs", () => {
  beforeEach(() => resetNurseCounter());

  it("S.7 pure program → full day, no primary clinic, hours=7", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [],
      programs: [
        {
          nurseId: "n1",
          programName: "מערך שד",
          programType: "PURE_PROGRAM",
          day: "WED",
          patientCount: 10,
          shiftStart: "08:00",
          shiftEnd: "15:00",
          defaultHours: 7,
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const wed = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "WED",
    );
    expect(wed?.patientCallProgram).toBe("מערך שד");
    expect(wed?.patientCallCount).toBe(10);
    // Base hours=7, but gap-fill (Layer 7) extends to 8h when budget allows
    expect(wed?.hours).toBeGreaterThanOrEqual(7);
    expect(wed?.primaryClinicId).toBeNull();
    expect(wed?.isFixed).toBe(true);
  });

  it("S.8 clinic addon → call info added, hours NOT changed", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const slot = makeClinicSlot({ clinicId: "c1", day: "MON" });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [slot],
      programs: [
        {
          nurseId: "n1",
          programName: "סוכרת",
          programType: "CLINIC_ADDON",
          day: "MON",
          patientCount: 5,
          shiftStart: null,
          shiftEnd: null,
          defaultHours: null,
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const mon = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "MON",
    );
    expect(mon?.primaryClinicId).toBe("c1");
    expect(mon?.patientCallProgram).toBe("סוכרת");
    expect(mon?.patientCallCount).toBe(5);
    // Addon doesn't add hours; base=7, gap-fill extends to 8 when budget allows
    expect(mon?.hours).toBeGreaterThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════
// Quality & Optimization (3 tests)
// ═══════════════════════════════════════════

describe("SHOULD-PASS — Quality & Optimization", () => {
  beforeEach(() => resetNurseCounter());

  it("S.9 schedule honoring all preferences → qualityScore > 85", () => {
    // 3 morning-preference nurses, 3 morning clinics → perfect matches
    const nurses = [
      makeNurse({
        id: "n1",
        userId: "u1",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
      makeNurse({
        id: "n2",
        userId: "u2",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
      makeNurse({
        id: "n3",
        userId: "u3",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
    ];
    const clinics = [
      makeClinicSlot({
        clinicId: "c1",
        day: "MON",
        shiftStart: "08:00",
        shiftEnd: "15:00",
      }),
      makeClinicSlot({
        clinicId: "c2",
        day: "TUE",
        shiftStart: "08:00",
        shiftEnd: "15:00",
      }),
      makeClinicSlot({
        clinicId: "c3",
        day: "WED",
        shiftStart: "08:00",
        shiftEnd: "15:00",
      }),
    ];

    const config = makeConfig({ nurses, clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    expect(result.qualityScore).toBeGreaterThan(85);
  });

  it("S.10 schedule with preference mismatches → qualityScore < 85", () => {
    // 2 morning-preference nurses forced into 4 afternoon slots
    const nurses = [
      makeNurse({
        id: "n1",
        userId: "u1",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
      makeNurse({
        id: "n2",
        userId: "u2",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
    ];
    const clinics = [
      makeClinicSlot({
        clinicId: "c1",
        day: "MON",
        shiftStart: "13:00",
        shiftEnd: "20:00",
        shiftHours: 7,
      }),
      makeClinicSlot({
        clinicId: "c2",
        day: "TUE",
        shiftStart: "13:00",
        shiftEnd: "20:00",
        shiftHours: 7,
      }),
      makeClinicSlot({
        clinicId: "c3",
        day: "WED",
        shiftStart: "13:00",
        shiftEnd: "20:00",
        shiftHours: 7,
      }),
      makeClinicSlot({
        clinicId: "c4",
        day: "THU",
        shiftStart: "13:00",
        shiftEnd: "20:00",
        shiftHours: 7,
      }),
    ];

    const config = makeConfig({ nurses, clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    // Each nurse works ~2 afternoon slots → 4 mismatches → -20 → score ≤ 80
    expect(result.qualityScore).toBeLessThan(85);
  });

  it("S.11 optimizer improves (or maintains) score within 2 seconds", () => {
    // Suboptimal setup: morning-pref nurses assigned to afternoon, and vice versa
    const nurses = [
      makeNurse({
        id: "n0",
        userId: "u0",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
      makeNurse({
        id: "n1",
        userId: "u1",
        shiftPreference: "AFTERNOON",
        contractHours: 36,
      }),
      makeNurse({
        id: "n2",
        userId: "u2",
        shiftPreference: "MORNING",
        contractHours: 36,
      }),
      makeNurse({
        id: "n3",
        userId: "u3",
        shiftPreference: "AFTERNOON",
        contractHours: 36,
      }),
    ];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const clinics = [
      makeClinicSlot({
        clinicId: "c-m1",
        day: "MON",
        shiftStart: "08:00",
        shiftEnd: "15:00",
        shiftHours: 7,
      }),
      makeClinicSlot({
        clinicId: "c-m2",
        day: "MON",
        shiftStart: "08:00",
        shiftEnd: "15:00",
        shiftHours: 7,
      }),
      makeClinicSlot({
        clinicId: "c-a1",
        day: "MON",
        shiftStart: "13:00",
        shiftEnd: "20:00",
        shiftHours: 7,
      }),
      makeClinicSlot({
        clinicId: "c-a2",
        day: "MON",
        shiftStart: "13:00",
        shiftEnd: "20:00",
        shiftHours: 7,
      }),
    ];

    // Assign SUBOPTIMALLY: morning-pref → afternoon, afternoon-pref → morning
    const assignments = [
      { nurse: "n0", clinic: "c-a1", start: "13:00", end: "20:00" },
      { nurse: "n1", clinic: "c-m1", start: "08:00", end: "15:00" },
      { nurse: "n2", clinic: "c-a2", start: "13:00", end: "20:00" },
      { nurse: "n3", clinic: "c-m2", start: "08:00", end: "15:00" },
    ];

    for (const a of assignments) {
      const cell = getCell(grid, a.nurse, "MON");
      cell.status = "ASSIGNED";
      cell.primaryClinicId = a.clinic;
      cell.shiftStart = a.start;
      cell.shiftEnd = a.end;
      cell.hours = 7;
      budgets.set(a.nurse, 29);
    }

    const scoreBefore = calculateQualityScore(grid, nurses, clinics, []);

    const start = performance.now();
    layer9_optimize(grid, nurses, clinics, budgets, []);
    const elapsed = performance.now() - start;

    const scoreAfter = calculateQualityScore(grid, nurses, clinics, []);

    expect(scoreAfter).toBeGreaterThanOrEqual(scoreBefore);
    expect(elapsed).toBeLessThan(2000); // < 2 seconds
  });
});

// ═══════════════════════════════════════════
// Performance: Full generation < 3 seconds
// ═══════════════════════════════════════════

describe("SHOULD-PASS — Performance", () => {
  beforeEach(() => resetNurseCounter());

  it("full schedule generation completes in < 3 seconds", () => {
    // Realistic scenario: 10 nurses, 15 clinic slots across the week
    const nurses = Array.from({ length: 10 }, (_, i) =>
      makeNurse({ id: `n${i}`, userId: `u${i}`, contractHours: 36 }),
    );

    const days: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU"];
    const clinics = days.flatMap((day, di) => [
      makeClinicSlot({ clinicId: `c${di}-a`, day, nursesNeeded: 2 }),
      makeClinicSlot({ clinicId: `c${di}-b`, day, nursesNeeded: 1 }),
    ]);

    const config = makeConfig({ nurses, clinics });

    const start = performance.now();
    const result = generateWeeklySchedule(WEEK_START, config);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
  });

  it("quality score for normal week ≥ 70", () => {
    const nurses = Array.from({ length: 8 }, (_, i) =>
      makeNurse({
        id: `n${i}`,
        userId: `u${i}`,
        contractHours: 36,
        shiftPreference: "ANYTIME",
      }),
    );

    const days: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU"];
    const clinics = days.map((day, i) =>
      makeClinicSlot({
        clinicId: `c${i}`,
        day,
        nursesNeeded: 1,
        shiftStart: "08:00",
        shiftEnd: "15:00",
      }),
    );

    const config = makeConfig({ nurses, clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    expect(result.qualityScore).toBeGreaterThanOrEqual(70);
  });
});
