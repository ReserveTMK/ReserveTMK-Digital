import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Survey } from "@shared/schema";
import { GROWTH_METRICS, GROWTH_SURVEY_WRITTEN_QUESTIONS } from "@shared/schema";
import { useState, useMemo } from "react";
import {
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  ArrowRight,
  MessageSquare,
  Eye,
  Pencil,
  User,
  MailX,
} from "lucide-react";
import {
  useEnrichedRelationships,
  type EnrichedRelationship,
} from "@/components/mentoring/mentoring-hooks";

type MetricConfig = { key: string; label: string; description: string };
type WrittenQuestionConfig = { key: string; label: string; placeholder: string };

function PreviewDialog({
  open,
  onOpenChange,
  metrics,
  writtenQuestions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metrics: MetricConfig[];
  writtenQuestions: WrittenQuestionConfig[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" /> Survey Preview
          </DialogTitle>
          <DialogDescription>
            This is what your mentees will see when they open the survey link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="text-center pb-3 border-b">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="font-semibold text-sm">Growth Check-in</p>
            <p className="text-xs text-muted-foreground mt-1">
              Rate yourself across key growth areas and share what's on your mind.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Growth Metrics (1-10 sliders)
            </p>
            <div className="space-y-3">
              {metrics.map((m) => (
                <div key={m.key} className="space-y-1" data-testid={`preview-metric-${m.key}`}>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">1</span>
                    <div className="flex-1 h-2 rounded-full bg-muted relative">
                      <div className="absolute inset-0 h-full w-1/2 rounded-full bg-primary/30" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">10</span>
                    <span className="text-sm font-bold w-6 text-center text-muted-foreground">5</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Reflection Questions
            </p>
            <div className="space-y-3">
              {writtenQuestions.map((q) => (
                <div key={q.key} className="space-y-1" data-testid={`preview-question-${q.key}`}>
                  <p className="text-sm font-medium">{q.label}</p>
                  <div className="h-16 rounded-md border bg-muted/20 flex items-start p-2">
                    <span className="text-xs text-muted-foreground italic">{q.placeholder}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditSurveyDialog({
  open,
  onOpenChange,
  metrics,
  writtenQuestions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metrics: MetricConfig[];
  writtenQuestions: WrittenQuestionConfig[];
  onSave: (metrics: MetricConfig[], questions: WrittenQuestionConfig[]) => void;
}) {
  const [editMetrics, setEditMetrics] = useState<MetricConfig[]>(() => metrics.map(m => ({ ...m })));
  const [editQuestions, setEditQuestions] = useState<WrittenQuestionConfig[]>(() => writtenQuestions.map(q => ({ ...q })));

  const resetState = () => {
    setEditMetrics(metrics.map(m => ({ ...m })));
    setEditQuestions(writtenQuestions.map(q => ({ ...q })));
  };

  const updateMetric = (index: number, field: keyof MetricConfig, value: string) => {
    const updated = [...editMetrics];
    updated[index] = { ...updated[index], [field]: value };
    setEditMetrics(updated);
  };

  const updateQuestion = (index: number, field: keyof WrittenQuestionConfig, value: string) => {
    const updated = [...editQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditQuestions(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit Survey Questions
          </DialogTitle>
          <DialogDescription>
            Customise the labels and descriptions shown to mentees. Changes apply to future surveys only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Growth Metrics (1-10 sliders)
            </p>
            <div className="space-y-3">
              {editMetrics.map((m, i) => (
                <div key={m.key} className="rounded-lg border p-3 space-y-2" data-testid={`edit-metric-${m.key}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">{m.key}</Badge>
                    <Input
                      value={m.label}
                      onChange={(e) => updateMetric(i, "label", e.target.value)}
                      className="h-8 text-sm"
                      data-testid={`input-metric-label-${m.key}`}
                    />
                  </div>
                  <Input
                    value={m.description}
                    onChange={(e) => updateMetric(i, "description", e.target.value)}
                    placeholder="Description shown below the label..."
                    className="h-8 text-xs"
                    data-testid={`input-metric-desc-${m.key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Reflection Questions
            </p>
            <div className="space-y-3">
              {editQuestions.map((q, i) => (
                <div key={q.key} className="rounded-lg border p-3 space-y-2" data-testid={`edit-question-${q.key}`}>
                  <Badge variant="outline" className="text-[10px]">{q.key}</Badge>
                  <Input
                    value={q.label}
                    onChange={(e) => updateQuestion(i, "label", e.target.value)}
                    className="h-8 text-sm"
                    data-testid={`input-question-label-${q.key}`}
                  />
                  <Input
                    value={q.placeholder}
                    onChange={(e) => updateQuestion(i, "placeholder", e.target.value)}
                    placeholder="Placeholder text..."
                    className="h-8 text-xs"
                    data-testid={`input-question-placeholder-${q.key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>Cancel</Button>
          <Button
            onClick={() => {
              onSave(editMetrics, editQuestions);
              onOpenChange(false);
            }}
            data-testid="button-save-survey-edits"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SurveyHistoryRow({ survey, relationships }: { survey: Survey; relationships: EnrichedRelationship[] }) {
  const [expanded, setExpanded] = useState(false);
  const questions = (survey.questions as any[]) || [];
  const responses = (survey.responses as any[]) || [];
  const rel = relationships.find(r => r.id === survey.relatedId);

  const metricResponses = responses.filter(r => {
    const q = questions.find((q: any) => q.id === r.questionId);
    return q && q.type === "slider";
  });

  const writtenResponses = responses.filter(r => {
    const q = questions.find((q: any) => q.id === r.questionId);
    return q && q.type === "text" && r.answer;
  });

  if (survey.status !== "completed") return null;

  return (
    <div className="border rounded-lg" data-testid={`survey-history-${survey.id}`}>
      <button className="w-full text-left p-3 flex items-center gap-2" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-medium flex-1">{rel?.contactName || "Unknown"}</span>
        <span className="text-[10px] text-green-600 dark:text-green-400">
          {survey.completedAt && new Date(survey.completedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t space-y-3">
          {metricResponses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Metrics
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {metricResponses.map(r => {
                  const q = questions.find((q: any) => q.id === r.questionId);
                  const value = typeof r.answer === "number" ? r.answer : 0;
                  const baseline = rel?.baselineMetrics?.[q?.key];
                  const grew = baseline != null && value > baseline;
                  return (
                    <div key={r.questionId} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{q?.question || "?"}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${grew ? "bg-green-500" : "bg-primary"}`}
                          style={{ width: `${(value / 10) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-0.5 text-[10px] tabular-nums w-14 justify-end">
                        {baseline != null && (
                          <>
                            <span className="text-muted-foreground">{baseline}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60" />
                          </>
                        )}
                        <span className={grew ? "text-green-600 dark:text-green-400 font-medium" : "font-medium"}>{value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {writtenResponses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Reflections
              </p>
              <div className="space-y-1.5">
                {writtenResponses.map(r => {
                  const q = questions.find((q: any) => q.id === r.questionId);
                  return (
                    <div key={r.questionId} className="rounded bg-muted/30 border p-2">
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{q?.question}</p>
                      <p className="text-xs">{String(r.answer)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenteeRow({
  rel,
  surveys,
  onSend,
  isSending,
  sendingId,
}: {
  rel: EnrichedRelationship;
  surveys: Survey[];
  onSend: (id: number) => void;
  isSending: boolean;
  sendingId: number | null;
}) {
  const menteeSurveys = surveys.filter(s => s.relatedId === rel.id);
  const lastSurvey = menteeSurveys.sort((a, b) => {
    const da = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const db = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return db - da;
  })[0];

  const hasPending = menteeSurveys.some(s => s.status === "sent" || s.status === "pending");
  const completedCount = menteeSurveys.filter(s => s.status === "completed").length;
  const hasEmail = !!rel.contactEmail;

  const lastSentLabel = lastSurvey?.sentAt
    ? new Date(lastSurvey.sentAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })
    : null;

  const lastStatus = lastSurvey?.status;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card" data-testid={`mentee-survey-row-${rel.id}`}>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{rel.contactName}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {!hasEmail && (
            <span className="text-destructive flex items-center gap-0.5">
              <MailX className="w-3 h-3" /> No email
            </span>
          )}
          {hasEmail && <span className="truncate max-w-[160px]">{rel.contactEmail}</span>}
          {completedCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {completedCount} completed
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lastSentLabel && (
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">Last sent</p>
            <p className="text-xs font-medium flex items-center gap-1 justify-end">
              {lastStatus === "completed" ? (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              ) : lastStatus === "sent" || lastStatus === "pending" ? (
                <Clock className="w-3 h-3 text-blue-500" />
              ) : null}
              {lastSentLabel}
            </p>
          </div>
        )}
        <Button
          size="sm"
          variant={hasPending ? "outline" : "default"}
          className="text-xs h-8"
          disabled={!hasEmail || (isSending && sendingId === rel.id)}
          onClick={() => onSend(rel.id)}
          data-testid={`button-send-survey-${rel.id}`}
        >
          {isSending && sendingId === rel.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <Send className="w-3.5 h-3.5 mr-1" />
          )}
          {hasPending ? "Resend" : "Send"}
        </Button>
      </div>
    </div>
  );
}

export function GrowthSurveysTab() {
  const { data: surveys, isLoading: surveysLoading } = useQuery<Survey[]>({ queryKey: ["/api/growth-surveys"] });
  const { data: relationships, isLoading: relsLoading } = useEnrichedRelationships();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showPreview, setShowPreview] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const [customMetrics, setCustomMetrics] = useState<MetricConfig[]>(
    GROWTH_METRICS.map(m => ({ ...m }))
  );
  const [customQuestions, setCustomQuestions] = useState<WrittenQuestionConfig[]>(
    GROWTH_SURVEY_WRITTEN_QUESTIONS.map(q => ({ ...q }))
  );

  const sendSurvey = useMutation({
    mutationFn: async (relationshipId: number) => {
      setSendingId(relationshipId);
      const res = await apiRequest("POST", "/api/growth-surveys/send", {
        relationshipId,
        customMetrics: customMetrics,
        customQuestions: customQuestions,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/growth-surveys"] });
      toast({ title: "Survey sent", description: "Growth survey emailed to mentee" });
      setSendingId(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setSendingId(null);
    },
  });

  const activeRels = useMemo(() => {
    if (!relationships) return [];
    return relationships.filter(r => r.status === "active" || r.status === "on_hold");
  }, [relationships]);

  const completedSurveys = useMemo(() => {
    if (!surveys) return [];
    return surveys.filter(s => s.status === "completed").sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return db - da;
    });
  }, [surveys]);

  const stats = useMemo(() => {
    if (!surveys) return { total: 0, pending: 0, completed: 0, responseRate: 0 };
    const total = surveys.length;
    const pending = surveys.filter(s => s.status === "sent" || s.status === "pending").length;
    const completed = surveys.filter(s => s.status === "completed").length;
    const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, pending, completed, responseRate };
  }, [surveys]);

  const isLoading = surveysLoading || relsLoading;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Growth Surveys</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Send self-assessment surveys to your active mentees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} data-testid="button-preview-survey">
            <Eye className="w-3.5 h-3.5 mr-1" /> Preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} data-testid="button-edit-survey">
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xl font-bold" data-testid="stat-total-surveys">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sent</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="stat-completed">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold" data-testid="stat-response-rate">{stats.responseRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Response Rate</p>
          </Card>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Active Mentees ({activeRels.length})
        </p>
        {activeRels.length === 0 ? (
          <Card className="p-6 text-center">
            <User className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No active mentees</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeRels.map(rel => (
              <MenteeRow
                key={rel.id}
                rel={rel}
                surveys={surveys || []}
                onSend={(id) => sendSurvey.mutate(id)}
                isSending={sendSurvey.isPending}
                sendingId={sendingId}
              />
            ))}
          </div>
        )}
      </div>

      {completedSurveys.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Completed Responses ({completedSurveys.length})
          </p>
          <div className="space-y-2">
            {completedSurveys.map(s => (
              <SurveyHistoryRow key={s.id} survey={s} relationships={relationships || []} />
            ))}
          </div>
        </div>
      )}

      <PreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        metrics={customMetrics}
        writtenQuestions={customQuestions}
      />

      <EditSurveyDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        metrics={customMetrics}
        writtenQuestions={customQuestions}
        onSave={(m, q) => {
          setCustomMetrics(m);
          setCustomQuestions(q);
          toast({ title: "Survey updated", description: "Changes will apply to future surveys" });
        }}
      />
    </div>
  );
}
