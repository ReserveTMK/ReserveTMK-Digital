import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/beautiful-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarDays, Trash2, CheckCircle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { getNZWeekStart } from "@shared/nz-week";

type WeeklyDebrief = {
  id: number;
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
  generatedSummaryText: string | null;
  finalSummaryText: string | null;
  metricsJson: {
    confirmedDebriefs?: number | null;
    completedProgrammes?: number | null;
    completedBookings?: number | null;
    milestonesCreated?: number | null;
    outstandingDebriefs?: number | null;
    upcomingEventsNextWeek?: number | null;
  } | null;
  themesJson: string[] | null;
  sentimentJson: {
    average: number | null;
    sampleSize: number;
    breakdown: { positive: number; neutral: number; negative: number };
  } | null;
  createdAt: string;
  confirmedAt: string | null;
};

function getSentimentLabel(avg: number | null): string {
  if (avg === null) return "N/A";
  if (avg >= 2.5) return "Positive";
  if (avg >= 1.5) return "Neutral";
  return "Negative";
}

function formatMetric(val: number | null | undefined): string {
  if (val === null || val === undefined) return "not tracked";
  return String(val);
}

function formatWeekPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${format(s, "EEE dd MMM")} – ${format(e, "EEE dd MMM yyyy")}`;
}

export default function WeeklyDebriefs() {
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
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold text-primary" data-testid="heading-weekly-debriefs">
          Weekly Hub Debriefs
        </h1>
        <p className="text-muted-foreground" data-testid="text-subtitle">
          Weekly operational summaries of hub activity
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm" data-testid="text-empty-state">
              No weekly debriefs yet. Generate one to get started.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {debriefs?.map((debrief) => (
          <DebriefCard key={debrief.id} debrief={debrief} />
        ))}
      </div>
    </div>
  );
}

function DebriefCard({ debrief }: { debrief: WeeklyDebrief }) {
  const { toast } = useToast();
  const [finalSummary, setFinalSummary] = useState(debrief.finalSummaryText || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    <Card data-testid={`card-debrief-${debrief.id}`}>
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
              <MetricItem label="Confirmed Debriefs" value={formatMetric(metrics.confirmedDebriefs)} id={`metric-confirmed-debriefs-${debrief.id}`} />
              <MetricItem label="Completed Programmes" value={formatMetric(metrics.completedProgrammes)} id={`metric-completed-programmes-${debrief.id}`} />
              <MetricItem label="Completed Bookings" value={formatMetric(metrics.completedBookings)} id={`metric-completed-bookings-${debrief.id}`} />
              <MetricItem label="Milestones Created" value={formatMetric(metrics.milestonesCreated)} id={`metric-milestones-${debrief.id}`} />
              <MetricItem label="Outstanding Debriefs" value={formatMetric(metrics.outstandingDebriefs)} id={`metric-outstanding-${debrief.id}`} />
              <MetricItem label="Upcoming Events" value={formatMetric(metrics.upcomingEventsNextWeek)} id={`metric-upcoming-${debrief.id}`} />
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
                <div
                  className="bg-green-500"
                  style={{ width: `${(sentiment.breakdown.positive / totalSentiment) * 100}%` }}
                  data-testid={`bar-positive-${debrief.id}`}
                  title={`Positive: ${sentiment.breakdown.positive}`}
                />
              )}
              {sentiment.breakdown.neutral > 0 && (
                <div
                  className="bg-yellow-400"
                  style={{ width: `${(sentiment.breakdown.neutral / totalSentiment) * 100}%` }}
                  data-testid={`bar-neutral-${debrief.id}`}
                  title={`Neutral: ${sentiment.breakdown.neutral}`}
                />
              )}
              {sentiment.breakdown.negative > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(sentiment.breakdown.negative / totalSentiment) * 100}%` }}
                  data-testid={`bar-negative-${debrief.id}`}
                  title={`Negative: ${sentiment.breakdown.negative}`}
                />
              )}
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
            <h3 className="text-sm font-semibold text-primary mb-2">Final Summary</h3>
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

function MetricItem({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="flex flex-col" data-testid={id}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}
