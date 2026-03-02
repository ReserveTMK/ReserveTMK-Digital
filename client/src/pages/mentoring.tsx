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
import { useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from "@/hooks/use-meetings";
import { useContacts } from "@/hooks/use-contacts";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { Link } from "wouter";
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
  Link2,
  Trash2,
  ExternalLink,
  FileText,
  MessageSquare,
  UserPlus,
  Settings,
  Copy,
} from "lucide-react";
import { useAnalyzeInteraction } from "@/hooks/use-interactions";
import type { Meeting, MentorProfile } from "@shared/schema";

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

function getMentorBookingId(profile: MentorProfile): string {
  return profile.mentorUserId || `mentor-${profile.id}`;
}

function useMentorProfiles() {
  return useQuery<MentorProfile[]>({ queryKey: ["/api/mentor-profiles"] });
}

function ScheduleSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const { data: mentorProfiles } = useMentorProfiles();
  const createMeeting = useCreateMeeting();
  const [mentorUserId, setMentorUserId] = useState("");
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
      ...(mentorUserId ? { mentorUserId } : {}),
    } as any, {
      onSuccess: () => {
        onOpenChange(false);
        setMentorUserId("");
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
          {mentorProfiles && mentorProfiles.length > 0 && (
            <div className="space-y-2">
              <Label>Mentor</Label>
              <Select value={mentorUserId} onValueChange={setMentorUserId}>
                <SelectTrigger data-testid="select-mentor">
                  <SelectValue placeholder="Select mentor..." />
                </SelectTrigger>
                <SelectContent>
                  {mentorProfiles.map((p: MentorProfile) => (
                    <SelectItem key={p.id} value={getMentorBookingId(p)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                      setContactSearch("");
                    }}
                    data-testid={`option-contact-${c.id}`}
                  >
                    {c.name}
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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Focus</Label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger data-testid="select-focus">
                  <SelectValue placeholder="Select focus..." />
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
            <Label>Location (optional)</Label>
            <Input placeholder="e.g., Reserve TMK office" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-location" />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!contactId || !date || createMeeting.isPending} data-testid="button-submit-session">
            {createMeeting.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Schedule
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
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/all-mentors"] });
      toast({ title: "Debrief saved", description: "Session linked to interaction record" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Debrief failed", description: e.message, variant: "destructive" }),
  });

  const handleAnalyzeAndSave = async () => {
    if (!transcript.trim()) return;
    try {
      const analysis = await analyze.mutateAsync({ transcript, contactName });
      debrief.mutate({ transcript, summary: summary || undefined, analysis });
    } catch {
      toast({ title: "Analysis failed", description: "Saving debrief without analysis", variant: "destructive" });
      debrief.mutate({ transcript, summary: summary || undefined });
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
          <DialogTitle>Log Debrief: {contactName}</DialogTitle>
          <DialogDescription>Record what happened in this mentoring session</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Quick Summary</Label>
            <Textarea
              placeholder="Brief overview of the session..."
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

function SessionCard({ meeting, contacts, showMentor, mentorProfiles }: { meeting: Meeting & { mentorName?: string; coMentorName?: string | null }; contacts: any[]; showMentor?: boolean; mentorProfiles?: MentorProfile[] }) {
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const [showDebrief, setShowDebrief] = useState(false);
  const [showCoMentorSelect, setShowCoMentorSelect] = useState(false);
  const contact = contacts?.find((c: any) => c.id === meeting.contactId);
  const config = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = config.icon;
  const isPast = new Date(meeting.startTime) < new Date();
  const hasDebrief = !!meeting.interactionId;

  const handleCoMentorChange = (value: string) => {
    const coMentorProfileId = value === "none" ? null : parseInt(value);
    updateMeeting.mutate({ id: meeting.id, coMentorProfileId } as any);
    setShowCoMentorSelect(false);
  };

  return (
    <>
      <Card className="p-4" data-testid={`session-card-${meeting.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium text-sm truncate">{contact?.name || meeting.title?.replace('Mentoring: ', '') || "Unknown"}</h4>
              {showMentor && meeting.mentorName && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  <Users className="w-3 h-3 mr-1" /> {meeting.mentorName}
                </Badge>
              )}
              {meeting.coMentorName && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-400" data-testid={`badge-co-mentor-${meeting.id}`}>
                  <UserPlus className="w-3 h-3 mr-1" /> {meeting.coMentorName}
                </Badge>
              )}
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
            {mentorProfiles && mentorProfiles.length > 0 && meeting.status !== "cancelled" && (
              showCoMentorSelect ? (
                <Select
                  value={meeting.coMentorProfileId ? String(meeting.coMentorProfileId) : "none"}
                  onValueChange={handleCoMentorChange}
                >
                  <SelectTrigger className="h-7 text-xs w-[140px]" data-testid={`select-co-mentor-${meeting.id}`}>
                    <SelectValue placeholder="Co-mentor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No co-mentor</SelectItem>
                    {mentorProfiles.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setShowCoMentorSelect(true)}
                  data-testid={`button-co-mentor-${meeting.id}`}
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  {meeting.coMentorProfileId ? "Change" : "Co-mentor"}
                </Button>
              )
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
  const { data: allMentorMeetings, isLoading: allLoading } = useQuery<(Meeting & { mentorName: string; coMentorName?: string | null })[]>({
    queryKey: ["/api/meetings/all-mentors"],
  });
  const { data: contacts } = useContacts();
  const { data: profiles } = useMentorProfiles();
  const [showSchedule, setShowSchedule] = useState(false);
  const [filter, setFilter] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [mentorFilter, setMentorFilter] = useState("all");

  const meetings = useMemo(() => {
    if (!allMentorMeetings) return [];
    let list = allMentorMeetings.filter(m => m.type === "mentoring" || !m.type);
    if (mentorFilter !== "all") {
      list = list.filter(m => m.mentorName === mentorFilter);
    }
    return list;
  }, [allMentorMeetings, mentorFilter]);

  const mentorNames = useMemo(() => {
    if (!allMentorMeetings) return [];
    const names = new Set(allMentorMeetings.map(m => m.mentorName));
    return Array.from(names).sort();
  }, [allMentorMeetings]);

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
        return c?.name.toLowerCase().includes(term) || m.mentoringFocus?.toLowerCase().includes(term) || m.mentorName?.toLowerCase().includes(term);
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

  if (allLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

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
        {mentorNames.length > 1 && (
          <Select value={mentorFilter} onValueChange={setMentorFilter}>
            <SelectTrigger className="w-[140px] h-9" data-testid="select-mentor-filter">
              <SelectValue placeholder="All Mentors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mentors</SelectItem>
              {mentorNames.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            <SessionCard key={m.id} meeting={m} contacts={(contacts || []) as any[]} showMentor={mentorFilter === "all" && mentorNames.length > 1} mentorProfiles={profiles} />
          ))}
        </div>
      )}

      <ScheduleSessionDialog open={showSchedule} onOpenChange={setShowSchedule} />
    </div>
  );
}

function AddMentorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const create = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const res = await apiRequest("POST", "/api/mentor-profiles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-profiles"] });
      toast({ title: "Mentor added" });
      onOpenChange(false);
      setName("");
      setEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Mentor</DialogTitle>
          <DialogDescription>Add a new mentor to your roster</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-mentor-name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-mentor-email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate({ name, email })} disabled={!name.trim() || create.isPending} data-testid="button-submit-mentor">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Mentor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MentorsTab() {
  const { data: profiles, isLoading } = useMentorProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<number | null>(null);
  const [calendarId, setCalendarId] = useState("");

  const { data: calendars } = useQuery<{ id: string; summary: string; primary: boolean }[]>({
    queryKey: ["/api/google-calendar/list"],
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & any) => {
      const res = await apiRequest("PATCH", `/api/mentor-profiles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-profiles"] });
      toast({ title: "Mentor updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/mentor-profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-profiles"] });
      toast({ title: "Mentor removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Mentor Roster</h3>
          <p className="text-xs text-muted-foreground">Manage who can offer mentoring sessions and their calendar connections</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-mentor">
          <UserPlus className="w-4 h-4 mr-1" /> Add Mentor
        </Button>
      </div>

      <div className="space-y-3">
        {(profiles || []).map((profile) => {
          const bookingId = getMentorBookingId(profile);
          const bookingUrl = `${window.location.origin}/book/${bookingId}`;
          const isEditingCal = editingCalendar === profile.id;

          return (
            <Card key={profile.id} className="p-4" data-testid={`mentor-card-${profile.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{profile.name}</h4>
                    {profile.isActive ? (
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">Inactive</Badge>
                    )}
                    {profile.mentorUserId ? (
                      <Badge variant="secondary" className="text-[10px] h-5">Account linked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-200">Pending login</Badge>
                    )}
                  </div>
                  {profile.email && (
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[11px] bg-muted px-2 py-1 rounded max-w-[260px] truncate">{bookingUrl}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingUrl);
                        toast({ title: "Link copied!" });
                      }}
                      data-testid={`button-copy-mentor-link-${profile.id}`}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => window.open(bookingUrl, '_blank')}
                      data-testid={`button-preview-mentor-link-${profile.id}`}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> Preview
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {isEditingCal ? (
                      <div className="flex items-center gap-2">
                        <Select value={calendarId} onValueChange={setCalendarId}>
                          <SelectTrigger className="h-7 text-xs w-[260px]" data-testid={`select-calendar-${profile.id}`}>
                            <SelectValue placeholder="Select calendar..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No calendar sync</SelectItem>
                            {(calendars || []).map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.summary} {c.primary ? "(Primary)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            updateProfile.mutate({
                              id: profile.id,
                              googleCalendarId: calendarId === "none" ? null : calendarId,
                            });
                            setEditingCalendar(null);
                          }}
                          data-testid={`button-save-calendar-${profile.id}`}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setEditingCalendar(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEditingCalendar(profile.id);
                          setCalendarId(profile.googleCalendarId || "none");
                        }}
                        data-testid={`button-edit-calendar-${profile.id}`}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        {profile.googleCalendarId ? `Calendar: ${profile.googleCalendarId.split('@')[0]}` : "Set Google Calendar"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Switch
                    checked={profile.isActive ?? true}
                    onCheckedChange={(checked) => updateProfile.mutate({ id: profile.id, isActive: checked })}
                    data-testid={`switch-mentor-active-${profile.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500"
                    onClick={() => {
                      if (confirm(`Remove ${profile.name} from the mentor roster?`)) {
                        deleteProfile.mutate(profile.id);
                      }
                    }}
                    data-testid={`button-delete-mentor-${profile.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AddMentorDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}

export default function MentoringPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-mentoring">Mentoring</h1>
          <p className="text-muted-foreground text-sm">Schedule and manage 1:1 mentoring sessions</p>
        </div>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList data-testid="mentoring-tabs">
          <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
          <TabsTrigger value="mentors" data-testid="tab-mentors">Mentors</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="mentors" className="mt-4">
          <MentorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
