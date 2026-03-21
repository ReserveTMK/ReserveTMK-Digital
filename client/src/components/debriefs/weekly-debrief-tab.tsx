import { Button } from "@/components/ui/beautiful-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import {
  Loader2,
  Mic,
  Square,
  Trash2,
  FileText,
  CalendarDays,
  CheckCircle,
  RotateCcw,
  RefreshCw,
  Quote,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { getNZWeekStart } from "@shared/nz-week";
import {
  type WeeklyDebrief,
  getSentimentLabel,
  formatMetric,
  formatWeekPeriod,
} from "./shared";

export function WeeklyDebriefTab() {
  const { toast } = useToast();

  const { data: debriefs, isLoading } = useQuery<WeeklyDebrief[]>({
    queryKey: ["/api/weekly-hub-debriefs"],
  });

  const generateMutation = useMutation({
    mutationFn: async (weekStartDate: string) => {
      const res = await apiRequest("POST", "/api/weekly-hub-debriefs/generate", { weekStartDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
      toast({ title: "Weekly debrief generated" });
    },
    onError: (error: Error) => {
      const msg = error.message || "";
      if (msg.startsWith("409:")) {
        toast({ title: "Already exists", description: msg.replace("409: ", ""), variant: "destructive" });
      } else {
        toast({ title: "Error generating debrief", description: msg, variant: "destructive" });
      }
    },
  });

  const thisWeekMonday = getNZWeekStart();
  const lastWeekDate = new Date(thisWeekMonday);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekMonday = getNZWeekStart(lastWeekDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => generateMutation.mutate(format(thisWeekMonday, "yyyy-MM-dd"))}
          isLoading={generateMutation.isPending}
          disabled={generateMutation.isPending}
          data-testid="button-generate-this-week"
        >
          <CalendarDays className="w-4 h-4 mr-2" />
          Generate This Week
        </Button>
        <Button
          variant="outline"
          onClick={() => generateMutation.mutate(format(lastWeekMonday, "yyyy-MM-dd"))}
          isLoading={generateMutation.isPending}
          disabled={generateMutation.isPending}
          data-testid="button-generate-last-week"
        >
          <CalendarDays className="w-4 h-4 mr-2" />
          Generate Last Week
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-debriefs" />
        </div>
      )}

      {!isLoading && (!debriefs || debriefs.length === 0) && (
        <Card className="p-12 text-center border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No weekly debriefs yet</h3>
          <p className="text-muted-foreground mb-6">Generate one to get started.</p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {debriefs?.map((debrief) => (
          <WeeklyDebriefCard key={debrief.id} debrief={debrief} />
        ))}
      </div>
    </div>
  );
}

function WeeklyDebriefCard({ debrief }: { debrief: WeeklyDebrief }) {
  const { toast } = useToast();
  const [finalSummary, setFinalSummary] = useState(debrief.finalSummaryText || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRecordingSummary, setIsRecordingSummary] = useState(false);
  const [summaryRecordingTime, setSummaryRecordingTime] = useState(0);
  const [summaryAudioBlob, setSummaryAudioBlob] = useState<Blob | null>(null);
  const [summaryAudioUrl, setSummaryAudioUrl] = useState<string | null>(null);
  const [isSummaryTranscribing, setIsSummaryTranscribing] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const summaryMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const summaryChunksRef = useRef<Blob[]>([]);
  const summaryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
      if (summaryAudioUrl) URL.revokeObjectURL(summaryAudioUrl);
    };
  }, [summaryAudioUrl]);

  const startSummaryRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      summaryMediaRecorderRef.current = mediaRecorder;
      summaryChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) summaryChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(summaryChunksRef.current, { type: mimeType });
        setSummaryAudioBlob(blob);
        setSummaryAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start(1000);
      setIsRecordingSummary(true);
      setSummaryRecordingTime(0);
      summaryTimerRef.current = setInterval(() => setSummaryRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopSummaryRecording = () => {
    summaryMediaRecorderRef.current?.stop();
    setIsRecordingSummary(false);
    if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
  };

  const transcribeSummaryAudio = async () => {
    if (!summaryAudioBlob || summaryAudioBlob.size < 100) {
      toast({ title: "Recording too short", description: "Please record a longer audio clip.", variant: "destructive" });
      return;
    }
    setIsSummaryTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: summaryAudioBlob,
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Transcription failed. Please try again.");
      }
      const data = await res.json();
      const transcribed = data.transcript || data.text || "";
      setFinalSummary(prev => prev ? prev + "\n\n" + transcribed : transcribed);
      setSummaryAudioBlob(null);
      setSummaryAudioUrl(null);
      setShowVoiceRecorder(false);
      toast({ title: "Transcribed", description: "Voice summary has been added." });
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSummaryTranscribing(false);
    }
  };

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/weekly-hub-debriefs/${debrief.id}/refresh`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
      toast({ title: "Debrief refreshed", description: "Metrics and summary have been updated with latest data." });
    },
    onError: (error: Error) => {
      toast({ title: "Error refreshing", description: error.message, variant: "destructive" });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/weekly-hub-debriefs/${debrief.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/weekly-hub-debriefs/${debrief.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
      toast({ title: "Debrief deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    },
  });

  const metrics = debrief.metricsJson;
  const sentiment = debrief.sentimentJson;
  const themes = debrief.themesJson;
  const isDraft = debrief.status === "draft";

  const sentimentLabel = sentiment ? getSentimentLabel(sentiment.average) : "N/A";
  const totalSentiment = sentiment
    ? (sentiment.breakdown.positive + sentiment.breakdown.neutral + sentiment.breakdown.negative) || 1
    : 1;

  return (
    <Card data-testid={`card-weekly-debrief-${debrief.id}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg" data-testid={`text-week-period-${debrief.id}`}>
            {formatWeekPeriod(debrief.weekStartDate, debrief.weekEndDate)}
          </CardTitle>
          <span className="text-xs text-muted-foreground" data-testid={`text-created-${debrief.id}`}>
            Generated {format(new Date(debrief.createdAt), "dd MMM yyyy HH:mm")}
          </span>
        </div>
        <Badge
          variant={isDraft ? "outline" : "default"}
          className={isDraft ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 no-default-hover-elevate" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate"}
          data-testid={`badge-status-${debrief.id}`}
        >
          {isDraft ? "Draft" : "Confirmed"}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {metrics && (
          <div data-testid={`section-metrics-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <WeeklyMetricItem label="Confirmed Debriefs" value={formatMetric(metrics.confirmedDebriefs)} id={`metric-confirmed-debriefs-${debrief.id}`} />
              <WeeklyMetricItem label="Completed Programmes" value={formatMetric(metrics.completedProgrammes)} id={`metric-completed-programmes-${debrief.id}`} />
              <WeeklyMetricItem label="Completed Venue Hires" value={formatMetric(metrics.completedBookings)} id={`metric-completed-bookings-${debrief.id}`} />
              <WeeklyMetricItem label="Milestones Created" value={formatMetric(metrics.milestonesCreated)} id={`metric-milestones-${debrief.id}`} />
              <WeeklyMetricItem label="Outstanding (This Week)" value={formatMetric(metrics.outstandingDebriefs)} id={`metric-outstanding-${debrief.id}`} />
              {metrics.backlogDebriefs != null && metrics.backlogDebriefs > (metrics.outstandingDebriefs || 0) && (
                <WeeklyMetricItem label="Backlog (All Time)" value={formatMetric(metrics.backlogDebriefs)} id={`metric-backlog-${debrief.id}`} />
              )}
              <WeeklyMetricItem label="Upcoming Events" value={formatMetric(metrics.upcomingEventsNextWeek)} id={`metric-upcoming-${debrief.id}`} />
              <WeeklyMetricItem label="Actions Created" value={formatMetric(metrics.actionsCreated)} id={`metric-actions-created-${debrief.id}`} />
              <WeeklyMetricItem label="Actions Completed" value={formatMetric(metrics.actionsCompleted)} id={`metric-actions-completed-${debrief.id}`} />
            </div>
          </div>
        )}

        {themes && themes.length > 0 && (
          <div data-testid={`section-themes-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Top Themes</h3>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <Badge key={i} variant="secondary" data-testid={`badge-theme-${debrief.id}-${i}`}>
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {sentiment && (
          <div data-testid={`section-sentiment-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Sentiment</h3>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-sm font-medium" data-testid={`text-sentiment-label-${debrief.id}`}>
                {sentimentLabel}
              </span>
              <span className="text-xs text-muted-foreground" data-testid={`text-sentiment-sample-${debrief.id}`}>
                (n={sentiment.sampleSize})
              </span>
            </div>
            <div className="flex h-3 rounded-md overflow-hidden">
              {sentiment.breakdown.positive > 0 && (
                <div className="bg-green-500" style={{ width: `${(sentiment.breakdown.positive / totalSentiment) * 100}%` }} title={`Positive: ${sentiment.breakdown.positive}`} />
              )}
              {sentiment.breakdown.neutral > 0 && (
                <div className="bg-yellow-400" style={{ width: `${(sentiment.breakdown.neutral / totalSentiment) * 100}%` }} title={`Neutral: ${sentiment.breakdown.neutral}`} />
              )}
              {sentiment.breakdown.negative > 0 && (
                <div className="bg-red-500" style={{ width: `${(sentiment.breakdown.negative / totalSentiment) * 100}%` }} title={`Negative: ${sentiment.breakdown.negative}`} />
              )}
            </div>
          </div>
        )}

        {metrics?.averagedDevelopmentMetrics && Object.keys(metrics.averagedDevelopmentMetrics).length > 0 && (
          <div data-testid={`section-dev-metrics-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Development Metrics (Averaged)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(metrics.averagedDevelopmentMetrics).map(([key, value]) => (
                <WeeklyMetricItem
                  key={key}
                  label={DEVELOPMENT_METRIC_LABELS[key] || key}
                  value={`${value}/10`}
                  id={`metric-dev-${key}-${debrief.id}`}
                />
              ))}
            </div>
          </div>
        )}

        {metrics?.keyQuotes && metrics.keyQuotes.length > 0 && (
          <div data-testid={`section-key-quotes-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
              <Quote className="w-4 h-4" />
              Impact Highlights
            </h3>
            <div className="space-y-2">
              {metrics.keyQuotes.map((quote, i) => (
                <div
                  key={i}
                  className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3 py-1"
                  data-testid={`text-key-quote-${debrief.id}-${i}`}
                >
                  "{quote}"
                </div>
              ))}
            </div>
          </div>
        )}

        {debrief.generatedSummaryText && (
          <div data-testid={`section-generated-summary-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Generated Summary</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {debrief.generatedSummaryText}
            </p>
          </div>
        )}

        {isDraft && (
          <div data-testid={`section-final-summary-${debrief.id}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary">Final Summary</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                data-testid={`button-record-summary-${debrief.id}`}
              >
                <Mic className="w-3.5 h-3.5 mr-1" />
                {showVoiceRecorder ? "Hide Recorder" : "Record Summary"}
              </Button>
            </div>

            {showVoiceRecorder && (
              <div className="mb-3 p-3 bg-muted/30 rounded-lg border border-border">
                {!summaryAudioBlob && !isRecordingSummary && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Button
                      onClick={startSummaryRecording}
                      className="rounded-full w-14 h-14 flex items-center justify-center"
                      data-testid={`button-start-summary-recording-${debrief.id}`}
                    >
                      <Mic className="w-6 h-6" />
                    </Button>
                    <p className="text-xs text-muted-foreground">Tap to record your weekly summary</p>
                  </div>
                )}
                {isRecordingSummary && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                    </div>
                    <p className="text-lg font-mono font-bold">{formatRecTime(summaryRecordingTime)}</p>
                    <Button variant="destructive" size="sm" onClick={stopSummaryRecording} data-testid={`button-stop-summary-recording-${debrief.id}`}>
                      <Square className="w-3.5 h-3.5 mr-1" /> Stop
                    </Button>
                  </div>
                )}
                {summaryAudioBlob && !isRecordingSummary && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <audio controls src={summaryAudioUrl || undefined} className="flex-1 h-8" />
                      <Button variant="ghost" size="icon" onClick={() => { setSummaryAudioBlob(null); setSummaryAudioUrl(null); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={transcribeSummaryAudio}
                      disabled={isSummaryTranscribing}
                      className="w-full"
                      data-testid={`button-transcribe-summary-${debrief.id}`}
                    >
                      {isSummaryTranscribing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Transcribing...</> : <><FileText className="w-3.5 h-3.5 mr-1" /> Transcribe & Add to Summary</>}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Textarea
              value={finalSummary}
              onChange={(e) => setFinalSummary(e.target.value)}
              placeholder="Edit the final summary before confirming..."
              className="min-h-[100px]"
              data-testid={`textarea-final-summary-${debrief.id}`}
            />
          </div>
        )}

        {!isDraft && debrief.finalSummaryText && (
          <div data-testid={`section-final-summary-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Final Summary</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {debrief.finalSummaryText}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {isDraft && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshMutation.mutate()}
                isLoading={refreshMutation.isPending}
                disabled={refreshMutation.isPending}
                data-testid={`button-refresh-${debrief.id}`}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => patchMutation.mutate({ status: "confirmed", finalSummaryText: finalSummary })}
                isLoading={patchMutation.isPending}
                disabled={patchMutation.isPending}
                data-testid={`button-confirm-${debrief.id}`}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Confirm
              </Button>
            </>
          )}

          {!isDraft && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => patchMutation.mutate({ status: "draft" })}
              isLoading={patchMutation.isPending}
              disabled={patchMutation.isPending}
              data-testid={`button-revert-${debrief.id}`}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Revert to Draft
            </Button>
          )}

          {!showDeleteConfirm ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid={`button-delete-${debrief.id}`}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Are you sure?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                isLoading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                data-testid={`button-confirm-delete-${debrief.id}`}
              >
                Yes, delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                data-testid={`button-cancel-delete-${debrief.id}`}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const DEVELOPMENT_METRIC_LABELS: Record<string, string> = {
  mindset: "Mindset",
  skill: "Skill",
  confidence: "Confidence",
  businessConfidence: "Business Confidence",
  systems: "Systems",
  fundingReadiness: "Funding Readiness",
  network: "Network",
};

function WeeklyMetricItem({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="flex flex-col" data-testid={id}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}
