import { describe, it, expect, beforeEach } from "vitest";
import { layer2_fixed } from "@/algorithm/layers/2-fixed";
import type {
  FixedEntry,
  ProgramEntry,
  Warning,
  Budgets,
} from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  getCell,
  resetNurseCounter,
} from "../helpers";

describe("Layer 2 — Fixed Assignments", () => {
  let warnings: Warning[];

  beforeEach(() => {
    warnings = [];
    resetNurseCounter();
  });

  // ── 2A: Fixed clinic assignments ──

  it("places fixed assignment correctly", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const fixed: FixedEntry[] = [
      {
        nurseId: "n1",
        clinicId: "clinic-A",
        day: "MON",
        shiftStart: "08:00",
        shiftEnd: "14:00",
        shiftHours: 6,
      },
    ];

    layer2_fixed(grid, [nurse], fixed, [], budgets, warnings);

    const cell = getCell(grid, "n1", "MON");
    expect(cell.status).toBe("ASSIGNED");
    expect(cell.primaryClinicId).toBe("clinic-A");
    expect(cell.shiftStart).toBe("08:00");
    expect(cell.shiftEnd).toBe("14:00");
    expect(cell.hours).toBe(6);
    expect(cell.isFixed).toBe(true);
  });

  it("deducts hours from budget", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const fixed: FixedEntry[] = [
      { nurseId: "n1", clinicId: "clinic-A", day: "MON", shiftHours: 7 },
      { nurseId: "n1", clinicId: "clinic-B", day: "TUE", shiftHours: 6 },
    ];

    layer2_fixed(grid, [nurse], fixed, [], budgets, warnings);

    expect(budgets.get("n1")).toBe(36 - 7 - 6); // 23
  });

  it("skips fixed assignment on blocked day and warns", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Pre-block Monday (simulating Layer 1 ran first)
    const cell = getCell(grid, "n1", "MON");
    cell.status = "BLOCKED";
    cell.blockReason = "time_off";

    const fixed: FixedEntry[] = [
      { nurseId: "n1", clinicId: "clinic-A", day: "MON", shiftHours: 7 },
    ];

    layer2_fixed(grid, [nurse], fixed, [], budgets, warnings);

    expect(getCell(grid, "n1", "MON").status).toBe("BLOCKED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe("warning");
    expect(warnings[0].nurseId).toBe("n1");
    expect(warnings[0].day).toBe("MON");
    // Budget should NOT be deducted
    expect(budgets.get("n1")).toBe(36);
  });

  it("uses default hours/shift when not specified", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const fixed: FixedEntry[] = [
      { nurseId: "n1", clinicId: "clinic-A", day: "WED" },
    ];

    layer2_fixed(grid, [nurse], fixed, [], budgets, warnings);

    const c = getCell(grid, "n1", "WED");
    expect(c.hours).toBe(7);
    expect(c.shiftStart).toBe("08:00");
    expect(c.shiftEnd).toBe("15:00");
  });

  // ── 2B: Pure patient programs ──

  it("places PURE_PROGRAM with patientCallProgram and count", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Diabetes Follow-up",
        programType: "PURE_PROGRAM",
        day: "TUE",
        patientCount: 12,
        defaultHours: 5,
        shiftStart: "09:00",
        shiftEnd: "14:00",
      },
    ];

    layer2_fixed(grid, [nurse], [], programs, budgets, warnings);

    const cell = getCell(grid, "n1", "TUE");
    expect(cell.status).toBe("ASSIGNED");
    expect(cell.patientCallProgram).toBe("Diabetes Follow-up");
    expect(cell.patientCallCount).toBe(12);
    expect(cell.hours).toBe(5);
    expect(cell.shiftStart).toBe("09:00");
    expect(cell.shiftEnd).toBe("14:00");
    expect(cell.isFixed).toBe(true);
  });

  it("skips PURE_PROGRAM on blocked day and warns", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Pre-block
    getCell(grid, "n1", "TUE").status = "BLOCKED";

    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Home Visits",
        programType: "PURE_PROGRAM",
        day: "TUE",
        patientCount: 8,
      },
    ];

    layer2_fixed(grid, [nurse], [], programs, budgets, warnings);

    expect(getCell(grid, "n1", "TUE").status).toBe("BLOCKED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].nurseId).toBe("n1");
    expect(budgets.get("n1")).toBe(36); // no deduction
  });

  it("ignores CLINIC_ADDON programs (only PURE_PROGRAM)", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Addon Program",
        programType: "CLINIC_ADDON",
        day: "WED",
        patientCount: 5,
      },
    ];

    layer2_fixed(grid, [nurse], [], programs, budgets, warnings);

    const cell = getCell(grid, "n1", "WED");
    expect(cell.status).toBe("AVAILABLE"); // unchanged
    expect(cell.patientCallProgram).toBeUndefined();
    expect(budgets.get("n1")).toBe(36); // no deduction
  });

  it("deducts PURE_PROGRAM hours from budget", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 30 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Vaccine Campaign",
        programType: "PURE_PROGRAM",
        day: "SUN",
        defaultHours: 4,
      },
    ];

    layer2_fixed(grid, [nurse], [], programs, budgets, warnings);

    expect(budgets.get("n1")).toBe(30 - 4); // 26
  });
});
