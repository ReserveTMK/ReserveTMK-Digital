import { Sidebar } from "@/components/layout/sidebar";
import { MetricCard } from "@/components/ui/metric-card";
import { useContacts } from "@/hooks/use-contacts";
import { useInteractions } from "@/hooks/use-interactions";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useEvents } from "@/hooks/use-events";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { useAuth } from "@/hooks/use-auth";
import { Users, Activity, TrendingUp, Calendar as CalendarIcon, ArrowRight, Clock, MapPin, Trash2, ChevronLeft, ChevronRight, PartyPopper, Mic, FileText } from "lucide-react";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore } from "date-fns";
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
import type { Meeting, Contact, Event } from "@shared/schema";

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

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);

  const totalContacts = contacts?.length || 0;
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

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = start.getDay();
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

  const selectedDayMeetings = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return meetingsByDate.get(key) || [];
  }, [selectedDate, meetingsByDate]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
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
              title="Community"
              value={loadingContacts ? "..." : totalContacts}
              icon={<Users className="w-5 h-5" />}
              color="primary"
            />
            <MetricCard
              title="Total Interactions"
              value={loadingInteractions ? "..." : totalInteractions}
              icon={<Activity className="w-5 h-5" />}
              color="secondary"
            />
            <MetricCard
              title="Impact Debriefs"
              value={(impactLogs as any[])?.length || 0}
              icon={<Mic className="w-5 h-5" />}
              color="green"
            />
            <MetricCard
              title="Avg Confidence"
              value={avgConfidence}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
              trend={avgConfidence !== "N/A" && Number(avgConfidence) > 7 ? "up" : "neutral"}
              trendValue="Good"
            />
            <MetricCard
              title="Total Events"
              value={events?.length || 0}
              icon={<CalendarIcon className="w-5 h-5" />}
              color="blue"
              data-testid="metric-total-events"
            />
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
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {d}
                    </div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayMeetings = meetingsByDate.get(key) || [];
                    const dayEvents = eventsByDate.get(key) || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = isSameDay(day, selectedDate);
                    const today = isToday(day);

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
                        {(dayMeetings.length > 0 || dayEvents.length > 0) && (
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
                            {dayEvents.slice(0, 2).map((_, i) => (
                              <div
                                key={`e-${i}`}
                                className="w-full h-1 rounded-full bg-violet-400"
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="font-semibold font-display" data-testid="text-selected-date">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </h3>
                </div>

                {(selectedDayMeetings.length > 0 || selectedDayEvents.length > 0) ? (
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
        </div>
      </main>

      <ViewMeetingDialog
        meeting={viewMeeting}
        onClose={() => setViewMeeting(null)}
        contacts={contacts || []}
      />
    </div>
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
