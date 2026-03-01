import { MetricCard } from "@/components/ui/metric-card";
import { useContacts } from "@/hooks/use-contacts";
import { useInteractions } from "@/hooks/use-interactions";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useEvents } from "@/hooks/use-events";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { useAuth } from "@/hooks/use-auth";
import { useProgrammes } from "@/hooks/use-programmes";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { Users, Activity, TrendingUp, Calendar as CalendarIcon, ArrowRight, Clock, MapPin, Trash2, ChevronLeft, ChevronRight, PartyPopper, Mic, FileText, Building2, Layers, BookOpen, AlertTriangle, ClipboardCheck, SkipForward, ListChecks, Info, Rocket, Sprout, TreePine, Sun, Eye } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, startOfDay, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, isToday, isBefore, isAfter } from "date-fns";
import { formatTimeSlot } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Meeting, Contact, Event, Programme, Booking } from "@shared/schema";

const MEETING_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: contacts, isLoading: loadingContacts } = useContacts();
  const { data: interactions, isLoading: loadingInteractions } = useInteractions();
  const { data: meetings } = useMeetings();
  const { data: events } = useEvents();
  const { data: impactLogs } = useImpactLogs();
  const { data: programmes } = useProgrammes();
  const { data: bookings } = useBookings();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);

  const { data: debriefQueue } = useQuery<any[]>({
    queryKey: ["/api/events/needs-debrief"],
  });

  const { data: outstandingActions } = useQuery<{
    id: number; title: string; status: string; dueDate: string | null; contactId: number | null; impactLogId: number | null; createdAt: string;
  }[]>({
    queryKey: ["/api/dashboard/outstanding-actions"],
  });

  const { data: blendedStats } = useQuery<{
    legacy: { totalActivations: number; totalFoottraffic: number; totalBookings: number; totalHours: number; totalRevenue: number; totalInKind: number; reportCount: number };
    live: { completedProgrammes: number; completedBookings: number; confirmedDebriefs: number };
    boundaryDate: string | null;
  }>({ queryKey: ["/api/dashboard/blended-stats"] });

  const { data: relationshipStages } = useQuery<{
    contactCounts: Record<string, number>;
    groupCounts: Record<string, number>;
  }>({
    queryKey: ["/api/dashboard/relationship-stages"],
  });

  const { data: trendData } = useQuery<{
    trendData: Array<{
      quarterLabel: string;
      activationsTotal: number;
      activationsWorkshops: number;
      activationsMentoring: number;
      activationsEvents: number;
      foottrafficUnique: number | null;
      source?: string;
    }>;
    boundaryDate: string | null;
  }>({
    queryKey: ["/api/legacy-trend-data"],
  });

  const hasLegacy = blendedStats && blendedStats.legacy.reportCount > 0;

  const communityCount = contacts?.filter((c: any) => c.isCommunityMember)?.length || 0;
  const totalContacts = contacts?.length || 0;
  const ytdInteractions = useMemo(() => {
    if (!interactions) return 0;
    const ytdStart = new Date(new Date().getFullYear(), 0, 1);
    return interactions.filter((i: any) => new Date(i.date || i.createdAt) >= ytdStart).length;
  }, [interactions]);
  const totalInteractions = interactions?.length || 0;
  const recentInteractions = interactions?.slice(0, 5) || [];

  const recentConfidence = interactions
    ?.slice(0, 10)
    .reduce((acc, curr) => acc + (curr.analysis?.confidenceScore || 0), 0);
  const avgConfidence = recentConfidence && interactions?.length
    ? (recentConfidence / Math.min(interactions.length, 10)).toFixed(1)
    : "N/A";

  const recentDebriefs = useMemo(() => {
    if (!impactLogs) return [];
    return (impactLogs as any[])
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [impactLogs]);

  const { data: mentoringRelationships } = useQuery<any[]>({
    queryKey: ["/api/mentoring-relationships"],
  });

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
          name: b.title,
          time: b.startTime ? formatTimeSlot(b.startTime) : "TBC",
          type: "Booking",
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
    const items: { id: number; name: string; date: string; status: string; statusColor: string; link: string }[] = [];

    (debriefQueue || []).forEach((item: any) => {
      items.push({
        id: item.id,
        name: item.name,
        date: item.startTime ? format(new Date(item.startTime), "d MMM") : "",
        status: item.queueStatus === "overdue" ? "Overdue" : "Needs Debrief",
        statusColor: item.queueStatus === "overdue"
          ? "bg-red-500/15 text-red-700 dark:text-red-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        link: `/debriefs?tab=calendar&reconcile=${item.id}`,
      });
    });

    (impactLogs as any[] || [])
      .filter((l: any) => l.status !== "confirmed")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .forEach((l: any) => {
        items.push({
          id: l.id,
          name: l.title || "Untitled debrief",
          date: l.createdAt ? format(new Date(l.createdAt), "d MMM") : "",
          status: l.status === "draft" ? "Draft" : l.status === "reviewed" ? "Reviewed" : "Pending",
          statusColor: l.status === "draft"
            ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
            : "bg-blue-500/15 text-blue-700 dark:text-blue-300",
          link: `/debriefs/${l.id}`,
        });
      });

    return items.slice(0, 6);
  }, [debriefQueue, impactLogs]);

  const journeySnapshot = useMemo(() => {
    const kakano = contacts?.filter((c: any) => c.stage === "kakano").length || 0;
    const tipu = contacts?.filter((c: any) => c.stage === "tipu").length || 0;
    const ora = contacts?.filter((c: any) => c.stage === "ora").length || 0;
    const inactive = contacts?.filter((c: any) => c.stage === "inactive").length || 0;
    const activeMentoring = mentoringRelationships?.filter((r: any) => r.status === "active").length || 0;
    const thirtyDaysAgo = addDays(new Date(), -30);
    const recentInteractionCount = interactions?.filter(
      (i: any) => new Date(i.date || i.createdAt) >= thirtyDaysAgo
    ).length || 0;
    return { kakano, tipu, ora, inactive, activeMentoring, recentInteractionCount };
  }, [contacts, mentoringRelationships, interactions]);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
            <MetricCard
              title="Total Community"
              value={loadingContacts ? "..." : communityCount}
              subtext={totalContacts > 0 ? `${totalContacts} total contacts` : undefined}
              icon={<Users className="w-5 h-5" />}
              color="primary"
              data-testid="metric-community"
            />
            <MetricCard
              title="Interactions YTD"
              value={loadingInteractions ? "..." : ytdInteractions}
              subtext={totalInteractions > ytdInteractions ? `${totalInteractions} all time` : undefined}
              icon={<Activity className="w-5 h-5" />}
              color="secondary"
              data-testid="metric-interactions"
            />
            <MetricCard
              title="Impact Debriefs"
              value={(impactLogs as any[])?.length || 0}
              subtext={hasLegacy && blendedStats!.legacy.totalActivations > 0 ? `incl. ${blendedStats!.legacy.totalActivations.toLocaleString()} legacy activations` : undefined}
              icon={<Mic className="w-5 h-5" />}
              color="green"
              data-testid="metric-debriefs"
            />
            <MetricCard
              title="Avg Confidence"
              value={avgConfidence}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
              trend={avgConfidence !== "N/A" && Number(avgConfidence) > 7 ? "up" : "neutral"}
              trendValue="Good"
              data-testid="metric-confidence"
            />
            <MetricCard
              title="Total Events"
              value={events?.length || 0}
              subtext={hasLegacy && blendedStats!.legacy.totalBookings > 0 ? `incl. ${blendedStats!.legacy.totalBookings.toLocaleString()} legacy bookings` : undefined}
              icon={<CalendarIcon className="w-5 h-5" />}
              color="blue"
              data-testid="metric-total-events"
            />
          </div>

          {hasLegacy && (
            <Card className="p-3 md:p-4" data-testid="card-legacy-info">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                  <Info className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground" data-testid="text-legacy-info">
                    Historical data from <span className="font-semibold text-foreground">{blendedStats!.legacy.reportCount}</span> legacy reports included
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2" data-testid="legacy-metric-badges">
                {blendedStats!.legacy.totalActivations > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-legacy-activations">
                    {blendedStats!.legacy.totalActivations.toLocaleString()} activations
                  </Badge>
                )}
                {blendedStats!.legacy.totalFoottraffic > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-legacy-foottraffic">
                    {blendedStats!.legacy.totalFoottraffic.toLocaleString()} foot traffic
                  </Badge>
                )}
                {blendedStats!.legacy.totalBookings > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-legacy-bookings">
                    {blendedStats!.legacy.totalBookings.toLocaleString()} bookings
                  </Badge>
                )}
                {blendedStats!.legacy.totalHours > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-legacy-hours">
                    {blendedStats!.legacy.totalHours.toLocaleString()} hours
                  </Badge>
                )}
                {blendedStats!.legacy.totalRevenue > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-legacy-revenue">
                    ${blendedStats!.legacy.totalRevenue.toLocaleString()} revenue
                  </Badge>
                )}
                {blendedStats!.legacy.totalInKind > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-legacy-inkind">
                    ${blendedStats!.legacy.totalInKind.toLocaleString()} in-kind
                  </Badge>
                )}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:gap-6">
            <Card className="p-4 md:p-6" data-testid="card-relationship-stages">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-stages-heading">Relationship Stages</h3>
                  <p className="text-xs text-muted-foreground">Contacts by engagement level</p>
                </div>
              </div>
              {relationshipStages ? (
                <div className="space-y-2">
                  {["new", "engaged", "active", "deepening", "partner", "alumni"].map((stage) => {
                    const count = relationshipStages.contactCounts[stage] || 0;
                    const totalContacts = Object.values(relationshipStages.contactCounts).reduce((a, b) => a + b, 0);
                    const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                    return (
                      <div key={stage} className="flex items-center gap-3" data-testid={`row-stage-${stage}`}>
                        <span className="text-xs text-muted-foreground w-20 capitalize">{stage}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right" data-testid={`text-stage-count-${stage}`}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {debriefQueue && debriefQueue.length > 0 && (
            <Card className="border-l-4 border-l-orange-500 p-4 md:p-6" data-testid="card-debrief-queue">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <ClipboardCheck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display">To Be Debriefed</h2>
                    <p className="text-sm text-muted-foreground">
                      {debriefQueue.length} event{debriefQueue.length !== 1 ? "s" : ""} awaiting debrief
                    </p>
                  </div>
                </div>
                <Link href="/debriefs?tab=calendar" data-testid="link-view-all-debriefs">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                {debriefQueue.slice(0, 3).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`debrief-queue-item-${item.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant={item.queueStatus === "overdue" ? "destructive" : item.queueStatus === "in_progress" ? "secondary" : "outline"}
                        className="shrink-0 text-xs"
                        data-testid={`badge-status-${item.id}`}
                      >
                        {item.queueStatus === "overdue" && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {item.queueStatus === "overdue" ? "Overdue" : item.queueStatus === "in_progress" ? "In Progress" : "Due"}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.startTime), "d MMM yyyy")} · {item.type}
                        </p>
                      </div>
                    </div>
                    <Link href={`/debriefs?tab=calendar&reconcile=${item.id}`} data-testid={`button-reconcile-${item.id}`}>
                      <Button size="sm" variant="default" className="gap-1 shrink-0">
                        <Mic className="w-3 h-3" /> Reconcile
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
              {(() => {
                const unconfirmedCount = (impactLogs as any[])?.filter((l: any) => l.status !== "confirmed").length || 0;
                if (unconfirmedCount === 0) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-border" data-testid="text-unconfirmed-debriefs">
                    <Link href="/debriefs" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-unconfirmed-debriefs">
                      <span className="font-medium text-foreground">{unconfirmedCount}</span> debrief{unconfirmedCount !== 1 ? "s" : ""} awaiting confirmation <ArrowRight className="w-3 h-3 inline ml-1" />
                    </Link>
                  </div>
                );
              })()}
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
                  const isOverdue = action.dueDate ? isBefore(new Date(action.dueDate), new Date()) : false;
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
                              <span className={`text-xs ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`} data-testid={`text-action-due-${action.id}`}>
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

            <Card className="p-4 md:p-6" data-testid="card-debriefs-attention">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-debriefs-attention-heading">Debriefs Needing Attention</h3>
                  <p className="text-xs text-muted-foreground">{debriefAttention.length} item{debriefAttention.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              {debriefAttention.length > 0 ? (
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                  {debriefAttention.map((item) => (
                    <Link key={item.id} href={item.link} data-testid={`debrief-attention-${item.id}`}>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <span className="text-xs text-muted-foreground">{item.date}</span>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${item.statusColor}`}>
                          {item.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>All caught up!</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border">
                <Link href="/debriefs">
                  <Button variant="ghost" size="sm" className="w-full gap-1 text-primary" data-testid="button-quick-debrief">
                    <Mic className="w-3.5 h-3.5" /> Quick Debrief <ArrowRight className="w-3 h-3 ml-auto" />
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="p-4 md:p-6" data-testid="card-community-snapshot">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Sprout className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-snapshot-heading">Community Snapshot</h3>
                  <p className="text-xs text-muted-foreground">Journey stages</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-200/50 dark:border-amber-800/30" data-testid="snapshot-kakano">
                  <div className="p-1.5 rounded-md bg-amber-500/10">
                    <Sprout className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Kākano</p>
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
                  <Activity className="w-3.5 h-3.5" />
                  <span data-testid="text-recent-interactions-count">{journeySnapshot.recentInteractionCount} interactions</span> in last 30 days
                </span>
              </div>
            </Card>

            <Card className="p-4 md:p-6" data-testid="card-projects">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Rocket className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-display font-semibold" data-testid="text-projects-heading">Projects</h3>
                  <p className="text-xs text-muted-foreground">Track active ventures</p>
                </div>
              </div>
              <div className="text-center py-8">
                <Rocket className="w-10 h-10 mx-auto mb-3 text-violet-400 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground" data-testid="text-projects-coming-soon">Coming soon</p>
                <p className="text-xs text-muted-foreground mt-1">Track venture progress, milestones and outcomes</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
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
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Bookings</span>
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

            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display" data-testid="text-recent-debriefs-heading">Recent Debriefs</h2>
              <Card className="p-4 md:p-6">
                {recentDebriefs.length > 0 ? (
                  <div className="space-y-4">
                    {recentDebriefs.map((debrief: any) => (
                      <Link
                        key={debrief.id}
                        href={`/debriefs/${debrief.id}`}
                        data-testid={`link-debrief-${debrief.id}`}
                        className="block w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center bg-primary/10 rounded-lg px-2 py-1 shrink-0">
                            <span className="text-xs font-medium text-primary">{debrief.createdAt ? format(new Date(debrief.createdAt), "MMM") : ""}</span>
                            <span className="text-lg font-bold text-primary leading-tight">{debrief.createdAt ? format(new Date(debrief.createdAt), "d") : ""}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate" data-testid={`text-debrief-title-${debrief.id}`}>{debrief.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className={`text-xs ${
                                debrief.status === "reviewed" ? "bg-green-500/15 text-green-700 dark:text-green-300" :
                                debrief.status === "draft" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" :
                                "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                              }`} data-testid={`badge-debrief-status-${debrief.id}`}>
                                {debrief.status}
                              </Badge>
                              {debrief.createdAt && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(debrief.createdAt), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                    <Link href="/debriefs" className="text-primary hover:underline text-xs font-medium flex items-center justify-center pt-2" data-testid="link-view-all-debriefs">
                      View all debriefs <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No debriefs yet.</p>
                    <Link href="/debriefs" data-testid="link-go-to-debriefs">
                      <Button variant="ghost" size="sm" className="mt-1 text-primary">
                        Go to Debriefs
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>

              <h2 className="text-xl font-bold font-display">Recent Interactions</h2>
              <Card className="p-4 md:p-6">
                {loadingInteractions ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentInteractions.length > 0 ? (
                  <div className="space-y-3">
                    {recentInteractions.slice(0, 5).map((interaction) => {
                      const contact = contacts?.find((c: Contact) => c.id === interaction.contactId);
                      return (
                        <div key={interaction.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {contact?.name?.[0] || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contact?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {interaction.summary || interaction.type}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(interaction.date), "MMM d")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <Link href="/contacts" className="text-primary hover:underline text-xs font-medium flex items-center justify-center pt-2">
                      View all members <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <p>No interactions yet.</p>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {trendData?.trendData && trendData.trendData.length > 1 && (
            <Card className="p-5" data-testid="card-dashboard-trend">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">Quarterly Trend</h3>
                  <Badge variant="secondary" className="text-[10px]">{trendData.trendData.length} quarters</Badge>
                </div>
                <Link href="/legacy-reports">
                  <Button variant="ghost" size="sm" className="text-xs">
                    <BookOpen className="w-3 h-3 mr-1" /> Manage Legacy Data
                  </Button>
                </Link>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quarterLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="activationsTotal" stroke="hsl(var(--brand-coral))" strokeWidth={2} name="Activations" dot />
                    <Line type="monotone" dataKey="activationsWorkshops" stroke="hsl(var(--brand-green))" strokeWidth={1.5} name="Workshops" dot />
                    <Line type="monotone" dataKey="activationsMentoring" stroke="hsl(var(--brand-blue))" strokeWidth={1.5} name="Mentoring" dot />
                    <Line type="monotone" dataKey="foottrafficUnique" stroke="hsl(var(--primary))" strokeWidth={1.5} name="Hub Foot Traffic" dot />
                  </LineChart>
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
