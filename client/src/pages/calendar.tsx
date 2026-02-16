import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Calendar,
  CalendarCheck,
  CalendarX,
  MapPin,
  Clock,
  Users,
  Link2,
  Plus,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

const EVENT_TYPES = [
  "Networking Event",
  "Workshop",
  "Activation",
  "Conference",
  "Community Event",
  "Mentoring Session",
  "Other",
];

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

function isTimeClose(a: string, b: string, thresholdMs = 3600000) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < thresholdMs;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unlinked" | "linked">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedGcalEvent, setSelectedGcalEvent] = useState<GoogleCalendarEvent | null>(null);
  const [selectedEventType, setSelectedEventType] = useState("Community Event");

  const { data: gcalEvents, isLoading: gcalLoading, error: gcalError, refetch: refetchGcal } = useQuery<GoogleCalendarEvent[]>({
    queryKey: ["/api/google-calendar/events"],
  });

  const { data: appEvents, isLoading: appLoading } = useQuery<AppEvent[]>({
    queryKey: ["/api/events"],
  });

  const reconcileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/google-calendar/reconcile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
      toast({ title: "Event imported from calendar" });
      setLinkDialogOpen(false);
      setSelectedGcalEvent(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to import", description: err.message, variant: "destructive" });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (data: { eventId: number; googleCalendarEventId: string }) => {
      const res = await apiRequest("POST", "/api/google-calendar/link", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Calendar event linked" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to link", description: err.message, variant: "destructive" });
    },
  });

  const linkedGcalIds = new Set(
    (appEvents || []).filter(e => e.googleCalendarEventId).map(e => e.googleCalendarEventId!)
  );

  const filteredEvents = (gcalEvents || []).filter(e => {
    if (search && !e.summary.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === "linked" && !linkedGcalIds.has(e.id)) return false;
    if (statusFilter === "unlinked" && linkedGcalIds.has(e.id)) return false;
    return true;
  });

  function findSuggestedMatch(gcalEvent: GoogleCalendarEvent): AppEvent | null {
    if (!appEvents) return null;
    for (const app of appEvents) {
      if (app.googleCalendarEventId === gcalEvent.id) return app;
      if (
        app.name.toLowerCase() === gcalEvent.summary.toLowerCase() &&
        isTimeClose(app.startTime, gcalEvent.start)
      ) {
        return app;
      }
    }
    return null;
  }

  function handleImportAsNew(gcalEvent: GoogleCalendarEvent) {
    setSelectedGcalEvent(gcalEvent);
    setSelectedEventType("Community Event");
    setLinkDialogOpen(true);
  }

  function confirmImport() {
    if (!selectedGcalEvent) return;
    reconcileMutation.mutate({
      googleCalendarEventId: selectedGcalEvent.id,
      summary: selectedGcalEvent.summary,
      description: selectedGcalEvent.description,
      location: selectedGcalEvent.location,
      start: selectedGcalEvent.start,
      end: selectedGcalEvent.end,
      type: selectedEventType,
    });
  }

  function handleLinkToExisting(gcalEvent: GoogleCalendarEvent, appEvent: AppEvent) {
    linkMutation.mutate({
      eventId: appEvent.id,
      googleCalendarEventId: gcalEvent.id,
    });
  }

  const isLoading = gcalLoading || appLoading;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-calendar-title">
                Calendar Sync
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Reconcile your Google Calendar events with your tracked events
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetchGcal()}
              disabled={gcalLoading}
              data-testid="button-refresh-calendar"
            >
              <RefreshCw className={gcalLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search calendar events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-calendar-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-calendar-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="unlinked">Unlinked Only</SelectItem>
                <SelectItem value="linked">Linked Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {gcalError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarX className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Unable to load calendar</h3>
                <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">
                  There was a problem connecting to your Google Calendar. Make sure your account is connected.
                </p>
                <Button variant="outline" onClick={() => refetchGcal()} data-testid="button-retry-calendar">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarX className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No calendar events found</h3>
                <p className="text-muted-foreground text-sm text-center max-w-sm">
                  {search || statusFilter !== "all"
                    ? "Try adjusting your search or filter"
                    : "Your Google Calendar has no events in the past 90 days or next 30 days"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((gcalEvent) => {
                const isLinked = linkedGcalIds.has(gcalEvent.id);
                const suggestedMatch = !isLinked ? findSuggestedMatch(gcalEvent) : null;
                const isExpanded = expandedId === gcalEvent.id;
                const linkedAppEvent = isLinked
                  ? (appEvents || []).find(e => e.googleCalendarEventId === gcalEvent.id)
                  : null;

                return (
                  <Card key={gcalEvent.id} className={isLinked ? "border-green-500/30 bg-green-500/5" : ""} data-testid={`card-gcal-event-${gcalEvent.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate" data-testid={`text-gcal-summary-${gcalEvent.id}`}>
                              {gcalEvent.summary}
                            </h3>
                            {isLinked ? (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                                <Link2 className="w-3 h-3 mr-1" />
                                Linked
                              </Badge>
                            ) : suggestedMatch ? (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                                Possible match
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(gcalEvent.start)} {formatTime(gcalEvent.start)} - {formatTime(gcalEvent.end)}
                            </span>
                            {gcalEvent.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[200px]">{gcalEvent.location}</span>
                              </span>
                            )}
                            {gcalEvent.attendees.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {gcalEvent.attendees.length}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isLinked && (
                            <Button
                              size="sm"
                              onClick={() => handleImportAsNew(gcalEvent)}
                              data-testid={`button-import-${gcalEvent.id}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Import</span>
                            </Button>
                          )}
                          {isLinked && linkedAppEvent && (
                            <a
                              href={`/events`}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setExpandedId(isExpanded ? null : gcalEvent.id)}
                            data-testid={`button-expand-${gcalEvent.id}`}
                          >
                            {isExpanded ? <ChevronUp /> : <ChevronDown />}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          {gcalEvent.description && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{gcalEvent.description}</p>
                            </div>
                          )}
                          {gcalEvent.attendees.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Attendees</p>
                              <div className="flex flex-wrap gap-2">
                                {gcalEvent.attendees.map((a, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {a.displayName}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {gcalEvent.htmlLink && (
                            <a
                              href={gcalEvent.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              Open in Google Calendar <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {suggestedMatch && !isLinked && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
                              <p className="text-sm font-medium text-amber-700 mb-2">
                                Possible match: "{suggestedMatch.name}"
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLinkToExisting(gcalEvent, suggestedMatch)}
                                disabled={linkMutation.isPending}
                                data-testid={`button-link-match-${gcalEvent.id}`}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                Link to this event
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Showing {filteredEvents.length} calendar event{filteredEvents.length !== 1 ? "s" : ""} from the past 90 days and next 30 days
          </div>
        </div>

        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Import Calendar Event</DialogTitle>
            </DialogHeader>
            {selectedGcalEvent && (
              <div className="space-y-4 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedGcalEvent.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(selectedGcalEvent.start)} {formatTime(selectedGcalEvent.start)} - {formatTime(selectedGcalEvent.end)}
                  </p>
                  {selectedGcalEvent.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {selectedGcalEvent.location}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Event Type</label>
                  <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                    <SelectTrigger data-testid="select-import-event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setLinkDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmImport}
                isLoading={reconcileMutation.isPending}
                data-testid="button-confirm-import"
              >
                Import Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
