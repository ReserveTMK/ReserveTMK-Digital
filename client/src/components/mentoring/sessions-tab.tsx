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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMeeting } from "@/hooks/use-meetings";
import { useContacts } from "@/hooks/use-contacts";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Search,
  Calendar,
  Sprout,
  TreePine,
  Sun,
  ChevronDown,
  X,
  UserPlus,
  Mail,
} from "lucide-react";
import { SessionCard } from "@/components/mentoring/session-card";
import {
  useMentorProfiles,
  useDebriefSummaries,
  useEnrichedRelationships,
  getMentorBookingId,
  isOverdue,
  JOURNEY_STAGE_CONFIG,
} from "@/components/mentoring/mentoring-hooks";
import type { Meeting, MeetingType, MentorProfile } from "@shared/schema";

export const FOCUS_OPTIONS = [
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

type Attendee = { email: string; name?: string; mentorProfileId?: number };

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  prefillContactId,
  prefillContactName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillContactId?: number;
  prefillContactName?: string;
}) {
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const { data: mentorProfiles } = useMentorProfiles();
  const { data: meetingTypes } = useQuery<MeetingType[]>({
    queryKey: ["/api/meeting-types"],
  });
  const createMeeting = useCreateMeeting();
  const [mentorUserId, setMentorUserId] = useState("");
  const [contactId, setContactId] = useState(prefillContactId ? String(prefillContactId) : "");
  const [contactSearch, setContactSearch] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [customDuration, setCustomDuration] = useState("30");
  const [customFocus, setCustomFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvites, setShowInvites] = useState(false);
  const [ventureDescription, setVentureDescription] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const [whatNeedHelpWith, setWhatNeedHelpWith] = useState("");

  const mentoringTypes = useMemo(() => {
    return (meetingTypes || []).filter(t => t.isActive && t.category === "mentoring");
  }, [meetingTypes]);

  const selectedType = useMemo(() => {
    if (selectedTypeId === "discovery") return { id: "discovery", name: "Discovery Session", duration: 45, color: "#8b5cf6", focus: null } as any;
    if (selectedTypeId === "custom") return null;
    if (!selectedTypeId) return null;
    return mentoringTypes.find(t => String(t.id) === selectedTypeId) || null;
  }, [selectedTypeId, mentoringTypes]);

  const effectiveDuration = selectedType?.duration || parseInt(customDuration);
  const effectiveFocus = selectedType?.focus || customFocus;

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return (contacts || []).slice(0, 10);
    const term = contactSearch.toLowerCase();
    return (contacts as any[]).filter((c: any) => c.name.toLowerCase().includes(term)).slice(0, 10);
  }, [contacts, contactSearch]);

  const selectedContact = useMemo(() => {
    if (!contactId || !contacts) return null;
    return (contacts as any[]).find((c: any) => c.id === parseInt(contactId));
  }, [contacts, contactId]);

  const addAttendee = (attendee: Attendee) => {
    if (attendees.some(a => a.email === attendee.email)) return;
    setAttendees([...attendees, attendee]);
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter(a => a.email !== email));
  };

  const handleAddEmail = () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) return;
    addAttendee({ email });
    setInviteEmail("");
  };

  const handleSubmit = () => {
    if (!contactId || !date || !time) return;
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + effectiveDuration * 60 * 1000);
    const contact = selectedContact;
    const isDiscovery = selectedTypeId === "discovery";

    const body: any = {
      contactId: parseInt(contactId),
      title: `Mentoring: ${contact?.name || 'Session'}`,
      description: effectiveFocus || null,
      startTime,
      endTime,
      status: "scheduled",
      location: location || null,
      type: "mentoring",
      duration: effectiveDuration,
      bookingSource: "internal",
      notes: notes || null,
      mentoringFocus: effectiveFocus || null,
      ...(mentorUserId ? { mentorUserId } : {}),
    };

    if (selectedType && selectedTypeId !== "discovery" && selectedTypeId !== "custom") {
      body.meetingTypeId = selectedType.id;
    }
    if (attendees.length > 0) {
      body.attendees = attendees;
    }
    if (isDiscovery) {
      body.discoveryGoals = {
        ventureDescription: ventureDescription || null,
        currentStage: currentStage || null,
        whatNeedHelpWith: whatNeedHelpWith || null,
      };
    }

    createMeeting.mutate(body, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setMentorUserId("");
    setContactId(prefillContactId ? String(prefillContactId) : "");
    setContactSearch("");
    setDate("");
    setTime("09:00");
    setSelectedTypeId("");
    setCustomDuration("30");
    setCustomFocus("");
    setNotes("");
    setLocation("");
    setAttendees([]);
    setInviteEmail("");
    setShowInvites(false);
    setVentureDescription("");
    setCurrentStage("");
    setWhatNeedHelpWith("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
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
            {prefillContactName && prefillContactId ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <span className="text-sm font-medium">{prefillContactName}</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Session Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                  selectedTypeId === "discovery"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setSelectedTypeId("discovery")}
                data-testid="type-discovery"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Discovery Session</p>
                  <p className="text-[10px] text-muted-foreground">45 min</p>
                </div>
              </button>
              {mentoringTypes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                    selectedTypeId === String(t.id)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => setSelectedTypeId(String(t.id))}
                  data-testid={`type-${t.id}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color || "#3b82f6" }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.duration} min</p>
                  </div>
                </button>
              ))}
              <button
                type="button"
                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                  selectedTypeId === "custom"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted border-dashed"
                }`}
                onClick={() => setSelectedTypeId("custom")}
                data-testid="type-custom"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Custom</p>
                  <p className="text-[10px] text-muted-foreground">Set your own</p>
                </div>
              </button>
            </div>
          </div>

          {selectedTypeId === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={customDuration} onValueChange={setCustomDuration}>
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
                <Label>Focus</Label>
                <Select value={customFocus} onValueChange={setCustomFocus}>
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
          )}

          {selectedTypeId === "discovery" && (
            <div className="space-y-3 p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-500/5">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Discovery Details</p>
              <div className="space-y-2">
                <Label className="text-xs">What is their venture or idea?</Label>
                <Input
                  placeholder="Brief description..."
                  value={ventureDescription}
                  onChange={(e) => setVentureDescription(e.target.value)}
                  data-testid="input-venture"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Current Stage</Label>
                <Select value={currentStage} onValueChange={setCurrentStage}>
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Where are they at?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="just_an_idea">Just an idea</SelectItem>
                    <SelectItem value="early_stage">Early stage / testing</SelectItem>
                    <SelectItem value="established">Established but stuck</SelectItem>
                    <SelectItem value="growing">Growing / scaling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">What do they need help with?</Label>
                <Textarea
                  placeholder="Key challenges or goals..."
                  value={whatNeedHelpWith}
                  onChange={(e) => setWhatNeedHelpWith(e.target.value)}
                  rows={2}
                  data-testid="input-help-with"
                />
              </div>
            </div>
          )}

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

          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <Input placeholder="e.g., Reserve TMK office" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-location" />
          </div>

          <Collapsible open={showInvites} onOpenChange={setShowInvites}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                data-testid="toggle-invites"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Others</span>
                {attendees.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{attendees.length}</Badge>
                )}
                <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showInvites ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {mentorProfiles && mentorProfiles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {mentorProfiles.filter(p => !attendees.some(a => a.mentorProfileId === p.id)).map(p => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-6 px-2"
                      onClick={() => p.email && addAttendee({ email: p.email, name: p.name, mentorProfileId: p.id })}
                      disabled={!p.email}
                      data-testid={`invite-mentor-${p.id}`}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {p.name}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <Input
                  placeholder="Email address..."
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmail(); } }}
                  className="h-8 text-xs"
                  data-testid="input-invite-email"
                />
                <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={handleAddEmail} data-testid="button-add-invite">
                  <Mail className="w-3.5 h-3.5" />
                </Button>
              </div>
              {attendees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {attendees.map(a => (
                    <Badge key={a.email} variant="secondary" className="text-[10px] h-6 px-2 gap-1">
                      {a.name || a.email}
                      <button type="button" onClick={() => removeAttendee(a.email)} className="hover:text-destructive" data-testid={`remove-attendee-${a.email}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

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

export function SessionsTab() {
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
              allMeetings={allMentorMeetings || []}
              allDebriefSummaries={debriefSummaries}
            />
          ))}
        </div>
      )}

      <ScheduleSessionDialog open={showSchedule} onOpenChange={setShowSchedule} />
    </div>
  );
}
