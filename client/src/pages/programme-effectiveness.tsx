import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  Trophy,
  BarChart3,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

type ProgrammeEffectiveness = {
  id: number;
  name: string;
  classification: string;
  status: string;
  eventCount: number;
  totalAttendance: number;
  uniqueAttendees: number;
  repeatParticipationRate: number | null;
  confirmedDebriefs: number;
  sentimentAverage: number | null;
  milestoneCount: number;
  totalBudget: number | null;
  costPerParticipant: number | null;
};

type ProgrammeOutcome = {
  programmeId: number;
  programmeName: string;
  classification: string;
  status: string;
  participantCount: number;
  milestoneCount: number;
  totalMilestoneValue: number;
  averageGrowthImprovement: number;
  stageProgressions: number;
  summaryLine: string;
  growthScoreChanges: Record<string, { average: number; count: number }>;
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Community Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/15 text-green-700 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  active: "bg-green-500/15 text-green-700 dark:text-green-300",
  completed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const formatNZD = (value: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);

const SORT_OPTIONS = [
  { key: "totalAttendance", label: "Attendance" },
  { key: "milestoneCount", label: "Milestones" },
  { key: "sentimentAverage", label: "Sentiment" },
  { key: "costPerParticipant", label: "Cost Efficiency" },
  { key: "totalMilestoneValue", label: "Milestone Value" },
  { key: "stageProgressions", label: "Stage Progressions" },
];

function getSentimentLabel(avg: number | null): { text: string; className: string } {
  if (avg === null || avg === undefined) return { text: "No data", className: "text-muted-foreground" };
  if (avg >= 2.5) return { text: "Positive", className: "text-green-600 dark:text-green-400" };
  if (avg >= 1.5) return { text: "Neutral", className: "text-amber-600 dark:text-amber-400" };
  return { text: "Negative", className: "text-red-600 dark:text-red-400" };
}

export default function ProgrammeEffectivenessPage() {
  const { data: programmes, isLoading } = useQuery<ProgrammeEffectiveness[]>({
    queryKey: ["/api/programme-effectiveness"],
  });

  const { data: outcomes } = useQuery<ProgrammeOutcome[]>({
    queryKey: ["/api/programme-attributed-outcomes"],
  });

  const outcomeMap = useMemo(() => {
    const map = new Map<number, ProgrammeOutcome>();
    if (outcomes) {
      for (const o of outcomes) map.set(o.programmeId, o);
    }
    return map;
  }, [outcomes]);

  const [sortBy, setSortBy] = useState<string>("totalAttendance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!programmes) return [];
    return [...programmes].sort((a, b) => {
      if (sortBy === "totalMilestoneValue" || sortBy === "stageProgressions" || sortBy === "averageGrowthImprovement") {
        const aOut = outcomeMap.get(a.id);
        const bOut = outcomeMap.get(b.id);
        const aVal = aOut ? (aOut as any)[sortBy] ?? -Infinity : -Infinity;
        const bVal = bOut ? (bOut as any)[sortBy] ?? -Infinity : -Infinity;
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      }
      const aVal = (a as any)[sortBy] ?? -Infinity;
      const bVal = (b as any)[sortBy] ?? -Infinity;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [programmes, sortBy, sortDir, outcomeMap]);

  const totalProgrammes = programmes?.length ?? 0;
  const totalAttendance = programmes?.reduce((sum, p) => sum + p.totalAttendance, 0) ?? 0;
  const totalMilestones = programmes?.reduce((sum, p) => sum + p.milestoneCount, 0) ?? 0;
  const totalMilestoneValue = outcomes?.reduce((sum, o) => sum + o.totalMilestoneValue, 0) ?? 0;
  const totalStageProgressions = outcomes?.reduce((sum, o) => sum + o.stageProgressions, 0) ?? 0;

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">
            Programme Effectiveness
          </h1>
          <p className="text-muted-foreground mt-1">Quality metrics across all programmes.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20" data-testid="loading-spinner">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="p-4" data-testid="stat-total-programmes">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Programmes</p>
                    <p className="text-2xl font-bold" data-testid="value-total-programmes">{totalProgrammes}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4" data-testid="stat-total-attendance">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Attendance</p>
                    <p className="text-2xl font-bold" data-testid="value-total-attendance">{totalAttendance}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4" data-testid="stat-total-milestones">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Milestones</p>
                    <p className="text-2xl font-bold" data-testid="value-total-milestones">{totalMilestones}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4" data-testid="stat-total-milestone-value">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Milestone Value</p>
                    <p className="text-2xl font-bold" data-testid="value-total-milestone-value">{formatNZD(totalMilestoneValue)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4" data-testid="stat-total-stage-progressions">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stage Progressions</p>
                    <p className="text-2xl font-bold" data-testid="value-total-stage-progressions">{totalStageProgressions}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex items-center gap-2 flex-wrap" data-testid="sort-controls">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.key;
                return (
                  <Button
                    key={opt.key}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handleSort(opt.key)}
                    data-testid={`button-sort-${opt.key}`}
                  >
                    {opt.label}
                    {isActive ? (
                      sortDir === "desc" ? (
                        <ArrowDown className="w-3.5 h-3.5 ml-1" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5 ml-1" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />
                    )}
                  </Button>
                );
              })}
            </div>

            {sorted.length === 0 ? (
              <Card className="p-12 text-center" data-testid="empty-state">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No programme data</h3>
                <p className="text-muted-foreground">Programme effectiveness metrics will appear here once programmes have activity.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sorted.map((p) => {
                  const sentiment = getSentimentLabel(p.sentimentAverage);
                  const outcome = outcomeMap.get(p.id);
                  return (
                    <Card key={p.id} className="p-4 hover-elevate transition-all" data-testid={`card-programme-${p.id}`}>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base" data-testid={`text-name-${p.id}`}>{p.name}</h3>
                            <Badge className={CLASSIFICATION_COLORS[p.classification] || ""} data-testid={`badge-classification-${p.id}`}>
                              {p.classification}
                            </Badge>
                            <Badge className={STATUS_COLORS[p.status] || ""} data-testid={`badge-status-${p.id}`}>
                              {STATUS_LABELS[p.status] || p.status}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3">
                          <div data-testid={`metric-events-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Events</p>
                            <p className="text-sm font-semibold">{p.eventCount}</p>
                          </div>
                          <div data-testid={`metric-attendance-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Total Attendance</p>
                            <p className="text-sm font-semibold">{p.totalAttendance}</p>
                          </div>
                          <div data-testid={`metric-unique-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Unique Attendees</p>
                            <p className="text-sm font-semibold">{p.uniqueAttendees}</p>
                          </div>
                          <div data-testid={`metric-repeat-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Repeat Rate</p>
                            <p className="text-sm font-semibold">
                              {p.repeatParticipationRate !== null
                                ? `${p.repeatParticipationRate.toFixed(1)}%`
                                : <span className="text-muted-foreground font-normal">N/A</span>}
                            </p>
                          </div>
                          <div data-testid={`metric-debriefs-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Confirmed Debriefs</p>
                            <p className="text-sm font-semibold">{p.confirmedDebriefs}</p>
                          </div>
                          <div data-testid={`metric-sentiment-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Sentiment</p>
                            <p className={`text-sm font-semibold ${sentiment.className}`}>{sentiment.text}</p>
                          </div>
                          <div data-testid={`metric-milestones-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Milestones</p>
                            <p className="text-sm font-semibold">{p.milestoneCount}</p>
                          </div>
                          <div data-testid={`metric-budget-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Total Budget</p>
                            <p className="text-sm font-semibold">
                              {p.totalBudget !== null
                                ? formatNZD(p.totalBudget)
                                : <span className="text-muted-foreground font-normal">No budget</span>}
                            </p>
                          </div>
                          <div data-testid={`metric-cost-per-participant-${p.id}`}>
                            <p className="text-xs text-muted-foreground">Cost / Participant</p>
                            <p className="text-sm font-semibold">
                              {p.costPerParticipant !== null
                                ? formatNZD(p.costPerParticipant)
                                : <span className="text-muted-foreground font-normal">N/A</span>}
                            </p>
                          </div>
                        </div>

                        {outcome && (outcome.milestoneCount > 0 || outcome.stageProgressions > 0 || outcome.averageGrowthImprovement > 0) && (
                          <div className="border-t pt-3 mt-1" data-testid={`outcomes-panel-${p.id}`}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attributed Outcomes</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                              <div data-testid={`outcome-milestone-value-${p.id}`}>
                                <p className="text-xs text-muted-foreground">Milestone Value</p>
                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                  {outcome.totalMilestoneValue > 0 ? formatNZD(outcome.totalMilestoneValue) : "$0"}
                                </p>
                              </div>
                              <div data-testid={`outcome-growth-${p.id}`}>
                                <p className="text-xs text-muted-foreground">Avg Growth</p>
                                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                  {outcome.averageGrowthImprovement > 0 ? (
                                    <span className="flex items-center gap-1">
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                      +{outcome.averageGrowthImprovement}
                                    </span>
                                  ) : <span className="text-muted-foreground font-normal">N/A</span>}
                                </p>
                              </div>
                              <div data-testid={`outcome-progressions-${p.id}`}>
                                <p className="text-xs text-muted-foreground">Stage Progressions</p>
                                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                  {outcome.stageProgressions > 0 ? outcome.stageProgressions : <span className="text-muted-foreground font-normal">0</span>}
                                </p>
                              </div>
                              <div data-testid={`outcome-participants-${p.id}`}>
                                <p className="text-xs text-muted-foreground">Participants</p>
                                <p className="text-sm font-semibold">{outcome.participantCount}</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 italic" data-testid={`outcome-summary-${p.id}`}>
                              {outcome.summaryLine}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}