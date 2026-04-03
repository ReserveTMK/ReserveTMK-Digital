import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { Users, Calendar, Building2, ChevronLeft, ChevronRight, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SpaceEvent = {
  id: number;
  name: string;
  type: string;
  spaceUseType?: string | null;
  startTime: string;
  endTime: string;
  attendeeCount?: number | null;
  tags?: string[];
  source: "event";
};

type SpaceBooking = {
  id: number;
  bookerName?: string | null;
  classification?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  source: "booking";
};

type SpaceItem = (SpaceEvent | SpaceBooking) & { date: Date };

const TYPE_COLORS: Record<string, string> = {
  "Venue Hire": "bg-orange-500/15 text-orange-700",
  "Space Use": "bg-blue-500/15 text-blue-700",
  "Studio": "bg-purple-500/15 text-purple-700",
  "Drop-in": "bg-green-500/15 text-green-700",
  "Workshop": "bg-amber-500/15 text-amber-700",
  "Programme": "bg-indigo-500/15 text-indigo-700",
  "External Event": "bg-rose-500/15 text-rose-700",
  "Other": "bg-gray-500/15 text-gray-700",
};

const TYPE_DOT_COLORS: Record<string, string> = {
  "Venue Hire": "bg-orange-500",
  "Space Use": "bg-blue-500",
  "Studio": "bg-purple-500",
  "Drop-in": "bg-green-500",
  "Workshop": "bg-amber-500",
  "Programme": "bg-indigo-500",
  "External Event": "bg-rose-500",
  "Other": "bg-gray-400",
};

function classifyItem(item: SpaceEvent | SpaceBooking): string {
  if (item.source === "booking") return "Venue Hire";
  const e = item as SpaceEvent;
  if (e.spaceUseType) {
    const map: Record<string, string> = {
      venue_hire: "Venue Hire", space_use: "Space Use",
      studio: "Studio", drop_in: "Drop-in",
    };
    return map[e.spaceUseType] || "Space Use";
  }
  if (e.type === "Drop-in") return "Drop-in";
  if (e.type === "Programme" || e.type === "Programme Session") return "Programme";
  if (e.type === "External Event") return "External Event";
  if (e.type === "Hub Activity") return "Space Use";
  return "Space Use";
}

function getItemName(item: SpaceItem): { primary: string; secondary: string } {
  if (item.source === "booking") {
    return {
      primary: (item as SpaceBooking).bookerName || "Unknown",
      secondary: (item as SpaceBooking).classification || "",
    };
  }
  const e = item as SpaceEvent;
  const tags = e.tags || [];
  if (tags.length > 0) {
    return { primary: tags[0], secondary: e.name };
  }
  return { primary: e.name, secondary: "" };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ActivationsTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  });

  const { data: bookings } = useQuery<any[]>({
    queryKey: ["/api/bookings"],
    staleTime: 30000,
  });

  // Filter and combine — scoped to current month
  const items = useMemo(() => {
    const result: SpaceItem[] = [];
    const EXCLUDE_TYPES = ["Meeting", "Catch Up", "Planning", "Mentoring Session"];

    for (const e of (events || [])) {
      const d = new Date(e.startTime);
      if (d < monthStart || d > monthEnd) continue;
      if (e.eventStatus === "cancelled") continue;
      if (EXCLUDE_TYPES.includes(e.type)) continue;
      result.push({ ...e, source: "event" as const, date: d });
    }

    for (const b of (bookings || [])) {
      if (!b.startDate) continue;
      const d = new Date(b.startDate);
      if (d < monthStart || d > monthEnd) continue;
      if (b.status === "cancelled") continue;
      result.push({ ...b, source: "booking" as const, date: d });
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, bookings, monthStart, monthEnd]);

  // Group items by date key
  const itemsByDate = useMemo(() => {
    const map = new Map<string, SpaceItem[]>();
    for (const item of items) {
      const key = format(item.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  // Build calendar grid (weeks × 7 days)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [monthStart, monthEnd]);

  // Stats
  const totalItems = items.length;
  const totalAttendees = items.reduce((sum, item) => {
    if (item.source === "event") return sum + ((item as SpaceEvent).attendeeCount || 0);
    return sum;
  }, 0);
  const venueHires = items.filter(i => classifyItem(i) === "Venue Hire").length;

  // Items for selected date
  const selectedItems = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return itemsByDate.get(key) || [];
  }, [selectedDate, itemsByDate]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      {/* Month nav + stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold w-40 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold">{totalItems}</span>
            <span className="text-muted-foreground">activations</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold">{venueHires}</span>
            <span className="text-muted-foreground">hires</span>
          </div>
          {totalAttendees > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-semibold">{totalAttendees}</span>
              <span className="text-muted-foreground">people</span>
            </div>
          )}
        </div>
      </div>

      {/* Type legend */}
      <div className="flex gap-3 flex-wrap text-xs">
        {Object.entries(TYPE_DOT_COLORS).filter(([key]) => key !== "Other").map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <Card className="overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map(day => (
            <div key={day} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayItems = itemsByDate.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const selected = selectedDate && isSameDay(day, selectedDate);

            // Group by type for dots
            const typeCounts = new Map<string, number>();
            for (const item of dayItems) {
              const t = classifyItem(item);
              typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
            }

            const hasHoliday = dayItems.some((item: any) => item.type === "Public Holiday" || item.eventType === "Public Holiday");
            const hasClosure = dayItems.some((item: any) => item.type === "Staff Closure" || item.eventType === "Staff Closure");

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(dayItems.length > 0 ? day : null)}
                className={`
                  relative min-h-[80px] p-1.5 border-b border-r text-left transition-colors
                  ${inMonth ? "bg-background" : "bg-muted/20"}
                  ${selected ? "ring-2 ring-primary ring-inset" : ""}
                  ${hasHoliday && !selected ? "bg-red-50 dark:bg-red-950/30 border-red-200/50" : ""}
                  ${hasClosure && !hasHoliday && !selected ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200/50" : ""}
                  ${dayItems.length > 0 && !hasHoliday && !hasClosure ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}
                `}
              >
                <div className={`
                  text-xs font-medium mb-1
                  ${today ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center" : ""}
                  ${!inMonth ? "text-muted-foreground/40" : "text-foreground"}
                `}>
                  {format(day, "d")}
                </div>

                {dayItems.length > 0 && inMonth && (
                  <div className="space-y-0.5">
                    {/* Show up to 3 items, then overflow count */}
                    {dayItems.slice(0, 3).map((item, i) => {
                      const typeLabel = classifyItem(item);
                      const dotColor = TYPE_DOT_COLORS[typeLabel] || TYPE_DOT_COLORS["Other"];
                      const { primary } = getItemName(item);
                      return (
                        <div key={i} className="flex items-center gap-1 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                          <span className="text-[10px] truncate text-muted-foreground leading-tight">
                            {primary}
                          </span>
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-muted-foreground/60 pl-2.5">
                        +{dayItems.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected day detail panel */}
      {selectedDate && selectedItems.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {format(selectedDate, "EEEE d MMMM yyyy")}
              <span className="text-muted-foreground font-normal ml-2">
                {selectedItems.length} activation{selectedItems.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {selectedItems.map((item, idx) => {
              const typeLabel = classifyItem(item);
              const typeColor = TYPE_COLORS[typeLabel] || TYPE_COLORS["Other"];
              const { primary, secondary } = getItemName(item);
              const attendees = item.source === "event" ? (item as SpaceEvent).attendeeCount : null;
              const time = item.source === "event"
                ? format(new Date((item as SpaceEvent).startTime), "h:mm a")
                : (item as SpaceBooking).startTime || "";

              return (
                <div key={`${item.source}-${item.id}-${idx}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                  <div className="w-14 text-center shrink-0">
                    <p className="text-[11px] text-muted-foreground">{time}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{primary}</p>
                      {secondary && primary !== secondary && (
                        <p className="text-[11px] text-muted-foreground/60 truncate">{secondary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {attendees != null && attendees > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />{attendees}
                      </span>
                    )}
                    <Badge className={`text-[10px] h-5 px-2 ${typeColor}`}>{typeLabel}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
