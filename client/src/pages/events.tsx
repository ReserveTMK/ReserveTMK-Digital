import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/use-events";
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
  "Networking Event",
  "Workshop",
  "Activation",
  "Conference",
  "Community Event",
  "Other",
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  "Networking Event": "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Activation": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "Conference": "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "Community Event": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Other": "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);

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
      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-events-title">Events</h1>
              <p className="text-muted-foreground mt-1">
                Track external activations, workshops, and networking events.
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
}: {
  event: Event;
  onEdit: () => void;
  isPast?: boolean;
}) {
  const deleteMutation = useDeleteEvent();
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        {event.attendeeCount !== null && event.attendeeCount !== undefined && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 shrink-0" />
            <span data-testid={`text-event-attendees-${event.id}`}>{event.attendeeCount} attendees</span>
          </div>
        )}
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
  const [type, setType] = useState(event?.type || "Networking Event");
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
          setType("Networking Event");
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
