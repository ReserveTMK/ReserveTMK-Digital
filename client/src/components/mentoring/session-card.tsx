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
  DialogFooter,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { useAnalyzeInteraction } from "@/hooks/use-interactions";
import { ScoreIndicator } from "@/components/mentoring/score-indicator";
import { JOURNEY_STAGE_CONFIG } from "@/components/mentoring/mentoring-hooks";
import type { Meeting, MentorProfile } from "@shared/schema";
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
  const [showDebrief, setShowDebrief] = useState(false);
  const [showCoMentorSelect, setShowCoMentorSelect] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const contact = contacts?.find((c: any) => c.id === meeting.contactId);
  const config = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = config.icon;
  const isPast = new Date(meeting.startTime) < new Date();
  const hasDebrief = !!meeting.interactionId;
  const hasScores = debriefSummary && (debriefSummary.mindsetScore !== undefined || debriefSummary.skillScore !== undefined || debriefSummary.confidenceScore !== undefined);
  const isUpcoming = (meeting.status === "scheduled" || meeting.status === "confirmed") && !isPast;

  const meetingAttendees: Attendee[] = Array.isArray(meeting.attendees) ? meeting.attendees as Attendee[] : [];

  const handleComplete = () => {
    updateMeeting.mutate({ id: meeting.id, status: "completed" } as any, {
      onSuccess: () => {
        setShowDebrief(true);
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
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleComplete} data-testid={`button-complete-${meeting.id}`}>
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
