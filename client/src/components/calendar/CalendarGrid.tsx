import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import {
  CombinedEvent,
  DebriefInfo,
  getEventDotColor,
  SpaceOccupancyItem,
} from "./calendar-constants";

export interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date;
  calendarDays: Date[];
  eventsByDate: Map<string, CombinedEvent[]>;
  spaceByDate: Map<string, SpaceOccupancyItem[]>;
  footTrafficByDate: Map<string, number>;
  needsAttentionByDate: Map<string, number>;
  showSchedule: boolean;
  showSpace: boolean;
  onSelectDate: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  getDebriefInfo: (entry: CombinedEvent) => DebriefInfo;
}

export function CalendarGrid({
  currentMonth,
  selectedDate,
  calendarDays,
  eventsByDate,
  spaceByDate,
  footTrafficByDate,
  needsAttentionByDate,
  showSchedule,
  showSpace,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  getDebriefInfo,
}: CalendarGridProps) {
  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button variant="ghost" size="icon" onClick={onPrevMonth} data-testid="button-prev-month">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold font-display" data-testid="text-current-month">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          {!isSameMonth(currentMonth, new Date()) && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={onToday}
              data-testid="button-today"
            >
              Today
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onNextMonth} data-testid="button-next-month">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
        {calendarDays.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = showSchedule ? (eventsByDate.get(key) || []) : [];
          const daySpaceItems = showSpace ? (spaceByDate.get(key) || []) : [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const today = isToday(day);
          const dayNeedsAttention = needsAttentionByDate.get(key) || 0;
          const hasConflict = showSpace && daySpaceItems.length > 1 && daySpaceItems.some((a, i) =>
            daySpaceItems.some((b, j) => {
              if (i >= j) return false;
              if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return true;
              const aStart = parseInt(a.startTime.replace(":", ""));
              const aEnd = parseInt(a.endTime.replace(":", ""));
              const bStart = parseInt(b.startTime.replace(":", ""));
              const bEnd = parseInt(b.endTime.replace(":", ""));
              return aStart < bEnd && bStart < aEnd;
            })
          );
          const dayFT = footTrafficByDate.get(key);
          const hasPublicHoliday = dayEvents.some(e => e.type === "app" && ((e.app as any)?.isPublicHoliday || (e.app as any)?.type === "Public Holiday"));
          const hasStaffClosure = dayEvents.some(e => e.type === "app" && (e.app as any)?.type === "Staff Closure");
          const allDots: { color: string; key: string; reconciled?: boolean }[] = [];
          dayEvents.forEach((e, i) => {
            const isManual = e.type === "app" && e.app?.source === "internal";
            const skipReconcile = e.type === "booking" || isManual;
            const info = !skipReconcile ? getDebriefInfo(e) : null;
            allDots.push({ color: getEventDotColor(e), key: `ev-${i}`, reconciled: !skipReconcile && e.isPast ? !!info : undefined });
          });
          daySpaceItems.forEach((item, i) => allDots.push({ color: item.kind === "programme" ? "bg-indigo-400" : "bg-orange-400", key: `sp-${i}` }));

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(day)}
              data-testid={`button-calendar-day-${key}`}
              className={`
                relative p-1 min-h-[3rem] md:min-h-[4rem] text-sm border border-border/30 transition-colors
                ${!isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}
                ${isSelected ? "bg-primary/10 border-primary/50" : "hover:bg-muted/50"}
                ${hasPublicHoliday && !isSelected ? "bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/30" : ""}
                ${hasStaffClosure && !hasPublicHoliday && !isSelected ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30" : ""}
                ${today && !isSelected && !hasPublicHoliday && !hasStaffClosure ? "bg-accent/30" : ""}

              `}
            >
              <span className={`
                inline-flex items-center justify-center w-6 h-6 text-xs rounded-full
                ${today ? "bg-primary text-primary-foreground font-bold" : ""}
              `}>
                {format(day, "d")}
              </span>
              {allDots.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                  {allDots.slice(0, 6).map((dot) => (
                    <div key={dot.key} className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot.color} ${dot.reconciled === false ? "ring-1 ring-amber-400/60" : ""} ${dot.reconciled === true ? "opacity-40" : ""}`} />
                  ))}
                  {allDots.length > 6 && (
                    <span className="text-[9px] text-muted-foreground leading-none">+{allDots.length - 6}</span>
                  )}
                </div>
              )}
              {dayFT && isCurrentMonth && (
                <span className="hidden md:block absolute bottom-0.5 right-1 text-[9px] text-green-600/70 dark:text-green-400/70 font-medium">{dayFT}</span>
              )}

            </button>
          );
        })}
      </div>
    </Card>
  );
}
