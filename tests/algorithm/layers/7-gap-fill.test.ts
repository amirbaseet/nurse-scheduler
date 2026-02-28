import { describe, it, expect, beforeEach } from "vitest";
import { layer7_gapFill } from "@/algorithm/layers/7-gap-fill";
import type { Warning } from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  getCell,
  resetNurseCounter,
} from "../helpers";

describe("Layer 7 — Gap Fill", () => {
  let warnings: Warning[];

  beforeEach(() => {
    warnings = [];
    resetNurseCounter();
  });

  it("extends shift by correct amount (up to 2h)", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 6;
    cell.shiftEnd = "14:00";
    budgets.set("n1", 10);

    layer7_gapFill(grid, [nurse], budgets, warnings);

    // Should extend by 2h (min of: 2, 8-6=2, budget 10)
    expect(cell.hours).toBe(8);
    expect(cell.shiftEnd).toBe("16:00");
    expect(budgets.get("n1")).toBe(8); // 10 - 2
  });

  it("respects max 8h per shift", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    cell.shiftEnd = "15:00";
    budgets.set("n1", 10);

    layer7_gapFill(grid, [nurse], budgets, warnings);

    // Only 1h room left (8 - 7), not full 2h
    expect(cell.hours).toBe(8);
    expect(cell.shiftEnd).toBe("16:00");
    expect(budgets.get("n1")).toBe(9);
  });

  it("skips already-8h shifts", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 8;
    cell.shiftEnd = "16:00";
    budgets.set("n1", 10);

    layer7_gapFill(grid, [nurse], budgets, warnings);

    expect(cell.hours).toBe(8); // unchanged
    expect(cell.shiftEnd).toBe("16:00"); // unchanged
  });

  it("limits extension to available budget", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 5;
    cell.shiftEnd = "13:00";
    budgets.set("n1", 1); // only 1h budget left, but gap-fill needs ≥2h to qualify

    // Nurse won't qualify (budget < 2), so no extension
    layer7_gapFill(grid, [nurse], budgets, warnings);

    expect(cell.hours).toBe(5); // unchanged (didn't qualify)
  });

  it("warns when nurse still has 4+ unfilled hours", () => {
    const nurse = makeNurse({ id: "n1", name: "Nasrin", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Only 1 shift at 7h, leaving 29h - after extension: 27h
    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 6;
    cell.shiftEnd = "14:00";
    budgets.set("n1", 29);

    layer7_gapFill(grid, [nurse], budgets, warnings);

    // After extending by 2h: budget = 27h, still ≥ 4
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe("info");
    expect(warnings[0].message).toContain("Nasrin");
    expect(warnings[0].message).toContain("27");
  });

  it("processes nurses with most remaining budget first", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    // nurse1: 5h remaining
    getCell(grid, "n1", "MON").status = "ASSIGNED";
    getCell(grid, "n1", "MON").hours = 6;
    getCell(grid, "n1", "MON").shiftEnd = "14:00";
    budgets.set("n1", 5);

    // nurse2: 15h remaining (should be processed first)
    getCell(grid, "n2", "MON").status = "ASSIGNED";
    getCell(grid, "n2", "MON").hours = 6;
    getCell(grid, "n2", "MON").shiftEnd = "14:00";
    budgets.set("n2", 15);

    layer7_gapFill(grid, [nurse1, nurse2], budgets, warnings);

    // Both should get extended (both have ≥2h budget)
    expect(getCell(grid, "n1", "MON").hours).toBe(8);
    expect(getCell(grid, "n2", "MON").hours).toBe(8);
  });

  it("does not extend non-assigned cells", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);
    budgets.set("n1", 10);

    // BLOCKED cell
    getCell(grid, "n1", "MON").status = "BLOCKED";

    layer7_gapFill(grid, [nurse], budgets, warnings);

    expect(getCell(grid, "n1", "MON").hours).toBe(0); // unchanged
  });
});
