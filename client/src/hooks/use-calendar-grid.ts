import { useMemo } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

/**
 * Builds a Monday-start calendar grid for the given month,
 * including padding days from adjacent months to fill complete weeks.
 */
export function useCalendarGrid(currentMonth: Date): Date[] {
  return useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const rawDay = start.getDay();
    const startDay = rawDay === 0 ? 6 : rawDay - 1;
    const paddingBefore = Array.from({ length: startDay }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (startDay - i));
      return d;
    });
    const totalCells = paddingBefore.length + days.length;
    const paddingAfter = Array.from({ length: (7 - (totalCells % 7)) % 7 }, (_, i) => {
      const d = new Date(end);
      d.setDate(d.getDate() + i + 1);
      return d;
    });
    return [...paddingBefore, ...days, ...paddingAfter];
  }, [currentMonth]);
}
