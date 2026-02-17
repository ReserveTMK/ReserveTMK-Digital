import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/use-events";
import { useContacts } from "@/hooks/use-contacts";
import { useEventAttendance, useAddAttendance, useRemoveAttendance } from "@/hooks/use-event-attendance";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  Calendar,
  MapPin,
  Users,
  Pencil,
  Trash2,
  PartyPopper,
  X,
  UserPlus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, setHours, setMinutes } from "date-fns";
import type { Event } from "@shared/schema";

const EVENT_TYPES = [
  "Meeting",
  "Mentoring Session",
  "External Event",
  "Personal Development",
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  "Meeting": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Mentoring Session": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "External Event": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "Personal Development": "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

const ATTENDEE_ROLES = ["attendee", "speaker", "organizer", "volunteer"];

const ROLE_COLORS: Record<string, string> = {
  attendee: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  speaker: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  organizer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  volunteer: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  const filteredEvents = events?.filter((event: Event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(search.toLowerCase()) ||
      event.location?.toLowerCase().includes(search.toLowerCase()) ||
      event.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || event.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const upcomingEvents = filteredEvents?.filter(
    (e: Event) => new Date(e.startTime) >= new Date()
  );
  const pastEvents = filteredEvents?.filter(
    (e: Event) => new Date(e.startTime) < new Date()
  );

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-events-title">Events</h1>
              <p className="text-muted-foreground mt-1">
                Track meetings, mentoring sessions, external events, and personal development activities.
              </p>
            </div>
            <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-add-event">
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                className="pl-10 h-11 bg-card rounded-xl border-border/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-events"
              />
            </div>
            <div className="w-full sm:w-56">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-card border-border/60" data-testid="select-event-type-filter">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredEvents?.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <PartyPopper className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters or add a new event.
              </p>
              <Button onClick={() => setCreateOpen(true)} variant="outline">
                Add Event
              </Button>
            </Card>
          ) : (
            <div className="space-y-8">
              {upcomingEvents && upcomingEvents.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-display font-bold text-foreground" data-testid="text-upcoming-events">
                    Upcoming Events ({upcomingEvents.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingEvents.map((event: Event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEdit={() => setEditEvent(event)}
                        isExpanded={expandedEventId === event.id}
                        onToggleExpand={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pastEvents && pastEvents.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-display font-bold text-muted-foreground" data-testid="text-past-events">
                    Past Events ({pastEvents.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastEvents.map((event: Event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEdit={() => setEditEvent(event)}
                        isPast
                        isExpanded={expandedEventId === event.id}
                        onToggleExpand={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <EventFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      {editEvent && (
        <EventFormDialog
          open={!!editEvent}
          onOpenChange={(v) => { if (!v) setEditEvent(null); }}
          mode="edit"
          event={editEvent}
        />
      )}
    </div>
  );
}

function EventCard({
  event,
  onEdit,
  isPast,
  isExpanded,
  onToggleExpand,
}: {
  event: Event;
  onEdit: () => void;
  isPast?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const deleteMutation = useDeleteEvent();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: attendance, isLoading: attendanceLoading } = useEventAttendance(isExpanded ? event.id : undefined);
  const { data: contacts } = useContacts();
  const addAttendance = useAddAttendance();
  const removeAttendance = useRemoveAttendance();
  const [addAttendeeOpen, setAddAttendeeOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("attendee");
  const [contactSearch, setContactSearch] = useState("");

  const attendeeCount = isExpanded && attendance ? (attendance as any[]).length : event.attendeeCount;

  const handleAddAttendee = () => {
    if (!selectedContactId) return;
    addAttendance.mutate({
      eventId: event.id,
      contactId: parseInt(selectedContactId),
      role: selectedRole,
    }, {
      onSuccess: () => {
        setSelectedContactId("");
        setSelectedRole("attendee");
        setAddAttendeeOpen(false);
      },
    });
  };

  const filteredContacts = contacts?.filter((c: any) => {
    if (!contactSearch) return true;
    return c.name.toLowerCase().includes(contactSearch.toLowerCase());
  });

  const attendeeContactIds = new Set((attendance as any[] || []).map((a: any) => a.contactId));

  return (
    <Card
      className={`p-5 transition-all duration-200 ${isPast ? "opacity-70" : ""}`}
      data-testid={`card-event-${event.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-lg font-display truncate" data-testid={`text-event-name-${event.id}`}>
              {event.name}
            </h3>
            <Badge
              variant="secondary"
              className={`text-xs shrink-0 ${EVENT_TYPE_COLORS[event.type] || ""}`}
              data-testid={`badge-event-type-${event.id}`}
            >
              {event.type}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid={`button-edit-event-${event.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="icon"
                onClick={() => deleteMutation.mutate(event.id)}
                data-testid={`button-confirm-delete-event-${event.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmDelete(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              data-testid={`button-delete-event-${event.id}`}
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" />
          <span data-testid={`text-event-date-${event.id}`}>
            {format(new Date(event.startTime), "MMM d, yyyy")}
            {" "}
            {format(new Date(event.startTime), "h:mm a")} - {format(new Date(event.endTime), "h:mm a")}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span data-testid={`text-event-location-${event.id}`}>{event.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 shrink-0" />
          <span data-testid={`text-event-attendees-${event.id}`}>
            {attendeeCount != null ? `${attendeeCount} attendees` : "0 attendees"}
          </span>
        </div>
      </div>

      {event.description && (
        <p className="text-sm text-foreground/80 mt-3 line-clamp-2" data-testid={`text-event-description-${event.id}`}>
          {event.description}
        </p>
      )}

      {event.tags && event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {event.tags.map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 bg-muted rounded-md text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
          data-testid={`button-toggle-attendance-${event.id}`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isExpanded ? "Hide" : "View"} Attendance</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Attendees</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddAttendeeOpen(true)}
              data-testid={`button-add-attendee-${event.id}`}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              Add Attendee
            </Button>
          </div>

          {attendanceLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (attendance as any[])?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No attendees recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {(attendance as any[])?.map((record: any) => {
                const contact = contacts?.find((c: any) => c.id === record.contactId);
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2"
                    data-testid={`attendee-record-${record.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {contact?.name?.[0] || "?"}
                      </div>
                      <span className="text-sm font-medium truncate">
                        {contact?.name || `Contact #${record.contactId}`}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-xs shrink-0 ${ROLE_COLORS[record.role] || ""}`}
                      >
                        {record.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttendance.mutate(record.id)}
                      data-testid={`button-remove-attendee-${record.id}`}
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {addAttendeeOpen && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border space-y-3" data-testid={`form-add-attendee-${event.id}`}>
              <div className="space-y-2">
                <Label className="text-xs">Search Contact</Label>
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="text-sm"
                  data-testid={`input-search-contact-${event.id}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Select Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger className="text-sm" data-testid={`select-contact-${event.id}`}>
                    <SelectValue placeholder="Choose a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredContacts
                      ?.filter((c: any) => !attendeeContactIds.has(c.id))
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="text-sm" data-testid={`select-role-${event.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDEE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddAttendee}
                  disabled={!selectedContactId}
                  isLoading={addAttendance.isPending}
                  data-testid={`button-submit-attendee-${event.id}`}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddAttendeeOpen(false);
                    setSelectedContactId("");
                    setContactSearch("");
                  }}
                  data-testid={`button-cancel-attendee-${event.id}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EventFormDialog({
  open,
  onOpenChange,
  mode,
  event,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  event?: Event;
}) {
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();

  const [name, setName] = useState(event?.name || "");
  const [type, setType] = useState(event?.type || "Meeting");
  const [date, setDate] = useState(
    event ? format(new Date(event.startTime), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [startTime, setStartTime] = useState(
    event ? format(new Date(event.startTime), "HH:mm") : "09:00"
  );
  const [endTime, setEndTime] = useState(
    event ? format(new Date(event.endTime), "HH:mm") : "17:00"
  );
  const [location, setLocation] = useState(event?.location || "");
  const [attendeeCount, setAttendeeCount] = useState(
    event?.attendeeCount?.toString() || ""
  );
  const [description, setDescription] = useState(event?.description || "");
  const [tagsStr, setTagsStr] = useState(event?.tags?.join(", ") || "");
  const [formError, setFormError] = useState("");

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Please enter an event name.");
      return;
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startDt = setMinutes(setHours(new Date(date), sh), sm);
    const endDt = setMinutes(setHours(new Date(date), eh), em);

    if (endDt <= startDt) {
      setFormError("End time must be after start time.");
      return;
    }

    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      type,
      startTime: startDt,
      endTime: endDt,
      location: location || null,
      attendeeCount: attendeeCount ? parseInt(attendeeCount) : null,
      description: description || null,
      tags: tags.length > 0 ? tags : null,
      userId: "temp",
    };

    if (mode === "edit" && event) {
      updateMutation.mutate(
        { id: event.id, ...payload },
        {
          onSuccess: () => onOpenChange(false),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setName("");
          setType("Meeting");
          setDate(format(new Date(), "yyyy-MM-dd"));
          setStartTime("09:00");
          setEndTime("17:00");
          setLocation("");
          setAttendeeCount("");
          setDescription("");
          setTagsStr("");
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto px-1">
          {formError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg" data-testid="text-event-form-error">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="event-name">Event Name</Label>
            <Input
              id="event-name"
              data-testid="input-event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Startup Mixer Night"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-date">Date</Label>
            <Input
              id="event-date"
              type="date"
              data-testid="input-event-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-start">Start Time</Label>
              <Input
                id="event-start"
                type="time"
                data-testid="input-event-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">End Time</Label>
              <Input
                id="event-end"
                type="time"
                data-testid="input-event-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              data-testid="input-event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Auckland Convention Centre"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-attendees">Attendee Count</Label>
            <Input
              id="event-attendees"
              type="number"
              data-testid="input-event-attendees"
              value={attendeeCount}
              onChange={(e) => setAttendeeCount(e.target.value)}
              placeholder="e.g. 50"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              data-testid="input-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the event..."
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-tags">Tags (comma separated)</Label>
            <Input
              id="event-tags"
              data-testid="input-event-tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. networking, startup, tech"
            />
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" isLoading={isPending} className="w-full" data-testid="button-submit-event">
              {mode === "edit" ? "Save Changes" : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
