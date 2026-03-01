import { describe, it, expect, beforeEach } from "vitest";
import { layer9_optimize } from "@/algorithm/layers/9-optimize";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "../helpers";

beforeEach(() => resetNurseCounter());

describe("Layer 9 — Simulated Annealing Optimizer", () => {
  it("does not swap fixed assignments", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    const clinicA = makeClinicSlot({ clinicId: "clinic-A", day: "SUN" });
    const clinicB = makeClinicSlot({ clinicId: "clinic-B", day: "SUN" });

    // Assign nurse1 to clinic-A (fixed), nurse2 to clinic-B (not fixed)
    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-A";
    cell1.shiftStart = "08:00";
    cell1.shiftEnd = "15:00";
    cell1.hours = 7;
    cell1.isFixed = true;

    const cell2 = getCell(grid, "n2", "SUN");
    cell2.status = "ASSIGNED";
    cell2.primaryClinicId = "clinic-B";
    cell2.shiftStart = "08:00";
    cell2.shiftEnd = "15:00";
    cell2.hours = 7;
    cell2.isFixed = false;

    layer9_optimize(grid, [nurse1, nurse2], [clinicA, clinicB], budgets, []);

    // Fixed assignment must remain unchanged
    expect(getCell(grid, "n1", "SUN").primaryClinicId).toBe("clinic-A");
    expect(getCell(grid, "n1", "SUN").isFixed).toBe(true);
  });

  it("does not swap nurse into a blocked clinic", () => {
    const nurse1 = makeNurse({
      id: "n1",
      contractHours: 36,
      blockedClinicIds: ["clinic-B"],
    });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    const clinicA = makeClinicSlot({ clinicId: "clinic-A", day: "SUN" });
    const clinicB = makeClinicSlot({ clinicId: "clinic-B", day: "SUN" });

    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-A";
    cell1.shiftStart = "08:00";
    cell1.shiftEnd = "15:00";
    cell1.hours = 7;

    const cell2 = getCell(grid, "n2", "SUN");
    cell2.status = "ASSIGNED";
    cell2.primaryClinicId = "clinic-B";
    cell2.shiftStart = "08:00";
    cell2.shiftEnd = "15:00";
    cell2.hours = 7;

    layer9_optimize(grid, [nurse1, nurse2], [clinicA, clinicB], budgets, []);

    // nurse1 is blocked from clinic-B, so she must never end up there
    expect(getCell(grid, "n1", "SUN").primaryClinicId).not.toBe("clinic-B");
  });

  it("does not violate FEMALE_ONLY gender constraint", () => {
    const femalNurse = makeNurse({
      id: "n1",
      gender: "FEMALE",
      contractHours: 36,
    });
    const maleNurse = makeNurse({
      id: "n2",
      gender: "MALE",
      contractHours: 36,
    });
    const grid = makeGrid([femalNurse, maleNurse]);
    const budgets = makeBudgets([femalNurse, maleNurse]);

    const femaleOnlyClinic = makeClinicSlot({
      clinicId: "clinic-FO",
      day: "SUN",
      genderPref: "FEMALE_ONLY",
    });
    const anyClinic = makeClinicSlot({
      clinicId: "clinic-ANY",
      day: "SUN",
      genderPref: "ANY",
    });

    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-FO";
    cell1.shiftStart = "08:00";
    cell1.shiftEnd = "15:00";
    cell1.hours = 7;

    const cell2 = getCell(grid, "n2", "SUN");
    cell2.status = "ASSIGNED";
    cell2.primaryClinicId = "clinic-ANY";
    cell2.shiftStart = "08:00";
    cell2.shiftEnd = "15:00";
    cell2.hours = 7;

    layer9_optimize(
      grid,
      [femalNurse, maleNurse],
      [femaleOnlyClinic, anyClinic],
      budgets,
      [],
    );

    // Male nurse must never end up in FEMALE_ONLY clinic
    expect(getCell(grid, "n2", "SUN").primaryClinicId).not.toBe("clinic-FO");
  });

  it("skips when fewer than 2 nurses", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.shiftStart = "08:00";
    cell.shiftEnd = "15:00";
    cell.hours = 7;

    // Should return immediately without error
    layer9_optimize(
      grid,
      [nurse],
      [makeClinicSlot({ clinicId: "clinic-A", day: "SUN" })],
      budgets,
      [],
    );

    expect(getCell(grid, "n1", "SUN").primaryClinicId).toBe("clinic-A");
  });

  it("completes within 2 seconds", () => {
    // Set up a realistic-ish grid: 10 nurses × 5 days × 2 clinics
    const nurses = Array.from({ length: 10 }, (_, i) =>
      makeNurse({ id: `n${i}`, contractHours: 36 }),
    );
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);
    const clinics = ["clinic-A", "clinic-B"].flatMap((clinicId) =>
      (["SUN", "MON", "TUE", "WED", "THU"] as const).map((day) =>
        makeClinicSlot({ clinicId, day, nursesNeeded: 5 }),
      ),
    );

    // Assign all nurses to alternating clinics on each day
    for (const nurse of nurses) {
      for (const day of ["SUN", "MON", "TUE", "WED", "THU"] as const) {
        const cell = getCell(grid, nurse.id, day);
        cell.status = "ASSIGNED";
        cell.primaryClinicId =
          parseInt(nurse.id.slice(1)) % 2 === 0 ? "clinic-A" : "clinic-B";
        cell.shiftStart = "08:00";
        cell.shiftEnd = "15:00";
        cell.hours = 7;
      }
    }

    const start = Date.now();
    layer9_optimize(grid, nurses, clinics, budgets, []);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it("preserves cell invariants after optimization", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const nurse3 = makeNurse({ id: "n3", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2, nurse3]);
    const budgets = makeBudgets([nurse1, nurse2, nurse3]);

    const clinics = [
      makeClinicSlot({ clinicId: "clinic-A", day: "SUN", nursesNeeded: 2 }),
      makeClinicSlot({ clinicId: "clinic-B", day: "SUN", nursesNeeded: 1 }),
    ];

    // Assign: n1→A, n2→B, n3→A
    for (const [nId, cId] of [
      ["n1", "clinic-A"],
      ["n2", "clinic-B"],
      ["n3", "clinic-A"],
    ] as const) {
      const cell = getCell(grid, nId, "SUN");
      cell.status = "ASSIGNED";
      cell.primaryClinicId = cId;
      cell.shiftStart = "08:00";
      cell.shiftEnd = "15:00";
      cell.hours = 7;
    }

    layer9_optimize(grid, [nurse1, nurse2, nurse3], clinics, budgets, []);

    // All cells should still be ASSIGNED with valid clinic IDs
    for (const nId of ["n1", "n2", "n3"]) {
      const cell = getCell(grid, nId, "SUN");
      expect(cell.status).toBe("ASSIGNED");
      expect(["clinic-A", "clinic-B"]).toContain(cell.primaryClinicId);
      expect(cell.hours).toBe(7);
      expect(cell.shiftStart).toBe("08:00");
      expect(cell.shiftEnd).toBe("15:00");
    }
  });
});
