import { useContacts } from "@/hooks/use-contacts";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { useProgrammes } from "@/hooks/use-programmes";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { Calendar as CalendarIcon, ArrowRight, Clock, MapPin, Trash2, ChevronLeft, ChevronRight, PartyPopper, Mic, Building2, Layers, Rocket, Loader2, Users, DollarSign, TrendingUp, TrendingDown, ListChecks, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, startOfDay, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, isToday, isBefore, isAfter } from "date-fns";
import { formatTimeSlot } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { Meeting, Contact, Event, Programme, Booking, Project, ProjectTask } from "@shared/schema";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  attendees: { email: string; displayName: string; responseStatus: string; organizer?: boolean }[];
  htmlLink: string;
  status: string;
}

const MEETING_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  const { data: meetings } = useMeetings();
  const { data: events } = useEvents();
  const { data: programmes } = useProgrammes();
  const { data: bookings } = useBookings();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();

  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);

  const { data: projectsData } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allTasks } = useQuery<ProjectTask[]>({
    queryKey: ["/api/projects", "all-tasks"],
  });

  const { data: gcalEvents } = useQuery<GoogleCalendarEvent[]>({
    queryKey: ["/api/google-calendar/events"],
    retry: false,
  });

  const communityGrowth = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const count = (contacts as any[]).filter((c: any) => {
        if (!c.isCommunityMember) return false;
        const created = new Date(c.createdAt);
        return created >= monthStart && created <= monthEnd;
      }).length;
      months.push({ label: format(monthStart, "MMM"), count });
    }
    return months;
  }, [contacts]);

  const bookingRevenue = useMemo(() => {
    if (!bookings) return { thisMonth: 0, lastMonth: 0, change: 0 };
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    let thisMonth = 0;
    let lastMonth = 0;
    (bookings as Booking[]).forEach((b) => {
      if (b.status === "cancelled" || !b.startDate) return;
      const amount = parseFloat((b as any).amount) || 0;
      if (amount === 0) return;
      const d = new Date(b.startDate);
      if (d >= thisMonthStart) thisMonth += amount;
      else if (d >= lastMonthStart && d <= lastMonthEnd) lastMonth += amount;
    });

    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : (thisMonth > 0 ? 100 : 0);
    return { thisMonth, lastMonth, change };
  }, [bookings]);

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

  const upcomingItems = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekEnd = addDays(now, 7);
    const items: { date: string; name: string; time: string; type: string; typeColor: string; id: string }[] = [];

    meetings?.forEach((m: Meeting) => {
      const d = new Date(m.startTime);
      if (m.status !== "cancelled" && isAfter(d, now) && isBefore(d, weekEnd)) {
        items.push({
          date: format(d, "yyyy-MM-dd"),
          name: m.title,
          time: format(d, "h:mm a"),
          type: "Meeting",
          typeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
          id: `meeting-${m.id}`,
        });
      }
    });

    events?.forEach((ev: Event) => {
      const d = new Date(ev.startTime);
      if (isAfter(d, now) && isBefore(d, weekEnd)) {
        items.push({
          date: format(d, "yyyy-MM-dd"),
          name: ev.name,
          time: format(d, "h:mm a"),
          type: ev.type || "Event",
          typeColor: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
          id: `event-${ev.id}`,
        });
      }
    });

    (programmes as Programme[] | undefined)?.forEach((p) => {
      if (p.status === "cancelled" || !p.startDate) return;
      const d = new Date(p.startDate);
      if (!isBefore(d, todayStart) && isBefore(d, weekEnd)) {
        items.push({
          date: format(d, "yyyy-MM-dd"),
          name: p.name,
          time: p.startTime ? formatTimeSlot(p.startTime) : "All day",
          type: "Programme",
          typeColor: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
          id: `prog-${p.id}`,
        });
      }
    });

    (bookings as Booking[] | undefined)?.forEach((b) => {
      if (b.status === "cancelled" || !b.startDate) return;
      const d = new Date(b.startDate);
      if (!isBefore(d, todayStart) && isBefore(d, weekEnd)) {
        items.push({
          date: format(d, "yyyy-MM-dd"),
          name: b.title || "",
          time: b.startTime ? formatTimeSlot(b.startTime) : "TBC",
          type: "Venue Hire",
          typeColor: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
          id: `book-${b.id}`,
        });
      }
    });

    gcalEvents?.forEach((gcal) => {
      if (!gcal.start) return;
      const d = new Date(gcal.start);
      if (isAfter(d, now) && isBefore(d, weekEnd)) {
        items.push({
          date: format(d, "yyyy-MM-dd"),
          name: gcal.summary,
          time: format(d, "h:mm a"),
          type: "Google Cal",
          typeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          id: `gcal-${gcal.id}`,
        });
      }
    });

    items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const grouped = new Map<string, typeof items>();
    items.forEach((item) => {
      if (!grouped.has(item.date)) grouped.set(item.date, []);
      grouped.get(item.date)!.push(item);
    });
    return grouped;
  }, [meetings, events, programmes, bookings, gcalEvents]);


  const calendarDays = useMemo(() => {
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

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    meetings?.forEach((m: Meeting) => {
      const key = format(new Date(m.startTime), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [meetings]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events?.forEach((ev: Event) => {
      const key = format(new Date(ev.startTime), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  const programmesByDate = useMemo(() => {
    const map = new Map<string, Programme[]>();
    (programmes as Programme[] | undefined)?.forEach((p) => {
      if (p.status === "cancelled") return;
      if (!p.startDate) return;
      const key = format(new Date(p.startDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [programmes]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    (bookings as Booking[] | undefined)?.forEach((b) => {
      if (b.status === "cancelled") return;
      if (!b.startDate) return;
      const key = format(new Date(b.startDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [bookings]);

  const gcalEventsByDate = useMemo(() => {
    const map = new Map<string, GoogleCalendarEvent[]>();
    gcalEvents?.forEach((ev) => {
      if (!ev.start) return;
      const key = format(new Date(ev.start), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [gcalEvents]);

  const selectedDayMeetings = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return meetingsByDate.get(key) || [];
  }, [selectedDate, meetingsByDate]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  const selectedDayProgrammes = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return programmesByDate.get(key) || [];
  }, [selectedDate, programmesByDate]);

  const selectedDayBookings = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return bookingsByDate.get(key) || [];
  }, [selectedDate, bookingsByDate]);

  const selectedDayGcalEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return gcalEventsByDate.get(key) || [];
  }, [selectedDate, gcalEventsByDate]);

  if (!user) return null;

  return (
    <>
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground" data-testid="text-welcome">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-muted-foreground text-lg">
              Here's a snapshot of your community impact.
            </p>
          </div>

          <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-bold font-display">Calendar</h2>
              </div>

              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="text-lg font-semibold font-display" data-testid="text-current-month">
                    {format(currentMonth, "MMMM yyyy")}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
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
                    const dayMeetings = meetingsByDate.get(key) || [];
                    const dayEvents = eventsByDate.get(key) || [];
                    const dayProgrammes = programmesByDate.get(key) || [];
                    const dayBookings = bookingsByDate.get(key) || [];
                    const dayGcal = gcalEventsByDate.get(key) || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = isSameDay(day, selectedDate);
                    const today = isToday(day);
                    const hasItems = dayMeetings.length + dayEvents.length + dayProgrammes.length + dayBookings.length + dayGcal.length > 0;

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(day)}
                        data-testid={`button-calendar-day-${key}`}
                        className={`
                          relative p-1 min-h-[3rem] md:min-h-[4rem] text-sm border border-border/30 transition-colors
                          ${!isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}
                          ${isSelected ? "bg-primary/10 border-primary/50" : "hover:bg-muted/50"}
                          ${today && !isSelected ? "bg-accent/30" : ""}
                        `}
                      >
                        <span className={`
                          inline-flex items-center justify-center w-6 h-6 text-xs rounded-full
                          ${today ? "bg-primary text-primary-foreground font-bold" : ""}
                        `}>
                          {format(day, "d")}
                        </span>
                        {hasItems && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {dayMeetings.slice(0, 2).map((m, i) => (
                              <div
                                key={`m-${i}`}
                                className={`w-full h-1 rounded-full ${
                                  m.status === "cancelled" ? "bg-red-400" :
                                  m.status === "completed" ? "bg-green-400" : "bg-blue-400"
                                }`}
                              />
                            ))}
                            {dayEvents.slice(0, 1).map((_, i) => (
                              <div
                                key={`e-${i}`}
                                className="w-full h-1 rounded-full bg-violet-400"
                              />
                            ))}
                            {dayProgrammes.slice(0, 1).map((_, i) => (
                              <div
                                key={`p-${i}`}
                                className="w-full h-1 rounded-full bg-indigo-400"
                              />
                            ))}
                            {dayBookings.slice(0, 1).map((_, i) => (
                              <div
                                key={`b-${i}`}
                                className="w-full h-1 rounded-full bg-orange-400"
                              />
                            ))}
                            {dayGcal.slice(0, 1).map((_, i) => (
                              <div
                                key={`g-${i}`}
                                className="w-full h-1 rounded-full bg-emerald-400"
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> Meetings</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /> Events</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Programmes</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Venue Hire</span>
                {gcalEvents && gcalEvents.length > 0 && (
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Google Calendar</span>
                )}
              </div>

              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="font-semibold font-display" data-testid="text-selected-date">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </h3>
                </div>

                {(selectedDayMeetings.length > 0 || selectedDayEvents.length > 0 || selectedDayProgrammes.length > 0 || selectedDayBookings.length > 0 || selectedDayGcalEvents.length > 0) ? (
                  <div className="space-y-3">
                    {selectedDayMeetings.map((meeting) => {
                      const contact = contacts?.find((c: Contact) => c.id === meeting.contactId);
                      return (
                        <div
                          key={meeting.id}
                          className="w-full text-left p-3 rounded-lg border border-border flex items-start gap-3"
                        >
                          <button
                            onClick={() => setViewMeeting(meeting)}
                            data-testid={`button-meeting-${meeting.id}`}
                            className="flex items-start gap-3 flex-1 min-w-0 text-left hover:bg-muted/50 transition-colors rounded-lg -m-1 p-1"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                              {contact?.name?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{meeting.title}</span>
                                <Badge variant="secondary" className={`text-xs ${MEETING_STATUS_COLORS[meeting.status] || ""}`}>
                                  {meeting.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(meeting.startTime), "h:mm a")} - {format(new Date(meeting.endTime), "h:mm a")}
                                </span>
                                {contact && <span>with {contact.name}</span>}
                              </div>
                              {meeting.location && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  {meeting.location}
                                </div>
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                    {selectedDayEvents.map((ev: Event) => (
                      <div
                        key={ev.id}
                        className="w-full text-left p-3 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 flex items-start gap-3"
                      >
                        <Link href="/calendar" className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors rounded-lg -m-1 p-1">
                          <div
                            data-testid={`button-calendar-event-${ev.id}`}
                            className="flex items-start gap-3 flex-1 min-w-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0 mt-0.5">
                              <PartyPopper className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{ev.name}</span>
                                <Badge variant="secondary" className="text-xs bg-violet-500/15 text-violet-700 dark:text-violet-300">
                                  {ev.type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(ev.startTime), "h:mm a")} - {format(new Date(ev.endTime), "h:mm a")}
                                </span>
                              </div>
                              {ev.location && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  {ev.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                    {selectedDayProgrammes.map((prog: Programme) => (
                      <div
                        key={`prog-${prog.id}`}
                        className="w-full text-left p-3 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                        onClick={() => navigate("/programmes")}
                        data-testid={`card-dashboard-programme-${prog.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{prog.name}</span>
                              <Badge variant="secondary" className="text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                                {prog.classification}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {prog.startTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimeSlot(prog.startTime)}{prog.endTime ? ` - ${formatTimeSlot(prog.endTime)}` : ""}
                                </span>
                              )}
                              {prog.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {prog.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedDayBookings.map((bk: Booking) => {
                      const bkVIds = bk.venueIds || (bk.venueId ? [bk.venueId] : []);
                      const venueName = bkVIds.map((id: number) => venues?.find((v: any) => v.id === id)?.name).filter(Boolean).join(" + ");
                      return (
                        <div
                          key={`bk-${bk.id}`}
                          className="w-full text-left p-3 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                          onClick={() => navigate(`/bookings/${bk.id}`)}
                          data-testid={`card-dashboard-booking-${bk.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0 mt-0.5">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{bk.title}</span>
                                <Badge variant="secondary" className="text-xs bg-orange-500/15 text-orange-700 dark:text-orange-300">
                                  {bk.classification}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {bk.startTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeSlot(bk.startTime)}{bk.endTime ? ` - ${formatTimeSlot(bk.endTime)}` : ""}
                                  </span>
                                )}
                                {venueName && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {venueName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {selectedDayGcalEvents.map((gcal) => (
                      <a
                        key={`gcal-${gcal.id}`}
                        href={gcal.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left p-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                        data-testid={`card-dashboard-gcal-${gcal.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                            <CalendarIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{gcal.summary}</span>
                              <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                Google Cal
                              </Badge>
                              <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {gcal.start && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(gcal.start), "h:mm a")}
                                  {gcal.end ? ` - ${format(new Date(gcal.end), "h:mm a")}` : ""}
                                </span>
                              )}
                              {gcal.attendees && gcal.attendees.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {gcal.attendees.slice(0, 3).map(a => a.displayName || a.email.split("@")[0]).join(", ")}
                                  {gcal.attendees.length > 3 ? ` +${gcal.attendees.length - 3}` : ""}
                                </span>
                              )}
                            </div>
                            {gcal.location && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {gcal.location}
                              </div>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No meetings or events on this day.</p>
                  </div>
                )}
              </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Card className="p-4 md:p-6" data-testid="card-upcoming-events">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-upcoming-heading">Upcoming Events</h3>
                  <p className="text-xs text-muted-foreground">Next 7 days</p>
                </div>
              </div>
              {upcomingItems.size > 0 ? (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {Array.from(upcomingItems.entries()).map(([dateKey, dayItems]) => (
                    <div key={dateKey}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5" data-testid={`text-upcoming-date-${dateKey}`}>
                        {format(new Date(dateKey + "T12:00:00"), "EEEE, d MMM")}
                      </p>
                      <div className="space-y-1.5">
                        {dayItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40" data-testid={`upcoming-item-${item.id}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <span className="text-xs text-muted-foreground">{item.time}</span>
                            </div>
                            <Badge variant="secondary" className={`text-[10px] shrink-0 ${item.typeColor}`}>
                              {item.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Nothing scheduled in the next 7 days</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border">
                <Link href="/calendar">
                  <Button variant="ghost" size="sm" className="w-full gap-1 text-primary" data-testid="button-quick-add-event">
                    <CalendarIcon className="w-3.5 h-3.5" /> View Calendar <ArrowRight className="w-3 h-3 ml-auto" />
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="p-4 md:p-6" data-testid="card-projects">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Rocket className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-projects-heading">Projects</h3>
                  <p className="text-xs text-muted-foreground">Track active initiatives</p>
                </div>
              </div>
              {projectWidget.active > 0 || projectWidget.planning > 0 ? (
                <>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-300 text-[10px]">Active</Badge>
                      <span className="text-lg font-bold tabular-nums" data-testid="text-projects-active-count">{projectWidget.active}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px]">Planning</Badge>
                      <span className="text-lg font-bold tabular-nums" data-testid="text-projects-planning-count">{projectWidget.planning}</span>
                    </div>
                    {projectWidget.pendingTasks > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">Tasks</Badge>
                        <span className="text-lg font-bold tabular-nums" data-testid="text-projects-pending-tasks">{projectWidget.pendingTasks}</span>
                      </div>
                    )}
                  </div>
                  {projectWidget.urgent.length > 0 && (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {projectWidget.urgent.map((p) => (
                        <Link key={p.id} href={`/projects/${p.id}`} data-testid={`project-widget-item-${p.id}`}>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">
                            <p className="text-sm font-medium truncate flex-1 min-w-0">{p.name}</p>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {p.pendingTaskCount > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`text-task-count-${p.id}`}>
                                  <ListChecks className="w-3 h-3 mr-0.5" />{p.pendingTaskCount}
                                </Badge>
                              )}
                              {p.endDate && (
                                <span className="text-xs text-muted-foreground">
                                  due {format(new Date(p.endDate), "d MMM")}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Rocket className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p data-testid="text-projects-empty">No active projects. Start one!</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border">
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="w-full gap-1 text-primary" data-testid="button-view-all-projects">
                    <Rocket className="w-3.5 h-3.5" /> View All Projects <ArrowRight className="w-3 h-3 ml-auto" />
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="p-4 md:p-6" data-testid="card-booking-revenue">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-revenue-heading">Venue Hire Revenue</h3>
                  <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
                </div>
              </div>
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums" data-testid="text-revenue-this-month">
                    ${bookingRevenue.thisMonth.toLocaleString("en-NZ", { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">This month</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    {bookingRevenue.change > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : bookingRevenue.change < 0 ? (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    ) : null}
                    {bookingRevenue.change !== 0 && (
                      <span className={`text-sm font-semibold ${bookingRevenue.change > 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-revenue-change">
                        {bookingRevenue.change > 0 ? "+" : ""}{Math.round(bookingRevenue.change)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-revenue-last-month">
                    Last month: ${bookingRevenue.lastMonth.toLocaleString("en-NZ", { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <Link href="/spaces?tab=venue-hire">
                  <Button variant="ghost" size="sm" className="w-full gap-1 text-primary" data-testid="button-view-bookings">
                    <Building2 className="w-3.5 h-3.5" /> View Venue Hires <ArrowRight className="w-3 h-3 ml-auto" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {communityGrowth.length > 0 && communityGrowth.some(m => m.count > 0) && (
            <Card className="p-4 md:p-6" data-testid="card-community-growth">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-growth-heading">Community Growth</h3>
                  <p className="text-xs text-muted-foreground">New members added per month (last 6 months)</p>
                </div>
              </div>
              <div className="h-[120px]" data-testid="chart-community-growth">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={communityGrowth} barSize={24}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg shadow-sm px-3 py-1.5 text-sm">
                              <span className="font-semibold">{payload[0].value}</span> new member{payload[0].value !== 1 ? "s" : ""}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}


        </div>
      </main>

      <ViewMeetingDialog
        meeting={viewMeeting}
        onClose={() => setViewMeeting(null)}
        contacts={contacts || []}
      />

    </>
  );
}

function ViewMeetingDialog({
  meeting,
  onClose,
  contacts,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  contacts: Contact[];
}) {
  const { mutate: deleteMeeting, isPending: deleting } = useDeleteMeeting();

  if (!meeting) return null;

  const contact = contacts.find((c) => c.id === meeting.contactId);
  const isPast = isBefore(new Date(meeting.endTime), new Date());

  return (
    <Dialog open={!!meeting} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{meeting.title}</DialogTitle>
          <DialogDescription className="sr-only">Meeting details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={`${MEETING_STATUS_COLORS[meeting.status] || ""}`}>
              {meeting.status}
            </Badge>
            {contact && (
              <Badge variant="outline">
                with {contact.name}
              </Badge>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="w-4 h-4" />
              <span>{format(new Date(meeting.startTime), "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{format(new Date(meeting.startTime), "h:mm a")} - {format(new Date(meeting.endTime), "h:mm a")}</span>
            </div>
            {meeting.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{meeting.location}</span>
              </div>
            )}
          </div>

          {meeting.description && (
            <div className="text-sm bg-muted/30 p-3 rounded-lg">
              <p className="text-muted-foreground">{meeting.description}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-wrap">
          {isPast && meeting.status !== "cancelled" && (
            <Link href="/debriefs" data-testid="link-dialog-log-debrief">
              <Button variant="outline" size="sm">
                <Mic className="w-3 h-3 mr-1" />
                Log Debrief
              </Button>
            </Link>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deleteMeeting(meeting.id, { onSuccess: onClose });
            }}
            disabled={deleting}
            data-testid="button-delete-meeting"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
