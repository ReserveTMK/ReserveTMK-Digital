import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import {
  Users, Loader2, CalendarDays, Activity, TrendingUp, Building2,
  DollarSign, Handshake, Clock, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

// --- Helpers ---

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, "MMMM yyyy"),
      value: format(d, "yyyy-MM"),
      start: format(startOfMonth(d), "yyyy-MM-dd"),
      end: format(endOfMonth(d), "yyyy-MM-dd"),
    });
  }
  return options;
}

// --- Stat Cards ---

function StatCard({ icon: Icon, label, value, color = "primary", testId, subText }: {
  icon: any; label: string; value: string | number; color?: string; testId: string; subText?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    amber: "bg-amber-500/10 text-amber-500",
    violet: "bg-violet-500/10 text-violet-500",
    pink: "bg-pink-500/10 text-pink-500",
    orange: "bg-orange-500/10 text-orange-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
    slate: "bg-slate-500/10 text-slate-500",
    teal: "bg-teal-500/10 text-teal-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    purple: "bg-purple-500/10 text-purple-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold" data-testid={testId}>{value}</p>
      {subText && <p className="text-xs text-muted-foreground mt-1">{subText}</p>}
    </Card>
  );
}

function HeadlineStatCard({ icon: Icon, label, value, color = "primary", testId, subText }: {
  icon: any; label: string; value: string | number; color?: string; testId: string; subText?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    indigo: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    teal: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  };
  return (
    <Card className={`p-5 border-2 ${colorMap[color] || colorMap.primary}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold" data-testid={testId}>{value}</p>
      {subText && <p className="text-xs text-muted-foreground mt-1">{subText}</p>}
    </Card>
  );
}

// --- Collapsible Section ---

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true, testId }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden" data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
        data-testid={`${testId}-toggle`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-display font-semibold text-lg">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-5 pb-5 border-t">{children}</div>}
    </Card>
  );
}

// --- Trend types ---

interface TrendPeriodData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  peopleReached: number;
  totalActivations: number;
  communityHours: number;
}

const TREND_METRICS = [
  { key: "peopleReached", label: "People Reached", color: "hsl(14, 88%, 68%)" },
  { key: "totalActivations", label: "Total Activations", color: "hsl(161, 100%, 12%)" },
  { key: "communityHours", label: "Community Hours", color: "hsl(0, 84%, 60%)" },
] as const;

// --- Main Component ---

export default function TrackingDashboard() {
  const { toast } = useToast();
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || "");
  const [generated, setGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const [trendData, setTrendData] = useState<TrendPeriodData[] | null>(null);
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [trendGranularity, setTrendGranularity] = useState<"monthly" | "quarterly">("monthly");

  const selectedOpt = monthOptions.find(o => o.value === selectedMonth);

  // Data aliases
  const reach = reportData?.reach || reportData?.engagement;
  const del = reportData?.delivery;
  const imp = reportData?.impact;
  const val = reportData?.value;
  const jp = reportData?.journeyProgression;

  const handleGenerate = async () => {
    if (!selectedOpt) return;
    setIsGenerating(true);
    setGenerated(false);
    try {
      const res = await apiRequest("POST", "/api/reports/generate", {
        startDate: selectedOpt.start,
        endDate: selectedOpt.end,
        reportType: "monthly",
      });
      const data = await res.json();
      setReportData(data);
      setGenerated(true);
    } catch {
      toast({ title: "Error", description: "Failed to generate tracking data", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadTrends = async () => {
    setIsTrendLoading(true);
    try {
      const res = await apiRequest("POST", "/api/reports/trends", {
        endDate: selectedOpt?.end || format(new Date(), "yyyy-MM-dd"),
        granularity: trendGranularity,
      });
      const data = await res.json();
      setTrendData(data);
    } catch {
      toast({ title: "Error", description: "Failed to load trend data", variant: "destructive" });
    } finally {
      setIsTrendLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6" data-testid="tracking-dashboard">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Tracking</h1>
          <p className="text-sm text-muted-foreground">Operational snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]" data-testid="month-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={isGenerating} data-testid="button-generate">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            {isGenerating ? "Loading..." : "Generate"}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isGenerating && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!generated && !isGenerating && (
        <div className="text-center py-16 text-muted-foreground" data-testid="tracking-empty">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a month and hit Generate to see your tracking data.</p>
        </div>
      )}

      {/* Sections */}
      {generated && reportData && !isGenerating && (
        <div className="space-y-4">

          {/* 1. Reach */}
          <CollapsibleSection title="Reach" icon={Users} testId="section-reach">
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <HeadlineStatCard
                  icon={Users}
                  label="People Reached"
                  value={(reach?.peopleReached || 0).toLocaleString()}
                  color="primary"
                  testId="stat-people-reached"
                  subText={reach?.footTraffic > 0 ? `${(reach.uniqueContacts || 0).toLocaleString()} tracked + ${(reach.footTraffic || 0).toLocaleString()} foot traffic` : undefined}
                />
                <StatCard
                  icon={Activity}
                  label="Total Engagements"
                  value={(reach?.totalEngagements || 0).toLocaleString()}
                  color="blue"
                  testId="stat-total-engagements"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Repeat Engagement"
                  value={`${reach?.repeatEngagementRate || 0}%`}
                  color="amber"
                  testId="stat-repeat-rate"
                  subText={`${(reach?.repeatEngagementCount || 0).toLocaleString()} people came back 2+ times`}
                />
              </div>

              {reach?.sourceBreakdown && (
                <div className="flex flex-wrap gap-2" data-testid="reach-source-badges">
                  {Object.entries(reach.sourceBreakdown)
                    .filter(([_, v]) => (v as number) > 0)
                    .map(([source, count]) => (
                      <Badge key={source} variant="outline" className="text-xs capitalize py-1 px-2.5">
                        {source.replace(/([A-Z])/g, " $1").trim()}: {(count as number).toLocaleString()}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* 2. Delivery */}
          <CollapsibleSection title="Delivery" icon={CalendarDays} testId="section-delivery">
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <HeadlineStatCard
                  icon={Zap}
                  label="Total Activations"
                  value={(del?.totalActivations || 0).toLocaleString()}
                  color="indigo"
                  testId="stat-total-activations"
                />
                <StatCard
                  icon={Users}
                  label="Total Attendees"
                  value={(del?.totalAttendees || 0).toLocaleString()}
                  color="blue"
                  testId="stat-total-attendees"
                />
                <StatCard
                  icon={Clock}
                  label="Community Hours"
                  value={(del?.communityHours || 0).toLocaleString()}
                  color="green"
                  testId="stat-community-hours"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard icon={CalendarDays} label="Events" value={del?.events?.total || 0} color="blue" testId="stat-events" />
                <StatCard icon={Building2} label="Venue Hires" value={del?.bookings?.total || 0} color="orange" testId="stat-bookings" />
                <StatCard icon={Users} label="Mentoring Sessions" value={del?.mentoringSessions || 0} color="purple" testId="stat-mentoring-sessions" />
                <StatCard icon={Handshake} label="Partner Meetings" value={del?.partnerMeetings || 0} color="teal" testId="stat-partner-meetings" />
                <StatCard icon={Activity} label="Programmes" value={del?.programmes?.total || 0} color="indigo" testId="stat-programmes" />
              </div>

              <details className="pt-3 border-t">
                <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors">
                  Type Breakdowns
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {del?.events?.byType && Object.keys(del.events.byType).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Events by Type</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={Object.entries(del.events.byType).map(([name, value]) => ({ name, value }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(161, 100%, 12%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {del?.bookings?.byClassification && Object.keys(del.bookings.byClassification).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Venue Hires by Type</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={Object.entries(del.bookings.byClassification).map(([name, value]) => ({ name, value }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(199, 85%, 83%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </CollapsibleSection>

          {/* 3. Impact */}
          <CollapsibleSection title="Impact" icon={TrendingUp} testId="section-impact">
            <div className="pt-4 space-y-4">
              {/* Journey stages */}
              {jp && (jp.totalProgressions > 0 || Object.values(jp.currentDistribution || {}).some((v: any) => v > 0)) && (
                <div data-testid="journey-progression">
                  <h4 className="text-sm font-semibold mb-3">Journey Stage Distribution</h4>
                  <div className="flex items-center justify-center gap-3 flex-wrap mb-3">
                    {["kakano", "tipu", "ora"].map((stage) => {
                      const dist = jp.currentDistribution || {};
                      const stageColors: Record<string, string> = {
                        kakano: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300",
                        tipu: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300",
                        ora: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300",
                      };
                      return (
                        <div key={stage} className={`rounded-lg border px-4 py-3 text-center ${stageColors[stage]}`}>
                          <p className="text-xs font-medium uppercase tracking-wider">{stage}</p>
                          <p className="text-2xl font-bold">{dist[stage] || 0}</p>
                        </div>
                      );
                    })}
                  </div>
                  {jp.totalProgressions > 0 && (
                    <p className="text-sm text-center text-muted-foreground">
                      <strong>{jp.totalProgressions}</strong> {jp.totalProgressions === 1 ? "person" : "people"} progressed during this period
                    </p>
                  )}
                </div>
              )}

              {/* Growth metrics summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <HeadlineStatCard
                  icon={TrendingUp}
                  label="Milestones Achieved"
                  value={imp?.milestoneCount || 0}
                  color="amber"
                  testId="stat-milestones"
                />
                <StatCard
                  icon={Users}
                  label="People with Tracked Growth"
                  value={imp?.contactsWithMetrics || 0}
                  color="violet"
                  testId="stat-tracked-growth"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Connection Movements"
                  value={imp?.connectionMovement || 0}
                  color="indigo"
                  testId="stat-connection-movement"
                />
              </div>

              {/* Growth metric averages */}
              {imp?.growthMetrics && (() => {
                const metrics = [
                  { key: "mindset", label: "Mindset", color: "text-blue-600 dark:text-blue-400", barColor: "bg-blue-500" },
                  { key: "skill", label: "Skill", color: "text-green-600 dark:text-green-400", barColor: "bg-green-500" },
                  { key: "confidence", label: "Confidence", color: "text-violet-600 dark:text-violet-400", barColor: "bg-violet-500" },
                ];
                const hasData = metrics.some(m => {
                  const d = imp.growthMetrics[m.key];
                  return d && (d.averageScore > 0 || d.positiveMovementPercent > 0);
                });
                if (!hasData) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Growth Shifts</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {metrics.map(metric => {
                        const data = imp.growthMetrics[metric.key];
                        if (!data || (data.averageScore === 0 && data.positiveMovementPercent === 0)) return null;
                        return (
                          <Card key={metric.key} className="p-4" data-testid={`metric-card-${metric.key}`}>
                            <h4 className={`text-sm font-semibold mb-2 ${metric.color}`}>{metric.label}</h4>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold">{data.averageScore}</span>
                              <span className="text-xs text-muted-foreground">/10 avg</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${metric.barColor} rounded-full transition-all`}
                                  style={{ width: `${data.positiveMovementPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                {data.positiveMovementPercent}% positive
                              </span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </CollapsibleSection>

          {/* 4. Value */}
          <CollapsibleSection title="Value" icon={DollarSign} testId="section-value">
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={DollarSign}
                  label="Total Revenue"
                  value={`$${(val?.revenue?.total || 0).toLocaleString()}`}
                  color="green"
                  testId="stat-total-revenue"
                />
                <StatCard
                  icon={Handshake}
                  label="In-Kind Value"
                  value={`$${(val?.inKindValue || 0).toLocaleString()}`}
                  color="blue"
                  testId="stat-inkind-value"
                />
                <StatCard
                  icon={Users}
                  label="Active Memberships"
                  value={val?.memberships?.active || 0}
                  color="violet"
                  testId="stat-memberships"
                />
                <StatCard
                  icon={Handshake}
                  label="Partnership Agreements"
                  value={val?.mouExchange?.active || 0}
                  color="amber"
                  testId="stat-mous"
                />
              </div>

              {val?.revenue?.byPricingTier && Object.keys(val.revenue.byPricingTier).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Revenue by Pricing Tier</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(val.revenue.byPricingTier).map(([tier, data]: [string, any]) => (
                      <Card key={tier} className="p-3">
                        <p className="text-sm text-muted-foreground capitalize">{tier.replace("_", " ")}</p>
                        <p className="text-lg font-bold">${(data.revenue ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{data.count} venue hires</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* 5. Trends */}
          <CollapsibleSection title="Trends" icon={TrendingUp} testId="section-trends" defaultOpen={false}>
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground">Track how your key metrics change over time.</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                    <Button
                      variant={trendGranularity === "monthly" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => { setTrendGranularity("monthly"); setTrendData(null); }}
                      data-testid="trends-granularity-monthly"
                    >
                      Monthly
                    </Button>
                    <Button
                      variant={trendGranularity === "quarterly" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => { setTrendGranularity("quarterly"); setTrendData(null); }}
                      data-testid="trends-granularity-quarterly"
                    >
                      Quarterly
                    </Button>
                  </div>
                  <Button onClick={handleLoadTrends} disabled={isTrendLoading} size="sm" data-testid="button-load-trends">
                    {isTrendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                    {isTrendLoading ? "Loading..." : "Load Trends"}
                  </Button>
                </div>
              </div>

              {isTrendLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}

              {trendData && trendData.length > 0 && !isTrendLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {TREND_METRICS.map((metric) => (
                    <Card key={metric.key} className="p-4" data-testid={`trend-chart-${metric.key}`}>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metric.color }} />
                        {metric.label}
                      </h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="periodLabel" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value: number) => [(value ?? 0).toLocaleString(), metric.label]} />
                          <Line
                            type="monotone"
                            dataKey={metric.key}
                            stroke={metric.color}
                            strokeWidth={2}
                            dot={{ fill: metric.color, r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  ))}
                </div>
              )}

              {trendData && trendData.length === 0 && !isTrendLoading && (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="trends-empty">
                  No trend data available.
                </div>
              )}

              {!trendData && !isTrendLoading && (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="trends-placeholder">
                  Click "Load Trends" to see how your metrics have changed over the last {trendGranularity === "monthly" ? "12 months" : "8 quarters"}.
                </div>
              )}
            </div>
          </CollapsibleSection>

        </div>
      )}
    </div>
  );
}
