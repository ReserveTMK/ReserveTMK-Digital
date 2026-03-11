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
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Target,
} from "lucide-react";
import { JourneyStepper } from "@/components/mentoring/journey-stepper";
import {
  JOURNEY_STAGE_CONFIG,
  RELATIONSHIP_STATUS_CONFIG,
  VENTURE_TYPE_LABELS,
  FREQUENCY_LABELS,
  isOverdue,
} from "@/components/mentoring/mentoring-hooks";
import type { EnrichedRelationship } from "@/components/mentoring/mentoring-hooks";

export function StatusConfirmDialog({ open, onOpenChange, name, status, onConfirm, isPending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  status: "graduated" | "ended";
  onConfirm: (notes?: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState("");
  const isGraduation = status === "graduated";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isGraduation ? "Graduate Mentee" : "End Relationship"}</DialogTitle>
          <DialogDescription>
            {isGraduation
              ? `Mark ${name} as graduated? This will end the active mentoring relationship.`
              : `End the mentoring relationship with ${name}? This cannot be undone easily.`}
          </DialogDescription>
        </DialogHeader>
        {isGraduation && (
          <div className="space-y-2 py-2">
            <Label>Graduation Notes (optional)</Label>
            <Textarea
              placeholder="Key outcomes, growth observed, next steps..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="input-graduation-notes"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={isGraduation ? "default" : "destructive"}
            onClick={() => { onConfirm(notes || undefined); onOpenChange(false); }}
            disabled={isPending}
            data-testid={`button-confirm-${status}`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isGraduation ? "Graduate" : "End Relationship"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MenteeCard({ relationship }: { relationship: EnrichedRelationship }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"graduated" | "ended" | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/debrief-summaries"] });
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
                <span>{FREQUENCY_LABELS[relationship.sessionFrequency] || relationship.sessionFrequency}</span>
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
                      if (status === "graduated" || status === "ended") {
                        setConfirmStatus(status);
                      } else {
                        updateRelationship.mutate({ id: relationship.id, status });
                      }
                    }}
                    disabled={updateRelationship.isPending}
                    data-testid={`button-set-status-${status}-${relationship.id}`}
                  >
                    {RELATIONSHIP_STATUS_CONFIG[status]?.label || status}
                  </Button>
                ))}
              </div>
            </div>

            {(relationship.ventureDescription || relationship.whatNeedHelpWith) && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discovery Info</p>
                {relationship.ventureDescription && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">Venture / Idea</p>
                    <p className="text-xs" data-testid={`text-venture-desc-${relationship.id}`}>{relationship.ventureDescription}</p>
                  </div>
                )}
                {relationship.whatNeedHelpWith && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">Needs Help With</p>
                    <p className="text-xs" data-testid={`text-help-needed-${relationship.id}`}>{relationship.whatNeedHelpWith}</p>
                  </div>
                )}
                {relationship.onboardingAnswers && Object.keys(relationship.onboardingAnswers).length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">Onboarding Responses</p>
                    <div className="space-y-0.5 mt-0.5">
                      {Object.entries(relationship.onboardingAnswers).map(([q, a]) => (
                        <p key={q} className="text-xs"><span className="text-muted-foreground">{q}:</span> {a}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {relationship.focusAreas && (
              <div>
                <p className="text-xs font-medium mb-1">Focus Areas</p>
                <div className="flex flex-wrap gap-1">
                  {relationship.focusAreas.split(",").filter(a => a.trim()).map((area, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{area.trim()}</Badge>
                  ))}
                </div>
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
      {confirmStatus && (
        <StatusConfirmDialog
          open={!!confirmStatus}
          onOpenChange={(v) => { if (!v) setConfirmStatus(null); }}
          name={relationship.contactName}
          status={confirmStatus}
          isPending={updateRelationship.isPending}
          onConfirm={(notes) => {
            updateRelationship.mutate({
              id: relationship.id,
              status: confirmStatus,
              endDate: new Date().toISOString(),
              ...(confirmStatus === "graduated" && notes ? { graduationNotes: notes } : {}),
            });
            setConfirmStatus(null);
          }}
        />
      )}
    </Card>
  );
}
