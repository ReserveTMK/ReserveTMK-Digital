import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
  EyeOff,
  Eye,
  Settings,
  AlertTriangle,
  Building2,
  CalendarDays,
  Link2,
  ArrowRightLeft,
  User,
  CheckCircle2,
  CircleDashed,
  Plus,
  Footprints,
  Save,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContacts } from "@/hooks/use-contacts";
import { useEventAttendance, useAddAttendance, useRemoveAttendance } from "@/hooks/use-event-attendance";
import { useGroups } from "@/hooks/use-groups";
import { useProgrammes } from "@/hooks/use-programmes";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import type { Contact, Programme, Booking, Venue } from "@shared/schema";

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

interface GoogleCalendarInfo {
  id: string;
  summary: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  primary: boolean;
  accessRole: string;
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
  linkedProgrammeId: number | null;
  linkedBookingId: number | null;
  source: string | null;
  requiresDebrief: boolean | null;
  eventStatus: string | null;
  debriefSkippedReason: string | null;
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

const EVENT_TYPES = ["Meeting", "Mentoring Session", "External Event", "Personal Development", "Planning", "Programme"] as const;

const EVENT_TYPE_DOT_COLORS: Record<string, string> = {
  "Meeting": "bg-teal-400",
  "Mentoring Session": "bg-blue-400",
  "External Event": "bg-orange-400",
  "Personal Development": "bg-violet-400",
  "Planning": "bg-rose-400",
  "Programme": "bg-indigo-400",
  "Venue Hire": "bg-amber-400",
};

const EVENT_TYPE_BADGE_COLORS: Record<string, string> = {
  "Meeting": "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "Mentoring Session": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "External Event": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Personal Development": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Planning": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "Programme": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Venue Hire": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const EVENT_TYPE_CARD_TINTS: Record<string, string> = {
  "Meeting": "border-teal-500/20 bg-teal-500/5 dark:bg-teal-500/5",
  "Mentoring Session": "border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/5",
  "External Event": "border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/5",
  "Personal Development": "border-violet-500/20 bg-violet-500/5 dark:bg-violet-500/5",
  "Planning": "border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/5",
  "Programme": "border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/5",
};

const PROG_CLASSIFICATION_COLORS: Record<string, string> = {
  "Community Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/15 text-green-700 dark:text-green-300",
};

const PROG_STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-50/50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
  active: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  completed: "bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-900/20 opacity-70",
  cancelled: "bg-gray-100/30 dark:bg-gray-900/10 border-gray-100 dark:border-gray-900/20 opacity-70",
};

const GCAL_TYPE_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "Programme", keywords: ["programme", "program", "community workshop", "creative workshop", "youth workshop", "talks", "activation"] },
  { type: "Mentoring Session", keywords: ["mentor", "mentoring", "mentee", "coaching", "1:1", "one on one", "1-on-1"] },
  { type: "Planning", keywords: ["planning", "plan", "strategy", "budgeting", "budget", "roadmap", "prep", "preparation", "brainstorm"] },
  { type: "Meeting", keywords: ["meeting", "hui", "catch up", "catchup", "sync", "standup", "check-in", "collab", "collaboration"] },
  { type: "External Event", keywords: ["event", "conference", "summit", "expo", "workshop", "networking", "ecosystem"] },
  { type: "Personal Development", keywords: ["training", "development", "learning", "course", "study", "webinar", "professional development", "pd"] },
];

const PERSONAL_EVENT_KEYWORDS = [
  "haircut", "barber", "dentist", "doctor", "gym", "workout", "physio",
  "optometrist", "vet", "grooming", "massage", "therapy", "appointment",
  "pickup", "drop off", "school run", "flight", "personal",
];

function isPersonalEvent(title: string, description?: string): boolean {
  const text = `${title} ${description || ""}`.toLowerCase();
  return PERSONAL_EVENT_KEYWORDS.some(kw => text.includes(kw));
}

function classifyGcalEvent(gcal: GoogleCalendarEvent): string {
  const text = `${gcal.summary || ""} ${gcal.description || ""}`.toLowerCase();
  for (const { type, keywords } of GCAL_TYPE_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }
  return "Meeting";
}

type CombinedEvent = { date: Date; type: "gcal" | "app" | "booking"; gcal?: GoogleCalendarEvent; app?: AppEvent; booking?: Booking; isPast: boolean; isDismissed?: boolean };

function getEventType(e: CombinedEvent): string {
  if (e.type === "booking" && e.booking) return "Venue Hire";
  if (e.type === "app" && e.app) return e.app.type;
  if (e.type === "gcal" && e.gcal) return classifyGcalEvent(e.gcal);
  return "Meeting";
}

function getEventDotColor(e: CombinedEvent) {
  const eventType = getEventType(e);
  return EVENT_TYPE_DOT_COLORS[eventType] || "bg-gray-400";
}

type DebriefInfo = { debriefId: number; status: string } | null;

const BOOKING_BADGE_COLORS: Record<string, string> = {
  "Workshop": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Community Event": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Private Hire": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Rehearsal": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Meeting": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "Pop-up": "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  "Other": "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  "Community Workshop": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/10 text-green-700 dark:text-green-300",
};

const BOOKING_CARD_COLORS: Record<string, string> = {
  "Workshop": "border-blue-500/30 bg-blue-500/5",
  "Community Event": "border-green-500/30 bg-green-500/5",
  "Private Hire": "border-orange-500/30 bg-orange-500/5",
  "Rehearsal": "border-purple-500/30 bg-purple-500/5",
  "Meeting": "border-slate-500/30 bg-slate-500/5",
  "Pop-up": "border-pink-500/30 bg-pink-500/5",
  "Other": "border-gray-500/30 bg-gray-500/5",
};

function BookingCalendarCard({ booking, venueMap, allContacts }: {
  booking: Booking;
  venueMap: Record<number, string>;
  allContacts: Contact[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState<string>(booking.attendeeCount?.toString() || "");
  const [rangatahiCount, setRangatahiCount] = useState<string>((booking as any).rangatahiCount?.toString() || "");
  const [isRangatahi, setIsRangatahi] = useState<boolean>((booking as any).isRangatahi || false);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [taggedIds, setTaggedIds] = useState<number[]>(booking.attendees || []);
  const { toast } = useToast();

  useEffect(() => {
    setAttendeeCount(booking.attendeeCount?.toString() || "");
    setRangatahiCount((booking as any).rangatahiCount?.toString() || "");
    setIsRangatahi((booking as any).isRangatahi || false);
    setTaggedIds(booking.attendees || []);
  }, [booking]);

  const attendanceMutation = useMutation({
    mutationFn: async (data: { attendeeCount?: number | null; rangatahiCount?: number | null; attendees?: number[]; isRangatahi?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${booking.id}/attendance`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save attendance", description: err.message, variant: "destructive" });
    },
  });

  const saveAttendance = () => {
    attendanceMutation.mutate({
      attendeeCount: attendeeCount ? parseInt(attendeeCount) : null,
      rangatahiCount: rangatahiCount ? parseInt(rangatahiCount) : null,
      attendees: taggedIds,
      isRangatahi,
    });
  };

  const toggleRangatahi = () => {
    const next = !isRangatahi;
    setIsRangatahi(next);
    attendanceMutation.mutate({
      isRangatahi: next,
      attendeeCount: attendeeCount ? parseInt(attendeeCount) : null,
      rangatahiCount: rangatahiCount ? parseInt(rangatahiCount) : null,
      attendees: taggedIds,
    });
  };

  const addAttendee = (contactId: number) => {
    if (taggedIds.includes(contactId)) return;
    const next = [...taggedIds, contactId];
    setTaggedIds(next);
    setAttendeeSearch("");
    attendanceMutation.mutate({ attendees: next });
  };

  const removeAttendee = (contactId: number) => {
    const next = taggedIds.filter(id => id !== contactId);
    setTaggedIds(next);
    attendanceMutation.mutate({ attendees: next });
  };

  const filteredContacts = useMemo(() => {
    if (!attendeeSearch.trim()) return [];
    const q = attendeeSearch.toLowerCase();
    return allContacts.filter(c => c.name?.toLowerCase().includes(q) && !taggedIds.includes(c.id)).slice(0, 8);
  }, [attendeeSearch, allContacts, taggedIds]);

  const venueName = venueMap[booking.venueId] || null;
  const cardColor = BOOKING_CARD_COLORS[booking.classification] || BOOKING_CARD_COLORS["Other"];

  return (
    <Card
      className={`p-4 overflow-visible ${cardColor}`}
      data-testid={`card-booking-calendar-${booking.id}`}
    >
      <div
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-booking-${booking.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{booking.title}</h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              {booking.startTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {booking.startTime}{booking.endTime ? ` - ${booking.endTime}` : ""}
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
          <div className="flex items-center gap-1.5 shrink-0">
            {isRangatahi && (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Rangatahi</Badge>
            )}
            <Badge className={`text-[10px] ${BOOKING_BADGE_COLORS[booking.classification] || ""}`}>
              {booking.classification}
            </Badge>
            <Badge className={`text-[10px] ${booking.status === "completed" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-blue-500/10 text-blue-700 dark:text-blue-300"}`}>
              {booking.status}
            </Badge>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
        {!expanded && (taggedIds.length > 0 || booking.attendeeCount) && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            {booking.attendeeCount ? `${booking.attendeeCount} attendees` : ""}
            {taggedIds.length > 0 ? `${booking.attendeeCount ? " / " : ""}${taggedIds.length} tagged` : ""}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <button
              onClick={toggleRangatahi}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors ${isRangatahi ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:bg-muted"}`}
              data-testid={`toggle-rangatahi-${booking.id}`}
            >
              <Users className="w-3.5 h-3.5" />
              {isRangatahi ? "Rangatahi Event" : "Mark as Rangatahi"}
            </button>
            {attendanceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Head Count</Label>
              <Input
                type="number"
                placeholder="0"
                value={attendeeCount}
                onChange={e => setAttendeeCount(e.target.value)}
                onBlur={saveAttendance}
                className="h-8 text-sm"
                data-testid={`input-attendee-count-${booking.id}`}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rangatahi Count</Label>
              <Input
                type="number"
                placeholder="0"
                value={rangatahiCount}
                onChange={e => setRangatahiCount(e.target.value)}
                onBlur={saveAttendance}
                className="h-8 text-sm"
                data-testid={`input-rangatahi-count-${booking.id}`}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tag Community Members</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={attendeeSearch}
                onChange={e => setAttendeeSearch(e.target.value)}
                className="h-8 text-sm pl-7"
                data-testid={`input-attendee-search-${booking.id}`}
              />
            </div>
            {filteredContacts.length > 0 && (
              <div className="mt-1 border rounded-md bg-popover max-h-32 overflow-y-auto">
                {filteredContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => addAttendee(c.id)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"
                    data-testid={`button-add-attendee-${booking.id}-${c.id}`}
                  >
                    <UserPlus className="w-3 h-3 text-muted-foreground" />
                    {c.name}
                    {c.role && <span className="text-xs text-muted-foreground">({c.role})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {taggedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {taggedIds.map(cId => {
                const contact = allContacts.find(c => c.id === cId);
                return (
                  <Badge key={cId} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-attendee-${booking.id}-${cId}`}>
                    {contact?.name || `#${cId}`}
                    <button onClick={() => removeAttendee(cId)} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EventCard({
  entry,
  appEvents,
  programmes,
  onLogDebrief,
  onLogDebriefFromApp,
  onDeleteEvent,
  onDismissEvent,
  onMarkNotPersonal,
  isDebriefPending,
  isMarkedNotPersonal,
  debriefInfo,
  onViewDebrief,
}: {
  entry: CombinedEvent;
  appEvents: AppEvent[];
  programmes: Programme[];
  onLogDebrief: (gcal: GoogleCalendarEvent) => void;
  onLogDebriefFromApp: (app: AppEvent) => void;
  onDeleteEvent: (app: AppEvent) => void;
  onDismissEvent: (gcalId: string, eventName: string, suggestedReason?: string) => void;
  onMarkNotPersonal: (gcalId: string) => void;
  isDebriefPending: boolean;
  isMarkedNotPersonal: boolean;
  debriefInfo: DebriefInfo;
  onViewDebrief: (debriefId: number) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showLinkProgramme, setShowLinkProgramme] = useState(false);
  const [showConvertProgramme, setShowConvertProgramme] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState("Community Workshop");
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
        role: "Entrepreneur",
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
  const isManualLog = isApp && entry.app?.source === "internal";

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

  const linkProgrammeMutation = useMutation({
    mutationFn: async ({ eventId, programmeId }: { eventId: number; programmeId: number }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/link-programme`, { programmeId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowLinkProgramme(false);
      toast({ title: "Linked", description: "Event linked to programme" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to link", description: err.message, variant: "destructive" });
    },
  });

  const convertToProgrammeMutation = useMutation({
    mutationFn: async ({ eventId, classification }: { eventId: number; classification: string }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/convert-to-programme`, { classification });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programmes"] });
      setShowConvertProgramme(false);
      toast({ title: "Converted", description: "Event converted to programme" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to convert", description: err.message, variant: "destructive" });
    },
  });

  const markPersonalMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/mark-personal`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Marked personal", description: "Event excluded from reporting" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/unlink`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programmes"] });
      toast({ title: "Unlinked", description: "Programme link removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
    },
  });

  const isLinkedToProgramme = !!(linkedAppEvent?.linkedProgrammeId);
  const isLinkedToBooking = !!(linkedAppEvent?.linkedBookingId);
  const isPersonalType = linkedAppEvent?.type === "Personal";
  const linkedProgramme = isLinkedToProgramme ? programmes.find(p => p.id === linkedAppEvent!.linkedProgrammeId) : null;

  async function handleLinkProgramme(programmeId: number) {
    let eventId = appEventId;
    if (!eventId) {
      eventId = await ensureAppEvent();
    }
    if (!eventId) return;
    linkProgrammeMutation.mutate({ eventId, programmeId });
  }

  async function handleConvertToProgramme() {
    let eventId = appEventId;
    if (!eventId) {
      eventId = await ensureAppEvent();
    }
    if (!eventId) return;
    convertToProgrammeMutation.mutate({ eventId, classification: selectedClassification });
  }

  async function handleMarkPersonal() {
    let eventId = appEventId;
    if (!eventId) {
      eventId = await ensureAppEvent();
    }
    if (!eventId) return;
    markPersonalMutation.mutate(eventId);
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
  const cardTint = EVENT_TYPE_CARD_TINTS[eventType] || "border-gray-500/20 bg-gray-500/5 dark:bg-gray-500/5";
  const personalEvent = isGcal && !isMarkedNotPersonal ? isPersonalEvent(entry.gcal!.summary, entry.gcal!.description) : false;

  return (
    <Card className={`p-4 ${personalEvent ? "border-amber-500/30 bg-amber-500/5" : cardTint}`} data-testid={`card-event-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}>
      <div className="space-y-2">
        {personalEvent && (
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Looks like a personal event</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkNotPersonal(entry.gcal!.id);
                }}
                data-testid={`button-not-personal-${entry.gcal!.id}`}
              >
                <X className="w-3 h-3 mr-1" />
                Not personal
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissEvent(entry.gcal!.id, entry.gcal!.summary, "Personal event");
                }}
                data-testid={`button-quick-dismiss-${entry.gcal!.id}`}
              >
                <EyeOff className="w-3 h-3 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left cursor-pointer"
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
              {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </div>
        </button>

        {(!isManualLog || location || (attendance && attendance.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!isManualLog && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(startStr)} - {formatTime(endStr)}
            </span>
          )}
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
        )}

        {isManualLog && entry.app?.description && (
          <p className="text-xs text-muted-foreground whitespace-pre-line">{entry.app.description}</p>
        )}

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/50 mt-2">
            {!isManualLog && (
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
            )}

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
                    onClick={async () => {
                      try {
                        const res = await apiRequest("POST", "/api/contacts", {
                          name: contactSearch.trim(),
                          role: "Entrepreneur",
                        });
                        const newContact = await res.json();
                        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
                        handleAddContact(newContact);
                      } catch (err: any) {}
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between text-primary"
                    data-testid="button-create-new-person"
                  >
                    <span>Create "{contactSearch.trim()}" as new contact</span>
                    <UserPlus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <Dialog open={showNewPersonDialog} onOpenChange={setShowNewPersonDialog}>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
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

            {isGcal && !isLinkedToProgramme && !isLinkedToBooking && !isPersonalType && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Programme Linking</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowLinkProgramme(!showLinkProgramme)}
                    data-testid={`button-link-programme-${entry.gcal!.id}`}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Link to Programme
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowConvertProgramme(!showConvertProgramme)}
                    data-testid={`button-convert-programme-${entry.gcal!.id}`}
                  >
                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                    Convert to Programme
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleMarkPersonal}
                    disabled={markPersonalMutation.isPending}
                    data-testid={`button-mark-personal-${entry.gcal!.id}`}
                  >
                    {markPersonalMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <User className="w-3 h-3 mr-1" />}
                    Mark Personal
                  </Button>
                </div>

                {showLinkProgramme && programmes.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto mt-1">
                    {programmes.map((p: Programme) => (
                      <button
                        key={p.id}
                        onClick={() => handleLinkProgramme(p.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                        data-testid={`button-select-programme-${p.id}`}
                      >
                        <span className="truncate">{p.name}</span>
                        <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{p.classification}</Badge>
                      </button>
                    ))}
                  </div>
                )}
                {showLinkProgramme && programmes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic mt-1">No programmes yet. Use "Convert to Programme" to create one.</p>
                )}

                {showConvertProgramme && (
                  <div className="space-y-2 mt-1 p-2 border border-border rounded-md bg-muted/20">
                    <Select value={selectedClassification} onValueChange={setSelectedClassification}>
                      <SelectTrigger className="h-7 text-xs" data-testid="trigger-convert-classification">
                        <SelectValue placeholder="Classification" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Community Workshop", "Youth Programme", "Cultural Event", "Training Session", "Community Gathering", "Partnership Event", "Other"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={handleConvertToProgramme}
                      disabled={convertToProgrammeMutation.isPending}
                      data-testid="button-confirm-convert"
                    >
                      {convertToProgrammeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Create Programme
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isLinkedToProgramme && linkedProgramme && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Linked Programme</Label>
                <div className="flex items-center justify-between gap-2 p-2 border border-indigo-500/20 rounded-md bg-indigo-500/5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Link2 className="w-3 h-3 text-indigo-500" />
                    <span className="font-medium">{linkedProgramme.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{linkedProgramme.classification}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => appEventId && unlinkMutation.mutate(appEventId)}
                    disabled={unlinkMutation.isPending}
                    data-testid={`button-unlink-programme-${appEventId}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {entry.isPast && !isManualLog && (
              <div className="flex items-center gap-2 pt-1 mb-1">
                {debriefInfo ? (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${
                      debriefInfo.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                    data-testid={`badge-debrief-status-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    {debriefInfo.status === "confirmed" ? "Debriefed" : "Debrief in progress"}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate"
                    data-testid={`badge-needs-reconciliation-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}
                  >
                    <CircleDashed className="w-3 h-3 mr-0.5" />
                    Needs reconciliation
                  </Badge>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {!isManualLog && entry.isPast && debriefInfo ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onViewDebrief(debriefInfo.debriefId)}
                  data-testid={`button-view-debrief-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  View Debrief
                </Button>
              ) : !isManualLog && entry.isPast ? (
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
              ) : null}
              {isGcal && !personalEvent && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDismissEvent(entry.gcal!.id, entry.gcal!.summary)}
                  data-testid={`button-dismiss-event-${entry.gcal!.id}`}
                >
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
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

        {!expanded && (
          <p className="text-xs text-muted-foreground italic">
            {isManualLog
              ? "Tap to tag members"
              : entry.isPast
                ? debriefInfo
                  ? "Tap to edit type, tag members, or view debrief"
                  : "Tap to edit type, tag members, or log debrief"
                : "Tap to edit type or tag members"}
          </p>
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
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<{ gcalEventId: string; eventName: string } | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showSpace, setShowSpace] = useState(true);
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
  const [dailyFTSaving, setDailyFTSaving] = useState(false);
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

  const { data: dismissedEvents } = useQuery<{ id: number; gcalEventId: string; reason: string }[]>({
    queryKey: ["/api/dismissed-calendar-events"],
  });

  const { data: calendarSettings } = useQuery<{ id: number; calendarId: string; label: string; active: boolean }[]>({
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
  });

  const { data: monthlySnapshots } = useQuery<any[]>({
    queryKey: ["/api/monthly-snapshots"],
  });

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
    if (!appEvents || !debriefByEventId.size) return map;
    for (const event of appEvents) {
      if (event.googleCalendarEventId && debriefByEventId.has(event.id)) {
        map.set(event.googleCalendarEventId, debriefByEventId.get(event.id)!);
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

  const PROGRAMME_MONTHLY_TARGET = 2;

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

  const NOT_PERSONAL_REASON = "__not_personal__";

  const dismissedIds = useMemo(() => new Set(
    (dismissedEvents || []).filter(d => d.reason !== NOT_PERSONAL_REASON).map(d => d.gcalEventId)
  ), [dismissedEvents]);

  const notPersonalIds = useMemo(() => new Set(
    (dismissedEvents || []).filter(d => d.reason === NOT_PERSONAL_REASON).map(d => d.gcalEventId)
  ), [dismissedEvents]);

  const dismissMutation = useMutation({
    mutationFn: async ({ gcalEventId, reason }: { gcalEventId: string; reason: string }) => {
      await apiRequest("POST", "/api/dismissed-calendar-events", { gcalEventId, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-calendar-events"] });
      toast({ title: "Event dismissed" });
      setDismissDialogOpen(false);
      setDismissTarget(null);
      setDismissReason("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to dismiss event", description: err.message, variant: "destructive" });
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

  const ACTIVITY_TYPES = ["Hub Activity", "Drop-in", "Meeting", "Community Event", "Venue Hire", "Other"] as const;

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
      for (const contact of data.contacts) {
        await apiRequest("POST", "/api/event-attendance", {
          eventId: event.id,
          contactId: contact.id,
          role: "attendee",
        });
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

  function handleDismissEvent(gcalEventId: string, eventName: string, suggestedReason?: string) {
    setDismissTarget({ gcalEventId, eventName });
    setDismissReason(suggestedReason || "");
    setDismissDialogOpen(true);
  }

  function confirmDismiss() {
    if (!dismissTarget || !dismissReason.trim()) return;
    dismissMutation.mutate({ gcalEventId: dismissTarget.gcalEventId, reason: dismissReason.trim() });
  }

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

    const linkedGcalIds = new Set(
      (appEvents || [])
        .filter(e => e.googleCalendarEventId && (e.linkedProgrammeId || e.linkedBookingId))
        .map(e => e.googleCalendarEventId)
    );

    (gcalEvents || []).forEach(e => {
      if (linkedGcalIds.has(e.id)) return;
      const d = new Date(e.start);
      const isDismissed = dismissedIds.has(e.id);
      combined.push({ date: d, type: "gcal", gcal: e, isPast: new Date(e.end) < new Date(), isDismissed });
    });

    (appEvents || []).forEach(e => {
      if (e.googleCalendarEventId && !e.linkedProgrammeId && !e.linkedBookingId) return;
      const d = new Date(e.startTime);
      combined.push({ date: d, type: "app", app: e, isPast: new Date(e.endTime) < new Date() });
    });

    const linkedBookingIds = new Set(
      (appEvents || []).filter(e => e.linkedBookingId).map(e => e.linkedBookingId)
    );
    (allBookings || []).forEach((b: Booking) => {
      if (b.status !== "confirmed" && b.status !== "completed") return;
      if (linkedBookingIds.has(b.id)) return;
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
    let events = allEvents;
    if (!showDismissed) {
      events = events.filter(e => !e.isDismissed);
    }
    if (activeTypeFilters.size > 0) {
      events = events.filter(e => activeTypeFilters.has(getEventType(e)));
    }
    return events;
  }, [allEvents, activeTypeFilters, showDismissed]);

  const currentMonthKey = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const currentSnapshot = useMemo(() => {
    if (!monthlySnapshots) return null;
    return monthlySnapshots.find((s: any) => s.month?.slice(0, 10) === currentMonthKey) || null;
  }, [monthlySnapshots, currentMonthKey]);

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

  const monthEventCount = useMemo(() => {
    return filteredEvents.filter(e => isSameMonth(e.date, currentMonth)).length;
  }, [filteredEvents, currentMonth]);

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

  const pastEventsNeedingDebrief = useMemo(() => {
    return filteredEvents.filter(e => e.isPast && e.type !== "booking" && !(e.type === "app" && e.app?.source === "internal")).length;
  }, [filteredEvents]);

  type SpaceOccupancyItem = {
    kind: "booking" | "programme";
    id: number;
    title: string;
    date: Date;
    startDate: Date | null;
    endDate: Date | null;
    startTime: string | null;
    endTime: string | null;
    venue: string | null;
    venueId: number | null;
    status: string;
    classification: string;
  };

  const BOOKING_DOT_COLORS: Record<string, string> = {
    "Workshop": "bg-blue-400",
    "Community Event": "bg-emerald-400",
    "Private Hire": "bg-orange-400",
    "Rehearsal": "bg-violet-400",
    "Meeting": "bg-cyan-400",
    "Pop-up": "bg-pink-400",
    "Other": "bg-gray-400",
  };

  

  const SPACE_STATUS_COLORS: Record<string, string> = {
    enquiry: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    confirmed: "bg-green-500/15 text-green-700 dark:text-green-300",
    completed: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
    cancelled: "bg-red-500/15 text-red-700 dark:text-red-300 line-through",
    planned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    active: "bg-green-500/15 text-green-700 dark:text-green-300",
  };

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
        title: b.title || "",
        date: sDate || new Date(b.createdAt || Date.now()),
        startDate: sDate,
        endDate: b.endDate ? new Date(b.endDate) : sDate,
        startTime: b.startTime || null,
        endTime: b.endTime || null,
        venue: venueMap[b.venueId] || null,
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
  }, [allBookings, programmes, venueMap]);

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

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-calendar-title">
              Calendar
            </h1>
            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                data-testid="button-toggle-schedule"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors dark:text-emerald-300 font-medium border border-emerald-500/30 bg-[#ffffff] text-[#000000]"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Schedule
              </button>
              <button
                onClick={() => setShowSpace(!showSpace)}
                data-testid="button-toggle-space"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors dark:text-orange-300 font-medium border border-orange-500/30 bg-[#ffffff26] text-[#000000]"
              >
                <Building2 className="w-3.5 h-3.5" />
                Space
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showSchedule && pastEventsNeedingDebrief > 0 && (
              <Badge variant="secondary" data-testid="badge-events-count">
                {pastEventsNeedingDebrief} past events
              </Badge>
            )}
            {showSchedule && (
              <Button
                size="sm"
                variant="outline"
                className={`toggle-elevate ${showDismissed ? "toggle-elevated" : ""}`}
                onClick={() => setShowDismissed(!showDismissed)}
                data-testid="button-toggle-dismissed"
              >
                {showDismissed ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                {showDismissed ? "Showing dismissed" : "Hidden"}
              </Button>
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

        {showSettings && (
          <Card className="p-4 mb-6" data-testid="panel-calendar-settings">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-sm font-semibold">My Calendars</h3>
              <Button size="icon" variant="ghost" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Toggle which calendars to sync. Shared events across calendars are automatically deduplicated.
            </p>
            {calendarsListLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading calendars...
              </div>
            ) : availableCalendars && availableCalendars.length > 0 ? (
              <div className="space-y-1">
                {availableCalendars.map(cal => {
                  const isEnabled = cal.primary || (calendarSettings || []).some(s => s.calendarId === cal.id);
                  return (
                    <div
                      key={cal.id}
                      className="flex items-center gap-3 p-2 rounded-md"
                      data-testid={`calendar-toggle-${cal.id}`}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cal.backgroundColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{cal.summary}</p>
                        {cal.description && (
                          <p className="text-xs text-muted-foreground truncate">{cal.description}</p>
                        )}
                      </div>
                      <Switch
                        checked={isEnabled}
                        disabled={cal.primary || toggleCalendarMutation.isPending}
                        onCheckedChange={(checked) => {
                          if (!cal.primary) {
                            toggleCalendarMutation.mutate({
                              calendarId: cal.id,
                              label: cal.summary,
                              enabled: checked,
                            });
                          }
                        }}
                        data-testid={`switch-calendar-${cal.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No calendars found. Make sure your Google Calendar is connected.
              </p>
            )}
          </Card>
        )}

        <Card className="p-4 mb-6" data-testid="panel-monthly-summary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold" data-testid="text-monthly-summary-title">
                {format(currentMonth, "MMMM yyyy")} Summary
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Events:</span>
                <span className="font-medium" data-testid="text-month-event-count">{monthEventCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Debriefed:</span>
                <span className="font-medium" data-testid="text-month-debriefed-count">{monthDebriefedCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Footprints className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Foot Traffic:</span>
                <span className="font-medium" data-testid="text-month-foot-traffic-total">{monthlyFootTrafficTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Card>

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

              <div className="grid grid-cols-7 gap-0">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = showSchedule ? (eventsByDate.get(key) || []) : [];
                  const daySpaceItems = showSpace ? (spaceByDate.get(key) || []) : [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = isSameDay(day, selectedDate);
                  const today = isToday(day);
                  const hasConflict = showSpace && daySpaceItems.length > 1 && daySpaceItems.some((a, i) =>
                    daySpaceItems.some((b, j) => {
                      if (i >= j) return false;
                      if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return true;
                      const aStart = parseInt(a.startTime.replace(":", ""));
                      const aEnd = parseInt(a.endTime.replace(":", ""));
                      const bStart = parseInt(b.startTime.replace(":", ""));
                      const bEnd = parseInt(b.endTime.replace(":", ""));
                      return aStart < bEnd && bStart < aEnd;
                    })
                  );
                  const allDots: { color: string; key: string; reconciled?: boolean }[] = [];
                  dayEvents.forEach((e, i) => {
                    const isManual = e.type === "app" && e.app?.source === "internal";
                    const skipReconcile = e.type === "booking" || isManual;
                    const info = !skipReconcile ? getDebriefInfo(e) : null;
                    allDots.push({ color: getEventDotColor(e), key: `ev-${i}`, reconciled: !skipReconcile && e.isPast ? !!info : undefined });
                  });
                  daySpaceItems.forEach((item, i) => allDots.push({ color: item.kind === "programme" ? "bg-indigo-400" : "bg-orange-400", key: `sp-${i}` }));

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectDate(day)}
                      data-testid={`button-calendar-day-${key}`}
                      className={`
                        relative p-1 min-h-[3rem] md:min-h-[4rem] text-sm border border-border/30 transition-colors
                        ${!isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}
                        ${isSelected ? "bg-primary/10 border-primary/50" : "hover:bg-muted/50"}
                        ${today && !isSelected ? "bg-accent/30" : ""}
                        ${hasConflict ? "ring-1 ring-red-400/50 bg-red-50/20 dark:bg-red-900/10" : ""}
                      `}
                    >
                      <span className={`
                        inline-flex items-center justify-center w-6 h-6 text-xs rounded-full
                        ${today ? "bg-primary text-primary-foreground font-bold" : ""}
                      `}>
                        {format(day, "d")}
                      </span>
                      {allDots.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {allDots.slice(0, 4).map((dot) => (
                            <div
                              key={dot.key}
                              className={`w-full h-1 rounded-full ${dot.color} ${dot.reconciled === false ? "opacity-100 ring-1 ring-amber-400/60" : ""} ${dot.reconciled === true ? "opacity-50" : ""}`}
                            />
                          ))}
                          {allDots.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{allDots.length - 4}</span>
                          )}
                        </div>
                      )}
                      {hasConflict && (
                        <div className="absolute top-0.5 right-0.5">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-4" ref={dayPanelRef}>
            <h2 className="text-lg font-bold font-display" data-testid="text-selected-date">
              {format(selectedDate, "EEEE, MMM d")}
            </h2>

            {showSchedule && gcalLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (showSchedule && selectedDayEvents.length > 0) || (showSpace && selectedDaySpace.length > 0) ? (
              <div className="space-y-3">
                {showSchedule && selectedDayEvents.map((entry) => (
                  entry.type === "booking" && entry.booking ? (
                    <BookingCalendarCard
                      key={`booking-${entry.booking.id}`}
                      booking={entry.booking}
                      venueMap={venueMap}
                      allContacts={(allContacts || []) as Contact[]}
                    />
                  ) : (
                  <div key={entry.type === "gcal" ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`} className="relative">
                    {entry.isDismissed && (
                      <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Dismissed
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const dismissed = (dismissedEvents || []).find(d => d.gcalEventId === entry.gcal?.id);
                              if (dismissed) restoreMutation.mutate(dismissed.id);
                            }}
                            data-testid={`button-restore-event-${entry.gcal?.id}`}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    )}
                    <EventCard
                      entry={entry}
                      appEvents={appEvents || []}
                      programmes={programmes || []}
                      onLogDebrief={handleLogDebrief}
                      onLogDebriefFromApp={handleLogDebriefFromApp}
                      onDeleteEvent={handleDeleteEvent}
                      onDismissEvent={handleDismissEvent}
                      onMarkNotPersonal={(gcalId) => markNotPersonalMutation.mutate(gcalId)}
                      isDebriefPending={createDebriefMutation.isPending}
                      isMarkedNotPersonal={entry.gcal ? notPersonalIds.has(entry.gcal.id) : false}
                      debriefInfo={getDebriefInfo(entry)}
                      onViewDebrief={(debriefId) => navigate(`/debriefs/${debriefId}`)}
                    />
                  </div>
                  )
                ))}
                {showSpace && selectedDaySpace.map((item) => (
                  <Card
                    key={`${item.kind}-${item.id}`}
                    className="p-4 border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/5 cursor-pointer overflow-visible hover-elevate"
                    onClick={() => navigate(item.kind === "booking" ? "/bookings" : "/programmes")}
                    data-testid={`card-space-${item.kind}-${item.id}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <Badge className={`text-xs shrink-0 ${BOOKING_BADGE_COLORS[item.classification] || ""}`}>
                          {item.classification}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {item.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.startTime}{item.endTime ? ` - ${item.endTime}` : ""}
                          </span>
                        )}
                        {item.venue && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {item.venue}
                          </span>
                        )}
                        <Badge className={`text-[10px] ${item.kind === "programme" ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "bg-orange-500/10 text-orange-700 dark:text-orange-300"}`}>
                          {item.kind === "programme" ? "Programme" : "Venue Hire"}
                        </Badge>
                        <Badge className={`text-[10px] ${SPACE_STATUS_COLORS[item.status] || ""}`}>
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
                <div className="flex items-center gap-2 mt-1">
                  <Footprints className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Foot Traffic:</span>
                  <Input
                    type="number"
                    className="w-20 min-h-[44px] md:min-h-0 md:h-8 text-sm"
                    placeholder="0"
                    value={dailyFootTrafficValue}
                    onChange={e => setDailyFootTrafficValue(e.target.value)}
                    data-testid="input-daily-foot-traffic"
                  />
                  <Button
                    size="sm"
                    className="min-h-[44px] md:min-h-0 md:h-8"
                    onClick={handleSaveDailyFootTraffic}
                    disabled={dailyFTSaving || dailyFootTrafficValue === ""}
                    data-testid="button-save-daily-foot-traffic"
                  >
                    {dailyFTSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={openLogActivity}
                  data-testid="button-log-activity"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Activity
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Card className="p-6">
                  <div className="text-center text-muted-foreground text-sm">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No items on this day</p>
                  </div>
                </Card>
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Foot Traffic:</span>
                  <Input
                    type="number"
                    className="w-20 min-h-[44px] md:min-h-0 md:h-8 text-sm"
                    placeholder="0"
                    value={dailyFootTrafficValue}
                    onChange={e => setDailyFootTrafficValue(e.target.value)}
                    data-testid="input-daily-foot-traffic-empty"
                  />
                  <Button
                    size="sm"
                    className="min-h-[44px] md:min-h-0 md:h-8"
                    onClick={handleSaveDailyFootTraffic}
                    disabled={dailyFTSaving || dailyFootTrafficValue === ""}
                    data-testid="button-save-daily-foot-traffic-empty"
                  >
                    {dailyFTSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={openLogActivity}
                  data-testid="button-log-activity-empty"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Activity
                </Button>
              </div>
            )}
          </div>
        </div>

        {showSchedule && (
          <div className="mt-6" data-testid="section-month-programmes">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-display font-bold text-foreground" data-testid="text-programmes-heading">
                Programmes this month
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/programmes")}
                data-testid="button-view-all-programmes"
              >
                View all
              </Button>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded-lg text-sm ${
              programmeTargetCount >= PROGRAMME_MONTHLY_TARGET
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : programmeTargetCount > 0
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
            }`} data-testid="programme-target-indicator">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <span className="font-medium">
                  {programmeTargetCount} / {PROGRAMME_MONTHLY_TARGET} target
                </span>
              </div>
              <span className="text-xs">
                {programmeTargetCount >= PROGRAMME_MONTHLY_TARGET
                  ? "Target met"
                  : `Need ${PROGRAMME_MONTHLY_TARGET - programmeTargetCount} more to hit target`}
              </span>
            </div>
            {monthProgrammes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {monthProgrammes.map((p: Programme) => {
                const dateDisplay = (() => {
                  if (p.tbcMonth && p.tbcYear) return `TBC - ${p.tbcMonth} ${p.tbcYear}`;
                  if (!p.startDate) return null;
                  const start = format(new Date(p.startDate), "d MMM");
                  if (p.endDate && format(new Date(p.endDate), "yyyy-MM-dd") !== format(new Date(p.startDate), "yyyy-MM-dd")) {
                    return `${start} - ${format(new Date(p.endDate), "d MMM")}`;
                  }
                  return start;
                })();

                const timeDisplay = p.startTime
                  ? p.endTime ? `${p.startTime} - ${p.endTime}` : p.startTime
                  : null;

                const totalBudget = parseFloat(p.facilitatorCost || "0") + parseFloat(p.cateringCost || "0") + parseFloat(p.promoCost || "0");

                const facCount = (p.facilitators || []).length;
                const attCount = (p.attendees || []).length;

                return (
                  <Card
                    key={p.id}
                    className={`p-3 hover-elevate cursor-pointer transition-all ${PROG_STATUS_COLORS[p.status] || ""}`}
                    onClick={() => navigate("/programmes")}
                    data-testid={`card-cal-programme-${p.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className={`font-medium text-sm truncate ${p.status === "cancelled" ? "line-through opacity-70" : ""}`}>
                        {p.name}
                      </h4>
                      <Badge className={`text-xs shrink-0 ${PROG_CLASSIFICATION_COLORS[p.classification] || ""}`}>
                        {p.classification}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {dateDisplay && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateDisplay}
                        </span>
                      )}
                      {timeDisplay && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeDisplay}
                        </span>
                      )}
                      {p.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[100px]">{p.location}</span>
                        </span>
                      )}
                      {totalBudget > 0 && (
                        <span className="flex items-center gap-1">
                          ${totalBudget.toLocaleString()}
                        </span>
                      )}
                      {facCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {facCount} facilitator{facCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {attCount > 0 && (
                        <span className="flex items-center gap-1">
                          <UserPlus className="w-3 h-3" />
                          {attCount} attendee{attCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No programmes scheduled this month</p>
            )}
          </div>
        )}


      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
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
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dismiss Event</DialogTitle>
            <DialogDescription>This event will be hidden from your calendar view. You can restore it later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dismissTarget && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="text-sm font-medium">{dismissTarget.eventName}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason for dismissing</Label>
              <div className="flex flex-col gap-2">
                {["Didn't happen", "Personal event", "Duplicate", "Not relevant"].map(reason => (
                  <Button
                    key={reason}
                    variant="outline"
                    size="sm"
                    className={`justify-start toggle-elevate ${dismissReason === reason ? "toggle-elevated" : ""}`}
                    onClick={() => setDismissReason(reason)}
                    data-testid={`button-dismiss-reason-${reason.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
              <Input
                value={!["Didn't happen", "Personal event", "Duplicate", "Not relevant"].includes(dismissReason) ? dismissReason : ""}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Or type a custom reason..."
                className="text-sm"
                data-testid="input-dismiss-reason-custom"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissDialogOpen(false)} data-testid="button-cancel-dismiss">
              Cancel
            </Button>
            <Button
              onClick={confirmDismiss}
              disabled={!dismissReason.trim() || dismissMutation.isPending}
              data-testid="button-confirm-dismiss"
            >
              {dismissMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={logActivityOpen} onOpenChange={(open) => { setLogActivityOpen(open); if (!open) resetActivityForm(); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>Record something that happened. It will appear on your calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="activity-date">Date</Label>
              <Input
                id="activity-date"
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                data-testid="input-activity-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-name">What happened <span className="text-destructive">*</span></Label>
              <Input
                id="activity-name"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="e.g. Morning drop-in session, Community catch up..."
                data-testid="input-activity-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger data-testid="trigger-activity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(t => (
                    <SelectItem key={t} value={t} data-testid={`option-activity-type-${t.toLowerCase().replace(/\s+/g, "-")}`}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tagged people</Label>
              {activitySelectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {activitySelectedContacts.map(c => (
                    <Badge key={c.id} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-activity-contact-${c.id}`}>
                      {c.name}
                      <button
                        onClick={() => setActivitySelectedContacts(prev => prev.filter(p => p.id !== c.id))}
                        className="ml-0.5"
                        data-testid={`button-remove-activity-contact-${c.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={activityContactSearch}
                  onChange={(e) => setActivityContactSearch(e.target.value)}
                  placeholder="Search people..."
                  className="pl-8"
                  data-testid="input-activity-contact-search"
                />
              </div>
              {filteredActivityContacts.length > 0 && (
                <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                  {filteredActivityContacts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActivitySelectedContacts(prev => [...prev, c]);
                        setActivityContactSearch("");
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      data-testid={`button-select-activity-contact-${c.id}`}
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.email && <span className="text-xs text-muted-foreground ml-2">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tagged groups</Label>
              {activitySelectedGroups.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {activitySelectedGroups.map(g => (
                    <Badge key={g.id} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-activity-group-${g.id}`}>
                      {g.name}
                      <button
                        onClick={() => setActivitySelectedGroups(prev => prev.filter(p => p.id !== g.id))}
                        className="ml-0.5"
                        data-testid={`button-remove-activity-group-${g.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={activityGroupSearch}
                  onChange={(e) => setActivityGroupSearch(e.target.value)}
                  placeholder="Search groups..."
                  className="pl-8"
                  data-testid="input-activity-group-search"
                />
              </div>
              {filteredActivityGroups.length > 0 && (
                <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                  {filteredActivityGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setActivitySelectedGroups(prev => [...prev, { id: g.id, name: g.name }]);
                        setActivityGroupSearch("");
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      data-testid={`button-select-activity-group-${g.id}`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-purpose">Why / purpose</Label>
              <Textarea
                id="activity-purpose"
                value={activityPurpose}
                onChange={(e) => setActivityPurpose(e.target.value)}
                placeholder="What was the purpose of this activity?"
                className="resize-none"
                rows={2}
                data-testid="input-activity-purpose"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-outcome">Outcome / notes</Label>
              <Textarea
                id="activity-outcome"
                value={activityOutcome}
                onChange={(e) => setActivityOutcome(e.target.value)}
                placeholder="What was the result? Any notes or follow-ups?"
                className="resize-none"
                rows={2}
                data-testid="input-activity-outcome"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLogActivityOpen(false); resetActivityForm(); }} data-testid="button-cancel-activity">
              Cancel
            </Button>
            <Button
              onClick={handleLogActivity}
              disabled={!activityName.trim() || logActivityMutation.isPending}
              data-testid="button-save-activity"
            >
              {logActivityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
