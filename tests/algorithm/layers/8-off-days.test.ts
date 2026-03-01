import { describe, it, expect, beforeEach } from "vitest";
import { layer8_offDays } from "@/algorithm/layers/8-off-days";
import {
  makeNurse,
  makeGrid,
  getCell,
  resetNurseCounter,
  DAYS,
} from "../helpers";

describe("Layer 8 — Off Days", () => {
  beforeEach(() => resetNurseCounter());

  it("marks all AVAILABLE cells as OFF", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);

    // All cells start AVAILABLE
    layer8_offDays(grid, [nurse]);

    for (const day of DAYS) {
      const cell = getCell(grid, "n1", day);
      expect(cell.status).toBe("OFF");
      expect(cell.hours).toBe(0);
    }
  });

  it("does not change ASSIGNED cells", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "MON");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    layer8_offDays(grid, [nurse]);

    expect(getCell(grid, "n1", "MON").status).toBe("ASSIGNED");
    expect(getCell(grid, "n1", "MON").hours).toBe(7);
    // Other days should be OFF
    expect(getCell(grid, "n1", "TUE").status).toBe("OFF");
  });

  it("converts BLOCKED cells to OFF", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "FRI");
    cell.status = "BLOCKED";
    cell.blockReason = "no_friday";

    layer8_offDays(grid, [nurse]);

    expect(getCell(grid, "n1", "FRI").status).toBe("OFF");
    expect(getCell(grid, "n1", "FRI").hours).toBe(0);
  });

  it("handles mixed statuses across multiple nurses", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const grid = makeGrid([nurse1, nurse2]);

    getCell(grid, "n1", "SUN").status = "ASSIGNED";
    getCell(grid, "n1", "MON").status = "BLOCKED";
    // n1 TUE-SAT: AVAILABLE → should become OFF

    getCell(grid, "n2", "SUN").status = "ASSIGNED";
    // n2 MON-SAT: AVAILABLE → should become OFF

    layer8_offDays(grid, [nurse1, nurse2]);

    expect(getCell(grid, "n1", "SUN").status).toBe("ASSIGNED");
    expect(getCell(grid, "n1", "MON").status).toBe("OFF");
    expect(getCell(grid, "n1", "TUE").status).toBe("OFF");
    expect(getCell(grid, "n1", "WED").status).toBe("OFF");

    expect(getCell(grid, "n2", "SUN").status).toBe("ASSIGNED");
    expect(getCell(grid, "n2", "MON").status).toBe("OFF");
  });
});
