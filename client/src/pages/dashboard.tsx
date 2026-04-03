import { useContacts } from "@/hooks/use-contacts";
// useMeetings removed — meetings show via events table
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
// useProgrammes removed — programmes show via events table
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { useGroups } from "@/hooks/use-groups";
import {
  Calendar as CalendarIcon, ArrowRight, Clock, MapPin, Trash2,
  ChevronLeft, ChevronRight, Building2, Layers, Rocket, Loader2,
  Users, DollarSign, TrendingUp, TrendingDown, ListChecks, ExternalLink,
  AlertCircle, FileText, Mic, Zap, Footprints, Handshake, Activity,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  format, startOfMonth, endOfMonth, startOfDay,
  isSameMonth, isSameDay, addMonths, subMonths, addDays, isToday,
  isAfter,
} from "date-fns";
import { useCalendarGrid } from "@/hooks/use-calendar-grid";
import type { GoogleCalendarEvent } from "@/types/google-calendar";
import { formatTimeSlot } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { Contact, Event, Booking, Project, ProjectTask } from "@shared/schema";

interface PulseData {
  needsAttention: { enquiries: number; draftDebriefs: number; needsDebrief: number; total: number };
  thisMonth: { activations: number; mentoringSessions: number; programmes: number; venueHires: number; footTraffic: number };
  community: { innovators: number; kakano: number; tipu: number; ora: number; activeMentees: number };
}

// MEETING_STATUS_COLORS removed — meetings render as event cards

export default function Dashboard() {
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  // meetings query removed — show via events table
  const { data: events } = useEvents();
  // programmes removed — show via events table
  const { data: bookings } = useBookings();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // viewMeeting removed — meetings render as event cards now

  const pulseMonth = format(currentMonth, "yyyy-MM");
  const { data: pulse } = useQuery<PulseData>({ queryKey: [`/api/dashboard/pulse?month=${pulseMonth}`] });

  const { data: projectsData } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: allTasks } = useQuery<ProjectTask[]>({ queryKey: ["/api/projects", "all-tasks"] });
  const { data: gcalEvents } = useQuery<GoogleCalendarEvent[]>({
    queryKey: ["/api/google-calendar/events"],
    retry: false,
  });
  const { data: dismissedEvents } = useQuery<{ id: number; gcalEventId: string; reason: string }[]>({
    queryKey: ["/api/dismissed-calendar-events"],
  });

  // ── Derived: dismissed + linked GCal IDs (for dedup) ─────────────────────

  const dismissedGcalIds = useMemo(() => {
    return new Set((dismissedEvents || []).filter(d => d.reason !== "__not_personal__").map(d => d.gcalEventId));
  }, [dismissedEvents]);

  const linkedGcalIds = useMemo(() => {
    return new Set(
      ((events as Event[] | undefined) || [])
        .filter((e: any) => e.googleCalendarEventId)
        .map((e: any) => e.googleCalendarEventId as string)
    );
  }, [events]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const todayItems = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    let count = 0;
    events?.forEach((ev: Event) => {
      const d = new Date(ev.startTime);
      if (d >= today && d < tomorrow) count++;
    });
    // Count unimported GCal events
    gcalEvents?.forEach((gcal) => {
      if (!gcal.start || dismissedGcalIds.has(gcal.id) || linkedGcalIds.has(gcal.id)) return;
      const d = new Date(gcal.start);
      if (d >= today && d < tomorrow) count++;
    });
    return count;
  }, [events, gcalEvents, dismissedGcalIds, linkedGcalIds]);

  type DayItem = { date: string; name: string; time: string; type: string; typeColor: string; id: string; href?: string };

  // Type-based card colours
  const TYPE_COLORS: Record<string, string> = {
    "Venue Hire": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    "Mentoring Session": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "Programme": "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    "External Meeting": "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    "Team Meeting": "bg-gray-500/15 text-gray-700 dark:text-gray-300",
    "Public Holiday": "bg-red-500/15 text-red-700 dark:text-red-300",
    "Drop-in": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };

  const buildItemsForRange = (start: Date, end: Date): DayItem[] => {
    const items: DayItem[] = [];
    // Events are the single source of truth for activities
    events?.forEach((ev: Event) => {
      const d = new Date(ev.startTime);
      if (d >= start && d < end) {
        items.push({
          date: format(d, "yyyy-MM-dd"),
          name: ev.name,
          time: format(d, "h:mm a"),
          type: ev.type || "Event",
          typeColor: TYPE_COLORS[ev.type] || "bg-violet-500/15 text-violet-700 dark:text-violet-300",
          id: `event-${ev.id}`,
          href: "/calendar",
        });
      }
    });
    // Unimported GCal events (not yet in events table)
    gcalEvents?.forEach((gcal) => {
      if (!gcal.start || dismissedGcalIds.has(gcal.id) || linkedGcalIds.has(gcal.id)) return;
      const d = new Date(gcal.start);
      if (d >= start && d < end) {
        items.push({ date: format(d, "yyyy-MM-dd"), name: gcal.summary, time: format(d, "h:mm a"), type: "Google Cal", typeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", id: `gcal-${gcal.id}` });
      }
    });
    items.sort((a, b) => a.time.localeCompare(b.time));
    return items;
  };

  const selectedDayItems = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = addDays(dayStart, 1);
    return buildItemsForRange(dayStart, dayEnd);
  }, [selectedDate, events, gcalEvents, dismissedGcalIds, linkedGcalIds]);

  const upcomingItems = useMemo(() => {
    const now = new Date();
    const weekEnd = addDays(now, 7);
    const items = buildItemsForRange(now, weekEnd);
    items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const grouped = new Map<string, DayItem[]>();
    items.forEach((item) => {
      if (!grouped.has(item.date)) grouped.set(item.date, []);
      grouped.get(item.date)!.push(item);
    });
    return grouped;
  }, [events, gcalEvents, dismissedGcalIds, linkedGcalIds]);

  const bookingRevenue = useMemo(() => {
    if (!bookings) return { thisMonth: 0, lastMonth: 0, change: 0 };
    const thisMonthStart = startOfMonth(currentMonth);
    const thisMonthEnd = endOfMonth(currentMonth);
    const lastMonthStart = startOfMonth(subMonths(currentMonth, 1));
    const lastMonthEnd = endOfMonth(subMonths(currentMonth, 1));
    let thisMonth = 0;
    let lastMonth = 0;
    (bookings as Booking[]).forEach((b) => {
      if (b.status === "cancelled" || !b.startDate) return;
      const amount = parseFloat((b as any).amount) || 0;
      if (amount === 0) return;
      const d = new Date(b.startDate);
      if (d >= thisMonthStart && d <= thisMonthEnd) thisMonth += amount;
      else if (d >= lastMonthStart && d <= lastMonthEnd) lastMonth += amount;
    });
    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : (thisMonth > 0 ? 100 : 0);
    return { thisMonth, lastMonth, change };
  }, [bookings, currentMonth]);

  const projectWidget = useMemo(() => {
    if (!projectsData) return { active: 0, planning: 0, pendingTasks: 0, urgent: [] as (Project & { pendingTaskCount: number })[] };
    const active = projectsData.filter(p => p.status === "active").length;
    const planning = projectsData.filter(p => p.status === "planning").length;
    const pendingTasks = (allTasks ?? []).filter(t => t.status === "pending" || t.status === "in_progress").length;
    const taskCountsByProject = new Map<number, number>();
    (allTasks ?? []).forEach(t => {
      if (t.status === "pending" || t.status === "in_progress") {
        taskCountsByProject.set(t.projectId, (taskCountsByProject.get(t.projectId) ?? 0) + 1);
      }
    });
    const urgent = projectsData
      .filter(p => p.status === "active" || p.status === "planning")
      .map(p => ({ ...p, pendingTaskCount: taskCountsByProject.get(p.id) ?? 0 }))
      .sort((a, b) => {
        if (b.pendingTaskCount !== a.pendingTaskCount) return b.pendingTaskCount - a.pendingTaskCount;
        if (!a.endDate && !b.endDate) return 0;
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      })
      .slice(0, 5);
    return { active, planning, pendingTasks, urgent };
  }, [projectsData, allTasks]);

  const communityGrowth = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const count = (contacts as any[]).filter((c: any) => {
        if (!c.isInnovator && !c.isCommunityMember) return false;
        const created = new Date(c.createdAt);
        return created >= monthStart && created <= monthEnd;
      }).length;
      months.push({ label: format(monthStart, "MMM"), count });
    }
    return months;
  }, [contacts]);

  // ── Calendar data ─────────────────────────────────────────────────────────

  const calendarDays = useCalendarGrid(currentMonth);

  // Events grouped by date — single source for calendar dots
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events?.forEach((ev: Event) => {
      const key = format(new Date(ev.startTime), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  const gcalEventsByDate = useMemo(() => {
    const map = new Map<string, GoogleCalendarEvent[]>();
    gcalEvents?.forEach((ev) => {
      if (!ev.start) return;
      if (dismissedGcalIds.has(ev.id)) return;
      if (linkedGcalIds.has(ev.id)) return;
      const key = format(new Date(ev.start), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [gcalEvents, dismissedGcalIds, linkedGcalIds]);

  if (!user) return null;

  const na = pulse?.needsAttention;
  const tm = pulse?.thisMonth;
  const cm = pulse?.community;

  return (
    <>
    <div className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Today strip ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
            <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-welcome">
              {todayItems > 0
                ? `${todayItems} ${todayItems === 1 ? "thing" : "things"} on today`
                : "Clear day"}
            </h1>
          </div>
          {na && na.total > 0 && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{na.total} {na.total === 1 ? "item needs" : "items need"} attention</span>
            </div>
          )}
        </div>

        {/* ── Needs Attention ──────────────────────────────────────────────── */}
        {na && na.total > 0 && (
          <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-needs-attention">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Needs Attention
            </h3>
            <div className="flex flex-wrap gap-3">
              {na.enquiries > 0 && (
                <Link href="/bookings?status=enquiry">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-background border hover:border-amber-400 transition-colors text-sm">
                    <Building2 className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold">{na.enquiries}</span>
                    <span className="text-muted-foreground">booking {na.enquiries === 1 ? "enquiry" : "enquiries"}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                </Link>
              )}
              {na.draftDebriefs > 0 && (
                <Link href="/debriefs?status=draft">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-background border hover:border-amber-400 transition-colors text-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">{na.draftDebriefs}</span>
                    <span className="text-muted-foreground">draft {na.draftDebriefs === 1 ? "debrief" : "debriefs"}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                </Link>
              )}
              {na.needsDebrief > 0 && (
                <Link href="/debriefs">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-background border hover:border-amber-400 transition-colors text-sm">
                    <Mic className="w-4 h-4 text-violet-500" />
                    <span className="font-semibold">{na.needsDebrief}</span>
                    <span className="text-muted-foreground">{na.needsDebrief === 1 ? "event" : "events"} awaiting debrief</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* ── This Month + Community ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="pulse-stats">
          {/* This month */}
          <StatTile icon={Zap} label="Activations" value={tm?.activations ?? "..."} color="indigo" href="/tracking" testId="stat-activations" />
          <StatTile icon={Handshake} label="Mentoring" value={tm?.mentoringSessions ?? "..."} color="purple" href="/mentoring" testId="stat-mentoring" />
          <StatTile icon={Layers} label="Programmes" value={tm?.programmes ?? "..."} color="blue" href="/programmes" testId="stat-programmes" />
          <StatTile icon={Building2} label="Venue Hires" value={tm?.venueHires ?? "..."} color="orange" href="/bookings" testId="stat-venue" />
          <StatTile icon={Footprints} label="Foot Traffic" value={tm?.footTraffic ?? "..."} color="green" testId="stat-foot-traffic" />
          <StatTile icon={Users} label="Innovators" value={cm?.innovators ?? "..."} color="primary" href="/contacts" testId="stat-innovators" subText={cm ? `${cm.kakano}K ${cm.tipu}T ${cm.ora}O` : undefined} />
        </div>

        {/* ── Calendar + Upcoming ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Compact calendar */}
          <Card className="p-4" data-testid="card-calendar">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="text-sm font-semibold font-display">{format(currentMonth, "MMMM yyyy")}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-0">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {calendarDays.map((day, idx) => {
                const key = format(day, "yyyy-MM-dd");
                const hasItems =
                  (eventsByDate.get(key)?.length || 0) +
                  (gcalEventsByDate.get(key)?.length || 0) > 0;
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const today = isToday(day);
                const dayAppEvents = eventsByDate.get(key) || [];
                const hasHoliday = dayAppEvents.some((e: any) => e.type === "Public Holiday");
                const hasClosure = dayAppEvents.some((e: any) => e.type === "Staff Closure");

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative p-0.5 h-8 text-xs transition-colors rounded
                      ${!isCurrentMonth ? "text-muted-foreground/30" : ""}
                      ${isSelected ? "bg-primary/10 font-semibold" : "hover:bg-muted/50"}
                      ${hasHoliday && !isSelected ? "bg-red-50 dark:bg-red-950/30" : ""}
                      ${hasClosure && !hasHoliday && !isSelected ? "bg-purple-50 dark:bg-purple-950/30" : ""}
                      ${today && !isSelected && !hasHoliday && !hasClosure ? "bg-accent/30" : ""}
                    `}
                  >
                    <span className={`
                      inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px]
                      ${today ? "bg-primary text-primary-foreground font-bold" : ""}
                    `}>
                      {format(day, "d")}
                    </span>
                    {hasItems && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Meet</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" />Event</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />Prog</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Hire</span>
            </div>
            <div className="mt-2 pt-2 border-t">
              <Link href="/calendar">
                <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-primary h-7">
                  <CalendarIcon className="w-3 h-3" /> Full Calendar <ArrowRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Selected day detail */}
          <Card className="p-4" data-testid="card-day-view">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold font-display">
                {isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, d MMMM")}
              </h3>
              <span className="text-xs text-muted-foreground ml-auto">{selectedDayItems.length} {selectedDayItems.length === 1 ? "item" : "items"}</span>
            </div>
            {selectedDayItems.length > 0 ? (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                {selectedDayItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-xs">
                    <Badge variant="secondary" className={`text-[9px] shrink-0 px-1.5 py-0 ${item.typeColor}`}>{item.type}</Badge>
                    <span className="font-medium truncate flex-1">{item.name}</span>
                    <span className="text-muted-foreground shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-xs">
                <CalendarIcon className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>Nothing on {format(selectedDate, "EEE d MMM")}</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Next 7 Days ────────────────────────────────────────────────── */}
        {upcomingItems.size > 0 && (
          <Card className="p-4" data-testid="card-upcoming">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold font-display">Next 7 Days</h3>
              <span className="text-xs text-muted-foreground ml-auto">{Array.from(upcomingItems.values()).flat().length} items</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {Array.from(upcomingItems.entries()).map(([dateKey, dayItems]) => (
                <div key={dateKey} className="min-w-[140px]">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    {format(new Date(dateKey + "T12:00:00"), "EEE, d MMM")}
                  </p>
                  <div className="space-y-0.5">
                    {dayItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-1.5 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.typeColor.split(" ")[0]}`} />
                        <span className="truncate">{item.name}</span>
                        <span className="text-muted-foreground text-[10px] shrink-0 ml-auto">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Projects + Revenue + Growth ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Projects */}
          <Card className="p-4" data-testid="card-projects">
            <div className="flex items-center gap-2 mb-3">
              <Rocket className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-semibold font-display">Projects</h3>
            </div>
            {projectWidget.active > 0 || projectWidget.planning > 0 ? (
              <>
                <div className="flex items-center gap-3 mb-2 text-xs">
                  <span><Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-300 text-[10px]">Active</Badge> <strong>{projectWidget.active}</strong></span>
                  <span><Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px]">Planning</Badge> <strong>{projectWidget.planning}</strong></span>
                  {projectWidget.pendingTasks > 0 && <span><Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">Tasks</Badge> <strong>{projectWidget.pendingTasks}</strong></span>}
                </div>
                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {projectWidget.urgent.map((p) => (
                    <Link key={p.id} href={`/projects/${p.id}`}>
                      <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 hover:bg-muted transition-colors cursor-pointer text-xs">
                        <span className="font-medium truncate flex-1">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {p.pendingTaskCount > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0"><ListChecks className="w-2.5 h-2.5 mr-0.5" />{p.pendingTaskCount}</Badge>}
                          {p.endDate && <span className="text-[10px] text-muted-foreground">due {format(new Date(p.endDate), "d MMM")}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-xs">
                <Rocket className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>No active projects</p>
              </div>
            )}
            <div className="mt-2 pt-2 border-t">
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-primary h-7">
                  <Rocket className="w-3 h-3" /> All Projects <ArrowRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Revenue */}
          <Card className="p-4" data-testid="card-revenue">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold font-display">Venue Revenue</h3>
              <span className="text-[10px] text-muted-foreground ml-auto">{format(currentMonth, "MMM yyyy")}</span>
            </div>
            <p className="text-3xl font-bold tabular-nums" data-testid="text-revenue-this-month">
              ${bookingRevenue.thisMonth.toLocaleString("en-NZ", { minimumFractionDigits: 0 })}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {bookingRevenue.change > 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-600" /> : bookingRevenue.change < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-600" /> : null}
              {bookingRevenue.change !== 0 && (
                <span className={`text-xs font-semibold ${bookingRevenue.change > 0 ? "text-green-600" : "text-red-600"}`}>
                  {bookingRevenue.change > 0 ? "+" : ""}{Math.round(bookingRevenue.change)}%
                </span>
              )}
              <span className="text-xs text-muted-foreground">vs ${bookingRevenue.lastMonth.toLocaleString("en-NZ", { minimumFractionDigits: 0 })} last month</span>
            </div>
            <div className="mt-2 pt-2 border-t">
              <Link href="/bookings">
                <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-primary h-7">
                  <Building2 className="w-3 h-3" /> View Bookings <ArrowRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Community growth */}
          <Card className="p-4" data-testid="card-growth">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold font-display">Community Growth</h3>
              <span className="text-[10px] text-muted-foreground ml-auto">Last 6 months</span>
            </div>
            {communityGrowth.length > 0 && communityGrowth.some(m => m.count > 0) ? (
              <div className="h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={communityGrowth} barSize={20}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return <div className="bg-popover border rounded-lg shadow-sm px-2 py-1 text-xs"><strong>{payload[0].value}</strong> new</div>;
                      }
                      return null;
                    }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-xs">
                <Users className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>No new contacts yet</p>
              </div>
            )}
            <div className="mt-2 pt-2 border-t">
              <Link href="/contacts">
                <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-primary h-7">
                  <Users className="w-3 h-3" /> All Contacts <ArrowRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>

      </div>
    </div>

    {/* ViewMeetingDialog removed — meetings render as event cards */}
    </>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, color = "primary", href, testId, subText }: {
  icon: any; label: string; value: string | number; color?: string; href?: string; testId: string; subText?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    orange: "bg-orange-500/10 text-orange-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
    purple: "bg-purple-500/10 text-purple-500",
  };
  const content = (
    <Card className={`p-3 ${href ? "hover:border-primary/30 transition-colors cursor-pointer" : ""}`} data-testid={testId}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {subText && <p className="text-[10px] text-muted-foreground mt-0.5">{subText}</p>}
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ViewMeetingDialog removed — meetings render as event cards on calendar
