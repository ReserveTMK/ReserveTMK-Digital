import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import {
  Loader2, Users, Trophy, TrendingUp, Clock, ArrowRight,
  BarChart3, GitCompareArrows, Info,
} from "lucide-react";
import { format, startOfQuarter, endOfQuarter, subQuarters } from "date-fns";

type Programme = {
  id: number;
  name: string;
  status: string;
  startDate: string | null;
};

type CohortMonthData = {
  month: string;
  activeCount: number;
  retentionRate: number;
  cumulativeMilestones: number;
  stageBreakdown: Record<string, number>;
};

type CohortMetrics = {
  label: string;
  cohortSize: number;
  contactIds: number[];
  retentionRate: number;
  milestoneAchievementRate: number;
  avgTimeToFirstMilestone: number | null;
  avgGrowthScoreImprovement: number;
  timeline: CohortMonthData[];
  keyStats: {
    totalMilestones: number;
    stageProgressions: number;
    avgBaselineGrowthScore: number;
    avgCurrentGrowthScore: number;
  };
};

const STAGE_COLORS: Record<string, string> = {
  kakano: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  tipu: "bg-green-500/15 text-green-700 dark:text-green-300",
  ora: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  inactive: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  unknown: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

const CHART_COLORS = {
  cohortA: "hsl(var(--primary))",
  cohortB: "hsl(220, 70%, 50%)",
  retention: "hsl(142, 70%, 45%)",
  milestones: "hsl(38, 92%, 50%)",
};

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function StatCard({ icon: Icon, label, value, subtitle, testId }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  testId: string;
}) {
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold" data-testid={`${testId}-value`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
}

function CohortTimeline({ data, label }: { data: CohortMetrics; label?: string }) {
  if (!data.timeline || data.timeline.length === 0) {
    return (
      <Card className="p-8 text-center" data-testid="empty-timeline">
        <p className="text-muted-foreground">No timeline data available for this cohort.</p>
      </Card>
    );
  }

  const chartData = data.timeline.map(t => ({
    month: formatMonth(t.month),
    retention: t.retentionRate,
    milestones: t.cumulativeMilestones,
    active: t.activeCount,
  }));

  return (
    <div className="space-y-4" data-testid="cohort-timeline">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4" data-testid="chart-retention">
          <h4 className="text-sm font-semibold mb-3">Retention Over Time</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Retention"]} />
              <Line type="monotone" dataKey="retention" stroke={CHART_COLORS.retention} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4" data-testid="chart-milestones">
          <h4 className="text-sm font-semibold mb-3">Cumulative Milestones</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="milestones" fill={CHART_COLORS.milestones} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {data.timeline.length > 0 && (
        <Card className="p-4" data-testid="stage-progression">
          <h4 className="text-sm font-semibold mb-3">Stage Distribution Over Time</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Month</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Active</th>
                  {["kakano", "tipu", "ora"].map(stage => (
                    <th key={stage} className="text-center py-2 px-2 text-muted-foreground font-medium capitalize">{stage}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.timeline.map(t => (
                  <tr key={t.month} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{formatMonth(t.month)}</td>
                    <td className="text-center py-2 px-2">{t.activeCount}</td>
                    {["kakano", "tipu", "ora"].map(stage => (
                      <td key={stage} className="text-center py-2 px-2">
                        {t.stageBreakdown[stage] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CohortControls({ prefix, programmeId, setProgrammeId, startDate, setStartDate, endDate, setEndDate, programmes }: {
  prefix: string;
  programmeId: string;
  setProgrammeId: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  programmes: Programme[] | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="min-w-[180px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Programme</Label>
        <Select value={programmeId} onValueChange={setProgrammeId} data-testid={`${prefix}-select-programme`}>
          <SelectTrigger data-testid={`${prefix}-select-programme-trigger`}>
            <SelectValue placeholder="By entry date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">By entry date</SelectItem>
            {programmes?.map(p => (
              <SelectItem key={p.id} value={String(p.id)} data-testid={`${prefix}-option-programme-${p.id}`}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[150px]" data-testid={`${prefix}-input-start-date`} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[150px]" data-testid={`${prefix}-input-end-date`} />
      </div>
    </div>
  );
}

export default function CohortAnalysisPage() {
  const prevQ = subQuarters(new Date(), 1);
  const [activeTab, setActiveTab] = useState("single");

  const [programmeId, setProgrammeId] = useState("none");
  const [startDate, setStartDate] = useState(format(startOfQuarter(prevQ), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfQuarter(prevQ), "yyyy-MM-dd"));

  const [compareAProgId, setCompareAProgId] = useState("none");
  const [compareAStart, setCompareAStart] = useState(format(startOfQuarter(subQuarters(new Date(), 2)), "yyyy-MM-dd"));
  const [compareAEnd, setCompareAEnd] = useState(format(endOfQuarter(subQuarters(new Date(), 2)), "yyyy-MM-dd"));

  const [compareBProgId, setCompareBProgId] = useState("none");
  const [compareBStart, setCompareBStart] = useState(format(startOfQuarter(prevQ), "yyyy-MM-dd"));
  const [compareBEnd, setCompareBEnd] = useState(format(endOfQuarter(prevQ), "yyyy-MM-dd"));

  const [generated, setGenerated] = useState(false);
  const [compareGenerated, setCompareGenerated] = useState(false);

  const { data: programmes } = useQuery<Programme[]>({
    queryKey: ["/api/programmes"],
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ startDate, endDate });
    if (programmeId !== "none") params.set("programmeId", programmeId);
    return params.toString();
  }, [programmeId, startDate, endDate]);

  const { data: cohortData, isLoading: cohortLoading, error: cohortError } = useQuery<CohortMetrics>({
    queryKey: ["/api/cohort-analysis", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/cohort-analysis?${queryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load cohort data");
      }
      return res.json();
    },
    enabled: generated,
  });

  const compareParams = useMemo(() => {
    const params = new URLSearchParams({
      cohortAStartDate: compareAStart,
      cohortAEndDate: compareAEnd,
      cohortBStartDate: compareBStart,
      cohortBEndDate: compareBEnd,
    });
    if (compareAProgId !== "none") params.set("cohortAProgrammeId", compareAProgId);
    if (compareBProgId !== "none") params.set("cohortBProgrammeId", compareBProgId);
    return params.toString();
  }, [compareAProgId, compareAStart, compareAEnd, compareBProgId, compareBStart, compareBEnd]);

  const { data: comparisonData, isLoading: compareLoading, error: compareError } = useQuery<{ cohortA: CohortMetrics; cohortB: CohortMetrics }>({
    queryKey: ["/api/cohort-comparison", compareParams],
    queryFn: async () => {
      const res = await fetch(`/api/cohort-comparison?${compareParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load comparison data");
      }
      return res.json();
    },
    enabled: compareGenerated,
  });

  const comparisonChartData = useMemo(() => {
    if (!comparisonData) return [];
    const allMonths = new Set<string>();
    comparisonData.cohortA.timeline.forEach(t => allMonths.add(t.month));
    comparisonData.cohortB.timeline.forEach(t => allMonths.add(t.month));
    const sorted = Array.from(allMonths).sort();
    const aMap = new Map(comparisonData.cohortA.timeline.map(t => [t.month, t]));
    const bMap = new Map(comparisonData.cohortB.timeline.map(t => [t.month, t]));
    return sorted.map(m => ({
      month: formatMonth(m),
      cohortARetention: aMap.get(m)?.retentionRate ?? null,
      cohortBRetention: bMap.get(m)?.retentionRate ?? null,
      cohortAMilestones: aMap.get(m)?.cumulativeMilestones ?? null,
      cohortBMilestones: bMap.get(m)?.cumulativeMilestones ?? null,
    }));
  }, [comparisonData]);

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">
            Cohort Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Track groups of people over time — retention, milestones, and growth.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="cohort-tabs">
          <TabsList data-testid="cohort-tabs-list">
            <TabsTrigger value="single" data-testid="tab-single">
              <BarChart3 className="w-4 h-4 mr-1.5" />
              Single Cohort
            </TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare">
              <GitCompareArrows className="w-4 h-4 mr-1.5" />
              Compare Cohorts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 mt-4">
            <Card className="p-4" data-testid="cohort-controls">
              <div className="flex flex-wrap items-end gap-3">
                <CohortControls
                  prefix="single"
                  programmeId={programmeId}
                  setProgrammeId={setProgrammeId}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  programmes={programmes}
                />
                <Button onClick={() => setGenerated(true)} data-testid="button-generate">
                  Analyse Cohort
                </Button>
              </div>
            </Card>

            {cohortLoading && (
              <div className="flex justify-center py-20" data-testid="loading-spinner">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {cohortError && !cohortLoading && (
              <Card className="p-8 text-center border-destructive/50" data-testid="error-state">
                <p className="text-destructive font-medium mb-1">Failed to load cohort data</p>
                <p className="text-sm text-muted-foreground">{(cohortError as Error).message}</p>
              </Card>
            )}

            {cohortData && !cohortLoading && (
              <>
                <div className="flex items-center gap-2" data-testid="cohort-header">
                  <h2 className="text-xl font-semibold" data-testid="text-cohort-label">{cohortData.label}</h2>
                  <Badge variant="secondary" data-testid="badge-cohort-size">
                    {cohortData.cohortSize} people
                  </Badge>
                </div>

                {cohortData.cohortSize === 0 ? (
                  <Card className="p-12 text-center" data-testid="empty-state">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No people found</h3>
                    <p className="text-muted-foreground">No contacts match this cohort definition. Try adjusting the programme or date range.</p>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatCard
                        icon={Users}
                        label="Retention Rate"
                        value={`${cohortData.retentionRate}%`}
                        subtitle="Currently active"
                        testId="stat-retention"
                      />
                      <StatCard
                        icon={Trophy}
                        label="Milestone Rate"
                        value={`${cohortData.milestoneAchievementRate}%`}
                        subtitle={`${cohortData.keyStats.totalMilestones} total milestones`}
                        testId="stat-milestones"
                      />
                      <StatCard
                        icon={Clock}
                        label="Avg Time to 1st Milestone"
                        value={cohortData.avgTimeToFirstMilestone !== null ? `${cohortData.avgTimeToFirstMilestone} days` : "N/A"}
                        testId="stat-time-to-milestone"
                      />
                      <StatCard
                        icon={TrendingUp}
                        label="Growth Score Change"
                        value={cohortData.avgGrowthScoreImprovement > 0 ? `+${cohortData.avgGrowthScoreImprovement}` : String(cohortData.avgGrowthScoreImprovement)}
                        subtitle={`${cohortData.keyStats.avgBaselineGrowthScore} → ${cohortData.keyStats.avgCurrentGrowthScore}`}
                        testId="stat-growth"
                      />
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground" data-testid="active-definition-note">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>"Active" means the contact has had engagement within the last 3 months (based on their last recorded activity date).</span>
                    </div>

                    <CohortTimeline data={cohortData} />
                  </>
                )}
              </>
            )}

            {!generated && !cohortLoading && (
              <Card className="p-12 text-center" data-testid="initial-state">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Define a cohort to get started</h3>
                <p className="text-muted-foreground">Select a programme or date range above, then click "Analyse Cohort" to see the timeline.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="compare" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4" data-testid="cohort-a-controls">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS.cohortA }} />
                  Cohort A
                </h3>
                <CohortControls
                  prefix="compare-a"
                  programmeId={compareAProgId}
                  setProgrammeId={setCompareAProgId}
                  startDate={compareAStart}
                  setStartDate={setCompareAStart}
                  endDate={compareAEnd}
                  setEndDate={setCompareAEnd}
                  programmes={programmes}
                />
              </Card>
              <Card className="p-4" data-testid="cohort-b-controls">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS.cohortB }} />
                  Cohort B
                </h3>
                <CohortControls
                  prefix="compare-b"
                  programmeId={compareBProgId}
                  setProgrammeId={setCompareBProgId}
                  startDate={compareBStart}
                  setStartDate={setCompareBStart}
                  endDate={compareBEnd}
                  setEndDate={setCompareBEnd}
                  programmes={programmes}
                />
              </Card>
            </div>

            <div className="flex justify-center">
              <Button onClick={() => setCompareGenerated(true)} data-testid="button-compare">
                <GitCompareArrows className="w-4 h-4 mr-1.5" />
                Compare Cohorts
              </Button>
            </div>

            {compareLoading && (
              <div className="flex justify-center py-20" data-testid="compare-loading">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {compareError && !compareLoading && (
              <Card className="p-8 text-center border-destructive/50" data-testid="compare-error-state">
                <p className="text-destructive font-medium mb-1">Failed to load comparison data</p>
                <p className="text-sm text-muted-foreground">{(compareError as Error).message}</p>
              </Card>
            )}

            {comparisonData && !compareLoading && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="comparison-stats">
                  {[
                    { data: comparisonData.cohortA, label: "Cohort A", color: CHART_COLORS.cohortA },
                    { data: comparisonData.cohortB, label: "Cohort B", color: CHART_COLORS.cohortB },
                  ].map(({ data, label, color }) => (
                    <Card key={label} className="p-4" data-testid={`comparison-card-${label.toLowerCase().replace(" ", "-")}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <h3 className="font-semibold">{data.label}</h3>
                        <Badge variant="secondary">{data.cohortSize} people</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div data-testid={`${label.toLowerCase().replace(" ", "-")}-retention`}>
                          <p className="text-xs text-muted-foreground">Retention</p>
                          <p className="text-lg font-bold">{data.retentionRate}%</p>
                        </div>
                        <div data-testid={`${label.toLowerCase().replace(" ", "-")}-milestones`}>
                          <p className="text-xs text-muted-foreground">Milestone Rate</p>
                          <p className="text-lg font-bold">{data.milestoneAchievementRate}%</p>
                        </div>
                        <div data-testid={`${label.toLowerCase().replace(" ", "-")}-time`}>
                          <p className="text-xs text-muted-foreground">Avg Time to Milestone</p>
                          <p className="text-lg font-bold">{data.avgTimeToFirstMilestone !== null ? `${data.avgTimeToFirstMilestone}d` : "N/A"}</p>
                        </div>
                        <div data-testid={`${label.toLowerCase().replace(" ", "-")}-growth`}>
                          <p className="text-xs text-muted-foreground">Growth Change</p>
                          <p className="text-lg font-bold">
                            {data.avgGrowthScoreImprovement > 0 ? "+" : ""}{data.avgGrowthScoreImprovement}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {comparisonChartData.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="comparison-charts">
                    <Card className="p-4" data-testid="compare-chart-retention">
                      <h4 className="text-sm font-semibold mb-3">Retention Comparison</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="cohortARetention" name="Cohort A" stroke={CHART_COLORS.cohortA} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          <Line type="monotone" dataKey="cohortBRetention" name="Cohort B" stroke={CHART_COLORS.cohortB} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>

                    <Card className="p-4" data-testid="compare-chart-milestones">
                      <h4 className="text-sm font-semibold mb-3">Milestone Comparison</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="cohortAMilestones" name="Cohort A" stroke={CHART_COLORS.cohortA} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          <Line type="monotone" dataKey="cohortBMilestones" name="Cohort B" stroke={CHART_COLORS.cohortB} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                )}
              </>
            )}

            {!compareGenerated && !compareLoading && (
              <Card className="p-12 text-center" data-testid="compare-initial-state">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <GitCompareArrows className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Compare two cohorts side by side</h3>
                <p className="text-muted-foreground">Define both cohorts above, then click "Compare Cohorts" to see overlaid charts and stats.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
