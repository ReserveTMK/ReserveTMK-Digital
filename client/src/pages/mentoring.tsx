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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from "@/hooks/use-meetings";
import { useContacts } from "@/hooks/use-contacts";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
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
  MoreVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Sprout,
  TreePine,
  Sun,
  Pause,
  GraduationCap,
  Target,
  ArrowRight,
} from "lucide-react";
import { useAnalyzeInteraction } from "@/hooks/use-interactions";
import { MeetingTypesSection } from "@/components/meeting-types-section";
import { MentoringOnboardingSetup } from "@/components/mentoring-onboarding-setup";
import type { Meeting, MentorProfile, MentoringRelationship, MentoringApplication } from "@shared/schema";

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

const JOURNEY_STAGE_CONFIG: Record<string, { label: string; desc: string; color: string; bgColor: string; icon: any }> = {
  kakano: { label: "Kakano", desc: "Seed / Foundation", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-800", icon: Sprout },
  tipu: { label: "Tipu", desc: "Actively Growing", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-500/10 border-green-200 dark:border-green-800", icon: TreePine },
  ora: { label: "Ora", desc: "Thriving / Sustained", color: "text-sky-700 dark:text-sky-400", bgColor: "bg-sky-500/10 border-sky-200 dark:border-sky-800", icon: Sun },
  inactive: { label: "Inactive", desc: "Paused / Stepped back", color: "text-muted-foreground", bgColor: "bg-muted border-border", icon: Pause },
};

const RELATIONSHIP_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  application: { label: "Application", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  active: { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  on_hold: { label: "On Hold", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  graduated: { label: "Graduated", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  ended: { label: "Ended", color: "bg-muted text-muted-foreground" },
};

const VENTURE_TYPE_LABELS: Record<string, string> = {
  commercial_business: "Commercial Business",
  social_enterprise: "Social Enterprise",
  creative_movement: "Creative Movement",
  community_initiative: "Community Initiative",
  exploring: "Exploring",
  ecosystem_partner: "Ecosystem Partner",
};

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
};

type EnrichedRelationship = MentoringRelationship & {
  contactName: string;
  contactEmail?: string;
  stage?: string;
  ventureType?: string;
  whatTheyAreBuilding?: string;
  completedSessionCount: number;
  upcomingSessionCount: number;
  totalSessionCount: number;
  lastSessionDate: string | null;
  lastSessionFocus: string | null;
  recentSessionIds: number[];
};

type DebriefSummary = {
  meetingId: number;
  mindsetScore?: number;
  skillScore?: number;
  confidenceScore?: number;
  keyInsights: string[];
  summary?: string;
};

function getMentorBookingId(profile: MentorProfile): string {
  return profile.mentorUserId || `mentor-${profile.id}`;
}

function useMentorProfiles() {
  return useQuery<MentorProfile[]>({ queryKey: ["/api/mentor-profiles"] });
}

function useEnrichedRelationships() {
  return useQuery<EnrichedRelationship[]>({ queryKey: ["/api/mentoring-relationships/enriched"] });
}

function useDebriefSummaries() {
  return useQuery<Record<number, DebriefSummary>>({ queryKey: ["/api/meetings/debrief-summaries"] });
}

function useMentoringApplications() {
  return useQuery<MentoringApplication[]>({ queryKey: ["/api/mentoring-applications"] });
}

function isOverdue(relationship: EnrichedRelationship): boolean {
  if (!relationship.lastSessionDate || !relationship.sessionFrequency) return false;
  if (relationship.status !== "active") return false;
  const daysSince = Math.floor((Date.now() - new Date(relationship.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24));
  const threshold = FREQUENCY_DAYS[relationship.sessionFrequency] || 30;
  return daysSince > threshold * 1.25;
}

function ScoreIndicator({ label, score, prevScore }: { label: string; score?: number; prevScore?: number }) {
  if (score === undefined || score === null) return null;
  const color = score >= 7 ? "text-green-600 dark:text-green-400" : score >= 4 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const trend = prevScore !== undefined && prevScore !== null ? (score > prevScore ? "up" : score < prevScore ? "down" : "flat") : null;
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-1 text-xs" data-testid={`score-${label.toLowerCase()}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{score}/10</span>
      {trend && <TrendIcon className={`w-3 h-3 ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`} />}
    </div>
  );
}

function JourneyStepper({ currentStage, compact }: { currentStage?: string; compact?: boolean }) {
  const stages = ["kakano", "tipu", "ora"];
  const currentIdx = stages.indexOf(currentStage || "");

  if (compact) {
    const config = JOURNEY_STAGE_CONFIG[currentStage || ""] || JOURNEY_STAGE_CONFIG.kakano;
    const StageIcon = config.icon;
    return (
      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${config.bgColor} ${config.color}`} data-testid="badge-journey-stage">
        <StageIcon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-0.5" data-testid="journey-stepper">
      {stages.map((stage, i) => {
        const config = JOURNEY_STAGE_CONFIG[stage];
        const StageIcon = config.icon;
        const isActive = i <= currentIdx;
        const isCurrent = stage === currentStage;
        return (
          <div key={stage} className="flex items-center">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${isCurrent ? `${config.bgColor} ${config.color} font-semibold border` : isActive ? `${config.color} opacity-60` : "text-muted-foreground opacity-40"}`}>
              <StageIcon className="w-3 h-3" />
              <span>{config.label}</span>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className={`w-3 h-3 mx-0.5 ${isActive ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
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
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/debrief-summaries"] });
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

function SessionCard({ meeting, contacts, showMentor, mentorProfiles, debriefSummary }: { meeting: Meeting & { mentorName?: string; coMentorName?: string | null }; contacts: any[]; showMentor?: boolean; mentorProfiles?: MentorProfile[]; debriefSummary?: DebriefSummary }) {
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const isMobile = useIsMobile();
  const [showDebrief, setShowDebrief] = useState(false);
  const [showCoMentorSelect, setShowCoMentorSelect] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const contact = contacts?.find((c: any) => c.id === meeting.contactId);
  const config = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = config.icon;
  const isPast = new Date(meeting.startTime) < new Date();
  const hasDebrief = !!meeting.interactionId;
  const hasScores = debriefSummary && (debriefSummary.mindsetScore !== undefined || debriefSummary.skillScore !== undefined || debriefSummary.confidenceScore !== undefined);

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
              {hasDebrief && !hasScores && (
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
            {hasScores && (
              <button
                className="flex items-center gap-3 mt-2 p-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors w-full text-left"
                onClick={() => setShowInsights(!showInsights)}
                data-testid={`button-insights-${meeting.id}`}
              >
                <ScoreIndicator label="Mindset" score={debriefSummary.mindsetScore} />
                <ScoreIndicator label="Skill" score={debriefSummary.skillScore} />
                <ScoreIndicator label="Confidence" score={debriefSummary.confidenceScore} />
                <ChevronDown className={`w-3 h-3 ml-auto text-muted-foreground transition-transform ${showInsights ? "rotate-180" : ""}`} />
              </button>
            )}
            {showInsights && debriefSummary && (
              <div className="mt-2 p-3 rounded-md border bg-card text-xs space-y-2" data-testid={`insights-panel-${meeting.id}`}>
                {debriefSummary.summary && (
                  <p className="text-muted-foreground">{debriefSummary.summary}</p>
                )}
                {debriefSummary.keyInsights && debriefSummary.keyInsights.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Key Insights</p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      {debriefSummary.keyInsights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          {isMobile ? (
            <div className="flex items-center gap-1 shrink-0">
              {meeting.status === "scheduled" && (
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "confirmed" })} data-testid={`button-confirm-${meeting.id}`}>
                  Confirm
                </Button>
              )}
              {(meeting.status === "confirmed" || (meeting.status === "scheduled" && isPast)) && (
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "completed" })} data-testid={`button-complete-${meeting.id}`}>
                  Complete
                </Button>
              )}
              {(meeting.status === "completed" || (isPast && meeting.status === "confirmed")) && !hasDebrief && (
                <Button size="sm" variant="outline" className="text-xs h-7 text-purple-600 border-purple-200" onClick={() => setShowDebrief(true)} data-testid={`button-debrief-${meeting.id}`}>
                  <MessageSquare className="w-3 h-3 mr-1" /> Debrief
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" data-testid={`button-menu-${meeting.id}`}>
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {mentorProfiles && mentorProfiles.length > 0 && meeting.status !== "cancelled" && (
                    <>
                      <DropdownMenuItem onClick={() => setShowCoMentorSelect(true)} data-testid={`menu-co-mentor-${meeting.id}`}>
                        <UserPlus className="w-3 h-3 mr-2" />
                        {meeting.coMentorProfileId ? "Change co-mentor" : "Add co-mentor"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {(meeting.status === "scheduled" || meeting.status === "confirmed") && (
                    <>
                      <DropdownMenuItem onClick={() => updateMeeting.mutate({ id: meeting.id, status: "cancelled" })} data-testid={`menu-cancel-${meeting.id}`} className="text-red-600">
                        Cancel
                      </DropdownMenuItem>
                      {isPast && (
                        <DropdownMenuItem onClick={() => updateMeeting.mutate({ id: meeting.id, status: "no-show" })} data-testid={`menu-noshow-${meeting.id}`} className="text-orange-600">
                          Mark No-show
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex flex-col gap-1 shrink-0">
              {meeting.status === "scheduled" && (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "confirmed" })} data-testid={`button-confirm-${meeting.id}`}>
                  Confirm
                </Button>
              )}
              {(meeting.status === "confirmed" || (meeting.status === "scheduled" && isPast)) && (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "completed" })} data-testid={`button-complete-${meeting.id}`}>
                  Complete
                </Button>
              )}
              {(meeting.status === "completed" || (isPast && meeting.status === "confirmed")) && !hasDebrief && (
                <Button size="sm" variant="outline" className="text-xs h-7 text-purple-600 border-purple-200" onClick={() => setShowDebrief(true)} data-testid={`button-debrief-${meeting.id}`}>
                  <MessageSquare className="w-3 h-3 mr-1" /> Log Debrief
                </Button>
              )}
              {mentorProfiles && mentorProfiles.length > 0 && meeting.status !== "cancelled" && (
                showCoMentorSelect ? (
                  <Select value={meeting.coMentorProfileId ? String(meeting.coMentorProfileId) : "none"} onValueChange={handleCoMentorChange}>
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
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowCoMentorSelect(true)} data-testid={`button-co-mentor-${meeting.id}`}>
                    <UserPlus className="w-3 h-3 mr-1" />
                    {meeting.coMentorProfileId ? "Change" : "Co-mentor"}
                  </Button>
                )
              )}
              {(meeting.status === "scheduled" || meeting.status === "confirmed") && (
                <>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-red-600" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "cancelled" })} data-testid={`button-cancel-${meeting.id}`}>
                    Cancel
                  </Button>
                  {isPast && (
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-orange-600" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "no-show" })} data-testid={`button-noshow-${meeting.id}`}>
                      No-show
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
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
      {showCoMentorSelect && isMobile && mentorProfiles && (
        <Dialog open={showCoMentorSelect} onOpenChange={setShowCoMentorSelect}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle>Select Co-mentor</DialogTitle>
            </DialogHeader>
            <Select value={meeting.coMentorProfileId ? String(meeting.coMentorProfileId) : "none"} onValueChange={(v) => { handleCoMentorChange(v); setShowCoMentorSelect(false); }}>
              <SelectTrigger data-testid={`mobile-select-co-mentor-${meeting.id}`}>
                <SelectValue placeholder="Select co-mentor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No co-mentor</SelectItem>
                {mentorProfiles.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
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
  const { data: debriefSummaries } = useDebriefSummaries();
  const { data: enrichedRelationships } = useEnrichedRelationships();
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

  const activeRelationships = enrichedRelationships?.filter(r => r.status === "active") || [];
  const overdueCount = activeRelationships.filter(r => isOverdue(r)).length;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const sessionsThisMonth = meetings.filter(m => new Date(m.startTime) >= thisMonth && m.status !== "cancelled").length;

  const avgSessionsPerMentee = activeRelationships.length > 0
    ? Math.round((activeRelationships.reduce((sum, r) => sum + r.completedSessionCount, 0) / activeRelationships.length) * 10) / 10
    : 0;

  const stageDistribution = useMemo(() => {
    const dist: Record<string, number> = { kakano: 0, tipu: 0, ora: 0, inactive: 0, unset: 0 };
    activeRelationships.forEach(r => {
      const s = r.stage || "unset";
      dist[s] = (dist[s] || 0) + 1;
    });
    return dist;
  }, [activeRelationships]);

  if (allLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-active-mentees">{activeRelationships.length}</p>
          <p className="text-xs text-muted-foreground">Active Mentees</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-sessions-month">{sessionsThisMonth}</p>
          <p className="text-xs text-muted-foreground">This Month</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="stat-avg-sessions">{avgSessionsPerMentee}</p>
          <p className="text-xs text-muted-foreground">Avg Sessions/Mentee</p>
        </Card>
        <Card className={`p-3 text-center ${overdueCount > 0 ? "border-amber-300 dark:border-amber-700" : ""}`}>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} data-testid="stat-overdue">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </Card>
      </div>

      {activeRelationships.length > 0 && (stageDistribution.kakano > 0 || stageDistribution.tipu > 0 || stageDistribution.ora > 0) && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="journey-distribution">
          <span className="text-xs text-muted-foreground">Journey:</span>
          {stageDistribution.kakano > 0 && (
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${JOURNEY_STAGE_CONFIG.kakano.bgColor} ${JOURNEY_STAGE_CONFIG.kakano.color}`}>
              <Sprout className="w-3 h-3 mr-1" /> {stageDistribution.kakano} Kakano
            </Badge>
          )}
          {stageDistribution.tipu > 0 && (
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${JOURNEY_STAGE_CONFIG.tipu.bgColor} ${JOURNEY_STAGE_CONFIG.tipu.color}`}>
              <TreePine className="w-3 h-3 mr-1" /> {stageDistribution.tipu} Tipu
            </Badge>
          )}
          {stageDistribution.ora > 0 && (
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${JOURNEY_STAGE_CONFIG.ora.bgColor} ${JOURNEY_STAGE_CONFIG.ora.color}`}>
              <Sun className="w-3 h-3 mr-1" /> {stageDistribution.ora} Ora
            </Badge>
          )}
        </div>
      )}

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
            <SessionCard
              key={m.id}
              meeting={m}
              contacts={(contacts || []) as any[]}
              showMentor={mentorFilter === "all" && mentorNames.length > 1}
              mentorProfiles={profiles}
              debriefSummary={debriefSummaries?.[m.id]}
            />
          ))}
        </div>
      )}

      <ScheduleSessionDialog open={showSchedule} onOpenChange={setShowSchedule} />
    </div>
  );
}

function ApplicationCard({ application, contacts, onAccept, onDecline }: {
  application: MentoringApplication;
  contacts: any[];
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
}) {
  const contact = contacts.find((c: any) => c.id === application.contactId);
  return (
    <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-500/5" data-testid={`application-card-${application.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{contact?.name || "Unknown"}</h4>
            <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-700 dark:text-blue-400">
              {application.status === "pending" ? "Pending Review" : application.status}
            </Badge>
            {application.applicationDate && (
              <span className="text-[10px] text-muted-foreground">
                Applied {new Date(application.applicationDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {application.ventureDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2">{application.ventureDescription}</p>
          )}
          {application.whatStuckOn && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Stuck on: </span>
              <span className="text-muted-foreground">{application.whatStuckOn}</span>
            </div>
          )}
          {application.whyMentoring && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Why mentoring: </span>
              <span className="text-muted-foreground">{application.whyMentoring}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" className="text-xs h-7" onClick={() => onAccept(application.id)} data-testid={`button-accept-${application.id}`}>
            Accept
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onDecline(application.id)} data-testid={`button-decline-${application.id}`}>
            Decline
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AddMenteeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: contacts } = useContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return (contacts || []).slice(0, 10);
    const term = contactSearch.toLowerCase();
    return (contacts as any[]).filter((c: any) => c.name.toLowerCase().includes(term)).slice(0, 10);
  }, [contacts, contactSearch]);

  const selectedContact = useMemo(() => {
    if (!contactId || !contacts) return null;
    return (contacts as any[]).find((c: any) => c.id === parseInt(contactId));
  }, [contacts, contactId]);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/mentoring-relationships", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      toast({ title: "Mentee added", description: "Mentoring relationship created" });
      onOpenChange(false);
      setContactId("");
      setContactSearch("");
      setFocusAreas("");
      setFrequency("monthly");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!contactId) return;
    create.mutate({
      contactId: parseInt(contactId),
      status: "active",
      startDate: new Date().toISOString(),
      focusAreas: focusAreas || null,
      sessionFrequency: frequency,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add Mentee</DialogTitle>
          <DialogDescription>Create a new mentoring relationship</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Person</Label>
            <Input
              placeholder="Search contacts..."
              value={selectedContact ? selectedContact.name : contactSearch}
              onChange={(e) => { setContactSearch(e.target.value); if (contactId) setContactId(""); }}
              data-testid="input-add-mentee-search"
            />
            {!contactId && contactSearch && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {filteredContacts.map((c: any) => (
                  <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setContactId(String(c.id)); setContactSearch(""); }} data-testid={`option-mentee-${c.id}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Focus Areas</Label>
            <Textarea placeholder="What will mentoring focus on?" value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} rows={2} data-testid="input-focus-areas" />
          </div>
          <div className="space-y-2">
            <Label>Session Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!contactId || create.isPending} data-testid="button-submit-mentee">
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add Mentee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MenteeCard({ relationship }: { relationship: EnrichedRelationship }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateRelationship = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/mentoring-relationships/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      toast({ title: "Updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const overdueStatus = isOverdue(relationship);
  const statusConfig = RELATIONSHIP_STATUS_CONFIG[relationship.status] || RELATIONSHIP_STATUS_CONFIG.active;
  const daysSinceSession = relationship.lastSessionDate
    ? Math.floor((Date.now() - new Date(relationship.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className={`p-4 transition-colors ${overdueStatus ? "border-amber-300 dark:border-amber-700" : ""}`} data-testid={`mentee-card-${relationship.id}`}>
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-${relationship.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium text-sm">{relationship.contactName}</h4>
              <Badge className={`text-[10px] h-5 px-1.5 ${statusConfig.color}`} variant="outline">
                {statusConfig.label}
              </Badge>
              {relationship.stage && <JourneyStepper currentStage={relationship.stage} compact />}
              {relationship.ventureType && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {VENTURE_TYPE_LABELS[relationship.ventureType] || relationship.ventureType}
                </Badge>
              )}
              {overdueStatus && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700" data-testid={`badge-overdue-${relationship.id}`}>
                  <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {relationship.completedSessionCount} sessions
              </span>
              {relationship.sessionFrequency && (
                <span className="capitalize">{relationship.sessionFrequency}</span>
              )}
              {daysSinceSession !== null && (
                <span>Last session {daysSinceSession === 0 ? "today" : `${daysSinceSession}d ago`}</span>
              )}
              {relationship.upcomingSessionCount > 0 && (
                <span className="text-green-600 dark:text-green-400">{relationship.upcomingSessionCount} upcoming</span>
              )}
            </div>
            {relationship.whatTheyAreBuilding && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{relationship.whatTheyAreBuilding}</p>
            )}
          </div>
          <div className="shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4" data-testid={`mentee-expanded-${relationship.id}`}>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium mb-2">Journey Stage</p>
              <JourneyStepper currentStage={relationship.stage} />
              <div className="flex gap-1 mt-2">
                {(["kakano", "tipu", "ora", "inactive"] as const).map(stage => (
                  <Button
                    key={stage}
                    size="sm"
                    variant={relationship.stage === stage ? "default" : "outline"}
                    className="text-xs h-7 capitalize"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateContact.mutate({ id: relationship.contactId, stage });
                    }}
                    disabled={updateContact.isPending}
                    data-testid={`button-set-stage-${stage}-${relationship.id}`}
                  >
                    {JOURNEY_STAGE_CONFIG[stage]?.label || stage}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2">Status</p>
              <div className="flex gap-1 flex-wrap">
                {(["active", "on_hold", "graduated", "ended"] as const).map(status => (
                  <Button
                    key={status}
                    size="sm"
                    variant={relationship.status === status ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateRelationship.mutate({
                        id: relationship.id,
                        status,
                        ...(status === "graduated" ? { endDate: new Date().toISOString() } : {}),
                        ...(status === "ended" ? { endDate: new Date().toISOString() } : {}),
                      });
                    }}
                    disabled={updateRelationship.isPending}
                    data-testid={`button-set-status-${status}-${relationship.id}`}
                  >
                    {RELATIONSHIP_STATUS_CONFIG[status]?.label || status}
                  </Button>
                ))}
              </div>
            </div>

            {relationship.focusAreas && (
              <div>
                <p className="text-xs font-medium mb-1">Focus Areas</p>
                <p className="text-xs text-muted-foreground">{relationship.focusAreas}</p>
              </div>
            )}

            {relationship.outcomesAchieved && relationship.outcomesAchieved.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Outcomes Achieved</p>
                <div className="flex flex-wrap gap-1">
                  {relationship.outcomesAchieved.map((o, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{o}</Badge>
                  ))}
                </div>
              </div>
            )}

            {relationship.graduationNotes && (
              <div>
                <p className="text-xs font-medium mb-1">Graduation Notes</p>
                <p className="text-xs text-muted-foreground">{relationship.graduationNotes}</p>
              </div>
            )}

            {relationship.lastSessionFocus && (
              <div>
                <p className="text-xs font-medium mb-1">Last Session Focus</p>
                <Badge variant="outline" className="text-[10px]">{relationship.lastSessionFocus}</Badge>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Link href={`/contacts/${relationship.contactId}`}>
                <Button size="sm" variant="outline" className="text-xs h-7" data-testid={`button-view-contact-${relationship.id}`}>
                  View Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MenteesTab() {
  const { data: enrichedRelationships, isLoading } = useEnrichedRelationships();
  const { data: applications, isLoading: appsLoading } = useMentoringApplications();
  const { data: contacts } = useContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddMentee, setShowAddMentee] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [appsOpen, setAppsOpen] = useState(true);

  const pendingApps = applications?.filter(a => a.status === "pending") || [];

  const acceptApp = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/mentoring-applications/${id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      toast({ title: "Application accepted", description: "Mentoring relationship created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declineApp = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/mentoring-applications/${id}`, { status: "declined" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      toast({ title: "Application declined" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!enrichedRelationships) return [];
    let list = enrichedRelationships;
    if (statusFilter !== "all") {
      list = list.filter(r => r.status === statusFilter);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(r => r.contactName.toLowerCase().includes(term) || r.focusAreas?.toLowerCase().includes(term));
    }
    return list.sort((a, b) => {
      if (isOverdue(a) && !isOverdue(b)) return -1;
      if (!isOverdue(a) && isOverdue(b)) return 1;
      return (b.completedSessionCount || 0) - (a.completedSessionCount || 0);
    });
  }, [enrichedRelationships, statusFilter, search]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {pendingApps.length > 0 && (
        <Collapsible open={appsOpen} onOpenChange={setAppsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-muted transition-colors" data-testid="button-toggle-applications">
              {appsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-semibold text-sm">Pending Applications</span>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{pendingApps.length}</Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {pendingApps.map(app => (
              <ApplicationCard
                key={app.id}
                application={app}
                contacts={(contacts || []) as any[]}
                onAccept={(id) => acceptApp.mutate(id)}
                onDecline={(id) => declineApp.mutate(id)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search mentees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-mentee-search" />
          </div>
          <div className="flex gap-1">
            {(["active", "on_hold", "graduated", "all"] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={statusFilter === f ? "default" : "outline"}
                className="text-xs h-8 capitalize"
                onClick={() => setStatusFilter(f)}
                data-testid={`filter-mentee-${f}`}
              >
                {f === "on_hold" ? "On Hold" : f === "all" ? "All" : f}
              </Button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddMentee(true)} data-testid="button-add-mentee">
          <Plus className="w-4 h-4 mr-1" /> Add Mentee
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all" ? "No mentees yet" : `No ${statusFilter.replace("_", " ")} mentees`}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddMentee(true)} data-testid="button-add-mentee-empty">
            <Plus className="w-4 h-4 mr-1" /> Add your first mentee
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <MenteeCard key={r.id} relationship={r} />
          ))}
        </div>
      )}

      <AddMenteeDialog open={showAddMentee} onOpenChange={setShowAddMentee} />
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
  const [showSettings, setShowSettings] = useState(false);
  const { data: applications } = useMentoringApplications();
  const pendingCount = applications?.filter(a => a.status === "pending").length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-mentoring">Mentoring</h1>
          <p className="text-muted-foreground text-sm">Manage mentoring relationships, sessions, and mentee journeys</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowSettings(true)}
          data-testid="button-mentoring-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mentoring Settings</DialogTitle>
            <DialogDescription>Configure meeting types and onboarding for mentoring</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="meeting-types">
            <TabsList>
              <TabsTrigger value="meeting-types" data-testid="tab-settings-meeting-types">Meeting Types</TabsTrigger>
              <TabsTrigger value="onboarding" data-testid="tab-settings-onboarding">Onboarding</TabsTrigger>
            </TabsList>
            <TabsContent value="meeting-types" className="mt-4">
              <MeetingTypesSection category="mentoring" />
            </TabsContent>
            <TabsContent value="onboarding" className="mt-4">
              <MentoringOnboardingSetup />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="sessions">
        <TabsList data-testid="mentoring-tabs">
          <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
          <TabsTrigger value="mentees" data-testid="tab-mentees" className="relative">
            Mentees
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-blue-600 rounded-full" data-testid="badge-pending-apps">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mentors" data-testid="tab-mentors">Mentors</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="mentees" className="mt-4">
          <MenteesTab />
        </TabsContent>
        <TabsContent value="mentors" className="mt-4">
          <MentorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
