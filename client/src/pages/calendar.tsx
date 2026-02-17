import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
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
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
  Search,
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContacts } from "@/hooks/use-contacts";
import { useEventAttendance, useAddAttendance, useRemoveAttendance } from "@/hooks/use-event-attendance";
import type { Contact } from "@shared/schema";

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

const EVENT_TYPES = ["Meeting", "Mentoring Session", "External Event", "Personal Development", "Planning"] as const;

const EVENT_TYPE_DOT_COLORS: Record<string, string> = {
  "Meeting": "bg-blue-400",
  "Mentoring Session": "bg-emerald-400",
  "External Event": "bg-orange-400",
  "Personal Development": "bg-violet-400",
  "Planning": "bg-rose-400",
};

const EVENT_TYPE_BADGE_COLORS: Record<string, string> = {
  "Meeting": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Mentoring Session": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "External Event": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Personal Development": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Planning": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const GCAL_TYPE_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "Mentoring Session", keywords: ["mentor", "mentoring", "mentee", "coaching", "1:1", "one on one", "1-on-1"] },
  { type: "Planning", keywords: ["planning", "plan", "strategy", "budgeting", "budget", "roadmap", "prep", "preparation", "brainstorm"] },
  { type: "Meeting", keywords: ["meeting", "hui", "catch up", "catchup", "sync", "standup", "check-in", "collab", "collaboration"] },
  { type: "External Event", keywords: ["event", "conference", "summit", "expo", "workshop", "activation", "networking", "ecosystem"] },
  { type: "Personal Development", keywords: ["training", "development", "learning", "course", "study", "webinar", "professional development", "pd"] },
];

function classifyGcalEvent(gcal: GoogleCalendarEvent): string {
  const text = `${gcal.summary || ""} ${gcal.description || ""}`.toLowerCase();
  for (const { type, keywords } of GCAL_TYPE_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }
  return "Meeting";
}

function getEventType(e: { type: "gcal" | "app"; gcal?: GoogleCalendarEvent; app?: AppEvent }): string {
  if (e.type === "app" && e.app) return e.app.type;
  if (e.type === "gcal" && e.gcal) return classifyGcalEvent(e.gcal);
  return "Meeting";
}

function getEventDotColor(e: { type: "gcal" | "app"; gcal?: GoogleCalendarEvent; app?: AppEvent }) {
  const eventType = getEventType(e);
  return EVENT_TYPE_DOT_COLORS[eventType] || "bg-gray-400";
}

type CombinedEvent = { date: Date; type: "gcal" | "app"; gcal?: GoogleCalendarEvent; app?: AppEvent; isPast: boolean };

function EventCard({
  entry,
  appEvents,
  onLogDebrief,
  onLogDebriefFromApp,
  onDeleteEvent,
  isDebriefPending,
}: {
  entry: CombinedEvent;
  appEvents: AppEvent[];
  onLogDebrief: (gcal: GoogleCalendarEvent) => void;
  onLogDebriefFromApp: (app: AppEvent) => void;
  onDeleteEvent: (app: AppEvent) => void;
  isDebriefPending: boolean;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showNewPersonDialog, setShowNewPersonDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const { data: contacts } = useContacts();

  const createContactMutation = useMutation({
    mutationFn: async (data: { name: string; email?: string; phone?: string }) => {
      const res = await apiRequest("POST", "/api/contacts", {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        type: "mentee",
      });
      return res.json();
    },
    onSuccess: async (newContact: Contact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowNewPersonDialog(false);
      setNewPersonName("");
      setNewPersonEmail("");
      setNewPersonPhone("");
      toast({ title: "Person added", description: `${newContact.name} has been created.` });
      await handleAddContact(newContact);
    },
    onError: (err: any) => {
      toast({ title: "Failed to add person", description: err.message, variant: "destructive" });
    },
  });

  const isGcal = entry.type === "gcal" && entry.gcal;
  const isApp = entry.type === "app" && entry.app;

  const linkedAppEvent = isGcal
    ? appEvents.find(e => e.googleCalendarEventId === entry.gcal!.id)
    : entry.app;

  const appEventId = linkedAppEvent?.id;
  const eventName = isGcal ? entry.gcal!.summary : entry.app!.name;
  const eventType = linkedAppEvent?.type || (isGcal ? classifyGcalEvent(entry.gcal!) : entry.app!.type);
  const startStr = isGcal ? entry.gcal!.start : entry.app!.startTime;
  const endStr = isGcal ? entry.gcal!.end : entry.app!.endTime;
  const location = isGcal ? entry.gcal!.location : entry.app!.location;

  const { data: attendance } = useEventAttendance(appEventId);
  const addAttendance = useAddAttendance();
  const removeAttendance = useRemoveAttendance(appEventId);

  const importGcalMutation = useMutation({
    mutationFn: async (data: { gcalId: string; name: string; type: string; start: string; end: string; location?: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/events", {
        name: data.name,
        type: data.type,
        startTime: data.start,
        endTime: data.end,
        location: data.location || null,
        description: data.description || null,
        googleCalendarEventId: data.gcalId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to import event", description: err.message, variant: "destructive" });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: string }) => {
      await apiRequest("PATCH", `/api/events/${id}`, { type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update type", description: err.message, variant: "destructive" });
    },
  });

  async function ensureAppEvent(): Promise<number | undefined> {
    if (appEventId) return appEventId;
    if (!isGcal || !entry.gcal) return undefined;
    try {
      const result = await importGcalMutation.mutateAsync({
        gcalId: entry.gcal.id,
        name: entry.gcal.summary || "Untitled Event",
        type: classifyGcalEvent(entry.gcal),
        start: entry.gcal.start,
        end: entry.gcal.end,
        location: entry.gcal.location,
        description: entry.gcal.description,
      });
      return result.id;
    } catch {
      return undefined;
    }
  }

  async function handleTypeChange(newType: string) {
    if (appEventId) {
      updateTypeMutation.mutate({ id: appEventId, type: newType });
    } else {
      const id = await ensureAppEvent();
      if (id) {
        updateTypeMutation.mutate({ id, type: newType });
      }
    }
  }

  async function handleAddContact(contact: Contact) {
    let eventId = appEventId;
    if (!eventId) {
      eventId = await ensureAppEvent();
    }
    if (!eventId) return;
    addAttendance.mutate({ eventId, contactId: contact.id, role: "attendee" });
    setContactSearch("");
  }

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return [];
    const term = contactSearch.toLowerCase();
    const existingIds = new Set((attendance || []).map((a: any) => a.contactId));
    return contacts
      .filter((c: Contact) => !existingIds.has(c.id))
      .filter((c: Contact) =>
        c.name.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term))
      )
      .slice(0, 5);
  }, [contacts, contactSearch, attendance]);

  const badgeColor = EVENT_TYPE_BADGE_COLORS[eventType] || "";

  return (
    <Card className="p-4" data-testid={`card-event-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}>
      <div className="space-y-2">
        <button
          onClick={() => entry.isPast && setExpanded(!expanded)}
          className={`w-full text-left ${entry.isPast ? "cursor-pointer" : ""}`}
          data-testid={`button-expand-event-${isGcal ? entry.gcal!.id : entry.app!.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm text-foreground">{eventName}</h4>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className={`text-xs ${badgeColor}`}>
                {eventType}
              </Badge>
              {isGcal && (
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  GCal
                </Badge>
              )}
              {entry.isPast && (
                expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(startStr)} - {formatTime(endStr)}
          </span>
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{location}</span>
            </span>
          )}
          {isGcal && entry.gcal!.attendees?.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {entry.gcal!.attendees.length}
            </span>
          )}
          {attendance && attendance.length > 0 && (
            <span className="flex items-center gap-1">
              <UserPlus className="w-3 h-3" />
              {attendance.length} tagged
            </span>
          )}
        </div>

        {expanded && entry.isPast && (
          <div className="space-y-3 pt-2 border-t border-border/50 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Event Type</Label>
              <Select
                value={eventType}
                onValueChange={handleTypeChange}
                data-testid={`select-event-type-${isGcal ? entry.gcal!.id : entry.app!.id}`}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`trigger-event-type-${isGcal ? entry.gcal!.id : entry.app!.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t} value={t} data-testid={`option-type-${t.toLowerCase().replace(/\s+/g, "-")}`}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${EVENT_TYPE_DOT_COLORS[t]}`} />
                        {t}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Community Members</Label>
              {attendance && attendance.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {attendance.map((a: any) => {
                    const contact = (contacts || []).find((c: Contact) => c.id === a.contactId);
                    return (
                      <Badge key={a.id} variant="secondary" className="text-xs gap-1 pr-1">
                        {contact?.name || "Unknown"}
                        <button
                          onClick={() => removeAttendance.mutate(a.id)}
                          className="ml-0.5 hover:text-destructive transition-colors"
                          data-testid={`button-remove-member-${a.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search community members..."
                  className="h-8 text-xs pl-7"
                  data-testid={`input-search-members-${isGcal ? entry.gcal!.id : entry.app!.id}`}
                />
              </div>
              {contactSearch.trim() && (
                <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                  {filteredContacts.map((c: Contact) => (
                    <button
                      key={c.id}
                      onClick={() => handleAddContact(c)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                      data-testid={`button-add-member-${c.id}`}
                    >
                      <span>{c.name}</span>
                      <UserPlus className="w-3 h-3 text-muted-foreground" />
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setNewPersonName(contactSearch.trim());
                      setShowNewPersonDialog(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between text-primary"
                    data-testid="button-create-new-person"
                  >
                    <span>Add "{contactSearch.trim()}" as new person</span>
                    <UserPlus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <Dialog open={showNewPersonDialog} onOpenChange={setShowNewPersonDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Person</DialogTitle>
                  <DialogDescription>Create a new community member to tag on this event.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Name</Label>
                    <Input
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="Full name"
                      data-testid="input-new-person-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Email (optional)</Label>
                    <Input
                      value={newPersonEmail}
                      onChange={(e) => setNewPersonEmail(e.target.value)}
                      placeholder="email@example.com"
                      type="email"
                      data-testid="input-new-person-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Phone (optional)</Label>
                    <Input
                      value={newPersonPhone}
                      onChange={(e) => setNewPersonPhone(e.target.value)}
                      placeholder="Phone number"
                      type="tel"
                      data-testid="input-new-person-phone"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewPersonDialog(false)} data-testid="button-cancel-new-person">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createContactMutation.mutate({
                      name: newPersonName.trim(),
                      email: newPersonEmail.trim() || undefined,
                      phone: newPersonPhone.trim() || undefined,
                    })}
                    disabled={!newPersonName.trim() || createContactMutation.isPending}
                    data-testid="button-save-new-person"
                  >
                    {createContactMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Add Person
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => isGcal ? onLogDebrief(entry.gcal!) : onLogDebriefFromApp(entry.app!)}
                disabled={isDebriefPending}
                data-testid={`button-debrief-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}
              >
                {isDebriefPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <FileText className="w-3.5 h-3.5 mr-1" />
                )}
                Log Debrief
              </Button>
              {isApp && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDeleteEvent(entry.app!)}
                  data-testid={`button-delete-event-${entry.app!.id}`}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        )}

        {!expanded && entry.isPast && (
          <p className="text-xs text-muted-foreground italic">Tap to edit type, tag members, or log debrief</p>
        )}
      </div>
    </Card>
  );
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "gcal" | "app"; event: GoogleCalendarEvent | AppEvent } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set());

  function toggleTypeFilter(type: string) {
    setActiveTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

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
    const combined: CombinedEvent[] = [];

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

  const filteredEvents = useMemo(() => {
    if (activeTypeFilters.size === 0) return allEvents;
    return allEvents.filter(e => activeTypeFilters.has(getEventType(e)));
  }, [allEvents, activeTypeFilters]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CombinedEvent[]>();
    filteredEvents.forEach(e => {
      const key = format(e.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [filteredEvents]);

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
    return filteredEvents.filter(e => e.isPast).length;
  }, [filteredEvents]);

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
                Review past events, classify them, tag members, and log debriefs
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

                <div className="flex flex-wrap items-center gap-1.5 mb-3" data-testid="filter-event-types">
                  {EVENT_TYPES.map(type => {
                    const isActive = activeTypeFilters.has(type);
                    const dotColor = EVENT_TYPE_DOT_COLORS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => toggleTypeFilter(type)}
                        data-testid={`button-filter-${type.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors
                          ${isActive
                            ? "bg-primary/10 text-foreground font-medium border border-primary/30"
                            : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                          }
                        `}
                      >
                        <span className={`w-2 h-2 rounded-full ${dotColor} ${!isActive && activeTypeFilters.size > 0 ? "opacity-40" : ""}`} />
                        {type}
                      </button>
                    );
                  })}
                  {activeTypeFilters.size > 0 && (
                    <button
                      onClick={() => setActiveTypeFilters(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 transition-colors"
                      data-testid="button-clear-filters"
                    >
                      Clear
                    </button>
                  )}
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
                  {selectedDayEvents.map((entry) => (
                    <EventCard
                      key={entry.type === "gcal" ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}
                      entry={entry}
                      appEvents={appEvents || []}
                      onLogDebrief={handleLogDebrief}
                      onLogDebriefFromApp={handleLogDebriefFromApp}
                      onDeleteEvent={handleDeleteEvent}
                      isDebriefPending={createDebriefMutation.isPending}
                    />
                  ))}
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
              <DialogDescription>This action cannot be undone. Please provide a reason.</DialogDescription>
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
                {deleteEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
