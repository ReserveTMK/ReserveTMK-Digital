import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from "@/hooks/use-meetings";
import { useContacts } from "@/hooks/use-contacts";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Search,
  Clock,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  UserX,
  Copy,
  Link2,
  Trash2,
  ExternalLink,
  FileText,
  MessageSquare,
  CalendarCheck,
  CalendarX,
  Zap,
} from "lucide-react";
import { useAnalyzeInteraction } from "@/hooks/use-interactions";
import type { Meeting, MentorAvailability } from "@shared/schema";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const FOCUS_OPTIONS = [
  "Venture Planning",
  "Brand & Identity",
  "Funding & Sustainability",
  "Digital & Content",
  "Skills & Capability",
  "Networking & Connections",
  "Goal Setting",
  "General Catch-up",
  "Follow-up",
  "Other",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: Calendar },
  confirmed: { label: "Confirmed", color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-700 dark:text-red-400", icon: XCircle },
  "no-show": { label: "No-show", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400", icon: UserX },
};

function useAvailability() {
  return useQuery<MentorAvailability[]>({
    queryKey: ["/api/mentor-availability"],
  });
}

function useCreateAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/mentor-availability", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "Availability added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

function useUpdateAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & any) => {
      const res = await apiRequest("PATCH", `/api/mentor-availability/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] }),
  });
}

function useDeleteAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/mentor-availability/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "Slot removed" });
    },
  });
}

function ScheduleSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const createMeeting = useCreateMeeting();
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return (contacts || []).slice(0, 10);
    const term = contactSearch.toLowerCase();
    return (contacts as any[]).filter((c: any) => c.name.toLowerCase().includes(term)).slice(0, 10);
  }, [contacts, contactSearch]);

  const selectedContact = useMemo(() => {
    if (!contactId || !contacts) return null;
    return (contacts as any[]).find((c: any) => c.id === parseInt(contactId));
  }, [contacts, contactId]);

  const handleSubmit = () => {
    if (!contactId || !date || !time) return;
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + parseInt(duration) * 60 * 1000);
    const contact = selectedContact;
    createMeeting.mutate({
      contactId: parseInt(contactId),
      title: `Mentoring: ${contact?.name || 'Session'}`,
      description: focus || null,
      startTime,
      endTime,
      status: "scheduled",
      location: location || null,
      type: "mentoring",
      duration: parseInt(duration),
      bookingSource: "internal",
      notes: notes || null,
      mentoringFocus: focus || null,
    } as any, {
      onSuccess: () => {
        onOpenChange(false);
        setContactId("");
        setContactSearch("");
        setDate("");
        setTime("09:00");
        setDuration("30");
        setFocus("");
        setNotes("");
        setLocation("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Mentoring Session</DialogTitle>
          <DialogDescription>Book a 1:1 session with a mentee</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Mentee</Label>
            <Input
              placeholder="Search contacts..."
              value={selectedContact ? selectedContact.name : contactSearch}
              onChange={(e) => {
                setContactSearch(e.target.value);
                if (contactId) setContactId("");
              }}
              data-testid="input-mentee-search"
            />
            {!contactId && contactSearch && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {filteredContacts.map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    onClick={() => {
                      setContactId(String(c.id));
                      setContactSearch(c.name);
                    }}
                    data-testid={`select-contact-${c.id}`}
                  >
                    {c.name} {c.role && <span className="text-muted-foreground">· {c.role}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-session-date" />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-session-time" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Focus Area</Label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger data-testid="select-focus">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_OPTIONS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. The Hub, Zoom, Phone" data-testid="input-location" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prep notes or context..." rows={2} data-testid="input-session-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!contactId || !date || !time || createMeeting.isPending} data-testid="button-schedule-session">
            {createMeeting.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAvailabilityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createAvailability = useCreateAvailability();
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");
  const [bufferMinutes, setBufferMinutes] = useState("15");

  const handleSubmit = () => {
    createAvailability.mutate({
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      slotDuration: parseInt(slotDuration),
      bufferMinutes: parseInt(bufferMinutes),
      isActive: true,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Availability Window</DialogTitle>
          <DialogDescription>Set when you're available for mentoring</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Day</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger data-testid="select-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-avail-start" />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-avail-end" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Slot Duration</Label>
              <Select value={slotDuration} onValueChange={setSlotDuration}>
                <SelectTrigger data-testid="select-slot-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buffer Between</Label>
              <Select value={bufferMinutes} onValueChange={setBufferMinutes}>
                <SelectTrigger data-testid="select-buffer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No buffer</SelectItem>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createAvailability.isPending} data-testid="button-add-availability">
            {createAvailability.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebriefDialog({ meeting, contactName, open, onOpenChange }: { meeting: Meeting; contactName: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const analyze = useAnalyzeInteraction();

  const debrief = useMutation({
    mutationFn: async (data: { transcript?: string; summary?: string; analysis?: any }) => {
      const res = await apiRequest("POST", `/api/meetings/${meeting.id}/debrief`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Debrief logged", description: "Session marked as completed with linked transcript" });
      onOpenChange(false);
      setTranscript("");
      setSummary("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAnalyzeAndSave = () => {
    if (!transcript.trim() && !summary.trim()) return;
    if (transcript.trim()) {
      analyze.mutate({ text: transcript }, {
        onSuccess: (data) => {
          debrief.mutate({
            transcript,
            summary: data.summary || summary,
            analysis: {
              mindsetScore: data.metrics?.mindset,
              skillScore: data.metrics?.skill,
              confidenceScore: data.metrics?.confidence,
              confidenceScoreMetric: data.metrics?.confidenceScore,
              systemsInPlaceScore: data.metrics?.systemsInPlace,
              fundingReadinessScore: data.metrics?.fundingReadiness,
              networkStrengthScore: data.metrics?.networkStrength,
              keyInsights: data.keywords,
            },
          });
        },
      });
    } else {
      debrief.mutate({ summary });
    }
  };

  const handleQuickSave = () => {
    if (!summary.trim()) return;
    debrief.mutate({ summary });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Debrief</DialogTitle>
          <DialogDescription>Record notes or a transcript for your session with {contactName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Quick Summary</Label>
            <Textarea
              placeholder="What happened in this session? Key takeaways, actions..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              data-testid="input-debrief-summary"
            />
          </div>
          <div className="space-y-2">
            <Label>Full Transcript (optional)</Label>
            <p className="text-xs text-muted-foreground">Paste a transcript for AI-powered analysis of mindset, skill, and confidence metrics</p>
            <Textarea
              placeholder="Paste conversation transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
              data-testid="input-debrief-transcript"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {transcript.trim() ? (
            <Button
              onClick={handleAnalyzeAndSave}
              disabled={debrief.isPending || analyze.isPending}
              data-testid="button-analyze-save"
            >
              {(debrief.isPending || analyze.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Analyze & Save
            </Button>
          ) : (
            <Button
              onClick={handleQuickSave}
              disabled={!summary.trim() || debrief.isPending}
              data-testid="button-quick-save"
            >
              {debrief.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Debrief
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionCard({ meeting, contacts }: { meeting: Meeting; contacts: any[] }) {
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const [showDebrief, setShowDebrief] = useState(false);
  const contact = contacts?.find((c: any) => c.id === meeting.contactId);
  const config = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = config.icon;
  const isPast = new Date(meeting.startTime) < new Date();
  const hasDebrief = !!meeting.interactionId;

  return (
    <>
      <Card className="p-4" data-testid={`session-card-${meeting.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{contact?.name || "Unknown"}</h4>
              <Badge className={`text-[10px] h-5 px-1.5 ${config.color}`} variant="outline" data-testid={`badge-status-${meeting.id}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
              {meeting.bookingSource === "public_link" && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  <Link2 className="w-3 h-3 mr-1" /> Public
                </Badge>
              )}
              {hasDebrief && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" data-testid={`badge-debriefed-${meeting.id}`}>
                  <FileText className="w-3 h-3 mr-1" /> Debriefed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(meeting.startTime).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(meeting.startTime).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}
                {meeting.duration && ` · ${meeting.duration}min`}
              </span>
              {meeting.location && <span>{meeting.location}</span>}
            </div>
            {meeting.mentoringFocus && (
              <Badge variant="outline" className="mt-1.5 text-[10px] h-5">{meeting.mentoringFocus}</Badge>
            )}
            {meeting.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meeting.notes}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {meeting.status === "scheduled" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => updateMeeting.mutate({ id: meeting.id, status: "confirmed" })}
                data-testid={`button-confirm-${meeting.id}`}
              >
                Confirm
              </Button>
            )}
            {(meeting.status === "confirmed" || (meeting.status === "scheduled" && isPast)) && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => updateMeeting.mutate({ id: meeting.id, status: "completed" })}
                data-testid={`button-complete-${meeting.id}`}
              >
                Complete
              </Button>
            )}
            {(meeting.status === "completed" || (isPast && meeting.status === "confirmed")) && !hasDebrief && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-purple-600 border-purple-200"
                onClick={() => setShowDebrief(true)}
                data-testid={`button-debrief-${meeting.id}`}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Log Debrief
              </Button>
            )}
            {(meeting.status === "scheduled" || meeting.status === "confirmed") && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-red-600"
                  onClick={() => updateMeeting.mutate({ id: meeting.id, status: "cancelled" })}
                  data-testid={`button-cancel-${meeting.id}`}
                >
                  Cancel
                </Button>
                {isPast && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 text-orange-600"
                    onClick={() => updateMeeting.mutate({ id: meeting.id, status: "no-show" })}
                    data-testid={`button-noshow-${meeting.id}`}
                  >
                    No-show
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
      {showDebrief && (
        <DebriefDialog
          meeting={meeting}
          contactName={contact?.name || "Unknown"}
          open={showDebrief}
          onOpenChange={setShowDebrief}
        />
      )}
    </>
  );
}

function SessionsTab() {
  const { data: meetingsData, isLoading } = useMeetings();
  const { data: contacts } = useContacts();
  const [showSchedule, setShowSchedule] = useState(false);
  const [filter, setFilter] = useState("upcoming");
  const [search, setSearch] = useState("");

  const meetings = useMemo(() => {
    if (!meetingsData) return [];
    return (meetingsData as Meeting[]).filter(m => m.type === "mentoring" || !m.type);
  }, [meetingsData]);

  const now = new Date();

  const filtered = useMemo(() => {
    let list = meetings;
    if (filter === "upcoming") {
      list = list.filter(m => new Date(m.startTime) >= now && m.status !== "cancelled");
    } else if (filter === "past") {
      list = list.filter(m => new Date(m.startTime) < now || m.status === "completed");
    } else if (filter === "cancelled") {
      list = list.filter(m => m.status === "cancelled" || m.status === "no-show");
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      const contactList = (contacts || []) as any[];
      list = list.filter(m => {
        const c = contactList.find((ct: any) => ct.id === m.contactId);
        return c?.name.toLowerCase().includes(term) || m.mentoringFocus?.toLowerCase().includes(term);
      });
    }
    return list.sort((a, b) => {
      if (filter === "past") return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [meetings, filter, search, contacts, now]);

  const stats = useMemo(() => {
    const total = meetings.length;
    const completed = meetings.filter(m => m.status === "completed").length;
    const upcoming = meetings.filter(m => new Date(m.startTime) >= now && m.status !== "cancelled").length;
    const uniqueMentees = new Set(meetings.map(m => m.contactId)).size;
    return { total, completed, upcoming, uniqueMentees };
  }, [meetings, now]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-total-sessions">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Sessions</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-completed">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-upcoming">{stats.upcoming}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-mentees">{stats.uniqueMentees}</p>
          <p className="text-xs text-muted-foreground">Mentees</p>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search sessions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-session-search" />
        </div>
        <div className="flex gap-1">
          {(["upcoming", "past", "cancelled"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="text-xs h-8 capitalize"
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
            >
              {f}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowSchedule(true)} data-testid="button-schedule-new">
          <Plus className="w-4 h-4 mr-1" />
          Schedule Session
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No {filter} sessions</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowSchedule(true)} data-testid="button-schedule-empty">
            <Plus className="w-4 h-4 mr-1" /> Schedule your first session
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <SessionCard key={m.id} meeting={m} contacts={(contacts || []) as any[]} />
          ))}
        </div>
      )}

      <ScheduleSessionDialog open={showSchedule} onOpenChange={setShowSchedule} />
    </div>
  );
}

function AvailabilityTab() {
  const { data: availability, isLoading } = useAvailability();
  const updateAvailability = useUpdateAvailability();
  const deleteAvailability = useDeleteAvailability();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: calStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/google-calendar/status"],
  });

  const quickSetup = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mentor-availability/quick-setup");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "Availability set up", description: "Default hours added: Mon–Fri, 9am–4pm" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bookingUrl = useMemo(() => {
    if (!user) return "";
    return `${window.location.origin}/book/${(user as any).id}`;
  }, [user]);

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({ title: "Link copied!", description: "Share this link for people to book mentoring sessions" });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const slots = (availability || []) as MentorAvailability[];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">Your Booking Link</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Share this link so people can book mentoring sessions with you</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-3 py-1.5 rounded-md max-w-[300px] truncate" data-testid="text-booking-url">
              {bookingUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(bookingUrl, '_blank')} data-testid="button-preview-link">
              <ExternalLink className="w-4 h-4 mr-1" /> Preview
            </Button>
          </div>
        </div>
      </Card>

      {calStatus?.connected ? (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2" data-testid="notice-gcal-connected">
          <CalendarCheck className="w-4 h-4 shrink-0" />
          <span>Google Calendar connected — your busy times are automatically excluded from available slots</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2" data-testid="notice-gcal-disconnected">
          <CalendarX className="w-4 h-4 shrink-0" />
          <span>Google Calendar not connected — connect it to automatically block busy times from your booking slots</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Weekly Availability</h3>
          <p className="text-xs text-muted-foreground">Set the times you're available for mentoring each week</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-availability">
          <Plus className="w-4 h-4 mr-1" /> Add Window
        </Button>
      </div>

      {slots.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No availability set</p>
          <p className="text-xs text-muted-foreground mt-1">Add your weekly hours so people can book sessions</p>
          <div className="flex justify-center gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add manually
            </Button>
            <Button size="sm" onClick={() => quickSetup.mutate()} disabled={quickSetup.isPending} data-testid="button-quick-setup">
              {quickSetup.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              Quick Setup (Mon–Fri, 9–4)
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-2">
          {DAY_NAMES.map((day, dayIdx) => {
            const daySlots = slots.filter(s => s.dayOfWeek === dayIdx);
            if (daySlots.length === 0) return null;
            return (
              <Card key={dayIdx} className="p-3" data-testid={`availability-day-${dayIdx}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm w-24">{day}</span>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {slot.startTime} – {slot.endTime}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {slot.slotDuration}min slots · {slot.bufferMinutes}min buffer
                          </span>
                          <Switch
                            checked={slot.isActive ?? true}
                            onCheckedChange={(checked) => updateAvailability.mutate({ id: slot.id, isActive: checked })}
                            data-testid={`switch-active-${slot.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => deleteAvailability.mutate(slot.id)}
                            data-testid={`button-delete-avail-${slot.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddAvailabilityDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}

export default function MentoringPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-mentoring">Mentoring</h1>
        <p className="text-muted-foreground text-sm">Schedule and manage 1:1 mentoring sessions</p>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList data-testid="mentoring-tabs">
          <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="availability" className="mt-4">
          <AvailabilityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
