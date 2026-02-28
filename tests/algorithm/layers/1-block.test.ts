import { describe, it, expect, beforeEach } from "vitest";
import { layer1_block } from "@/algorithm/layers/1-block";
import type { TimeOffEntry, DayOfWeek, Warning } from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  getCell,
  resetNurseCounter,
  DAYS,
} from "../helpers";

// Week of Sunday Jan 5, 2025
const WEEK_START = new Date(2025, 0, 5);

describe("Layer 1 — Block", () => {
  let warnings: Warning[];

  beforeEach(() => {
    warnings = [];
    resetNurseCounter();
  });

  it("blocks nurse on approved vacation day", () => {
    const nurse = makeNurse({ id: "n1", userId: "u1" });
    const grid = makeGrid([nurse]);

    // Vacation covers Mon Jan 6 – Wed Jan 8
    const timeOff: TimeOffEntry[] = [
      {
        nurseUserId: "u1",
        startDate: new Date(2025, 0, 6),
        endDate: new Date(2025, 0, 8),
      },
    ];

    layer1_block(grid, [nurse], timeOff, DAYS, WEEK_START, warnings);

    expect(getCell(grid, "n1", "SUN").status).toBe("AVAILABLE");
    expect(getCell(grid, "n1", "MON").status).toBe("BLOCKED");
    expect(getCell(grid, "n1", "MON").blockReason).toBe("time_off");
    expect(getCell(grid, "n1", "TUE").status).toBe("BLOCKED");
    expect(getCell(grid, "n1", "WED").status).toBe("BLOCKED");
    expect(getCell(grid, "n1", "THU").status).toBe("AVAILABLE");
  });

  it("blocks recurring off-day (THU) and leaves others available", () => {
    const nurse = makeNurse({
      id: "n1",
      userId: "u1",
      recurringOffDays: ["THU"] as DayOfWeek[],
    });
    const grid = makeGrid([nurse]);

    layer1_block(grid, [nurse], [], DAYS, WEEK_START, warnings);

    expect(getCell(grid, "n1", "THU").status).toBe("BLOCKED");
    expect(getCell(grid, "n1", "THU").blockReason).toBe("recurring_off");
    expect(getCell(grid, "n1", "SUN").status).toBe("AVAILABLE");
    expect(getCell(grid, "n1", "MON").status).toBe("AVAILABLE");
  });

  it("blocks Friday when canWorkFriday=false", () => {
    const nurse = makeNurse({ id: "n1", userId: "u1", canWorkFriday: false });
    const grid = makeGrid([nurse]);

    layer1_block(grid, [nurse], [], DAYS, WEEK_START, warnings);

    expect(getCell(grid, "n1", "FRI").status).toBe("BLOCKED");
    expect(getCell(grid, "n1", "FRI").blockReason).toBe("no_friday");
    expect(getCell(grid, "n1", "THU").status).toBe("AVAILABLE");
  });

  it("blocks Saturday when canWorkSaturday=false", () => {
    const nurse = makeNurse({
      id: "n1",
      userId: "u1",
      canWorkSaturday: false,
    });
    const grid = makeGrid([nurse]);

    layer1_block(grid, [nurse], [], DAYS, WEEK_START, warnings);

    expect(getCell(grid, "n1", "SAT").status).toBe("BLOCKED");
    expect(getCell(grid, "n1", "SAT").blockReason).toBe("no_saturday");
    expect(getCell(grid, "n1", "FRI").status).toBe("AVAILABLE");
  });

  it("time-off takes priority over recurring off-day on same day", () => {
    // Vacation on Thursday (Jan 9) AND recurring off on Thursday
    // Should block with "time_off" (checked first)
    const nurse = makeNurse({
      id: "n1",
      userId: "u1",
      recurringOffDays: ["THU"] as DayOfWeek[],
    });
    const grid = makeGrid([nurse]);

    const timeOff: TimeOffEntry[] = [
      {
        nurseUserId: "u1",
        startDate: new Date(2025, 0, 9),
        endDate: new Date(2025, 0, 9),
      },
    ];

    layer1_block(grid, [nurse], timeOff, DAYS, WEEK_START, warnings);

    const cell = getCell(grid, "n1", "THU");
    expect(cell.status).toBe("BLOCKED");
    expect(cell.blockReason).toBe("time_off"); // time-off wins (checked first)
  });

  it("nurse with no restrictions has all days AVAILABLE", () => {
    const nurse = makeNurse({ id: "n1", userId: "u1" });
    const grid = makeGrid([nurse]);

    layer1_block(grid, [nurse], [], DAYS, WEEK_START, warnings);

    for (const day of DAYS) {
      expect(getCell(grid, "n1", day).status).toBe("AVAILABLE");
    }
  });

  it("does not block nurses unrelated to a time-off entry", () => {
    const nurse1 = makeNurse({ id: "n1", userId: "u1" });
    const nurse2 = makeNurse({ id: "n2", userId: "u2" });
    const grid = makeGrid([nurse1, nurse2]);

    // Only nurse1 has time off
    const timeOff: TimeOffEntry[] = [
      {
        nurseUserId: "u1",
        startDate: new Date(2025, 0, 5),
        endDate: new Date(2025, 0, 11),
      },
    ];

    layer1_block(grid, [nurse1, nurse2], timeOff, DAYS, WEEK_START, warnings);

    // nurse1: all blocked
    for (const day of DAYS) {
      expect(getCell(grid, "n1", day).status).toBe("BLOCKED");
    }
    // nurse2: all available
    for (const day of DAYS) {
      expect(getCell(grid, "n2", day).status).toBe("AVAILABLE");
    }
  });
});
