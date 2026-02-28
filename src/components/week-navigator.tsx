"use client";

import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addWeeks, subWeeks, getISOWeek } from "date-fns";
import { he } from "date-fns/locale";

export function WeekNavigator({
  weekStart,
  onWeekChange,
}: {
  weekStart: Date;
  onWeekChange: (newWeekStart: Date) => void;
}) {
  const weekNum = getISOWeek(weekStart);
  const weekEnd = addWeeks(weekStart, 1);
  const dateRange = `${format(weekStart, "d/M", { locale: he })} - ${format(weekEnd, "d/M", { locale: he })}`;

  return (
    <div className="flex items-center gap-2">
      {/* RTL: right arrow goes to next (later) week */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onWeekChange(addWeeks(weekStart, 1))}
        aria-label="שבוע הבא"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="min-w-[160px] text-center font-medium">
        שבוע {weekNum} ({dateRange})
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onWeekChange(subWeeks(weekStart, 1))}
        aria-label="שבוע קודם"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}
