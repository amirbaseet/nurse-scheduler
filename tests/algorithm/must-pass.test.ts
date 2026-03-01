import { describe, it, expect, beforeEach } from "vitest";
import { generateWeeklySchedule } from "@/algorithm/index";
import { mergeClinicConfigs } from "@/algorithm/converters";
import { layer9_optimize } from "@/algorithm/layers/9-optimize";
import type { AlgorithmConfig, DayOfWeek } from "@/algorithm/types";
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
// Category 1: Basic Constraints (5 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 1: Basic Constraints", () => {
  beforeEach(() => resetNurseCounter());

  it("1.1 nurse on approved vacation → NOT assigned during vacation", () => {
    const nurse = makeNurse({ id: "n1", userId: "u1", contractHours: 36 });
    const slot = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      nursesNeeded: 1,
    });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [slot],
      timeOff: [
        {
          nurseUserId: "u1",
          startDate: new Date("2026-03-02"), // MON
          endDate: new Date("2026-03-02"),
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    // Nurse should NOT be assigned on MON
    const monAssignment = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "MON",
    );
    expect(monAssignment?.primaryClinicId).toBeNull();

    // Unfilled slot should appear as a manager gap
    expect(
      result.managerGaps.some((g) => g.clinicId === "c1" && g.day === "MON"),
    ).toBe(true);
  });

  it("1.2 nurse at max contract hours → NOT assigned more work", () => {
    // Contract = 7h → budget for exactly 1 shift
    const nurse = makeNurse({ id: "n1", contractHours: 7 });
    const slot1 = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      shiftHours: 7,
    });
    const slot2 = makeClinicSlot({
      clinicId: "c2",
      day: "TUE",
      shiftHours: 7,
    });

    const config = makeConfig({ nurses: [nurse], clinics: [slot1, slot2] });
    const result = generateWeeklySchedule(WEEK_START, config);

    const assigned = result.assignments.filter(
      (a) => a.nurseId === "n1" && a.primaryClinicId !== null,
    );
    expect(assigned).toHaveLength(1); // only 1 shift, budget exhausted
    expect(assigned[0].hours).toBe(7);
  });

  it("1.3 two clinics, one nurse → warning generated, 1 filled", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const slot1 = makeClinicSlot({ clinicId: "c1", day: "MON" });
    const slot2 = makeClinicSlot({ clinicId: "c2", day: "MON" });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [slot1, slot2],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    // One clinic filled
    const monAssigned = result.assignments.filter(
      (a) =>
        a.nurseId === "n1" && a.day === "MON" && a.primaryClinicId !== null,
    );
    expect(monAssigned).toHaveLength(1);

    // Unfilled slot → gap or error warning
    const hasGap = result.managerGaps.some((g) => g.day === "MON");
    const hasWarning = result.warnings.some(
      (w) => w.day === "MON" && w.level === "error",
    );
    expect(hasGap || hasWarning).toBe(true);
  });

  it("1.4 nurse with maxDaysPerWeek=3 → works max 3 days", () => {
    // contractHours=21 → budget for exactly 3 × 7h shifts
    const nurse = makeNurse({
      id: "n1",
      contractHours: 21,
      maxDaysPerWeek: 3,
    });
    const clinics = (["SUN", "MON", "TUE", "WED", "THU"] as DayOfWeek[]).map(
      (day, i) => makeClinicSlot({ clinicId: `c${i}`, day }),
    );

    const config = makeConfig({ nurses: [nurse], clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    const assignedDays = result.assignments.filter(
      (a) => a.nurseId === "n1" && a.primaryClinicId !== null,
    );
    expect(assignedDays.length).toBeLessThanOrEqual(3);
  });

  it("1.5 full week generation → all required slots filled or warned", () => {
    const nurses = [
      makeNurse({ id: "n1", contractHours: 36 }),
      makeNurse({ id: "n2", contractHours: 36 }),
      makeNurse({ id: "n3", contractHours: 36 }),
    ];
    const clinics = [
      makeClinicSlot({ clinicId: "c1", day: "MON" }),
      makeClinicSlot({ clinicId: "c2", day: "TUE" }),
      makeClinicSlot({ clinicId: "c3", day: "WED" }),
    ];

    const config = makeConfig({ nurses, clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    // Every slot: either filled or appears in managerGaps
    for (const slot of clinics) {
      const filled = result.assignments.some(
        (a) => a.primaryClinicId === slot.clinicId && a.day === slot.day,
      );
      const gapped = result.managerGaps.some(
        (g) => g.clinicId === slot.clinicId && g.day === slot.day,
      );
      expect(filled || gapped).toBe(true);
    }

    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════
// Category 2: Gender Rules (3 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 2: Gender Rules", () => {
  beforeEach(() => resetNurseCounter());

  it("2.1 FEMALE_ONLY clinic → only female nurse assigned", () => {
    const female = makeNurse({
      id: "n1",
      gender: "FEMALE",
      contractHours: 36,
    });
    const male = makeNurse({
      id: "n2",
      gender: "MALE",
      contractHours: 36,
    });
    const slot = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      genderPref: "FEMALE_ONLY",
    });

    const config = makeConfig({
      nurses: [female, male],
      clinics: [slot],
    });
    const result = generateWeeklySchedule(WEEK_START, config);

    const monAssigned = result.assignments.find(
      (a) => a.primaryClinicId === "c1" && a.day === "MON",
    );
    expect(monAssigned?.nurseId).toBe("n1"); // female only
  });

  it("2.2 FEMALE_ONLY + no female available → error warning, slot empty", () => {
    const male = makeNurse({
      id: "n1",
      gender: "MALE",
      contractHours: 36,
    });
    const slot = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      genderPref: "FEMALE_ONLY",
    });

    const config = makeConfig({ nurses: [male], clinics: [slot] });
    const result = generateWeeklySchedule(WEEK_START, config);

    const filled = result.assignments.find(
      (a) => a.primaryClinicId === "c1" && a.day === "MON",
    );
    expect(filled).toBeUndefined();

    expect(
      result.warnings.some((w) => w.level === "error" && w.clinicId === "c1"),
    ).toBe(true);
  });

  it("2.3 FEMALE_PREFERRED + no female → male assigned with warning", () => {
    const male = makeNurse({
      id: "n1",
      gender: "MALE",
      contractHours: 36,
    });
    const slot = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      genderPref: "FEMALE_PREFERRED",
    });

    const config = makeConfig({ nurses: [male], clinics: [slot] });
    const result = generateWeeklySchedule(WEEK_START, config);

    const monAssigned = result.assignments.find(
      (a) => a.primaryClinicId === "c1" && a.day === "MON",
    );
    expect(monAssigned?.nurseId).toBe("n1"); // male assigned as fallback

    expect(result.warnings.some((w) => w.level === "warning")).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Category 3: Fixed Assignments (3 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 3: Fixed Assignments", () => {
  beforeEach(() => resetNurseCounter());

  it("3.1 fixed assignment → always placed with isFixed=true", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const slot = makeClinicSlot({ clinicId: "c-eyes", day: "SUN" });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [slot],
      fixedAssignments: [
        {
          nurseId: "n1",
          clinicId: "c-eyes",
          day: "SUN",
          shiftStart: "08:00",
          shiftEnd: "15:00",
          shiftHours: 7,
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const sunAssignment = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "SUN",
    );
    expect(sunAssignment?.primaryClinicId).toBe("c-eyes");
    expect(sunAssignment?.isFixed).toBe(true);
  });

  it("3.2 fixed on time-off day → warning generated, assignment skipped", () => {
    const nurse = makeNurse({ id: "n1", userId: "u1", contractHours: 36 });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [],
      timeOff: [
        {
          nurseUserId: "u1",
          startDate: new Date("2026-03-01"), // SUN
          endDate: new Date("2026-03-01"),
        },
      ],
      fixedAssignments: [
        {
          nurseId: "n1",
          clinicId: "c-eyes",
          day: "SUN",
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const sunAssignment = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "SUN",
    );
    expect(sunAssignment?.primaryClinicId).toBeNull();

    expect(
      result.warnings.some(
        (w) => w.message.includes("skipped") || w.message.includes("blocked"),
      ),
    ).toBe(true);
  });

  it("3.3 optimizer (Layer 9) never swaps fixed assignments", () => {
    const n1 = makeNurse({ id: "n1", contractHours: 36 });
    const n2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([n1, n2]);
    const budgets = makeBudgets([n1, n2]);

    // n1: fixed on SUN at c-eyes
    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "c-eyes";
    cell1.shiftStart = "08:00";
    cell1.shiftEnd = "15:00";
    cell1.hours = 7;
    cell1.isFixed = true;

    // n2: non-fixed on SUN at c-ent
    const cell2 = getCell(grid, "n2", "SUN");
    cell2.status = "ASSIGNED";
    cell2.primaryClinicId = "c-ent";
    cell2.shiftStart = "08:00";
    cell2.shiftEnd = "15:00";
    cell2.hours = 7;
    cell2.isFixed = false;

    const clinics = [
      makeClinicSlot({ clinicId: "c-eyes", day: "SUN" }),
      makeClinicSlot({ clinicId: "c-ent", day: "SUN" }),
    ];

    layer9_optimize(grid, [n1, n2], clinics, budgets, []);

    // Fixed assignment must remain unchanged
    expect(getCell(grid, "n1", "SUN").primaryClinicId).toBe("c-eyes");
    expect(getCell(grid, "n1", "SUN").isFixed).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Category 4: Friday/Saturday (3 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 4: Friday/Saturday", () => {
  beforeEach(() => resetNurseCounter());

  it("4.1 canWorkFriday=false → BLOCKED on Friday, not assigned", () => {
    const nurse = makeNurse({
      id: "n1",
      canWorkFriday: false,
      contractHours: 36,
    });
    const slot = makeClinicSlot({ clinicId: "c1", day: "FRI" });

    const config = makeConfig({ nurses: [nurse], clinics: [slot] });
    const result = generateWeeklySchedule(WEEK_START, config);

    const fri = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "FRI",
    );
    expect(fri?.primaryClinicId).toBeNull();
  });

  it("4.2 canWorkSaturday=false → BLOCKED on Saturday, not assigned", () => {
    const nurse = makeNurse({
      id: "n1",
      canWorkSaturday: false,
      contractHours: 36,
    });
    const slot = makeClinicSlot({ clinicId: "c1", day: "SAT" });

    const config = makeConfig({ nurses: [nurse], clinics: [slot] });
    const result = generateWeeklySchedule(WEEK_START, config);

    const sat = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "SAT",
    );
    expect(sat?.primaryClinicId).toBeNull();
  });

  it("4.3 only 2 nurses canWorkFriday=true → both assigned to Friday clinics", () => {
    const n1 = makeNurse({
      id: "n1",
      canWorkFriday: true,
      contractHours: 36,
    });
    const n2 = makeNurse({
      id: "n2",
      canWorkFriday: true,
      contractHours: 36,
    });
    const n3 = makeNurse({
      id: "n3",
      canWorkFriday: false,
      contractHours: 36,
    });
    const slot = makeClinicSlot({
      clinicId: "c1",
      day: "FRI",
      nursesNeeded: 2,
    });

    const config = makeConfig({
      nurses: [n1, n2, n3],
      clinics: [slot],
    });
    const result = generateWeeklySchedule(WEEK_START, config);

    const friAssigned = result.assignments.filter(
      (a) => a.day === "FRI" && a.primaryClinicId === "c1",
    );
    expect(friAssigned).toHaveLength(2);
    expect(friAssigned.every((a) => a.nurseId !== "n3")).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Category 5: Config Merge (3 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 5: Config Merge", () => {
  const makeDefault = (overrides?: Record<string, unknown>) => ({
    clinicId: "c1",
    day: "MON",
    shiftStart: "08:00",
    shiftEnd: "15:00",
    nursesNeeded: 2,
    isActive: true,
    clinic: {
      code: "test_clinic",
      genderPref: "ANY",
      canBeSecondary: false,
      secondaryHours: null,
      secondaryNursesNeeded: 0,
    },
    ...overrides,
  });

  it("5.1 clinic with default config only → algorithm uses default", () => {
    const result = mergeClinicConfigs([makeDefault()], []);
    expect(result).toHaveLength(1);
    expect(result[0].clinicId).toBe("c1");
    expect(result[0].nursesNeeded).toBe(2);
    expect(result[0].shiftStart).toBe("08:00");
  });

  it("5.2 clinic with weekly override → algorithm uses override", () => {
    const override = makeDefault({
      shiftStart: "09:00",
      shiftEnd: "16:00",
      nursesNeeded: 3,
    });

    const result = mergeClinicConfigs([makeDefault()], [override]);
    expect(result).toHaveLength(1);
    expect(result[0].nursesNeeded).toBe(3);
    expect(result[0].shiftStart).toBe("09:00");
  });

  it("5.3 override with isActive=false → clinic skipped", () => {
    const override = makeDefault({ isActive: false });
    const result = mergeClinicConfigs([makeDefault()], [override]);
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════
// Category 6: Edge Cases (5 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 6: Edge Cases", () => {
  beforeEach(() => resetNurseCounter());

  it("6.1 all nurses on vacation same day → all slots empty + warnings", () => {
    const n1 = makeNurse({ id: "n1", userId: "u1" });
    const n2 = makeNurse({ id: "n2", userId: "u2" });
    const slot = makeClinicSlot({
      clinicId: "c1",
      day: "MON",
      nursesNeeded: 1,
    });

    const config = makeConfig({
      nurses: [n1, n2],
      clinics: [slot],
      timeOff: [
        {
          nurseUserId: "u1",
          startDate: new Date("2026-03-02"),
          endDate: new Date("2026-03-02"),
        },
        {
          nurseUserId: "u2",
          startDate: new Date("2026-03-02"),
          endDate: new Date("2026-03-02"),
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const monFilled = result.assignments.filter(
      (a) => a.day === "MON" && a.primaryClinicId === "c1",
    );
    expect(monFilled).toHaveLength(0);
    expect(
      result.managerGaps.some((g) => g.day === "MON" && g.clinicId === "c1"),
    ).toBe(true);
  });

  it("6.2 zero clinics configured → all nurses get OFF", () => {
    const nurse = makeNurse({ id: "n1" });

    const config = makeConfig({ nurses: [nurse], clinics: [] });
    const result = generateWeeklySchedule(WEEK_START, config);

    for (const a of result.assignments) {
      expect(a.isOff).toBe(true);
      expect(a.primaryClinicId).toBeNull();
    }
  });

  it("6.3 contractHours=8, maxDaysPerWeek=2 → works 1-2 days", () => {
    const nurse = makeNurse({
      id: "n1",
      contractHours: 8,
      maxDaysPerWeek: 2,
    });
    const clinics = (["SUN", "MON", "TUE", "WED", "THU"] as DayOfWeek[]).map(
      (day, i) => makeClinicSlot({ clinicId: `c${i}`, day }),
    );

    const config = makeConfig({ nurses: [nurse], clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    const assignedDays = result.assignments.filter(
      (a) => a.nurseId === "n1" && a.primaryClinicId !== null,
    );
    expect(assignedDays.length).toBeGreaterThanOrEqual(1);
    expect(assignedDays.length).toBeLessThanOrEqual(2);
  });

  it("6.4 one nurse, 5 clinics same day → 1 filled, 4 unfilled", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const clinics = Array.from({ length: 5 }, (_, i) =>
      makeClinicSlot({ clinicId: `c${i}`, day: "MON" }),
    );

    const config = makeConfig({ nurses: [nurse], clinics });
    const result = generateWeeklySchedule(WEEK_START, config);

    const monFilled = result.assignments.filter(
      (a) => a.day === "MON" && a.primaryClinicId !== null,
    );
    expect(monFilled).toHaveLength(1);

    // 4 gaps for unfilled
    const monGaps = result.managerGaps.filter((g) => g.day === "MON");
    expect(monGaps).toHaveLength(4);
  });

  it("6.5 fixed primary + secondary on same day → both applied, hours correct", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const primarySlot = makeClinicSlot({
      clinicId: "c-primary",
      day: "MON",
    });
    const secondarySlot = makeClinicSlot({
      clinicId: "c-secondary",
      day: "MON",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [primarySlot, secondarySlot],
      fixedAssignments: [
        {
          nurseId: "n1",
          clinicId: "c-primary",
          day: "MON",
          shiftStart: "08:00",
          shiftEnd: "15:00",
          shiftHours: 7,
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const mon = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "MON",
    );
    expect(mon?.primaryClinicId).toBe("c-primary");
    expect(mon?.secondaryClinicId).toBe("c-secondary");
    expect(mon?.hours).toBe(8); // 8h total shift (primary + secondary within same shift)
  });
});

// ═══════════════════════════════════════════
// Category 7: Recurring Off-Days (2 tests)
// ═══════════════════════════════════════════

describe("MUST-PASS — Category 7: Recurring Off-Days", () => {
  beforeEach(() => resetNurseCounter());

  it("7.1 recurringOffDays=[THU] → BLOCKED every Thursday", () => {
    const nurse = makeNurse({
      id: "n1",
      recurringOffDays: ["THU"],
    });
    const slot = makeClinicSlot({ clinicId: "c1", day: "THU" });

    const config = makeConfig({ nurses: [nurse], clinics: [slot] });
    const result = generateWeeklySchedule(WEEK_START, config);

    const thu = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "THU",
    );
    expect(thu?.primaryClinicId).toBeNull();
  });

  it("7.2 recurring off + vacation same day → BLOCKED (not double-counted)", () => {
    const nurse = makeNurse({
      id: "n1",
      userId: "u1",
      recurringOffDays: ["THU"],
    });

    const config = makeConfig({
      nurses: [nurse],
      clinics: [makeClinicSlot({ clinicId: "c1", day: "THU" })],
      timeOff: [
        {
          nurseUserId: "u1",
          startDate: new Date("2026-03-05"), // THU
          endDate: new Date("2026-03-05"),
        },
      ],
    });

    const result = generateWeeklySchedule(WEEK_START, config);

    const thu = result.assignments.find(
      (a) => a.nurseId === "n1" && a.day === "THU",
    );
    expect(thu?.primaryClinicId).toBeNull();

    // Should not crash or produce duplicate blocks
    expect(result.assignments.filter((a) => a.nurseId === "n1")).toHaveLength(
      7,
    ); // exactly 7 days
  });
});
