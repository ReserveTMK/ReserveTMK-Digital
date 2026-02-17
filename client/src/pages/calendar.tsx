import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import {
  Calendar,
  CalendarX,
  MapPin,
  Clock,
  Users,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isBefore,
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  attendees: { email: string; displayName: string; responseStatus: string }[];
  htmlLink: string;
  status: string;
}

interface AppEvent {
  id: number;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  description: string | null;
  googleCalendarEventId: string | null;
  tags: string[] | null;
  attendeeCount: number | null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

const EVENT_TYPE_DOT_COLORS: Record<string, string> = {
  "Meeting": "bg-blue-400",
  "Mentoring Session": "bg-emerald-400",
  "External Event": "bg-orange-400",
  "Personal Development": "bg-violet-400",
};

const EVENT_TYPE_BADGE_COLORS: Record<string, string> = {
  "Meeting": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Mentoring Session": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "External Event": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Personal Development": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

function getEventDotColor(e: { type: "gcal" | "app"; app?: AppEvent }) {
  if (e.type === "gcal") return "bg-gray-400";
  const appType = e.app?.type || "";
  return EVENT_TYPE_DOT_COLORS[appType] || "bg-gray-400";
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "gcal" | "app"; event: GoogleCalendarEvent | AppEvent } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: gcalEvents, isLoading: gcalLoading, error: gcalError, refetch: refetchGcal } = useQuery<GoogleCalendarEvent[]>({
    queryKey: ["/api/google-calendar/events"],
  });

  const { data: appEvents } = useQuery<AppEvent[]>({
    queryKey: ["/api/events"],
    staleTime: 0,
  });

  const createDebriefMutation = useMutation({
    mutationFn: async (data: { title: string; eventId?: number; summary?: string }) => {
      const res = await apiRequest("POST", "/api/impact-logs", {
        title: data.title,
        status: "draft",
        eventId: data.eventId || null,
        summary: data.summary || null,
      });
      return res.json();
    },
    onSuccess: (log: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      toast({ title: "Debrief created", description: "You can now record or type your notes." });
      navigate(`/debriefs/${log.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create debrief", description: err.message, variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("DELETE", `/api/events/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event removed" });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteReason("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete event", description: err.message, variant: "destructive" });
    },
  });

  function handleLogDebrief(gcalEvent: GoogleCalendarEvent) {
    const linkedAppEvent = (appEvents || []).find(e => e.googleCalendarEventId === gcalEvent.id);
    const details: string[] = [];
    if (gcalEvent.start) details.push(`Date: ${formatDate(gcalEvent.start)} ${formatTime(gcalEvent.start)} - ${formatTime(gcalEvent.end)}`);
    if (gcalEvent.location) details.push(`Location: ${gcalEvent.location}`);
    if (gcalEvent.attendees?.length > 0) {
      details.push(`Attendees: ${gcalEvent.attendees.map(a => a.displayName || a.email).join(", ")}`);
    }
    if (gcalEvent.description) details.push(`Notes: ${gcalEvent.description}`);

    createDebriefMutation.mutate({
      title: gcalEvent.summary || "Untitled Event",
      eventId: linkedAppEvent?.id,
      summary: details.length > 0 ? details.join("\n") : undefined,
    });
  }

  function handleLogDebriefFromApp(appEvent: AppEvent) {
    const details: string[] = [];
    if (appEvent.startTime) details.push(`Date: ${formatDate(appEvent.startTime)} ${formatTime(appEvent.startTime)} - ${formatTime(appEvent.endTime)}`);
    if (appEvent.location) details.push(`Location: ${appEvent.location}`);
    if (appEvent.description) details.push(`Notes: ${appEvent.description}`);

    createDebriefMutation.mutate({
      title: appEvent.name,
      eventId: appEvent.id,
      summary: details.length > 0 ? details.join("\n") : undefined,
    });
  }

  function handleDeleteEvent(event: AppEvent) {
    setDeleteTarget({ type: "app", event });
    setDeleteReason("");
    setDeleteDialogOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget || deleteTarget.type !== "app" || !deleteReason.trim()) return;
    deleteEventMutation.mutate({ id: (deleteTarget.event as AppEvent).id, reason: deleteReason.trim() });
  }

  const allEvents = useMemo(() => {
    const combined: { date: Date; type: "gcal" | "app"; gcal?: GoogleCalendarEvent; app?: AppEvent; isPast: boolean }[] = [];

    (gcalEvents || []).forEach(e => {
      const d = new Date(e.start);
      combined.push({ date: d, type: "gcal", gcal: e, isPast: new Date(e.end) < new Date() });
    });

    (appEvents || []).filter(e => !e.googleCalendarEventId).forEach(e => {
      const d = new Date(e.startTime);
      combined.push({ date: d, type: "app", app: e, isPast: new Date(e.endTime) < new Date() });
    });

    return combined;
  }, [gcalEvents, appEvents]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof allEvents>();
    allEvents.forEach(e => {
      const key = format(e.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [allEvents]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return (eventsByDate.get(key) || []).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedDate, eventsByDate]);

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

  const pastEventsNeedingDebrief = useMemo(() => {
    return allEvents.filter(e => e.isPast).length;
  }, [allEvents]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-calendar-title">
                Calendar
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                View events and log debriefs for past activities
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pastEventsNeedingDebrief > 0 && (
                <Badge variant="secondary" data-testid="badge-events-count">
                  {pastEventsNeedingDebrief} past events
                </Badge>
              )}
              <Button
                variant="outline"
                onClick={() => refetchGcal()}
                disabled={gcalLoading}
                data-testid="button-refresh-calendar"
              >
                <RefreshCw className={`w-4 h-4 ${gcalLoading ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </div>

          {gcalError && (
            <Card className="p-4 mb-6 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <CalendarX className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Google Calendar not connected</p>
                  <p className="text-xs text-muted-foreground">Showing tracked events only. Connect your calendar to see all events.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchGcal()} data-testid="button-retry-calendar">
                  Retry
                </Button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
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

                <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground" data-testid="legend-event-types">
                  {Object.entries(EVENT_TYPE_DOT_COLORS).map(([label, color]) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      {label}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    Google Cal
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-0">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {d}
                    </div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents = eventsByDate.get(key) || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = isSameDay(day, selectedDate);
                    const today = isToday(day);
                    const isPast = isBefore(day, new Date()) && !today;

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
                        {dayEvents.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 3).map((e, i) => (
                              <div
                                key={i}
                                className={`w-full h-1 rounded-full ${getEventDotColor(e)}`}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold font-display" data-testid="text-selected-date">
                {format(selectedDate, "EEEE, MMM d")}
              </h2>

              {gcalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : selectedDayEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayEvents.map((entry, idx) => {
                    if (entry.type === "gcal" && entry.gcal) {
                      const gcal = entry.gcal;
                      return (
                        <Card key={`gcal-${gcal.id}`} className="p-4" data-testid={`card-event-gcal-${gcal.id}`}>
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm text-foreground">{gcal.summary}</h4>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                <Calendar className="w-3 h-3 mr-1" />
                                GCal
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(gcal.start)} - {formatTime(gcal.end)}
                              </span>
                              {gcal.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate max-w-[120px]">{gcal.location}</span>
                                </span>
                              )}
                              {gcal.attendees?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {gcal.attendees.length}
                                </span>
                              )}
                            </div>
                            {entry.isPast && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2"
                                onClick={() => handleLogDebrief(gcal)}
                                disabled={createDebriefMutation.isPending}
                                data-testid={`button-debrief-gcal-${gcal.id}`}
                              >
                                {createDebriefMutation.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 mr-1" />
                                )}
                                Log Debrief
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    }

                    if (entry.type === "app" && entry.app) {
                      const app = entry.app;
                      return (
                        <Card key={`app-${app.id}`} className="p-4 border-violet-300/30" data-testid={`card-event-app-${app.id}`}>
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm text-foreground">{app.name}</h4>
                              <Badge variant="secondary" className={`text-xs shrink-0 ${EVENT_TYPE_BADGE_COLORS[app.type] || ""}`}>
                                {app.type}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(app.startTime)} - {formatTime(app.endTime)}
                              </span>
                              {app.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate max-w-[120px]">{app.location}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 mt-2">
                              {entry.isPast && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => handleLogDebriefFromApp(app)}
                                  disabled={createDebriefMutation.isPending}
                                  data-testid={`button-debrief-app-${app.id}`}
                                >
                                  {createDebriefMutation.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  Log Debrief
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteEvent(app)}
                                data-testid={`button-delete-event-${app.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    }

                    return null;
                  })}
                </div>
              ) : (
                <Card className="p-6">
                  <div className="text-center text-muted-foreground text-sm">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No events on this day</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Remove Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {deleteTarget?.type === "app" && (
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-sm font-medium">{(deleteTarget.event as AppEvent).name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate((deleteTarget.event as AppEvent).startTime)}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="delete-reason">Why is this event being removed?</Label>
                <Textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Event was cancelled, duplicate entry, never happened..."
                  className="resize-none"
                  rows={3}
                  data-testid="input-delete-reason"
                />
                <p className="text-xs text-muted-foreground">
                  A reason is required so we can keep accurate records.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={!deleteReason.trim() || deleteEventMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteEventMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Remove Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
