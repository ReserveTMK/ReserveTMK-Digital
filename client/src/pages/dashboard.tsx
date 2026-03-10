import { useContacts } from "@/hooks/use-contacts";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useEvents } from "@/hooks/use-events";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { useAuth } from "@/hooks/use-auth";
import { useProgrammes } from "@/hooks/use-programmes";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { Calendar as CalendarIcon, ArrowRight, Clock, MapPin, Trash2, ChevronLeft, ChevronRight, PartyPopper, Mic, Building2, Layers, AlertTriangle, ClipboardCheck, ListChecks, Rocket, Sprout, TreePine, Sun, Eye, Loader2, Users, DollarSign, TrendingUp, TrendingDown, Lightbulb, UserPlus, Coffee } from "lucide-react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { Meeting, Contact, Event, Programme, Booking, Project, ProjectTask } from "@shared/schema";
import {
  useEnrichedRelationships,
  useMentoringApplications,
  isOverdue,
  FREQUENCY_DAYS,
  type EnrichedRelationship,
} from "@/components/mentoring/mentoring-hooks";

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
  const { data: impactLogs } = useImpactLogs();
  const { data: programmes } = useProgrammes();
  const { data: bookings } = useBookings();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();

  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [skipTarget, setSkipTarget] = useState<any | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const { data: debriefQueue } = useQuery<any[]>({
    queryKey: ["/api/events/needs-debrief"],
  });

  const { data: outstandingActions } = useQuery<{
    id: number; title: string; status: string; dueDate: string | null; contactId: number | null; impactLogId: number | null; createdAt: string;
  }[]>({
    queryKey: ["/api/dashboard/outstanding-actions"],
  });

  const { data: enrichedRelationships } = useEnrichedRelationships();
  const { data: mentoringApplications } = useMentoringApplications();

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("DELETE", `/api/events/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setDeleteTarget(null);
      setDeleteReason("");
      toast({ title: "Event removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete event", description: err.message, variant: "destructive" });
    },
  });

  const skipDebriefMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("POST", `/api/events/${id}/skip-debrief`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      setSkipTarget(null);
      setSkipReason("");
      toast({ title: "Debrief dismissed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to dismiss debrief", description: err.message, variant: "destructive" });
    },
  });

  const { data: mentoringRelationships } = useQuery<any[]>({
    queryKey: ["/api/mentoring-relationships"],
  });

  const { data: projectsData } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allTasks } = useQuery<ProjectTask[]>({
    queryKey: ["/api/projects/all-tasks"],
  });

  const { data: catchUpItems } = useQuery<{
    id: number; contactId: number; note: string | null; priority: string; createdAt: string;
    contactName?: string; contactRole?: string; contactStage?: string; connectionStrength?: string;
  }[]>({
    queryKey: ["/api/catch-up-list"],
  });

  const overdueMentees = useMemo(() => {
    if (!enrichedRelationships) return [];
    return enrichedRelationships
      .filter((r: EnrichedRelationship) => isOverdue(r))
      .map((r: EnrichedRelationship) => {
        const daysSince = r.lastSessionDate
          ? Math.floor((Date.now() - new Date(r.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const threshold = FREQUENCY_DAYS[r.sessionFrequency || "monthly"] || 30;
        return { ...r, daysSince, daysOverdue: daysSince - threshold };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [enrichedRelationships]);

  const pendingApplicationCount = useMemo(() => {
    if (!mentoringApplications) return 0;
    return mentoringApplications.filter((a: any) => a.status === "pending").length;
  }, [mentoringApplications]);

  const catchUpSummary = useMemo(() => {
    if (!catchUpItems || catchUpItems.length === 0) return null;
    const urgent = catchUpItems.filter(i => i.priority === "urgent");
    const soon = catchUpItems.filter(i => i.priority === "soon");
    const whenever = catchUpItems.filter(i => i.priority === "whenever");
    const topItems = [...urgent, ...soon, ...whenever].slice(0, 5);
    return { total: catchUpItems.length, urgentCount: urgent.length, soonCount: soon.length, wheneverCount: whenever.length, topItems };
  }, [catchUpItems]);

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

    items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const grouped = new Map<string, typeof items>();
    items.forEach((item) => {
      if (!grouped.has(item.date)) grouped.set(item.date, []);
      grouped.get(item.date)!.push(item);
    });
    return grouped;
  }, [meetings, events, programmes, bookings]);

  const debriefAttention = useMemo(() => {
    const items: { id: number; eventId: number | null; name: string; date: string; status: string; statusColor: string; link: string; type: "event" | "debrief" }[] = [];

    (debriefQueue || []).forEach((item: any) => {
      items.push({
        id: item.id,
        eventId: item.id,
        name: item.name,
        date: item.startTime ? format(new Date(item.startTime), "d MMM") : "",
        status: item.queueStatus === "overdue" ? "Overdue" : "Needs Debrief",
        statusColor: item.queueStatus === "overdue"
          ? "bg-red-500/15 text-red-700 dark:text-red-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        link: `/debriefs?tab=queue&reconcile=${item.id}`,
        type: "event",
      });
    });

    (impactLogs as any[] || [])
      .filter((l: any) => l.status !== "confirmed")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((l: any) => {
        items.push({
          id: l.id,
          eventId: l.eventId || null,
          name: l.title || "Untitled debrief",
          date: l.createdAt ? format(new Date(l.createdAt), "d MMM") : "",
          status: l.status === "draft" ? "Draft" : l.status === "reviewed" ? "Reviewed" : "Pending",
          statusColor: l.status === "draft"
            ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
            : "bg-blue-500/15 text-blue-700 dark:text-blue-300",
          link: `/debriefs/${l.id}`,
          type: "debrief",
        });
      });

    return items;
  }, [debriefQueue, impactLogs]);

  const journeySnapshot = useMemo(() => {
    const kakano = contacts?.filter((c: any) => c.stage === "kakano").length || 0;
    const tipu = contacts?.filter((c: any) => c.stage === "tipu").length || 0;
    const ora = contacts?.filter((c: any) => c.stage === "ora").length || 0;
    const inactive = contacts?.filter((c: any) => c.stage === "inactive").length || 0;
    const activeMentoring = mentoringRelationships?.filter((r: any) => r.status === "active").length || 0;
    const communityCount = (contacts as any[])?.filter((c: any) => c.isCommunityMember).length || 0;
    const innovatorCount = (contacts as any[])?.filter((c: any) => c.isInnovator).length || 0;
    return { kakano, tipu, ora, inactive, activeMentoring, communityCount, innovatorCount };
  }, [contacts, mentoringRelationships]);

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

          {debriefAttention.length > 0 && (
            <Card className="border-l-4 border-l-amber-500 p-4 md:p-6" data-testid="card-debriefs-attention-top">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <ClipboardCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display" data-testid="text-debriefs-attention-heading">Debriefs Needing Attention</h2>
                    <p className="text-sm text-muted-foreground">{debriefAttention.length} item{debriefAttention.length !== 1 ? "s" : ""} to review</p>
                  </div>
                </div>
                <Link href="/debriefs" data-testid="link-view-all-debriefs">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                {debriefAttention.slice(0, 6).map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40"
                    data-testid={`debrief-attention-${item.type}-${item.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <span className="text-xs text-muted-foreground">{item.date}</span>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${item.statusColor}`}>
                      {item.status}
                    </Badge>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link href={item.link}>
                        <Button size="sm" variant="default" className="gap-1" data-testid={`button-log-debrief-${item.type}-${item.id}`}>
                          <Mic className="w-3 h-3" /> Log
                        </Button>
                      </Link>
                      {item.type === "event" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => { setSkipTarget(item); setSkipReason(""); }}
                          data-testid={`button-skip-debrief-${item.id}`}
                        >
                          Dismiss
                        </Button>
                      )}
                      {item.type === "event" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setDeleteTarget(item); setDeleteReason(""); }}
                          data-testid={`button-delete-event-${item.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {outstandingActions && outstandingActions.length > 0 && (
            <Card className="border-l-4 border-l-orange-500 p-4 md:p-6" data-testid="card-outstanding-actions">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <ListChecks className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display" data-testid="text-outstanding-actions-title">Outstanding Actions</h2>
                    <p className="text-sm text-muted-foreground" data-testid="text-outstanding-actions-subtitle">
                      {outstandingActions.length} action{outstandingActions.length !== 1 ? "s" : ""} needing follow-up
                    </p>
                  </div>
                </div>
                <Link href="/actions" data-testid="link-view-all-actions">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {outstandingActions.slice(0, 5).map((action) => {
                  const contact = contacts?.find((c: Contact) => c.id === action.contactId);
                  const actionOverdue = action.dueDate ? isBefore(new Date(action.dueDate), new Date()) : false;
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`action-item-${action.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Badge
                          variant="secondary"
                          className={`shrink-0 text-xs ${
                            action.status === "pending" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                          }`}
                          data-testid={`badge-action-status-${action.id}`}
                        >
                          {action.status === "in_progress" ? "In Progress" : "Pending"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" data-testid={`text-action-title-${action.id}`}>{action.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {contact && (
                              <span className="text-xs text-muted-foreground" data-testid={`text-action-contact-${action.id}`}>{contact.name}</span>
                            )}
                            {action.dueDate && (
                              <span className={`text-xs ${actionOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`} data-testid={`text-action-due-${action.id}`}>
                                Due {format(new Date(action.dueDate), "d MMM yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {catchUpSummary && (
            <Card className="border-l-4 border-l-teal-500 p-4 md:p-6" data-testid="card-catch-up-summary">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10">
                    <Coffee className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display" data-testid="text-catch-up-heading">Catch Up</h2>
                    <p className="text-sm text-muted-foreground" data-testid="text-catch-up-subtitle">
                      {catchUpSummary.total} contact{catchUpSummary.total !== 1 ? "s" : ""} to catch up with
                      {catchUpSummary.urgentCount > 0 || catchUpSummary.soonCount > 0 ? " — " : ""}
                      {[
                        catchUpSummary.urgentCount > 0 ? `${catchUpSummary.urgentCount} urgent` : "",
                        catchUpSummary.soonCount > 0 ? `${catchUpSummary.soonCount} soon` : "",
                      ].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
                <Link href="/catch-up" data-testid="link-view-all-catch-ups">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-1.5">
                {catchUpSummary.topItems.map((item) => {
                  const addedDate = new Date(item.createdAt);
                  const daysAgo = Math.floor((Date.now() - addedDate.getTime()) / (1000 * 60 * 60 * 24));
                  const priorityColor = item.priority === "urgent"
                    ? "bg-red-500/15 text-red-700 dark:text-red-300"
                    : item.priority === "soon"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground";
                  return (
                    <Link key={item.id} href={`/contacts/${item.contactId}`} data-testid={`catch-up-item-${item.id}`}>
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-catch-up-name-${item.id}`}>
                            {item.contactName || "Contact"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {item.note && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.note}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {daysAgo === 0 ? "added today" : `added ${daysAgo}d ago`}
                            </span>
                          </div>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${priorityColor}`} data-testid={`badge-catch-up-priority-${item.id}`}>
                          {item.priority}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}

          {(overdueMentees.length > 0 || pendingApplicationCount > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overdueMentees.length > 0 && (
                <Card className="border-l-4 border-l-red-500 p-4 md:p-6" data-testid="card-overdue-mentees">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold" data-testid="text-overdue-mentees-heading">Overdue Mentees</h3>
                        <p className="text-xs text-muted-foreground">{overdueMentees.length} mentee{overdueMentees.length !== 1 ? "s" : ""} past due</p>
                      </div>
                    </div>
                    <Link href="/mentoring" data-testid="link-view-mentoring">
                      <Button variant="ghost" size="sm" className="gap-1 text-primary">
                        View <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-1.5">
                    {overdueMentees.slice(0, 4).map((r) => (
                      <Link key={r.id} href={`/contacts/${r.contactId}`} data-testid={`link-overdue-mentee-${r.id}`}>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{r.contactName}</p>
                            <p className="text-xs text-muted-foreground">{r.sessionFrequency} sessions</p>
                          </div>
                          <Badge variant="destructive" className="text-[10px] shrink-0" data-testid={`badge-overdue-days-${r.id}`}>
                            {r.daysOverdue}d overdue
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>
              )}

              {pendingApplicationCount > 0 && (
                <Card className="border-l-4 border-l-blue-500 p-4 md:p-6" data-testid="card-pending-applications">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <UserPlus className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display font-semibold" data-testid="text-pending-apps-heading">Pending Applications</h3>
                      <p className="text-xs text-muted-foreground">{pendingApplicationCount} mentoring application{pendingApplicationCount !== 1 ? "s" : ""} awaiting review</p>
                    </div>
                    <Link href="/mentoring" data-testid="link-review-applications">
                      <Button size="sm" className="gap-1">
                        Review <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}
            </div>
          )}

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

            <Card className="p-4 md:p-6" data-testid="card-innovator-snapshot">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Sprout className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-snapshot-heading">Innovator Snapshot</h3>
                  <p className="text-xs text-muted-foreground">Journey stages</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-200/50 dark:border-amber-800/30" data-testid="snapshot-kakano">
                  <div className="p-1.5 rounded-md bg-amber-500/10">
                    <Sprout className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Kakano</p>
                    <p className="text-[11px] text-muted-foreground">Seed / Foundation</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums" data-testid="text-kakano-count">{journeySnapshot.kakano}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-800/30" data-testid="snapshot-tipu">
                  <div className="p-1.5 rounded-md bg-emerald-500/10">
                    <TreePine className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Tipu</p>
                    <p className="text-[11px] text-muted-foreground">Actively Growing</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums" data-testid="text-tipu-count">{journeySnapshot.tipu}</span>
                    {journeySnapshot.activeMentoring > 0 && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400" data-testid="text-tipu-mentoring">{journeySnapshot.activeMentoring} in mentoring</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-200/50 dark:border-blue-800/30" data-testid="snapshot-ora">
                  <div className="p-1.5 rounded-md bg-blue-500/10">
                    <Sun className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Ora</p>
                    <p className="text-[11px] text-muted-foreground">Thriving / Sustained</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums" data-testid="text-ora-count">{journeySnapshot.ora}</span>
                </div>
                {journeySnapshot.inactive > 0 && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40" data-testid="snapshot-inactive">
                    <div className="p-1.5 rounded-md bg-muted">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-muted-foreground" data-testid="text-inactive-count">{journeySnapshot.inactive}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span data-testid="text-community-count">{journeySnapshot.communityCount} community</span>
                </span>
                {journeySnapshot.innovatorCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span data-testid="text-innovator-count">{journeySnapshot.innovatorCount} innovator{journeySnapshot.innovatorCount !== 1 ? "s" : ""}</span>
                  </span>
                )}
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
                <Link href="/bookings">
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
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = isSameDay(day, selectedDate);
                    const today = isToday(day);
                    const hasItems = dayMeetings.length + dayEvents.length + dayProgrammes.length + dayBookings.length > 0;

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
              </div>

              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="font-semibold font-display" data-testid="text-selected-date">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </h3>
                </div>

                {(selectedDayMeetings.length > 0 || selectedDayEvents.length > 0 || selectedDayProgrammes.length > 0 || selectedDayBookings.length > 0) ? (
                  <div className="space-y-3">
                    {selectedDayMeetings.map((meeting) => {
                      const contact = contacts?.find((c: Contact) => c.id === meeting.contactId);
                      const isPast = isBefore(new Date(meeting.endTime), new Date());
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
                          {isPast && meeting.status !== "cancelled" && (
                            <Link href="/debriefs" data-testid={`link-log-debrief-${meeting.id}`}>
                              <Button variant="outline" size="sm">
                                <Mic className="w-3 h-3 mr-1" />
                                Log Debrief
                              </Button>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                    {selectedDayEvents.map((ev: Event) => {
                      const isPast = isBefore(new Date(ev.endTime), new Date());
                      return (
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
                          {isPast && (
                            <Link href="/debriefs" data-testid={`link-log-debrief-event-${ev.id}`}>
                              <Button variant="outline" size="sm">
                                <Mic className="w-3 h-3 mr-1" />
                                Log Debrief
                              </Button>
                            </Link>
                          )}
                        </div>
                      );
                    })}
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
                      const venueName = venues?.find((v: any) => v.id === bk.venueId)?.name;
                      return (
                        <div
                          key={`bk-${bk.id}`}
                          className="w-full text-left p-3 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                          onClick={() => navigate("/bookings")}
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
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No meetings or events on this day.</p>
                  </div>
                )}
              </Card>
          </div>

        </div>
      </main>

      <ViewMeetingDialog
        meeting={viewMeeting}
        onClose={() => setViewMeeting(null)}
        contacts={contacts || []}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Event</DialogTitle>
            <DialogDescription className="sr-only">Confirm event removal</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{deleteTarget.name}</p>
                <p className="text-xs text-muted-foreground">{deleteTarget.date}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-reason">Why is this event being removed?</Label>
                <Textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Cancelled, duplicate entry, entered in error..."
                  className="resize-none"
                  data-testid="input-delete-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteReason(""); }} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteReason.trim() || deleteEventMutation.isPending}
              onClick={() => {
                if (deleteTarget?.eventId) {
                  deleteEventMutation.mutate({ id: deleteTarget.eventId, reason: deleteReason.trim() });
                }
              }}
              data-testid="button-confirm-delete"
            >
              {deleteEventMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!skipTarget} onOpenChange={(open) => { if (!open) { setSkipTarget(null); setSkipReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dismiss Debrief</DialogTitle>
            <DialogDescription className="sr-only">Confirm debrief dismissal</DialogDescription>
          </DialogHeader>
          {skipTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{skipTarget.name}</p>
                <p className="text-xs text-muted-foreground">{skipTarget.date}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skip-reason">Why is this debrief being dismissed?</Label>
                <Textarea
                  id="skip-reason"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="e.g. Not relevant, already documented elsewhere..."
                  className="resize-none"
                  data-testid="input-skip-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSkipTarget(null); setSkipReason(""); }} data-testid="button-cancel-skip">
              Cancel
            </Button>
            <Button
              disabled={!skipReason.trim() || skipDebriefMutation.isPending}
              onClick={() => {
                if (skipTarget?.id) {
                  skipDebriefMutation.mutate({ id: skipTarget.id, reason: skipReason.trim() });
                }
              }}
              data-testid="button-confirm-skip"
            >
              {skipDebriefMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
