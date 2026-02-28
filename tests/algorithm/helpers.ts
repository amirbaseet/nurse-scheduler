import type {
  AlgoNurse,
  ClinicSlot,
  Grid,
  Cell,
  Budgets,
  DayOfWeek,
} from "@/algorithm/types";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

let nurseCounter = 0;

/** Create an AlgoNurse with sensible defaults; override any field. */
export function makeNurse(overrides?: Partial<AlgoNurse>): AlgoNurse {
  nurseCounter++;
  const id = overrides?.id ?? `nurse-${nurseCounter}`;
  return {
    id,
    userId: overrides?.userId ?? `user-${nurseCounter}`,
    name: overrides?.name ?? `Nurse ${nurseCounter}`,
    gender: "FEMALE",
    contractHours: 36,
    shiftPreference: "ANYTIME",
    canWorkFriday: true,
    canWorkSaturday: true,
    maxDaysPerWeek: 5,
    isManager: false,
    managementHours: null,
    recurringOffDays: [],
    blockedClinicIds: [],
    ...overrides,
  };
}

/** Reset the counter between test files if needed. */
export function resetNurseCounter(): void {
  nurseCounter = 0;
}

/** Build an initialized Grid — every cell AVAILABLE, 0 hours. */
export function makeGrid(nurses: AlgoNurse[], days: DayOfWeek[] = DAYS): Grid {
  const grid: Grid = new Map();
  for (const nurse of nurses) {
    const dayMap = new Map<DayOfWeek, Cell>();
    for (const day of days) {
      dayMap.set(day, {
        status: "AVAILABLE",
        hours: 0,
        isFixed: false,
        isManagerSelf: false,
      });
    }
    grid.set(nurse.id, dayMap);
  }
  return grid;
}

/** Build a Budgets map from an array of nurses. */
export function makeBudgets(nurses: AlgoNurse[]): Budgets {
  const budgets: Budgets = new Map();
  for (const nurse of nurses) {
    budgets.set(nurse.id, nurse.contractHours);
  }
  return budgets;
}

/** Shorthand to get a single cell (throws if missing). */
export function getCell(grid: Grid, nurseId: string, day: DayOfWeek): Cell {
  const dayMap = grid.get(nurseId);
  if (!dayMap) throw new Error(`Nurse ${nurseId} not in grid`);
  const cell = dayMap.get(day);
  if (!cell) throw new Error(`Day ${day} not in grid for ${nurseId}`);
  return cell;
}

/** Create a ClinicSlot with sensible defaults; override any field. */
export function makeClinicSlot(overrides?: Partial<ClinicSlot>): ClinicSlot {
  return {
    clinicId: "clinic-default",
    day: "SUN",
    shiftStart: "08:00",
    shiftEnd: "15:00",
    shiftHours: 7,
    nursesNeeded: 1,
    ...overrides,
  };
}

export { DAYS };
