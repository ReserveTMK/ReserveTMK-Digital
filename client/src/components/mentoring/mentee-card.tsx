import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Target,
  TrendingUp,
  ArrowRight,
  Pencil,
  Save,
  Check,
  X,
  Send,
} from "lucide-react";
import { JourneyStepper } from "@/components/mentoring/journey-stepper";
import {
  JOURNEY_STAGE_CONFIG,
  RELATIONSHIP_STATUS_CONFIG,
  VENTURE_TYPE_LABELS,
  FREQUENCY_LABELS,
  isOverdue,
} from "@/components/mentoring/mentoring-hooks";
import { MENTORING_FOCUS_AREAS } from "@shared/schema";
import type { EnrichedRelationship } from "@/components/mentoring/mentoring-hooks";

const BASELINE_METRICS = [
  { key: "mindset", label: "Mindset" },
  { key: "skill", label: "Skill" },
  { key: "confidence", label: "Confidence" },
  { key: "bizConfidence", label: "Biz Confidence" },
  { key: "systemsInPlace", label: "Systems" },
  { key: "fundingReadiness", label: "Funding" },
  { key: "networkStrength", label: "Network" },
] as const;

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

function InlineEditText({ value, onSave, placeholder, multiline, testId }: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="text-xs flex-1"
            autoFocus
            data-testid={`${testId}-input`}
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="text-xs h-7 flex-1"
            autoFocus
            data-testid={`${testId}-input`}
          />
        )}
        <button className="p-1 text-primary hover:bg-muted rounded" onClick={() => { onSave(draft); setEditing(false); }}>
          <Check className="w-3 h-3" />
        </button>
        <button className="p-1 text-muted-foreground hover:bg-muted rounded" onClick={() => { setDraft(value); setEditing(false); }}>
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      className="text-xs text-left group flex items-start gap-1 w-full"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      data-testid={testId}
    >
      <span className={value ? "" : "text-muted-foreground italic"}>{value || placeholder}</span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
    </button>
  );
}

export function MenteeCard({ relationship, defaultExpanded }: { relationship: EnrichedRelationship; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded || false);
  const [confirmStatus, setConfirmStatus] = useState<"graduated" | "ended" | null>(null);
  const [showReactivate, setShowReactivate] = useState(false);
  const [reactivateStage, setReactivateStage] = useState<string>(
    relationship.status === "graduated" ? "tipu" : "kakano"
  );
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [editingFocus, setEditingFocus] = useState(false);
  const [baselineDraft, setBaselineDraft] = useState<Record<string, number>>({
    mindset: 5, skill: 5, confidence: 5, bizConfidence: 5, systemsInPlace: 5, fundingReadiness: 5, networkStrength: 5,
  });
  const [focusDraft, setFocusDraft] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (relationship.baselineMetrics) {
      setBaselineDraft({ ...{ mindset: 5, skill: 5, confidence: 5, bizConfidence: 5, systemsInPlace: 5, fundingReadiness: 5, networkStrength: 5 }, ...relationship.baselineMetrics });
    }
  }, [relationship.baselineMetrics]);

  useEffect(() => {
    if (relationship.focusAreas) {
      setFocusDraft(relationship.focusAreas.split(",").map(a => a.trim()).filter(Boolean));
    }
  }, [relationship.focusAreas]);

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

  const updateApplication = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, any>) => {
      const appId = id;
      const res = await apiRequest("PATCH", `/api/mentoring-applications/${appId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
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

  const sendGrowthSurvey = useMutation({
    mutationFn: async (relationshipId: number) => {
      const res = await apiRequest("POST", "/api/growth-surveys/send", { relationshipId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/growth-surveys"] });
      toast({ title: "Survey sent", description: "Growth survey emailed to mentee" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const overdueStatus = isOverdue(relationship);
  const statusConfig = RELATIONSHIP_STATUS_CONFIG[relationship.status] || RELATIONSHIP_STATUS_CONFIG.active;
  const daysSinceSession = relationship.lastSessionDate
    ? Math.floor((Date.now() - new Date(relationship.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const toggleFocusArea = (area: string) => {
    setFocusDraft(prev => {
      if (prev.includes(area)) return prev.filter(a => a !== area);
      if (prev.length >= 3) return prev;
      return [...prev, area];
    });
  };

  const saveFocusAreas = () => {
    const parts = [...focusDraft];
    if (customFocus.trim()) parts.push(customFocus.trim());
    updateRelationship.mutate({ id: relationship.id, focusAreas: parts.join(", ") || null });
    setEditingFocus(false);
    setCustomFocus("");
  };

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
                {(relationship.status === "graduated" || relationship.status === "ended") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                    onClick={(e) => { e.stopPropagation(); setShowReactivate(true); }}
                    disabled={updateRelationship.isPending}
                    data-testid={`button-reactivate-${relationship.id}`}
                  >
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Re-activate
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discovery Info</p>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Venture / Idea</p>
                <InlineEditText
                  value={relationship.ventureDescription || ""}
                  onSave={(v) => {
                    if (relationship.applicationId) {
                      updateApplication.mutate({ id: relationship.applicationId, ventureDescription: v || null });
                    }
                    updateContact.mutate({ id: relationship.contactId, whatTheyAreBuilding: v || null });
                  }}
                  placeholder="What are they working on?"
                  multiline
                  testId={`edit-venture-${relationship.id}`}
                />
              </div>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Needs Help With</p>
                <InlineEditText
                  value={relationship.whatNeedHelpWith || ""}
                  onSave={(v) => {
                    if (relationship.applicationId) {
                      updateApplication.mutate({ id: relationship.applicationId, whatNeedHelpWith: v || null });
                    }
                  }}
                  placeholder="What do they need help with?"
                  multiline
                  testId={`edit-help-${relationship.id}`}
                />
              </div>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Why Mentoring?</p>
                <InlineEditText
                  value={relationship.whyMentoring || ""}
                  onSave={(v) => {
                    if (relationship.applicationId) {
                      updateApplication.mutate({ id: relationship.applicationId, whyMentoring: v || null });
                    }
                  }}
                  placeholder="Why are they seeking mentoring?"
                  multiline
                  testId={`edit-why-mentoring-${relationship.id}`}
                />
              </div>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">What Are You Stuck On?</p>
                <InlineEditText
                  value={relationship.whatStuckOn || ""}
                  onSave={(v) => {
                    if (relationship.applicationId) {
                      updateApplication.mutate({ id: relationship.applicationId, whatStuckOn: v || null });
                    }
                  }}
                  placeholder="Current blockers or challenges?"
                  multiline
                  testId={`edit-stuck-on-${relationship.id}`}
                />
              </div>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">What Have You Already Tried?</p>
                <InlineEditText
                  value={relationship.alreadyTried || ""}
                  onSave={(v) => {
                    if (relationship.applicationId) {
                      updateApplication.mutate({ id: relationship.applicationId, alreadyTried: v || null });
                    }
                  }}
                  placeholder="What have they already attempted?"
                  multiline
                  testId={`edit-already-tried-${relationship.id}`}
                />
              </div>

              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Time Commitment</p>
                <InlineEditText
                  value={relationship.timeCommitmentPerWeek || ""}
                  onSave={(v) => {
                    if (relationship.applicationId) {
                      updateApplication.mutate({ id: relationship.applicationId, timeCommitmentPerWeek: v || null });
                    }
                  }}
                  placeholder="Hours per week they can commit?"
                  testId={`edit-time-commitment-${relationship.id}`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium">Session Frequency</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  value={relationship.sessionFrequency || "monthly"}
                  onValueChange={(v) => updateRelationship.mutate({ id: relationship.id, sessionFrequency: v })}
                >
                  <SelectTrigger className="h-7 text-xs w-[180px]" data-testid={`select-frequency-${relationship.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium">Focus Areas</p>
                {!editingFocus ? (
                  <button
                    className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                    onClick={(e) => { e.stopPropagation(); setEditingFocus(true); }}
                    data-testid={`button-edit-focus-${relationship.id}`}
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button className="text-[10px] text-muted-foreground hover:underline" onClick={(e) => { e.stopPropagation(); setEditingFocus(false); }}>Cancel</button>
                    <button
                      className="text-[10px] text-primary flex items-center gap-0.5 hover:underline font-medium"
                      onClick={(e) => { e.stopPropagation(); saveFocusAreas(); }}
                      data-testid={`button-save-focus-${relationship.id}`}
                    >
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </div>
                )}
              </div>
              {editingFocus ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1.5">
                    {MENTORING_FOCUS_AREAS.map(area => (
                      <button
                        key={area}
                        type="button"
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          focusDraft.includes(area)
                            ? "bg-primary text-primary-foreground border-primary"
                            : focusDraft.length >= 3
                              ? "bg-muted/50 text-muted-foreground border-border cursor-not-allowed opacity-50"
                              : "bg-background hover:bg-muted border-border"
                        }`}
                        onClick={() => toggleFocusArea(area)}
                        disabled={!focusDraft.includes(area) && focusDraft.length >= 3}
                        data-testid={`focus-tag-${area.toLowerCase().replace(/\s+/g, "-")}-${relationship.id}`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="Other focus area (optional)"
                    value={customFocus}
                    onChange={(e) => setCustomFocus(e.target.value)}
                    className="text-xs h-7"
                    data-testid={`input-custom-focus-${relationship.id}`}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {relationship.focusAreas ? (
                    relationship.focusAreas.split(",").filter(a => a.trim()).map((area, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{area.trim()}</Badge>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">No focus areas set</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Baseline Metrics
                </p>
                {!editingBaseline ? (
                  <button
                    className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                    onClick={(e) => { e.stopPropagation(); setEditingBaseline(true); }}
                    data-testid={`button-edit-baseline-${relationship.id}`}
                  >
                    <Pencil className="w-3 h-3" /> {relationship.baselineMetrics ? "Edit" : "Set Baseline"}
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button className="text-[10px] text-muted-foreground hover:underline" onClick={(e) => { e.stopPropagation(); setEditingBaseline(false); }}>Cancel</button>
                    <button
                      className="text-[10px] text-primary flex items-center gap-0.5 hover:underline font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateRelationship.mutate({ id: relationship.id, baselineMetrics: baselineDraft });
                        if (!relationship.baselineMetrics) {
                          updateContact.mutate({ id: relationship.contactId, metrics: baselineDraft });
                        }
                        setEditingBaseline(false);
                      }}
                      disabled={updateRelationship.isPending}
                      data-testid={`button-save-baseline-${relationship.id}`}
                    >
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </div>
                )}
              </div>
              {editingBaseline ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2" onClick={(e) => e.stopPropagation()}>
                  {BASELINE_METRICS.map(m => (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{m.label}</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={baselineDraft[m.key] || 5}
                        onChange={(e) => setBaselineDraft(prev => ({ ...prev, [m.key]: parseInt(e.target.value) }))}
                        className="flex-1 h-1.5 accent-primary"
                        data-testid={`baseline-slider-${m.key}-${relationship.id}`}
                      />
                      <span className="text-xs font-medium w-5 text-right tabular-nums">{baselineDraft[m.key] || 5}</span>
                    </div>
                  ))}
                </div>
              ) : relationship.baselineMetrics ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(relationship.baselineMetrics).map(([key, baseline]) => {
                    const current = relationship.currentMetrics?.[key];
                    const label = BASELINE_METRICS.find(m => m.key === key)?.label || key;
                    const grew = current != null && current > baseline;
                    return (
                      <div key={key} className="flex items-center gap-1.5" data-testid={`metric-${key}-${relationship.id}`}>
                        <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
                        <div className="flex items-center gap-1 text-xs tabular-nums">
                          <span className="text-muted-foreground">{baseline}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                          <span className={grew ? "text-green-600 dark:text-green-400 font-medium" : ""}>{current ?? baseline}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">No baseline set yet</p>
              )}
            </div>

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

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Link href={`/contacts/${relationship.contactId}`}>
                <Button size="sm" variant="outline" className="text-xs h-7" data-testid={`button-view-contact-${relationship.id}`}>
                  View Profile
                </Button>
              </Link>
              {(relationship.status === "active" || relationship.status === "on_hold") && relationship.contactEmail && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    sendGrowthSurvey.mutate(relationship.id);
                  }}
                  disabled={sendGrowthSurvey.isPending}
                  data-testid={`button-send-survey-${relationship.id}`}
                >
                  {sendGrowthSurvey.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                  Growth Survey
                </Button>
              )}
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
      <Dialog open={showReactivate} onOpenChange={setShowReactivate}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Re-activate Mentee</DialogTitle>
            <DialogDescription>
              Re-start the mentoring relationship with {relationship.contactName}? They'll get a fresh start date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium">Starting stage</Label>
            <div className="flex gap-2">
              {[
                { value: "kakano", label: "Kākano" },
                { value: "tipu", label: "Tipu" },
                { value: "ora", label: "Ora" },
              ].map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant={reactivateStage === s.value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setReactivateStage(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReactivate(false)}>Cancel</Button>
            <Button
              onClick={() => {
                updateRelationship.mutate({
                  id: relationship.id,
                  status: "active",
                  endDate: null,
                  startDate: new Date().toISOString(),
                });
                updateContact.mutate({ id: relationship.contactId, stage: reactivateStage, isCommunityMember: true });
                setShowReactivate(false);
              }}
              disabled={updateRelationship.isPending}
              data-testid={`button-confirm-reactivate-${relationship.id}`}
            >
              {updateRelationship.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Re-activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
