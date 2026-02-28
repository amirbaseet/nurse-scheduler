import { describe, it, expect, beforeEach } from "vitest";
import { layer6_programs } from "@/algorithm/layers/6-programs";
import type { ProgramEntry, Warning } from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  getCell,
  resetNurseCounter,
} from "../helpers";

describe("Layer 6 — Program Addons (CLINIC_ADDON)", () => {
  let warnings: Warning[];

  beforeEach(() => {
    warnings = [];
    resetNurseCounter();
  });

  it("adds patient call info to an assigned cell", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Pre-assign nurse
    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Diabetes Calls",
        programType: "CLINIC_ADDON",
        day: "MON",
        patientCount: 8,
      },
    ];

    layer6_programs(grid, [nurse], programs, budgets, warnings);

    expect(cell.patientCallProgram).toBe("Diabetes Calls");
    expect(cell.patientCallCount).toBe(8);
    expect(cell.hours).toBe(7); // hours unchanged
    expect(warnings).toHaveLength(0);
  });

  it("warns when nurse is not assigned on that day", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Cell is AVAILABLE (not assigned)
    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Home Calls",
        programType: "CLINIC_ADDON",
        day: "TUE",
        patientCount: 5,
      },
    ];

    layer6_programs(grid, [nurse], programs, budgets, warnings);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe("warning");
    expect(warnings[0].nurseId).toBe("n1");
    expect(warnings[0].day).toBe("TUE");
  });

  it("ignores PURE_PROGRAM entries", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    const programs: ProgramEntry[] = [
      {
        nurseId: "n1",
        programName: "Pure Program",
        programType: "PURE_PROGRAM",
        day: "MON",
        patientCount: 10,
      },
    ];

    layer6_programs(grid, [nurse], programs, budgets, warnings);

    // PURE_PROGRAM should be ignored by Layer 6
    expect(cell.patientCallProgram).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });
});
