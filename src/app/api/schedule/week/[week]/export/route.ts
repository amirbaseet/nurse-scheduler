import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { parseWeekParam, DAY_ORDER } from "@/lib/utils";
import ExcelJS from "exceljs";
import { addDays, format } from "date-fns";
import { apiError, API_ERRORS } from "@/lib/api-errors";

const DAY_NAMES_HE = [
  "ראשון (א)",
  "שני (ב)",
  "שלישי (ג)",
  "רביעי (ד)",
  "חמישי (ה)",
  "ששי (ו)",
  "שבת (ש)",
];

function getCombinedClinicName(a: {
  primaryClinic?: { name: string } | null;
  secondaryClinic?: { name: string } | null;
}): string {
  const primary = a.primaryClinic?.name ?? "";
  const secondary = a.secondaryClinic?.name;
  return secondary ? `${primary}+ ${secondary}` : primary;
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const headerFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E2F3" },
};

export async function GET(
  _request: Request,
  { params }: { params: { week: string } },
) {
  try {
    await authGuard("MANAGER");
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return apiError(API_ERRORS.INVALID_DATE, 400);
    }

    const schedule = await db.weeklySchedule.findUnique({
      where: { weekStart },
      include: {
        assignments: {
          include: {
            nurse: { include: { user: true } },
            primaryClinic: true,
            secondaryClinic: true,
          },
        },
      },
    });

    if (!schedule) {
      return apiError(API_ERRORS.SCHEDULE_NOT_FOUND, 404);
    }

    // Group assignments by nurse
    const nurseMap = new Map<
      string,
      {
        name: string;
        contractHours: number;
        days: Map<string, (typeof schedule.assignments)[number]>;
        notes: string[];
      }
    >();

    for (const a of schedule.assignments) {
      if (!nurseMap.has(a.nurseId)) {
        const profile = await db.nurseProfile.findUnique({
          where: { userId: a.nurse.user.id },
        });
        nurseMap.set(a.nurseId, {
          name: a.nurse.user.name,
          contractHours: profile?.contractHours ?? 0,
          days: new Map(),
          notes: [],
        });
      }
      const entry = nurseMap.get(a.nurseId)!;
      entry.days.set(a.day, a);
      if (a.notes && !entry.notes.includes(a.notes)) {
        entry.notes.push(a.notes);
      }
    }

    const nurses = Array.from(nurseMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "he"),
    );

    // Build workbook with exceljs
    const workbook = new ExcelJS.Workbook();
    const year = weekStart.getUTCFullYear();
    const worksheet = workbook.addWorksheet(`סידור עבודה ${year}`);

    // RTL direction
    worksheet.views = [{ rightToLeft: true }];

    // Column widths: Name, Label, Sun-Sat (7), Notes, Total = 11 columns
    worksheet.columns = [
      { width: 18 }, // A: nurse name
      { width: 12 }, // B: label (מרפאה/רופא or שעה)
      { width: 22 }, // C: Sun
      { width: 22 }, // D: Mon
      { width: 22 }, // E: Tue
      { width: 22 }, // F: Wed
      { width: 22 }, // G: Thu
      { width: 22 }, // H: Fri
      { width: 22 }, // I: Sat
      { width: 18 }, // J: Notes
      { width: 10 }, // K: Total
    ];

    // --- Row 1: Title ---
    const titleRow = worksheet.addRow([`סידור עבודה שבועי לאחיות ${year}`]);
    worksheet.mergeCells(1, 1, 1, 11);
    const titleCell = worksheet.getCell("A1");
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    // --- Row 2: Empty spacer ---
    worksheet.addRow([]);

    // --- Row 3: Header - Day names ---
    const headerRow1 = worksheet.addRow([
      "אחות",
      "",
      ...DAY_NAMES_HE,
      "הערות",
      "סה״כ",
    ]);

    // --- Row 4: Dates (add BEFORE merging rows 3-4, so addRow gets row 4) ---
    const dates: string[] = DAY_ORDER.map((_, i) => {
      const d = addDays(weekStart, i);
      return format(d, "dd.MM.yyyy");
    });
    const headerRow2 = worksheet.addRow(["", "", ...dates, "", ""]);

    // Now merge header cells across rows 3-4
    worksheet.mergeCells(3, 1, 4, 1); // "אחות"
    worksheet.mergeCells(3, 2, 4, 2); // label column
    worksheet.mergeCells(3, 10, 4, 10); // "הערות"
    worksheet.mergeCells(3, 11, 4, 11); // "סה״כ"

    // Style header rows
    for (const row of [headerRow1, headerRow2]) {
      for (let col = 1; col <= 11; col++) {
        const cell = row.getCell(col);
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        cell.fill = headerFill;
      }
    }
    // Date row: smaller font
    for (let col = 3; col <= 9; col++) {
      headerRow2.getCell(col).font = { size: 9, bold: false };
    }

    // --- Data rows: 2 rows per nurse ---
    let currentRow = 5;
    for (const nurse of nurses) {
      let totalHours = 0;

      // Clinic row
      const clinicRowData: (string | number)[] = [nurse.name, "מרפאה/רופא"];
      for (const day of DAY_ORDER) {
        const a = nurse.days.get(day);
        if (!a || a.isOff) {
          clinicRowData.push(a?.isOff ? "חופש" : "");
        } else {
          clinicRowData.push(getCombinedClinicName(a));
          totalHours += a.hours;
        }
      }
      clinicRowData.push(nurse.notes.join(", ")); // notes
      clinicRowData.push(totalHours); // total

      worksheet.addRow(clinicRowData);

      // Hours row
      const hoursRowData: (string | number)[] = ["", "שעה"];
      for (const day of DAY_ORDER) {
        const a = nurse.days.get(day);
        if (!a || a.isOff || !a.shiftStart || !a.shiftEnd) {
          hoursRowData.push("");
        } else {
          hoursRowData.push(`${a.shiftStart}-${a.shiftEnd}`);
        }
      }
      hoursRowData.push(""); // notes placeholder
      hoursRowData.push(""); // total placeholder

      worksheet.addRow(hoursRowData);

      // Merge nurse name across both rows (col A)
      worksheet.mergeCells(currentRow, 1, currentRow + 1, 1);
      // Merge notes across both rows (col J)
      worksheet.mergeCells(currentRow, 10, currentRow + 1, 10);
      // Merge total across both rows (col K)
      worksheet.mergeCells(currentRow, 11, currentRow + 1, 11);

      // Style both rows
      for (let r = currentRow; r <= currentRow + 1; r++) {
        const row = worksheet.getRow(r);
        for (let col = 1; col <= 11; col++) {
          const cell = row.getCell(col);
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        }
      }

      // Nurse name: bold, left-aligned
      const nameCell = worksheet.getCell(currentRow, 1);
      nameCell.font = { bold: true };
      nameCell.alignment = { horizontal: "right", vertical: "middle" };

      // Total hours: bold
      const totalCell = worksheet.getCell(currentRow, 11);
      totalCell.font = { bold: true };

      // Label cells: smaller font
      worksheet.getCell(currentRow, 2).font = { size: 9 };
      worksheet.getCell(currentRow + 1, 2).font = { size: 9 };

      currentRow += 2;
    }

    // Generate buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const uint8 = new Uint8Array(excelBuffer);
    const weekDate = format(weekStart, "yyyy-MM-dd");
    const filename = `schedule-${weekDate}.xlsx`;

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
