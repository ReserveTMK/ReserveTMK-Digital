import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Users, Calendar, Building2, Mic, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SpaceEvent = {
  id: number;
  name: string;
  type: string;
  spaceUseType?: string | null;
  startTime: string;
  endTime: string;
  attendeeCount?: number | null;
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
  "Other": "bg-gray-500/15 text-gray-700",
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
  if (e.type === "Hub Activity") return "Space Use";
  return "Space Use";
}

// ── Period options ─────────────────────────────────────────────────────────────

function getPeriodOptions() {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, "MMMM yyyy"),
      value: format(d, "yyyy-MM"),
      start: startOfMonth(d),
      end: endOfMonth(d),
    });
  }
  return options;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SpaceUseTab() {
  const periodOptions = getPeriodOptions();
  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0].value);
  const period = periodOptions.find(p => p.value === selectedPeriod)!;

  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  });

  const { data: bookings } = useQuery<any[]>({
    queryKey: ["/api/bookings"],
    staleTime: 30000,
  });

  // Filter and combine
  const items = useMemo(() => {
    const result: SpaceItem[] = [];
    const EXCLUDE_TYPES = ["Meeting", "Catch Up", "Planning", "Mentoring Session", "External Event"];

    for (const e of (events || [])) {
      const d = new Date(e.startTime);
      if (d < period.start || d > period.end) continue;
      if (e.eventStatus === "cancelled") continue;
      if (EXCLUDE_TYPES.includes(e.type)) continue;
      result.push({ ...e, source: "event" as const, date: d });
    }

    for (const b of (bookings || [])) {
      if (!b.startDate) continue;
      const d = new Date(b.startDate);
      if (d < period.start || d > period.end) continue;
      if (b.status === "cancelled") continue;
      result.push({ ...b, source: "booking" as const, date: d });
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, bookings, period]);

  // Stats
  const totalItems = items.length;
  const totalAttendees = items.reduce((sum, item) => {
    if (item.source === "event") return sum + ((item as SpaceEvent).attendeeCount || 0);
    return sum;
  }, 0);
  const venueHires = items.filter(i => classifyItem(i) === "Venue Hire").length;

  return (
    <div className="space-y-4">
      {/* Period selector + stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold">{totalItems}</span>
            <span className="text-muted-foreground">uses</span>
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

      {/* List */}
      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No space use recorded for {period.label}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const typeLabel = classifyItem(item);
            const typeColor = TYPE_COLORS[typeLabel] || TYPE_COLORS["Other"];
            const name = item.source === "event"
              ? (item as SpaceEvent).name
              : (item as SpaceBooking).bookerName || "Unknown";
            const date = format(item.date, "EEE d MMM");
            const attendees = item.source === "event" ? (item as SpaceEvent).attendeeCount : null;

            // For events: use first tag as org name if available, else event name
            const eventTags = item.source === "event" ? ((item as any).tags || []) : [];
            const orgName = item.source === "booking"
              ? ((item as SpaceBooking).bookerName || name)
              : eventTags.length > 0 ? eventTags[0] : name;
            const descriptor = item.source === "event" && eventTags.length > 0
              ? (item as SpaceEvent).name
              : item.source === "booking"
                ? (item as SpaceBooking).classification || ""
                : "";

            return (
              <Card key={`${item.source}-${item.id}-${idx}`} className="p-3 flex items-center gap-3">
                <div className="w-16 text-center shrink-0">
                  <p className="text-[10px] text-muted-foreground leading-tight">{date}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <p className="text-sm font-medium truncate">{orgName}</p>
                    {descriptor && orgName !== descriptor && (
                      <p className="text-[11px] text-muted-foreground/60 truncate shrink-0">{descriptor}</p>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
