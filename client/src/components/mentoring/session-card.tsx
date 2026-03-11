import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUpdateMeeting } from "@/hooks/use-meetings";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Loader2,
  Clock,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  UserX,
  Link2,
  FileText,
  MessageSquare,
  UserPlus,
  MoreVertical,
  ChevronDown,
  Sprout,
  TreePine,
  Sun,
  Brain,
  Send,
  Save,
} from "lucide-react";
import { useAnalyzeInteraction } from "@/hooks/use-interactions";
import { ScoreIndicator } from "@/components/mentoring/score-indicator";
import { JOURNEY_STAGE_CONFIG } from "@/components/mentoring/mentoring-hooks";
import type { Meeting, MentorProfile, MentoringApplication } from "@shared/schema";
import type { DebriefSummary } from "@/components/mentoring/mentoring-hooks";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: Calendar },
  confirmed: { label: "Confirmed", color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-700 dark:text-red-400", icon: XCircle },
  "no-show": { label: "No-show", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400", icon: UserX },
};

export { STATUS_CONFIG };

const STAGE_ICONS: Record<string, any> = { kakano: Sprout, tipu: TreePine, ora: Sun };

type Attendee = { email: string; name?: string; mentorProfileId?: number };

function SessionPrepContext({ contactId, allMeetings, debriefSummaries, contacts }: {
  contactId: number;
  allMeetings: (Meeting & { mentorName?: string })[];
  debriefSummaries?: Record<number, DebriefSummary>;
  contacts: any[];
}) {
  const contact = contacts.find(c => c.id === contactId);
  const pastSessions = allMeetings
    .filter(m => m.contactId === contactId && m.status === "completed" && m.interactionId)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const lastSession = pastSessions[0];
  const lastDebrief = lastSession ? debriefSummaries?.[lastSession.id] : null;
  const stage = contact?.stage;

  if (!lastDebrief && !stage) return null;

  const StageIcon = stage ? STAGE_ICONS[stage] : null;
  const stageConfig = stage ? JOURNEY_STAGE_CONFIG[stage as keyof typeof JOURNEY_STAGE_CONFIG] : null;

  return (
    <div className="mt-2 p-2.5 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 space-y-1.5" data-testid="session-prep">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <Brain className="w-3 h-3" />
        Session Prep
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {stageConfig && StageIcon && (
          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${stageConfig.bgColor} ${stageConfig.color}`}>
            <StageIcon className="w-3 h-3 mr-0.5" /> {stageConfig.label}
          </Badge>
        )}
        {lastSession?.mentoringFocus && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
            Last: {lastSession.mentoringFocus}
          </Badge>
        )}
      </div>
      {lastDebrief?.summary && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">{lastDebrief.summary}</p>
      )}
      {lastDebrief && (lastDebrief.mindsetScore !== undefined || lastDebrief.skillScore !== undefined || lastDebrief.confidenceScore !== undefined) && (
        <div className="flex items-center gap-3">
          <ScoreIndicator label="M" score={lastDebrief.mindsetScore} />
          <ScoreIndicator label="S" score={lastDebrief.skillScore} />
          <ScoreIndicator label="C" score={lastDebrief.confidenceScore} />
        </div>
      )}
    </div>
  );
}

function InlineSessionNotes({ meeting, contactName }: { meeting: Meeting; contactName: string }) {
  const [notes, setNotes] = useState(meeting.notes || "");
  const [nextSteps, setNextSteps] = useState((meeting as any).nextSteps || "");
  const [sending, setSending] = useState(false);
  const updateMeeting = useUpdateMeeting();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const analyze = useAnalyzeInteraction();

  const debrief = useMutation({
    mutationFn: async (data: { summary?: string; transcript?: string; analysis?: any }) => {
      const res = await apiRequest("POST", `/api/meetings/${meeting.id}/debrief`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/all-mentors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/debrief-summaries"] });
    },
  });

  const hasChanges = notes !== (meeting.notes || "") || nextSteps !== ((meeting as any).nextSteps || "");
  const hasDebrief = !!meeting.interactionId;

  const handleSave = async () => {
    updateMeeting.mutate({ id: meeting.id, notes, nextSteps } as any, {
      onSuccess: async () => {
        if (notes.trim() && !hasDebrief) {
          try {
            const analysis = await analyze.mutateAsync({ transcript: notes, contactName } as any);
            await debrief.mutateAsync({ summary: notes, analysis });
          } catch {
            try {
              await debrief.mutateAsync({ summary: notes });
            } catch {}
          }
        }
      },
    });
  };

  const handleSend = async () => {
    if (!notes.trim()) return;
    if (hasChanges) {
      updateMeeting.mutate({ id: meeting.id, notes, nextSteps } as any, {
        onSuccess: async () => {
          if (notes.trim() && !hasDebrief) {
            try {
              await debrief.mutateAsync({ summary: notes });
            } catch {}
          }
          doSend();
        },
      });
    } else {
      doSend();
    }
  };

  const doSend = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/meetings/${meeting.id}/send-notes`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      toast({ title: "Sent", description: `Session notes emailed to ${contactName}` });
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-3" data-testid={`session-notes-${meeting.id}`}>
      <div className="space-y-1.5">
        <Label className="text-xs">Session Notes</Label>
        <Textarea
          placeholder="Summary of the session..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="text-sm"
          data-testid={`input-session-notes-${meeting.id}`}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Next Steps / Homework</Label>
        <Textarea
          placeholder="Action items, homework, follow-ups..."
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          rows={2}
          className="text-sm"
          data-testid={`input-next-steps-${meeting.id}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={handleSave}
          disabled={updateMeeting.isPending || debrief.isPending || analyze.isPending}
          data-testid={`button-save-notes-${meeting.id}`}
        >
          {(updateMeeting.isPending || debrief.isPending || analyze.isPending) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Save
        </Button>
        {notes.trim() && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 text-blue-600 border-blue-200 dark:border-blue-800"
            onClick={handleSend}
            disabled={sending || updateMeeting.isPending}
            data-testid={`button-send-notes-${meeting.id}`}
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
            Send to Mentee
          </Button>
        )}
      </div>
    </div>
  );
}

export function SessionCard({ meeting, contacts, showMentor, mentorProfiles, debriefSummary, allMeetings, allDebriefSummaries }: {
  meeting: Meeting & { mentorName?: string; coMentorName?: string | null };
  contacts: any[];
  showMentor?: boolean;
  mentorProfiles?: MentorProfile[];
  debriefSummary?: DebriefSummary;
  allMeetings?: (Meeting & { mentorName?: string })[];
  allDebriefSummaries?: Record<number, DebriefSummary>;
}) {
  const updateMeeting = useUpdateMeeting();
  const isMobile = useIsMobile();
  const [showCoMentorSelect, setShowCoMentorSelect] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const contact = contacts?.find((c: any) => c.id === meeting.contactId);
  const config = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = config.icon;
  const isPast = new Date(meeting.startTime) < new Date();
  const hasDebrief = !!meeting.interactionId;
  const hasScores = debriefSummary && (debriefSummary.mindsetScore !== undefined || debriefSummary.skillScore !== undefined || debriefSummary.confidenceScore !== undefined);
  const isUpcoming = (meeting.status === "scheduled" || meeting.status === "confirmed") && !isPast;
  const isCompleted = meeting.status === "completed";
  const hasNotes = !!meeting.notes;

  const meetingAttendees: Attendee[] = Array.isArray(meeting.attendees) ? meeting.attendees as Attendee[] : [];

  const handleComplete = () => {
    updateMeeting.mutate({ id: meeting.id, status: "completed" } as any, {
      onSuccess: () => {
        setShowNotes(true);
      },
    });
  };

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
              {meetingAttendees.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5" data-testid={`badge-attendees-${meeting.id}`}>
                  <Users className="w-3 h-3 mr-0.5" /> +{meetingAttendees.length}
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
                  <FileText className="w-3 h-3 mr-1" /> Notes
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
            {!showNotes && hasNotes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meeting.notes}</p>
            )}
            {meetingAttendees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {meetingAttendees.map(a => (
                  <Badge key={a.email} variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-500/5">
                    {a.name || a.email}
                  </Badge>
                ))}
              </div>
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
            {isUpcoming && allMeetings && (
              <SessionPrepContext
                contactId={meeting.contactId}
                allMeetings={allMeetings}
                debriefSummaries={allDebriefSummaries}
                contacts={contacts}
              />
            )}
            {showNotes && isCompleted && (
              <InlineSessionNotes meeting={meeting} contactName={contact?.name || "Unknown"} />
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
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={handleComplete} data-testid={`button-complete-${meeting.id}`}>
                  Complete
                </Button>
              )}
              {isCompleted && !showNotes && (
                <Button size="sm" variant="outline" className="text-xs h-7 text-purple-600 border-purple-200" onClick={() => setShowNotes(true)} data-testid={`button-notes-${meeting.id}`}>
                  <MessageSquare className="w-3 h-3 mr-1" /> Notes
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
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleComplete} data-testid={`button-complete-${meeting.id}`}>
                  Complete
                </Button>
              )}
              {isCompleted && !showNotes && (
                <Button size="sm" variant="outline" className="text-xs h-7 text-purple-600 border-purple-200" onClick={() => setShowNotes(true)} data-testid={`button-notes-${meeting.id}`}>
                  <MessageSquare className="w-3 h-3 mr-1" /> {hasNotes ? "Edit Notes" : "Add Notes"}
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
      {showCoMentorSelect && isMobile && mentorProfiles && (
        <Dialog open={showCoMentorSelect} onOpenChange={setShowCoMentorSelect}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle>Select Co-mentor</DialogTitle>
              <DialogDescription className="sr-only">Select a co-mentor for this session</DialogDescription>
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
