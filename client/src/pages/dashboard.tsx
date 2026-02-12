import { Sidebar } from "@/components/layout/sidebar";
import { MetricCard } from "@/components/ui/metric-card";
import { useContacts } from "@/hooks/use-contacts";
import { useInteractions } from "@/hooks/use-interactions";
import { useMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from "@/hooks/use-meetings";
import { useAuth } from "@/hooks/use-auth";
import { Users, Activity, TrendingUp, Calendar as CalendarIcon, ArrowRight, Plus, Clock, MapPin, X, Check, Trash2, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay, addHours, setHours, setMinutes } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import type { Meeting, Contact } from "@shared/schema";

const MEETING_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: contacts, isLoading: loadingContacts } = useContacts();
  const { data: interactions, isLoading: loadingInteractions } = useInteractions();
  const { data: meetings, isLoading: loadingMeetings } = useMeetings();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
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

  const upcomingMeetings = useMemo(() => {
    if (!meetings) return [];
    const now = new Date();
    return meetings
      .filter((m: Meeting) => new Date(m.startTime) >= now && m.status === "scheduled")
      .sort((a: Meeting, b: Meeting) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [meetings]);

  const nextSessionLabel = useMemo(() => {
    if (!upcomingMeetings.length) return "None";
    const next = new Date(upcomingMeetings[0].startTime);
    if (isToday(next)) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (isSameDay(next, tomorrow)) return "Tomorrow";
    return format(next, "MMM d");
  }, [upcomingMeetings]);

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

  const selectedDayMeetings = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return meetingsByDate.get(key) || [];
  }, [selectedDate, meetingsByDate]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground" data-testid="text-welcome">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-muted-foreground text-lg">
              Here's what's happening with your mentorship program.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
              title="Avg Confidence"
              value={avgConfidence}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
              trend={avgConfidence !== "N/A" && Number(avgConfidence) > 7 ? "up" : "neutral"}
              trendValue="Good"
            />
            <MetricCard
              title="Next Session"
              value={nextSessionLabel}
              icon={<CalendarIcon className="w-5 h-5" />}
              color="blue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-bold font-display">Calendar</h2>
                <Button onClick={() => setBookDialogOpen(true)} data-testid="button-book-meeting">
                  <Plus className="w-4 h-4 mr-2" />
                  Book Meeting
                </Button>
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
                        {dayMeetings.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {dayMeetings.slice(0, 3).map((m, i) => (
                              <div
                                key={i}
                                className={`w-full h-1 rounded-full ${
                                  m.status === "cancelled" ? "bg-red-400" :
                                  m.status === "completed" ? "bg-green-400" : "bg-blue-400"
                                }`}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDate(new Date());
                      setBookDialogOpen(true);
                    }}
                    data-testid="button-quick-book"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Quick Book
                  </Button>
                </div>

                {selectedDayMeetings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDayMeetings.map((meeting) => {
                      const contact = contacts?.find((c: Contact) => c.id === meeting.contactId);
                      return (
                        <button
                          key={meeting.id}
                          onClick={() => setViewMeeting(meeting)}
                          data-testid={`button-meeting-${meeting.id}`}
                          className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-start gap-3"
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
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No meetings on this day.</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-primary"
                      onClick={() => setBookDialogOpen(true)}
                    >
                      Book one now
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display">Upcoming Meetings</h2>
              <Card className="p-4 md:p-6">
                {loadingMeetings ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : upcomingMeetings.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingMeetings.slice(0, 8).map((meeting: Meeting) => {
                      const contact = contacts?.find((c: Contact) => c.id === meeting.contactId);
                      return (
                        <button
                          key={meeting.id}
                          onClick={() => {
                            setSelectedDate(new Date(meeting.startTime));
                            setViewMeeting(meeting);
                          }}
                          data-testid={`button-upcoming-meeting-${meeting.id}`}
                          className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col items-center bg-primary/10 rounded-lg px-2 py-1 shrink-0">
                            <span className="text-xs font-medium text-primary">{format(new Date(meeting.startTime), "MMM")}</span>
                            <span className="text-lg font-bold text-primary leading-tight">{format(new Date(meeting.startTime), "d")}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{meeting.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(meeting.startTime), "h:mm a")} {contact ? `with ${contact.name}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No upcoming meetings.</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-primary"
                      onClick={() => setBookDialogOpen(true)}
                    >
                      Schedule one
                    </Button>
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

      <BookMeetingDialog
        open={bookDialogOpen}
        onOpenChange={setBookDialogOpen}
        contacts={contacts || []}
        defaultDate={selectedDate}
      />

      <ViewMeetingDialog
        meeting={viewMeeting}
        onClose={() => setViewMeeting(null)}
        contacts={contacts || []}
      />
    </div>
  );
}

function BookMeetingDialog({
  open,
  onOpenChange,
  contacts,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: Contact[];
  defaultDate: Date;
}) {
  const { mutate, isPending } = useCreateMeeting();
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setTitle("");
    setContactId("");
    setDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    setLocation("");
    setDescription("");
  };

  const [formError, setFormError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Please enter a meeting title.");
      return;
    }
    if (!contactId) {
      setFormError("Please select a community member.");
      return;
    }

    const meetingDate = date || format(defaultDate, "yyyy-MM-dd");
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startDt = setMinutes(setHours(new Date(meetingDate), sh), sm);
    const endDt = setMinutes(setHours(new Date(meetingDate), eh), em);

    if (endDt <= startDt) {
      setFormError("End time must be after start time.");
      return;
    }

    mutate(
      {
        title: title.trim(),
        contactId: parseInt(contactId),
        startTime: startDt,
        endTime: endDt,
        location: location || undefined,
        description: description || undefined,
        status: "scheduled",
        userId: "temp",
      },
      {
        onSuccess: () => {
          resetForm();
          setFormError("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Book a Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {formError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg" data-testid="text-form-error">
              {formError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Meeting Title</Label>
            <Input
              id="meeting-title"
              data-testid="input-meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Check-in"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-contact">Community Member</Label>
            <Select value={contactId} onValueChange={setContactId} required>
              <SelectTrigger data-testid="select-meeting-contact">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-date">Date</Label>
            <Input
              id="meeting-date"
              data-testid="input-meeting-date"
              type="date"
              value={date || format(defaultDate, "yyyy-MM-dd")}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-start">Start Time</Label>
              <Input
                id="meeting-start"
                data-testid="input-meeting-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-end">End Time</Label>
              <Input
                id="meeting-end"
                data-testid="input-meeting-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-location">Location (optional)</Label>
            <Input
              id="meeting-location"
              data-testid="input-meeting-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Zoom, Office, Cafe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-description">Notes (optional)</Label>
            <Input
              id="meeting-description"
              data-testid="input-meeting-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any agenda or notes for this meeting"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !title || !contactId} data-testid="button-submit-meeting">
              {isPending ? "Booking..." : "Book Meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const { mutate: updateMeeting, isPending: updating } = useUpdateMeeting();
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
          {meeting.status === "scheduled" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateMeeting(
                    { id: meeting.id, status: "completed" },
                    { onSuccess: onClose }
                  );
                }}
                disabled={updating}
                data-testid="button-complete-meeting"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateMeeting(
                    { id: meeting.id, status: "cancelled" },
                    { onSuccess: onClose }
                  );
                }}
                disabled={updating}
                data-testid="button-cancel-meeting"
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </>
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
