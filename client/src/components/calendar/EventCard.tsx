import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  MapPin,
  Clock,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
  Search,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Save,
  ExternalLink,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DismissPopover } from "@/components/dismiss-popover";
import { useContacts } from "@/hooks/use-contacts";
import { useEventAttendance, useAddAttendance, useRemoveAttendance } from "@/hooks/use-event-attendance";
import type { Contact, Programme, Booking } from "@shared/schema";
import type { GoogleCalendarEvent } from "@/types/google-calendar";
import {
  AppEvent,
  CombinedEvent,
  DebriefInfo,
  EVENT_TYPES,
  EVENT_TYPE_DOT_COLORS,
  EVENT_TYPE_BADGE_COLORS,
  EVENT_TYPE_CARD_TINTS,
  classifyGcalEvent,
  formatTime,
  cleanDescription,
  isPersonalEvent,
} from "./calendar-constants";

export interface EventCardProps {
  entry: CombinedEvent;
  appEvents: AppEvent[];
  programmes: Programme[];
  onLogDebrief: (gcal: GoogleCalendarEvent) => void;
  onLogDebriefFromApp: (app: AppEvent) => void;
  onDeleteEvent: (app: AppEvent) => void;
  onDismissEvent: (gcalId: string, reason: string) => void;
  onSkipDebrief?: (eventId: number, reason: string) => void;
  onMarkNotPersonal: (gcalId: string) => void;
  isDismissPending: boolean;
  isDebriefPending: boolean;
  isMarkedNotPersonal: boolean;
  debriefInfo: DebriefInfo;
  onViewDebrief: (debriefId: number) => void;
  venueNames?: string[];
  sourceBooking?: Booking | null;
  venueMap?: Record<number, string>;
  allContacts?: Contact[];
}

export function EventCard({
  entry,
  appEvents,
  programmes,
  onLogDebrief,
  onLogDebriefFromApp,
  onDeleteEvent,
  onDismissEvent,
  onSkipDebrief,
  onMarkNotPersonal,
  isDismissPending,
  isDebriefPending,
  isMarkedNotPersonal,
  debriefInfo,
  onViewDebrief,
  venueNames,
  sourceBooking,
  venueMap,
  allContacts: allContactsProp,
}: EventCardProps) {
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
  const [localSpaceUseType, setLocalSpaceUseType] = useState<string>("");
  const { data: contacts } = useContacts();

  const updateSpaceUseTypeMutation = useMutation({
    mutationFn: async ({ eventId, spaceUseType }: { eventId: number; spaceUseType: string | null }) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}`, { spaceUseType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

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

  const bk = sourceBooking;
  const bkVenueIds = bk ? (bk.venueIds || (bk.venueId ? [bk.venueId] : [])) : [];
  const bkVenueName = bk && venueMap ? bkVenueIds.map((id: number) => venueMap[id]).filter(Boolean).join(" + ") : null;

  const eventName = bk
    ? ((bk as any).displayName || bk.title || bk.classification || "Venue Hire")
    : (isGcal ? entry.gcal!.summary : entry.app!.name);
  const eventType = bk ? "Venue Hire" : (linkedAppEvent?.type || (isGcal ? classifyGcalEvent(entry.gcal!) : entry.app!.type));
  const startStr = isGcal ? entry.gcal!.start : entry.app!.startTime;
  const endStr = isGcal ? entry.gcal!.end : entry.app!.endTime;
  const location = bkVenueName || (isGcal ? entry.gcal!.location : entry.app!.location);
  const bookerName = bk ? (bk.bookerName || (allContactsProp || []).find(c => c.id === bk.bookerId)?.name) : null;

  const { data: attendance } = useEventAttendance(appEventId);
  const addAttendance = useAddAttendance();
  const removeAttendance = useRemoveAttendance(appEventId);

  const importGcalMutation = useMutation({
    mutationFn: async (data: { gcalId: string; name: string; type: string; start: string; end: string; location?: string; description?: string; attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean }> }) => {
      const res = await apiRequest("POST", "/api/events", {
        name: data.name,
        type: data.type,
        startTime: data.start,
        endTime: data.end,
        location: data.location || null,
        description: data.description || null,
        googleCalendarEventId: data.gcalId,
        calendarAttendees: data.attendees || null,
        attendeeCount: data.attendees?.length || null,
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
        attendees: entry.gcal.attendees,
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

  const isConfirmed = debriefInfo?.status === "confirmed";
  const isInProgress = debriefInfo && debriefInfo.status !== "confirmed";
  const needsDebrief = entry.isPast && !debriefInfo
    && entry.type !== "booking"
    && !(entry.type === "app" && entry.app?.source === "internal");

  const isVenueHire = eventType === "Venue Hire";
  const cardState = isVenueHire
    ? entry.isPast && isConfirmed
      ? "opacity-50 hover:opacity-75 transition-opacity border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/5"
      : "border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/5"
    : entry.isPast && isConfirmed
    ? "opacity-50 hover:opacity-75 transition-opacity border-green-500/20 bg-green-500/5"
    : entry.isPast && isInProgress
    ? "opacity-70 hover:opacity-90 transition-opacity border-blue-500/20 bg-blue-500/5"
    : "bg-muted/40 border-border";

  return (
    <Card
      className={`p-4 cursor-pointer ${cardState}`}
      onClick={() => setExpanded(!expanded)} data-testid={`card-event-${isGcal ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`}`}>
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
              <DismissPopover
                reasons={["Archive", "Ignore", "Personal"]}
                onDismiss={(reason) => onDismissEvent(entry.gcal!.id, reason)}
                isPending={isDismissPending}
                testIdPrefix={`quick-dismiss-${entry.gcal!.id}`}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`button-quick-dismiss-${entry.gcal!.id}`}
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Archive
                </Button>
              </DismissPopover>
            </div>
          </div>
        )}
        <div
          className="w-full text-left"
          data-testid={`button-expand-event-${isGcal ? entry.gcal!.id : entry.app!.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground truncate">{eventName}</h4>
              {bookerName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" />{bookerName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className={`text-xs ${badgeColor}`}>
                {eventType}
              </Badge>
              {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </div>
          {location && (
            <div className="flex justify-end">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />{location}
              </span>
            </div>
          )}
        </div>

        {(!isManualLog || (attendance && attendance.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!isManualLog && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(startStr)} - {formatTime(endStr)}
            </span>
          )}
          {(() => {
            const count = entry.app?.attendeeCount
              || (isGcal && entry.gcal!.attendees ? entry.gcal!.attendees.filter(a => !a.organizer).length : 0)
              || (attendance ? attendance.length : 0);
            return count > 0 ? (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {count}
              </span>
            ) : null;
          })()}
          {attendance && attendance.length > 0 && !isConfirmed && !expanded && (
            <span className="flex items-center gap-1">
              <UserPlus className="w-3 h-3" />
              {attendance.length} tagged
            </span>
          )}
        </div>
        )}

        {entry.isPast && (isConfirmed || isInProgress || needsDebrief) && (
          <div className={`flex items-center gap-1 text-xs mt-0.5 ${
            isConfirmed ? "text-emerald-600/60 dark:text-emerald-400/60"
            : isInProgress ? "text-blue-600/60 dark:text-blue-400/60"
            : "text-amber-600/70 dark:text-amber-400/70"
          }`}>
            {isConfirmed ? <CheckCircle2 className="w-3 h-3" />
              : isInProgress ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CircleDashed className="w-3 h-3" />}
            {isConfirmed ? "Debriefed" : isInProgress ? "Debriefing" : "To debrief"}
          </div>
        )}

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/50 mt-2">
            {(() => {
              const desc = cleanDescription(isGcal ? entry.gcal?.description : entry.app?.description);
              return desc ? (
                <p className="text-xs text-muted-foreground whitespace-pre-line max-h-24 overflow-y-auto">{desc}</p>
              ) : null;
            })()}
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

            {entry.isPast && appEventId && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Space Use</Label>
              <Select
                value={localSpaceUseType || (linkedAppEvent?.spaceUseType ?? "")}
                onValueChange={(val) => {
                  setLocalSpaceUseType(val);
                  updateSpaceUseTypeMutation.mutate({ eventId: appEventId, spaceUseType: val || null });
                }}
                data-testid={`select-space-use-${appEventId}`}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`trigger-space-use-${appEventId}`}>
                  <SelectValue placeholder="Select space use..." />
                </SelectTrigger>
                <SelectContent>
                  {(venueNames || []).map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {isGcal && entry.gcal!.attendees?.length > 0 && (() => {
              const contactByEmail = new Map(
                (contacts || []).filter((c: Contact) => c.email).map((c: Contact) => [c.email!.toLowerCase(), c])
              );
              const invitees = entry.gcal!.attendees.filter(a => !a.organizer);
              if (invitees.length === 0) return null;
              const statusIcon = (s: string) => {
                if (s === "accepted") return <span className="text-emerald-500 text-[10px]">✓</span>;
                if (s === "declined") return <span className="text-red-400 text-[10px]">✗</span>;
                if (s === "tentative") return <span className="text-amber-500 text-[10px]">?</span>;
                return <span className="text-muted-foreground text-[10px]">—</span>;
              };
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> Invitees
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={(e) => {
                      e.stopPropagation();
                      const matched = invitees
                        .map(a => contactByEmail.get(a.email.toLowerCase()))
                        .filter((c): c is Contact => !!c);
                      matched.forEach(c => handleAddContact(c));
                    }}>
                      Tag all ↓
                    </Button>
                  </Label>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {invitees.map((a) => {
                      const matched = contactByEmail.get(a.email.toLowerCase());
                      const name = matched?.name || a.displayName || a.email;
                      return (
                        <span key={a.email} className="flex items-center gap-1 text-xs">
                          {statusIcon(a.responseStatus)}
                          {matched ? (
                            <Link
                              href={`/contacts/${matched.id}`}
                              className="text-primary hover:underline"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              {name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{name}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {<div className="space-y-1.5">
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
            </div>}

            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center gap-2 flex-1">
                <Button size="sm" variant="outline" className="text-xs" onClick={(e) => e.stopPropagation()} data-testid="button-save-event">
                  <Save className="w-3 h-3 mr-1" /> Save
                </Button>
                {bk && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); window.location.href = `/bookings/${bk.id}`; }}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Booking
                  </Button>
                )}
                {linkedAppEvent?.linkedProgrammeId && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); window.location.href = `/programmes`; }}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Programme
                  </Button>
                )}
              </div>
              {(entry.isPast && !isConfirmed && !isInProgress) || !entry.isPast ? (
                <DismissPopover
                  reasons={["Not relevant", "Duplicate", "Personal"]}
                  onDismiss={(reason) => {
                    if (appEventId && onSkipDebrief) onSkipDebrief(appEventId, reason);
                    else if (isGcal) onDismissEvent(entry.gcal!.id, reason);
                  }}
                  isPending={isDismissPending}
                  testIdPrefix={`skip-${isGcal ? entry.gcal!.id : entry.app?.id}`}
                >
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                    Skip
                  </Button>
                </DismissPopover>
              ) : null}
              <DismissPopover
                reasons={["Duplicate", "Didn't happen", "Personal", "Not relevant"]}
                onDismiss={(reason) => {
                  if (isGcal) onDismissEvent(entry.gcal!.id, reason);
                  else if (entry.app) onDeleteEvent(entry.app);
                }}
                isPending={isDismissPending}
                testIdPrefix={`archive-${isGcal ? entry.gcal!.id : entry.app?.id}`}
              >
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  Archive
                </Button>
              </DismissPopover>
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}
