import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { parseWeekParam, DAY_ORDER } from "@/lib/utils";
import * as XLSX from "xlsx";
import { getISOWeek } from "date-fns";

const DAY_HEADERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export async function GET(
  _request: Request,
  { params }: { params: { week: string } },
) {
  try {
    await authGuard("MANAGER");
    const weekStart = parseWeekParam(params.week);

    if (!weekStart) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
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
      return NextResponse.json({ error: "לו״ז לא נמצא" }, { status: 404 });
    }

    // Group assignments by nurse
    const nurseMap = new Map<
      string,
      {
        name: string;
        contractHours: number;
        days: Map<string, (typeof schedule.assignments)[number]>;
      }
    >();

    for (const a of schedule.assignments) {
      if (!nurseMap.has(a.nurseId)) {
        // Fetch contract hours from nurse profile
        const profile = await db.nurseProfile.findUnique({
          where: { userId: a.nurse.user.id },
        });
        nurseMap.set(a.nurseId, {
          name: a.nurse.user.name,
          contractHours: profile?.contractHours ?? 0,
          days: new Map(),
        });
      }
      nurseMap.get(a.nurseId)!.days.set(a.day, a);
    }

    // Sort nurses by name
    const nurses = Array.from(nurseMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "he"),
    );

    // Build worksheet data
    const weekNum = getISOWeek(weekStart);
    const headers = ["אחות", "שעות חוזה", ...DAY_HEADERS, "סה״כ"];
    const rows: (string | number)[][] = [headers];

    for (const nurse of nurses) {
      const row: (string | number)[] = [nurse.name, nurse.contractHours];
      let totalHours = 0;

      for (const day of DAY_ORDER) {
        const a = nurse.days.get(day);
        if (!a || a.isOff) {
          row.push(a?.isOff ? "חופש" : "—");
        } else {
          const clinicName = a.primaryClinic?.name ?? "—";
          const time =
            a.shiftStart && a.shiftEnd
              ? `${a.shiftStart}-${a.shiftEnd}`
              : "";
          row.push(time ? `${clinicName}\n${time}` : clinicName);
          totalHours += a.hours;
        }
      }

      row.push(totalHours);
      rows.push(row);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws["!cols"] = [
      { wch: 18 }, // nurse name
      { wch: 10 }, // contract hours
      ...DAY_HEADERS.map(() => ({ wch: 20 })), // day columns
      { wch: 8 }, // total
    ];

    XLSX.utils.book_append_sheet(wb, ws, `לו״ז שבוע ${weekNum}`);

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `schedule-week-${weekNum}.xlsx`;

    return new NextResponse(buffer, {
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
