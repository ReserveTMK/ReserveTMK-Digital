import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import {
  CalendarX,
  RefreshCw,
  Settings,
  CircleAlert,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { useCalendarGrid } from "@/hooks/use-calendar-grid";
import type { GoogleCalendarEvent, GoogleCalendarInfo } from "@/types/google-calendar";
import { useContacts } from "@/hooks/use-contacts";
import { useGroups } from "@/hooks/use-groups";
import { useProgrammes } from "@/hooks/use-programmes";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import type { Contact, Programme, Booking, Venue } from "@shared/schema";
import { Card } from "@/components/ui/card";
import {
  CalendarGrid,
  DayPanel,
  MonthProgrammes,
  DeleteEventDialog,
  LogActivityDialog,
  CalendarSettingsPanel,
  MonthSummaryBar,
  NeedsAttentionPanel,
  AppEvent,
  CombinedEvent,
  DebriefInfo,
  SpaceOccupancyItem,
  NOT_PERSONAL_REASON,
  classifyGcalEvent,
  getEventType,
  formatDate,
  formatTime,
} from "@/components/calendar";

export default function CalendarPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const initialDate = useMemo(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get("date");
      if (dateParam) {
        const parsed = new Date(dateParam + "T00:00:00");
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return new Date();
  }, []);
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "gcal" | "app"; event: GoogleCalendarEvent | AppEvent } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showSpace, setShowSpace] = useState(true);
  const [skippedBookingIds, setSkippedBookingIds] = useState<Set<number>>(new Set());
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [activityType, setActivityType] = useState("Hub Activity");
  const [activityDate, setActivityDate] = useState("");
  const [activityPurpose, setActivityPurpose] = useState("");
  const [activityOutcome, setActivityOutcome] = useState("");
  const [activityContactSearch, setActivityContactSearch] = useState("");
  const [activitySelectedContacts, setActivitySelectedContacts] = useState<Contact[]>([]);
  const [activityGroupSearch, setActivityGroupSearch] = useState("");
  const [activitySelectedGroups, setActivitySelectedGroups] = useState<{ id: number; name: string }[]>([]);
  const [dailyFootTrafficValue, setDailyFootTrafficValue] = useState("");
  const [showNeedsAttention, setShowNeedsAttention] = useState(false);
  const [dailyFTSaving, setDailyFTSaving] = useState(false);
  const [attendeeNudgeEventId, setAttendeeNudgeEventId] = useState<number | null>(null);
  const [attendeeNudgeEventName, setAttendeeNudgeEventName] = useState<string>("");
  const [attendeeNudgeValue, setAttendeeNudgeValue] = useState<string>("");
  const [orgLinkEventId, setOrgLinkEventId] = useState<number | null>(null);
  const [orgLinkEventName, setOrgLinkEventName] = useState<string>("");
  const [orgLinkSearch, setOrgLinkSearch] = useState<string>("");
  const [orgLinkDismissed, setOrgLinkDismissed] = useState(false);
  const isMobile = useIsMobile();
  const dayPanelRef = useRef<HTMLDivElement>(null);

  const handleSelectDate = useCallback((day: Date) => {
    setSelectedDate(day);
    if (isMobile && dayPanelRef.current) {
      setTimeout(() => {
        dayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [isMobile]);

  // ---- Data queries ----

  const { data: gcalEvents, isLoading: gcalLoading, error: gcalError, refetch: refetchGcal } = useQuery<GoogleCalendarEvent[]>({
    queryKey: ["/api/google-calendar/events"],
  });

  const { data: calendarHealth } = useQuery<{ connected: boolean; hasRefreshToken: boolean; tokenExpired: boolean; expiresAt: string | null }>({
    queryKey: ["/api/google-calendar/health"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: appEvents } = useQuery<AppEvent[]>({
    queryKey: ["/api/events"],
    staleTime: 0,
  });

  const { data: dismissedEvents } = useQuery<{ id: number; gcalEventId: string; reason: string }[]>({
    queryKey: ["/api/dismissed-calendar-events"],
  });

  const { data: calendarSettings } = useQuery<{ id: number; calendarId: string; label: string; active: boolean; autoImport: boolean }[]>({
    queryKey: ["/api/calendar-settings"],
  });

  const { data: availableCalendars, isLoading: calendarsListLoading } = useQuery<GoogleCalendarInfo[]>({
    queryKey: ["/api/google-calendar/list"],
    enabled: showSettings,
  });

  const { data: programmes } = useProgrammes();
  const { data: allBookings } = useBookings();
  const { data: venues } = useVenues();
  const { data: allContacts } = useContacts();
  const { data: allGroups } = useGroups();

  const { data: impactLogs } = useQuery<{ id: number; eventId: number | null; status: string }[]>({
    queryKey: ["/api/impact-logs"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: monthlySnapshots } = useQuery<any[]>({
    queryKey: ["/api/monthly-snapshots"],
  });

  // ---- Debrief maps ----

  const debriefByEventId = useMemo(() => {
    const map = new Map<number, DebriefInfo>();
    if (!impactLogs) return map;
    for (const log of impactLogs) {
      if (!log.eventId) continue;
      const existing = map.get(log.eventId);
      if (!existing || log.status === "confirmed" || (log.status === "draft" && existing.status !== "confirmed")) {
        map.set(log.eventId, { debriefId: log.id, status: log.status });
      }
    }
    return map;
  }, [impactLogs]);

  const debriefByGcalId = useMemo(() => {
    const map = new Map<string, DebriefInfo>();
    if (appEvents && debriefByEventId.size) {
      for (const event of appEvents) {
        if (event.googleCalendarEventId && debriefByEventId.has(event.id)) {
          map.set(event.googleCalendarEventId, debriefByEventId.get(event.id)!);
        }
      }
    }
    return map;
  }, [appEvents, debriefByEventId]);

  function getDebriefInfo(entry: CombinedEvent): DebriefInfo {
    if (entry.type === "app" && entry.app) {
      return debriefByEventId.get(entry.app.id) || null;
    }
    if (entry.type === "gcal" && entry.gcal) {
      return debriefByGcalId.get(entry.gcal.id) || null;
    }
    return null;
  }

  const debriefByBookingId = useMemo(() => {
    const map = new Map<number, "none" | "draft" | "confirmed">();
    if (!appEvents || !impactLogs) return map;
    for (const event of appEvents) {
      if (!event.linkedBookingId) continue;
      const debrief = debriefByEventId.get(event.id);
      if (debrief) {
        map.set(Number(event.linkedBookingId), debrief.status as "draft" | "confirmed");
      }
    }
    return map;
  }, [appEvents, impactLogs, debriefByEventId]);

  function getBookingDebriefStatus(bookingId: number): "none" | "draft" | "confirmed" {
    return debriefByBookingId.get(Number(bookingId)) || "none";
  }

  function eventNeedsAttention(e: CombinedEvent): boolean {
    if (!e.isPast) return false;
    if (e.type === "booking") return false;
    if (e.type === "app" && e.app?.source === "internal") return false;
    const info = getDebriefInfo(e);
    const missingDebrief = !info || info.status !== "confirmed";
    const missingAttendance = e.type === "app" && e.app && e.app.attendeeCount === null;
    return missingDebrief || !!missingAttendance;
  }

  // ---- Programme metrics ----

  const monthProgrammes = useMemo(() => {
    if (!programmes) return [];
    const viewMonth = currentMonth.getMonth();
    const viewYear = currentMonth.getFullYear();
    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return programmes.filter((p: Programme) => {
      if (p.tbcMonth && p.tbcYear) {
        const tbcMonthIdx = MONTH_NAMES.indexOf(p.tbcMonth);
        return tbcMonthIdx === viewMonth && parseInt(p.tbcYear) === viewYear;
      }
      if (p.startDate) {
        const start = new Date(p.startDate);
        if (start.getMonth() === viewMonth && start.getFullYear() === viewYear) return true;
        if (p.endDate) {
          const end = new Date(p.endDate);
          const monthStart = new Date(viewYear, viewMonth, 1);
          const monthEnd = new Date(viewYear, viewMonth + 1, 0);
          return start <= monthEnd && end >= monthStart;
        }
      }
      return false;
    });
  }, [programmes, currentMonth]);

  const programmeTargetCount = useMemo(() => {
    return monthProgrammes.filter((p: Programme) => p.status !== "cancelled").length;
  }, [monthProgrammes]);

  // ---- Dismissed / not-personal sets ----

  const dismissedIds = useMemo(() => new Set(
    (dismissedEvents || []).filter(d => d.reason !== NOT_PERSONAL_REASON).map(d => d.gcalEventId)
  ), [dismissedEvents]);

  const notPersonalIds = useMemo(() => new Set(
    (dismissedEvents || []).filter(d => d.reason === NOT_PERSONAL_REASON).map(d => d.gcalEventId)
  ), [dismissedEvents]);

  // ---- Mutations ----

  const dismissMutation = useMutation({
    mutationFn: async ({ gcalEventId, reason }: { gcalEventId: string; reason: string }) => {
      await apiRequest("POST", "/api/dismissed-calendar-events", { gcalEventId, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-calendar-events"] });
      toast({ title: "Event archived" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to archive event", description: err.message, variant: "destructive" });
    },
  });

  const markNotPersonalMutation = useMutation({
    mutationFn: async (gcalEventId: string) => {
      await apiRequest("POST", "/api/dismissed-calendar-events", { gcalEventId, reason: NOT_PERSONAL_REASON });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-calendar-events"] });
      toast({ title: "Marked as not personal" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/dismissed-calendar-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-calendar-events"] });
      toast({ title: "Event restored" });
    },
  });

  const toggleCalendarMutation = useMutation({
    mutationFn: async ({ calendarId, label, enabled }: { calendarId: string; label: string; enabled: boolean }) => {
      if (enabled) {
        await apiRequest("POST", "/api/calendar-settings", { calendarId, label });
      } else {
        const setting = (calendarSettings || []).find(s => s.calendarId === calendarId);
        if (setting) {
          await apiRequest("DELETE", `/api/calendar-settings/${setting.id}`);
        }
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
      toast({ title: variables.enabled ? "Calendar enabled" : "Calendar disabled" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update calendar", description: err.message, variant: "destructive" });
    },
  });

  const toggleAutoImportMutation = useMutation({
    mutationFn: async ({ settingId, autoImport }: { settingId: number; autoImport: boolean }) => {
      await apiRequest("PATCH", `/api/calendar-settings/${settingId}`, { autoImport });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-settings"] });
      toast({ title: variables.autoImport ? "Auto-import enabled" : "Auto-import disabled" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; date: string; description: string; contacts: Contact[]; groups: { id: number; name: string }[] }) => {
      const dayStart = new Date(data.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(data.date);
      dayEnd.setHours(23, 59, 59, 999);
      const tags = data.groups.map(g => g.name);
      const res = await apiRequest("POST", "/api/events", {
        name: data.name,
        type: data.type,
        startTime: dayStart.toISOString(),
        endTime: dayEnd.toISOString(),
        source: "internal",
        requiresDebrief: true,
        description: data.description || null,
        tags: tags.length > 0 ? tags : null,
        attendeeCount: data.contacts.length || null,
      });
      const event = await res.json();
      if (data.contacts.length > 0) {
        await Promise.all(data.contacts.map(contact =>
          apiRequest("POST", "/api/event-attendance", {
            eventId: event.id,
            contactId: contact.id,
            role: "attendee",
          })
        ));
      }
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Activity logged", description: "Your activity has been recorded on the calendar." });
      setLogActivityOpen(false);
      resetActivityForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to log activity", description: err.message, variant: "destructive" });
    },
  });

  function resetActivityForm() {
    setActivityName("");
    setActivityType("Hub Activity");
    setActivityDate("");
    setActivityPurpose("");
    setActivityOutcome("");
    setActivityContactSearch("");
    setActivitySelectedContacts([]);
    setActivityGroupSearch("");
    setActivitySelectedGroups([]);
  }

  function openLogActivity() {
    setActivityDate(format(selectedDate, "yyyy-MM-dd"));
    setLogActivityOpen(true);
  }

  function handleLogActivity() {
    if (!activityName.trim()) return;
    const descriptionParts: string[] = [];
    if (activityPurpose.trim()) descriptionParts.push(`Purpose: ${activityPurpose.trim()}`);
    if (activityOutcome.trim()) descriptionParts.push(`Outcome: ${activityOutcome.trim()}`);
    logActivityMutation.mutate({
      name: activityName.trim(),
      type: activityType,
      date: activityDate || format(new Date(), "yyyy-MM-dd"),
      description: descriptionParts.join("\n\n"),
      contacts: activitySelectedContacts,
      groups: activitySelectedGroups,
    });
  }

  const filteredActivityContacts = useMemo(() => {
    if (!allContacts || !activityContactSearch.trim()) return [];
    const term = activityContactSearch.toLowerCase();
    const selectedIds = new Set(activitySelectedContacts.map(c => c.id));
    return (allContacts as Contact[])
      .filter(c => !selectedIds.has(c.id))
      .filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term))
      )
      .slice(0, 5);
  }, [allContacts, activityContactSearch, activitySelectedContacts]);

  const filteredActivityGroups = useMemo(() => {
    if (!allGroups || !activityGroupSearch.trim()) return [];
    const term = activityGroupSearch.toLowerCase();
    const selectedIds = new Set(activitySelectedGroups.map(g => g.id));
    return (allGroups as { id: number; name: string }[])
      .filter(g => !selectedIds.has(g.id))
      .filter(g => g.name.toLowerCase().includes(term))
      .slice(0, 5);
  }, [allGroups, activityGroupSearch, activitySelectedGroups]);

  function handleDismissEvent(gcalEventId: string, reason: string) {
    dismissMutation.mutate({ gcalEventId, reason });
  }

  const createDebriefMutation = useMutation({
    mutationFn: async (data: { title: string; eventId?: number; gcalEventId?: string; summary?: string; _linkedAppEvent?: AppEvent | null; _linkedTags?: string[] }) => {
      const res = await apiRequest("POST", "/api/impact-logs", {
        title: data.title,
        status: "draft",
        eventId: data.eventId || null,
        gcalEventId: data.gcalEventId || null,
        summary: data.summary || null,
      });
      return res.json();
    },
    onSuccess: (log: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      const linkedEv: AppEvent | null | undefined = variables._linkedAppEvent;
      if (linkedEv && linkedEv.attendeeCount === null) {
        setAttendeeNudgeEventId(linkedEv.id);
        setAttendeeNudgeEventName(linkedEv.name);
        setAttendeeNudgeValue("");
      }
      const tags: string[] = variables._linkedTags || [];
      if (linkedEv && tags.length === 0) {
        setOrgLinkEventId(linkedEv.id);
        setOrgLinkEventName(linkedEv.name);
        setOrgLinkSearch("");
        setOrgLinkDismissed(false);
      }
      toast({ title: "Debrief created", description: "You can now record or type your notes." });
      const dateParam = format(selectedDate, "yyyy-MM-dd");
      navigate(`/debriefs/${log.id}?from=calendar&date=${dateParam}`);
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
      gcalEventId: gcalEvent.id,
      summary: details.length > 0 ? details.join("\n") : undefined,
      _linkedAppEvent: linkedAppEvent || null,
      _linkedTags: linkedAppEvent?.tags || [],
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
      _linkedAppEvent: appEvent,
      _linkedTags: appEvent.tags || [],
    });
  }

  function handleLogDebriefFromBooking(booking: Booking) {
    const details: string[] = [];
    if (booking.startDate) details.push(`Date: ${formatDate(new Date(booking.startDate).toISOString())}${booking.startTime ? ` ${booking.startTime}` : ""}${booking.endTime ? ` - ${booking.endTime}` : ""}`);
    const bookingVIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
    const vName = bookingVIds.map((id: number) => venueMap[id]).filter(Boolean).join(" + ");
    if (vName) details.push(`Venue: ${vName}`);
    if (booking.bookerName) details.push(`Booker: ${booking.bookerName}`);
    if (booking.attendeeCount) details.push(`Attendees: ${booking.attendeeCount}`);

    const linkedEvent = (appEvents || []).find(e => Number(e.linkedBookingId) === Number(booking.id));

    createDebriefMutation.mutate({
      title: (booking as any).displayName || booking.title || booking.bookerName || booking.classification || "Venue Hire",
      eventId: linkedEvent?.id,
      summary: details.length > 0 ? details.join("\n") : undefined,
      _linkedAppEvent: linkedEvent || null,
      _linkedTags: linkedEvent?.tags || [],
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

  // ---- Combined events memo ----

  const allEvents = useMemo(() => {
    const combined: CombinedEvent[] = [];

    const importedGcalIds = new Set([
      ...(appEvents || [])
        .filter(e => e.googleCalendarEventId)
        .map(e => e.googleCalendarEventId),
      ...(allBookings || [])
        .filter((b: Booking) => b.googleCalendarEventId)
        .map((b: Booking) => b.googleCalendarEventId),
    ]);

    const internalEventKeys = new Set(
      (appEvents || [])
        .filter(e => !e.googleCalendarEventId)
        .map(e => {
          const d = new Date(e.startTime);
          return `${(e.name || "").trim().toLowerCase()}|${d.toDateString()}`;
        })
    );

    (gcalEvents || []).forEach(e => {
      if (importedGcalIds.has(e.id)) return;
      const gcalKey = `${(e.summary || "").trim().toLowerCase()}|${new Date(e.start).toDateString()}`;
      if (internalEventKeys.has(gcalKey)) return;
      const d = new Date(e.start);
      const isDismissed = dismissedIds.has(e.id);
      combined.push({ date: d, type: "gcal", gcal: e, isPast: new Date(e.end) < new Date(), isDismissed });
    });

    (appEvents || []).forEach(e => {
      const d = new Date(e.startTime);
      combined.push({ date: d, type: "app", app: e, isPast: new Date(e.endTime) < new Date() });
    });

    const linkedBookingIds = new Set(
      (appEvents || []).filter(e => e.linkedBookingId).map(e => Number(e.linkedBookingId))
    );
    (allBookings || []).forEach((b: Booking) => {
      if (b.status !== "confirmed" && b.status !== "completed") return;
      if (linkedBookingIds.has(Number(b.id))) return;
      if (!b.startDate) return;
      const d = new Date(b.startDate);
      let endMoment: Date;
      if (b.endDate) {
        endMoment = new Date(b.endDate);
      } else {
        endMoment = new Date(d);
      }
      if (b.endTime) {
        const [h, m] = b.endTime.split(":").map(Number);
        endMoment.setHours(h, m, 59);
      } else {
        endMoment.setHours(23, 59, 59);
      }
      combined.push({ date: d, type: "booking", booking: b, isPast: endMoment < new Date() });
    });

    return combined;
  }, [gcalEvents, appEvents, dismissedIds, allBookings]);

  const filteredEvents = useMemo(() => {
    let events = allEvents.filter(e => !e.isDismissed);
    if (activeTypeFilters.size > 0) {
      events = events.filter(e => activeTypeFilters.has(getEventType(e)));
    }
    if (showNeedsAttention) {
      events = events.filter(e => eventNeedsAttention(e));
    }
    return events;
  }, [allEvents, activeTypeFilters, showNeedsAttention, debriefByEventId, debriefByGcalId]);

  // ---- Foot traffic ----

  const currentMonthKey = format(startOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: dailyFootTrafficData } = useQuery<any[]>({
    queryKey: ["/api/daily-foot-traffic", currentMonthKey],
    queryFn: async () => {
      const r = await fetch(`/api/daily-foot-traffic?month=${currentMonthKey}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch foot traffic");
      return r.json();
    },
  });

  const monthlyFootTrafficTotal = useMemo(() => {
    if (!Array.isArray(dailyFootTrafficData) || dailyFootTrafficData.length === 0) return 0;
    return dailyFootTrafficData.reduce((sum: number, entry: any) => sum + (entry.count || 0), 0);
  }, [dailyFootTrafficData]);

  const selectedDayFootTraffic = useMemo(() => {
    if (!Array.isArray(dailyFootTrafficData)) return null;
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return dailyFootTrafficData.find((entry: any) => {
      const entryDate = new Date(entry.date);
      return format(entryDate, "yyyy-MM-dd") === dateKey;
    }) || null;
  }, [dailyFootTrafficData, selectedDate]);

  useEffect(() => {
    if (selectedDayFootTraffic) {
      setDailyFootTrafficValue(String(selectedDayFootTraffic.count));
    } else {
      setDailyFootTrafficValue("");
    }
  }, [selectedDayFootTraffic]);

  // ---- Month event counts ----

  const monthEventCount = useMemo(() => {
    const mStart = startOfMonth(currentMonth);
    const mEnd = endOfMonth(currentMonth);
    let count = 0;
    const monthLinkedBookingIds = new Set(
      (appEvents || []).filter(e => e.linkedBookingId).map(e => Number(e.linkedBookingId))
    );
    if (appEvents) {
      for (const e of appEvents) {
        const d = new Date(e.startTime);
        if (d >= mStart && d <= mEnd) count++;
      }
    }
    if (allBookings) {
      for (const b of allBookings as Booking[]) {
        if (b.status !== "confirmed" && b.status !== "completed") continue;
        if (monthLinkedBookingIds.has(Number(b.id))) continue;
        if (!b.startDate) continue;
        const d = new Date(b.startDate);
        if (d >= mStart && d <= mEnd) count++;
      }
    }
    return count;
  }, [appEvents, allBookings, currentMonth]);

  const monthDebriefedCount = useMemo(() => {
    if (!appEvents || !impactLogs) return 0;
    const mStart = startOfMonth(currentMonth);
    const mEnd = endOfMonth(currentMonth);
    let count = 0;
    for (const event of appEvents) {
      const eventDate = new Date(event.startTime);
      if (eventDate >= mStart && eventDate <= mEnd && debriefByEventId.has(event.id)) {
        count++;
      }
    }
    return count;
  }, [appEvents, impactLogs, currentMonth, debriefByEventId]);

  const handleSaveDailyFootTraffic = async () => {
    setDailyFTSaving(true);
    try {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      await apiRequest("POST", "/api/daily-foot-traffic", {
        date: dateKey,
        count: parseInt(dailyFootTrafficValue) || 0,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-foot-traffic"] });
      toast({ title: "Saved", description: `Foot traffic for ${format(selectedDate, "MMM d")} updated` });
    } catch {
      toast({ title: "Error", description: "Failed to save foot traffic", variant: "destructive" });
    } finally {
      setDailyFTSaving(false);
    }
  };

  // ---- Date-indexed maps ----

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CombinedEvent[]>();
    filteredEvents.forEach(e => {
      const key = format(e.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [filteredEvents]);

  const footTrafficByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (Array.isArray(dailyFootTrafficData)) {
      dailyFootTrafficData.forEach((entry: any) => {
        if (entry.count > 0) {
          const key = format(new Date(entry.date), "yyyy-MM-dd");
          map.set(key, entry.count);
        }
      });
    }
    return map;
  }, [dailyFootTrafficData]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return (eventsByDate.get(key) || []).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedDate, eventsByDate]);

  const calendarDays = useCalendarGrid(currentMonth);

  const pastEventsNeedingDebrief = useMemo(() => {
    return filteredEvents.filter(e => e.isPast && e.type !== "booking" && !(e.type === "app" && e.app?.source === "internal")).length;
  }, [filteredEvents]);

  const needsAttentionEvents = useMemo(() => {
    let events = allEvents.filter(e => !e.isDismissed);
    if (activeTypeFilters.size > 0) {
      events = events.filter(e => activeTypeFilters.has(getEventType(e)));
    }
    return events.filter(e => eventNeedsAttention(e));
  }, [allEvents, activeTypeFilters, debriefByEventId, debriefByGcalId]);

  const needsAttentionByDate = useMemo(() => {
    const map = new Map<string, number>();
    needsAttentionEvents.forEach(e => {
      const key = format(e.date, "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [needsAttentionEvents]);

  // ---- Venue + space maps ----

  const venueMap = useMemo(() => {
    const map: Record<number, string> = {};
    (venues || []).forEach((v: Venue) => { map[v.id] = v.name; });
    return map;
  }, [venues]);

  const spaceItems = useMemo<SpaceOccupancyItem[]>(() => {
    const items: SpaceOccupancyItem[] = [];
    (allBookings || []).forEach((b: Booking) => {
      if (b.status === "cancelled") return;
      const sDate = b.startDate ? new Date(b.startDate) : null;
      items.push({
        kind: "booking",
        id: b.id,
        title: (b as any).displayName || b.title || b.classification || "Untitled booking",
        bookerName: b.bookerName || ((allContacts || []) as Contact[]).find(c => c.id === b.bookerId)?.name || null,
        date: sDate || new Date(b.createdAt || Date.now()),
        startDate: sDate,
        endDate: b.endDate ? new Date(b.endDate) : sDate,
        startTime: b.startTime || null,
        endTime: b.endTime || null,
        venue: (b.venueIds || (b.venueId ? [b.venueId] : [])).map((id: number) => venueMap[id]).filter(Boolean).join(" + ") || null,
        venueId: b.venueId,
        status: b.status,
        classification: b.classification,
      });
    });
    (programmes || []).forEach((p: Programme) => {
      if (p.status === "cancelled") return;
      const sDate = p.startDate ? new Date(p.startDate) : null;
      items.push({
        kind: "programme",
        id: p.id,
        title: p.name,
        bookerName: null,
        date: sDate || new Date(p.createdAt || Date.now()),
        startDate: sDate,
        endDate: p.endDate ? new Date(p.endDate) : sDate,
        startTime: p.startTime || null,
        endTime: p.endTime || null,
        venue: p.location || null,
        venueId: null,
        status: p.status,
        classification: p.classification,
      });
    });
    return items;
  }, [allBookings, programmes, venueMap, allContacts]);

  const spaceByDate = useMemo(() => {
    const map = new Map<string, SpaceOccupancyItem[]>();
    spaceItems.forEach(item => {
      if (!item.startDate) return;
      const start = new Date(item.startDate);
      const end = item.endDate ? new Date(item.endDate) : start;
      let d = new Date(start);
      while (d <= end) {
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
        d = new Date(d);
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [spaceItems]);

  const selectedDaySpace = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return (spaceByDate.get(key) || []).sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      return a.date.getTime() - b.date.getTime();
    });
  }, [selectedDate, spaceByDate]);

  // ---- Render ----

  return (
    <div className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-calendar-title">
              Calendar
            </h1>

          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {calendarHealth && !calendarHealth.connected && (
              <Badge variant="destructive" className="text-xs">
                Google Calendar disconnected
              </Badge>
            )}
            {calendarHealth && calendarHealth.connected && calendarHealth.tokenExpired && (
              <Badge variant="destructive" className="text-xs">
                Google Calendar token expired — reconnect in Settings
              </Badge>
            )}
            {showSchedule && needsAttentionEvents.length > 0 && (
              <Button
                size="sm"
                variant={showNeedsAttention ? "default" : "outline"}
                className={`toggle-elevate ${showNeedsAttention ? "toggle-elevated bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : "border-amber-400/50 text-amber-700 dark:text-amber-300"}`}
                onClick={() => setShowNeedsAttention(!showNeedsAttention)}
                data-testid="button-toggle-needs-attention"
              >
                <CircleAlert className="w-4 h-4 mr-1" />
                {needsAttentionEvents.length} need attention
              </Button>
            )}
            {showSchedule && pastEventsNeedingDebrief > 0 && !showNeedsAttention && (
              <Badge variant="secondary" data-testid="badge-events-count">
                {pastEventsNeedingDebrief} past events
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-calendar-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
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

        {gcalError && showSchedule && (
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

        <CalendarSettingsPanel
          showSettings={showSettings}
          onClose={() => setShowSettings(false)}
          availableCalendars={availableCalendars}
          calendarsListLoading={calendarsListLoading}
          calendarSettings={calendarSettings}
          onToggleCalendar={(calendarId, label, enabled) => toggleCalendarMutation.mutate({ calendarId, label, enabled })}
          onToggleAutoImport={(settingId, autoImport) => toggleAutoImportMutation.mutate({ settingId, autoImport })}
          isTogglePending={toggleCalendarMutation.isPending}
        />

        <MonthSummaryBar
          currentMonth={currentMonth}
          monthEventCount={monthEventCount}
          monthDebriefedCount={monthDebriefedCount}
          monthlyFootTrafficTotal={monthlyFootTrafficTotal}
        />

        {showNeedsAttention && (
          <NeedsAttentionPanel
            needsAttentionEvents={needsAttentionEvents}
            onClose={() => setShowNeedsAttention(false)}
            onSelectDate={handleSelectDate}
            getDebriefInfo={getDebriefInfo}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CalendarGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              calendarDays={calendarDays}
              eventsByDate={eventsByDate}
              spaceByDate={spaceByDate}
              footTrafficByDate={footTrafficByDate}
              needsAttentionByDate={needsAttentionByDate}
              showSchedule={showSchedule}
              showSpace={showSpace}
              onSelectDate={handleSelectDate}
              onPrevMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
              onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
              onToday={() => { setCurrentMonth(new Date()); handleSelectDate(new Date()); }}
              getDebriefInfo={getDebriefInfo}
            />
          </div>

          <DayPanel
            selectedDate={selectedDate}
            selectedDayEvents={selectedDayEvents}
            selectedDaySpace={selectedDaySpace}
            showSchedule={showSchedule}
            showSpace={showSpace}
            gcalLoading={gcalLoading}
            dayPanelRef={dayPanelRef as React.RefObject<HTMLDivElement>}
            dailyFootTrafficValue={dailyFootTrafficValue}
            onFootTrafficChange={setDailyFootTrafficValue}
            onSaveFootTraffic={handleSaveDailyFootTraffic}
            dailyFTSaving={dailyFTSaving}
            onLogActivity={openLogActivity}
            appEvents={appEvents || []}
            programmes={programmes || []}
            venues={(venues || []) as Venue[]}
            allBookings={(allBookings || []) as Booking[]}
            allContacts={(allContacts || []) as Contact[]}
            venueMap={venueMap}
            dismissedEvents={dismissedEvents || []}
            notPersonalIds={notPersonalIds}
            onLogDebrief={handleLogDebrief}
            onLogDebriefFromApp={handleLogDebriefFromApp}
            onDeleteEvent={handleDeleteEvent}
            onDismissEvent={handleDismissEvent}
            onSkipDebrief={async (eventId, reason) => {
              await apiRequest("POST", `/api/events/${eventId}/skip-debrief`, { reason });
              queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
              queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            }}
            onMarkNotPersonal={(gcalId) => markNotPersonalMutation.mutate(gcalId)}
            isDismissPending={dismissMutation.isPending}
            isDebriefPending={createDebriefMutation.isPending}
            getDebriefInfo={getDebriefInfo}
            onViewDebrief={(debriefId) => {
              const dateParam = format(selectedDate, "yyyy-MM-dd");
              navigate(`/debriefs/${debriefId}?from=calendar&date=${dateParam}`);
            }}
            onRestore={(id) => restoreMutation.mutate(id)}
            onNavigate={navigate}
          />
        </div>

        {showSchedule && (
          <MonthProgrammes
            monthProgrammes={monthProgrammes}
            programmeTargetCount={programmeTargetCount}
            onNavigate={navigate}
          />
        )}


      </div>
      <DeleteEventDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteTarget={deleteTarget}
        deleteReason={deleteReason}
        onReasonChange={setDeleteReason}
        onConfirm={confirmDelete}
        isPending={deleteEventMutation.isPending}
      />
      <LogActivityDialog
        open={logActivityOpen}
        onOpenChange={(open) => { setLogActivityOpen(open); if (!open) resetActivityForm(); }}
        activityName={activityName}
        onActivityNameChange={setActivityName}
        activityType={activityType}
        onActivityTypeChange={setActivityType}
        activityDate={activityDate}
        onActivityDateChange={setActivityDate}
        activityPurpose={activityPurpose}
        onActivityPurposeChange={setActivityPurpose}
        activityOutcome={activityOutcome}
        onActivityOutcomeChange={setActivityOutcome}
        activityContactSearch={activityContactSearch}
        onActivityContactSearchChange={setActivityContactSearch}
        activitySelectedContacts={activitySelectedContacts}
        onRemoveContact={(id) => setActivitySelectedContacts(prev => prev.filter(p => p.id !== id))}
        filteredActivityContacts={filteredActivityContacts}
        onSelectContact={(c) => { setActivitySelectedContacts(prev => [...prev, c]); setActivityContactSearch(""); }}
        activityGroupSearch={activityGroupSearch}
        onActivityGroupSearchChange={setActivityGroupSearch}
        activitySelectedGroups={activitySelectedGroups}
        onRemoveGroup={(id) => setActivitySelectedGroups(prev => prev.filter(p => p.id !== id))}
        filteredActivityGroups={filteredActivityGroups}
        onSelectGroup={(g) => { setActivitySelectedGroups(prev => [...prev, { id: g.id, name: g.name }]); setActivityGroupSearch(""); }}
        onSave={handleLogActivity}
        onCancel={() => { setLogActivityOpen(false); resetActivityForm(); }}
        isPending={logActivityMutation.isPending}
      />

      {/* Attendee count nudge toast */}
      {attendeeNudgeEventId && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-2 max-w-sm w-full mx-2">
          <span className="text-xs text-muted-foreground flex-1">Add attendee count for <span className="font-medium text-foreground">{attendeeNudgeEventName}</span>?</span>
          <Input
            type="number"
            min="0"
            value={attendeeNudgeValue}
            onChange={(e) => setAttendeeNudgeValue(e.target.value)}
            placeholder="0"
            className="h-7 w-16 text-xs"
          />
          <Button
            size="sm"
            className="h-7 text-xs px-2"
            disabled={!attendeeNudgeValue}
            onClick={async () => {
              try {
                await apiRequest("PATCH", `/api/events/${attendeeNudgeEventId}`, { attendeeCount: parseInt(attendeeNudgeValue, 10) });
                queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                setAttendeeNudgeEventId(null);
              } catch {}
            }}
          >Save</Button>
          <button className="text-muted-foreground hover:text-foreground ml-1" onClick={() => setAttendeeNudgeEventId(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Org linking prompt */}
      {orgLinkEventId && !orgLinkDismissed && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-3 space-y-2 w-64">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Link an organisation to this event?</span>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setOrgLinkDismissed(true)}><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[10px] text-muted-foreground">{orgLinkEventName}</p>
          <Input
            value={orgLinkSearch}
            onChange={(e) => setOrgLinkSearch(e.target.value)}
            placeholder="Search organisations..."
            className="h-7 text-xs"
          />
          {orgLinkSearch.trim() && (
            <div className="border border-border rounded-md divide-y divide-border/50 max-h-[120px] overflow-y-auto">
              {(allGroups as { id: number; name: string }[] || [])
                .filter(g => g.name.toLowerCase().includes(orgLinkSearch.toLowerCase()))
                .slice(0, 6)
                .map(g => (
                  <button
                    key={g.id}
                    onClick={async () => {
                      try {
                        const evRes = await apiRequest("GET", `/api/events/${orgLinkEventId}`);
                        const ev = await evRes.json();
                        const existingTags: string[] = ev.tags || [];
                        if (!existingTags.includes(g.name)) {
                          await apiRequest("PATCH", `/api/events/${orgLinkEventId}`, { tags: [...existingTags, g.name] });
                        }
                        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                        setOrgLinkDismissed(true);
                      } catch {}
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                  >{g.name}</button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
