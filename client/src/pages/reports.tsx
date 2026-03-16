import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  FileText, Users, Loader2, BarChart3, CalendarDays, CalendarRange,
  Download, Activity, Tag, TrendingUp, Building2, DollarSign,
  Save, BookOpen, ChevronDown, ChevronUp, Handshake, Clock,
  Info, History, Zap, X, Pen, Landmark, Settings, Camera, Star,
  Plus, Trash2, ArrowUpRight, Briefcase, Rocket, BadgeDollarSign, ArrowDownRight, MoveRight, ArrowRight, MessageSquare,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, startOfYear,
} from "date-fns";
import { Link } from "wouter";
import type { Funder } from "@shared/schema";

const CHART_COLORS = [
  "hsl(14, 88%, 68%)", "hsl(161, 100%, 12%)", "hsl(199, 85%, 83%)", "hsl(335, 82%, 76%)", "hsl(161, 40%, 35%)",
  "hsl(153, 30%, 18%)", "hsl(0, 84%, 60%)", "hsl(14, 88%, 58%)", "hsl(161, 60%, 25%)", "hsl(199, 70%, 60%)",
];

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

function getQuarterOptions() {
  const options = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let year = currentYear; year >= currentYear - 1; year--) {
    for (let q = 4; q >= 1; q--) {
      const quarterStart = new Date(year, (q - 1) * 3, 1);
      if (quarterStart > now) continue;
      const quarterEnd = endOfQuarter(quarterStart);
      options.push({
        label: `Q${q} ${year}`,
        value: `${year}-Q${q}`,
        start: format(startOfQuarter(quarterStart), "yyyy-MM-dd"),
        end: format(quarterEnd, "yyyy-MM-dd"),
      });
    }
  }
  return options;
}

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

function MetricBenchmarkCard({ title, benchmarks, color }: {
  title: string;
  benchmarks: any;
  color: string;
}) {
  if (!benchmarks || benchmarks.historicAverage === 0) return null;
  const pop = benchmarks.popChange;
  return (
    <Card className="p-4 space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Avg: </span>
          <span className="font-bold">{benchmarks.historicAverage}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Best: </span>
          <span className="font-bold">{benchmarks.highestValue}</span>
        </div>
        <div>
          <span className="text-muted-foreground">PoP: </span>
          <span className={`font-bold ${pop !== null && pop >= 0 ? "text-green-600" : "text-orange-600"}`}>
            {pop !== null ? `${pop >= 0 ? "+" : ""}${pop}%` : "N/A"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Rank: </span>
          <span className="font-bold">
            {benchmarks.currentRank ? `#${benchmarks.currentRank}/${benchmarks.totalPeriods}` : "N/A"}
          </span>
        </div>
      </div>
      {benchmarks.highestPeriod && (
        <p className="text-xs text-muted-foreground italic">Best: {benchmarks.highestPeriod}</p>
      )}
    </Card>
  );
}

interface TrendPeriodData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  peopleReached: number;
  uniqueContacts: number;
  totalActivations: number;
  milestonesAchieved: number;
  communitySpend: number;
  repeatEngagementRate: number;
  communityHours: number;
}

const TREND_METRICS = [
  { key: "peopleReached", label: "People Reached", color: "hsl(14, 88%, 68%)" },
  { key: "uniqueContacts", label: "Unique Contacts", color: "hsl(161, 100%, 12%)" },
  { key: "totalActivations", label: "Total Activations", color: "hsl(199, 85%, 83%)" },
  { key: "milestonesAchieved", label: "Milestones Achieved", color: "hsl(335, 82%, 76%)" },
  { key: "communitySpend", label: "Community Spend ($)", color: "hsl(161, 40%, 35%)" },
  { key: "repeatEngagementRate", label: "Repeat Engagement Rate (%)", color: "hsl(153, 30%, 18%)" },
  { key: "communityHours", label: "Community Hours", color: "hsl(0, 84%, 60%)" },
] as const;

function getPoPChange(current: number, previous: number): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { value: 0, direction: "flat" };
  if (previous === 0) return { value: 100, direction: "up" };
  const change = Math.round(((current - previous) / previous) * 100);
  return { value: Math.abs(change), direction: change > 0 ? "up" : change < 0 ? "down" : "flat" };
}

function TrendsSection({ communityLens, funderFilter, programmeFilter, taxonomyFilter, activeFunder, reportEndDate }: {
  communityLens: string;
  funderFilter: string;
  programmeFilter: string;
  taxonomyFilter: string;
  activeFunder: Funder | null;
  reportEndDate: string;
}) {
  const [granularity, setGranularity] = useState<"monthly" | "quarterly">("monthly");
  const [trendData, setTrendData] = useState<TrendPeriodData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLoadTrends = async () => {
    setIsLoading(true);
    try {
      const filters: {
        endDate: string;
        granularity: "monthly" | "quarterly";
        programmeIds?: number[];
        taxonomyIds?: number[];
        funder?: string;
        communityLens?: string;
      } = {
        endDate: reportEndDate || format(new Date(), "yyyy-MM-dd"),
        granularity,
      };
      if (programmeFilter !== "all") filters.programmeIds = [parseInt(programmeFilter)];
      if (taxonomyFilter !== "all") filters.taxonomyIds = [parseInt(taxonomyFilter)];
      const effectiveFunder = funderFilter !== "all" ? funderFilter : (activeFunder?.funderTag || null);
      if (effectiveFunder) filters.funder = effectiveFunder;
      if (communityLens !== "all") filters.communityLens = communityLens;

      const res = await apiRequest("POST", "/api/reports/trends", filters);
      const data = await res.json();
      setTrendData(data);
    } catch {
      toast({ title: "Error", description: "Failed to load trend data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const latestPeriod = trendData && trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const previousPeriod = trendData && trendData.length > 1 ? trendData[trendData.length - 2] : null;

  return (
    <CollapsibleSection title="Trends" icon={TrendingUp} testId="section-trends" defaultOpen={true} key={`trends-${activeFunder?.id || 'none'}`}>
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Track how your key metrics change over time.</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
              <Button
                variant={granularity === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setGranularity("monthly"); setTrendData(null); }}
                data-testid="trends-granularity-monthly"
              >
                Monthly
              </Button>
              <Button
                variant={granularity === "quarterly" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setGranularity("quarterly"); setTrendData(null); }}
                data-testid="trends-granularity-quarterly"
              >
                Quarterly
              </Button>
            </div>
            <Button onClick={handleLoadTrends} disabled={isLoading} size="sm" data-testid="button-load-trends">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-1" />}
              {isLoading ? "Loading..." : "Load Trends"}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {trendData && trendData.length > 0 && !isLoading && (
          <div className="space-y-6">
            {latestPeriod && previousPeriod && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="trend-pop-badges">
                {TREND_METRICS.map((metric) => {
                  const current = latestPeriod[metric.key as keyof TrendPeriodData] as number;
                  const prev = previousPeriod[metric.key as keyof TrendPeriodData] as number;
                  const pop = getPoPChange(current, prev);
                  return (
                    <div key={metric.key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card" data-testid={`trend-pop-${metric.key}`}>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                        <p className="text-sm font-semibold">{metric.key === "communitySpend" ? `$${current.toLocaleString()}` : current.toLocaleString()}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${
                          pop.direction === "up"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                            : pop.direction === "down"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {pop.direction === "up" ? "+" : pop.direction === "down" ? "-" : ""}
                        {pop.value}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {TREND_METRICS.map((metric) => (
                <Card key={metric.key} className="p-4" data-testid={`trend-chart-${metric.key}`}>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metric.color }} />
                    {metric.label}
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={metric.key === "communitySpend" || metric.key === "communityHours"} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) =>
                          metric.key === "communitySpend"
                            ? [`$${value.toLocaleString()}`, metric.label]
                            : metric.key === "repeatEngagementRate"
                            ? [`${value}%`, metric.label]
                            : [value.toLocaleString(), metric.label]
                        }
                      />
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
          </div>
        )}

        {trendData && trendData.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground text-sm" data-testid="trends-empty">
            No trend data available for the selected filters.
          </div>
        )}

        {!trendData && !isLoading && (
          <div className="text-center py-8 text-muted-foreground text-sm" data-testid="trends-placeholder">
            Click "Load Trends" to see how your metrics have changed over the last {granularity === "monthly" ? "12 months" : "8 quarters"}.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

const HIGHLIGHT_CATEGORY_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "programme", label: "Programme" },
  { value: "mentoring", label: "Mentoring" },
  { value: "community", label: "Community" },
  { value: "milestone", label: "Milestone" },
];

export default function Reports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("monthly");
  const monthOptions = getMonthOptions();
  const quarterOptions = getQuarterOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || "");
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0]?.value || "");
  const [adHocStart, setAdHocStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [adHocEnd, setAdHocEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generated, setGenerated] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [narrativeData, setNarrativeData] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [communityLens, setCommunityLens] = useState<"all" | "maori" | "pasifika" | "maori_pasifika">("all");
  const [communityComparisonData, setCommunityComparisonData] = useState<any>(null);
  const [tamakiOraData, setTamakiOraData] = useState<any>(null);
  const [activeFunder, setActiveFunder] = useState<Funder | null>(null);
  const [narrativeStyle, setNarrativeStyle] = useState<"compliance" | "story">("compliance");
  const [showHighlightDialog, setShowHighlightDialog] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState("");
  const [highlightDescription, setHighlightDescription] = useState("");
  const [highlightCategory, setHighlightCategory] = useState("community");
  const [highlightPhoto, setHighlightPhoto] = useState<File | null>(null);

  const { data: savedReports } = useQuery<any[]>({
    queryKey: ["/api/reports"],
  });

  const { data: programmes } = useQuery<any[]>({
    queryKey: ["/api/programmes"],
  });

  const { data: taxonomy } = useQuery<any[]>({
    queryKey: ["/api/taxonomy"],
  });

  const { data: dateRange } = useQuery<{ earliestDate: string | null; latestDate: string | null }>({
    queryKey: ["/api/reports/date-range"],
  });

  const { data: fundersList } = useQuery<Funder[]>({
    queryKey: ["/api/funders"],
  });

  const { data: monthlySnapshots } = useQuery<any[]>({
    queryKey: ["/api/monthly-snapshots"],
  });

  const { data: highlights, refetch: refetchHighlights } = useQuery<any[]>({
    queryKey: ["/api/report-highlights"],
  });



  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [taxonomyFilter, setTaxonomyFilter] = useState("all");
  const [funderFilter, setFunderFilter] = useState("all");
  const [benchmarkData, setBenchmarkData] = useState<any>(null);

  const { data: funderTags } = useQuery<string[]>({
    queryKey: ['/api/funder-tags'],
  });

  const getDateRange = () => {
    if (activeTab === "monthly") {
      const opt = monthOptions.find(o => o.value === selectedMonth);
      return { startDate: opt?.start || "", endDate: opt?.end || "" };
    } else if (activeTab === "quarterly") {
      const opt = quarterOptions.find(o => o.value === selectedQuarter);
      return { startDate: opt?.start || "", endDate: opt?.end || "" };
    } else if (activeTab === "ytd") {
      const now = new Date();
      return {
        startDate: format(startOfYear(now), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      };
    } else if (activeTab === "alltime") {
      if (dateRange?.earliestDate) {
        return {
          startDate: format(new Date(dateRange.earliestDate), "yyyy-MM-dd"),
          endDate: format(new Date(), "yyyy-MM-dd"),
        };
      }
      return {
        startDate: "2023-11-01",
        endDate: format(new Date(), "yyyy-MM-dd"),
      };
    }
    return { startDate: adHocStart, endDate: adHocEnd };
  };

  const COMMUNITY_LENS_LABELS: Record<string, string> = {
    all: "All Communities",
    maori: "Maori (matawaka)",
    pasifika: "Pasifika",
    maori_pasifika: "Maori + Pasifika",
  };

  const handleSelectFunder = (funder: Funder) => {
    if (activeFunder?.id === funder.id) {
      setActiveFunder(null);
      setCommunityLens("all");
      setNarrativeStyle("compliance");
      setFunderFilter("all");
      setGenerated(false);
      return;
    }
    setActiveFunder(funder);
    const lens = (funder.communityLens || "all") as "all" | "maori" | "pasifika" | "maori_pasifika";
    setCommunityLens(lens);
    const style = (funder.narrativeStyle || "compliance") as "compliance" | "story";
    setNarrativeStyle(style);
    if (funder.funderTag) {
      setFunderFilter(funder.funderTag);
    }
    setGenerated(false);
  };

  const isSectionDefaultOpen = (sectionKey: string) => {
    if (!activeFunder?.prioritySections || activeFunder.prioritySections.length === 0) return true;
    return activeFunder.prioritySections.includes(sectionKey);
  };

  const handleGenerate = async () => {
    const { startDate, endDate } = getDateRange();
    if (!startDate || !endDate) return;

    setIsGenerating(true);
    setGenerated(false);
    setNarrativeData(null);

    try {
      const filters: any = { startDate, endDate };
      if (programmeFilter !== "all") filters.programmeIds = [parseInt(programmeFilter)];
      if (taxonomyFilter !== "all") filters.taxonomyIds = [parseInt(taxonomyFilter)];
      if (funderFilter !== "all") filters.funder = funderFilter;
      if (communityLens !== "all") filters.communityLens = communityLens;

      const reportRes = await apiRequest("POST", "/api/reports/generate", filters);
      const data = await reportRes.json();
      setReportData(data);
      setGenerated(true);

      try {
        const benchmarkRes = await apiRequest("GET", `/api/benchmark-insights?startDate=${startDate}&endDate=${endDate}`);
        const bData = await benchmarkRes.json();
        setBenchmarkData(bData);
      } catch {
        setBenchmarkData(null);
      }

      if (communityLens === "all") {
        try {
          const compRes = await apiRequest("POST", "/api/reports/community-comparison", { startDate, endDate });
          const compData = await compRes.json();
          setCommunityComparisonData(compData);
        } catch {
          setCommunityComparisonData(null);
        }
      } else {
        setCommunityComparisonData(null);
      }

      const showTamakiOra = activeFunder && (
        activeFunder.name.toLowerCase().includes("nga matarae") ||
        activeFunder.name.toLowerCase().includes("nga matarae") ||
        (activeFunder.outcomesFramework && activeFunder.outcomesFramework.toLowerCase().includes("tamaki ora")) ||
        (activeFunder.outcomesFramework && activeFunder.outcomesFramework.toLowerCase().includes("tamaki ora"))
      );
      if (showTamakiOra) {
        try {
          const tamakiRes = await apiRequest("POST", "/api/reports/tamaki-ora", filters);
          const tamakiData = await tamakiRes.json();
          setTamakiOraData(tamakiData);
        } catch {
          setTamakiOraData(null);
        }
      } else {
        setTamakiOraData(null);
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const [participantStory, setParticipantStory] = useState("");
  const [whatsNext, setWhatsNext] = useState("");

  const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleGenerateNarrative = async () => {
    const { startDate, endDate } = getDateRange();
    const filters: any = { startDate, endDate, narrativeStyle };
    if (programmeFilter !== "all") filters.programmeIds = [parseInt(programmeFilter)];
    if (taxonomyFilter !== "all") filters.taxonomyIds = [parseInt(taxonomyFilter)];
    if (funderFilter !== "all") filters.funder = funderFilter;
    if (communityLens !== "all") filters.communityLens = communityLens;

    try {
      const res = await apiRequest("POST", "/api/reports/narrative", filters);
      const data = await res.json();
      setNarrativeData(data.narrative);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to generate narrative", variant: "destructive" });
    }
  };

  const handleSaveReport = async () => {
    const { startDate, endDate } = getDateRange();
    const periodLabel = getPeriodLabel();
    try {
      const fullNarrative = [
        narrativeData || "",
        participantStory.trim() ? `\n\n## Participant Story\n\n${participantStory}` : "",
        whatsNext.trim() ? `\n\n## What's Next\n\n${whatsNext}` : "",
      ].join("");

      await apiRequest("POST", "/api/reports/save", {
        title: `Report: ${periodLabel}`,
        type: activeTab === "quarterly" ? "quarterly" : activeTab === "adhoc" ? "ad_hoc" : activeTab === "ytd" ? "ytd" : activeTab === "alltime" ? "all_time" : "monthly",
        startDate,
        endDate,
        filters: {
          programmeIds: programmeFilter !== "all" ? [parseInt(programmeFilter)] : undefined,
          taxonomyIds: taxonomyFilter !== "all" ? [parseInt(taxonomyFilter)] : undefined,
          funder: funderFilter !== "all" ? funderFilter : undefined,
          communityLens: communityLens !== "all" ? communityLens : undefined,
          narrativeStyle,
          activeFunderId: activeFunder?.id,
          participantStory: participantStory.trim() || undefined,
          whatsNext: whatsNext.trim() || undefined,
        },
        snapshotData: reportData,
        narrative: fullNarrative.trim() || narrativeData,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Saved", description: "Report snapshot saved successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to save report", variant: "destructive" });
    }
  };

  const handleLoadReport = async (id: number) => {
    try {
      const res = await fetch(`/api/reports/${id}`, { credentials: "include" });
      const data = await res.json();
      if (data.snapshotData) {
        setReportData(data.snapshotData);
        setNarrativeData(data.narrative || null);
        setGenerated(true);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load report", variant: "destructive" });
    }
  };

  const getPeriodLabel = () => {
    const { startDate, endDate } = getDateRange();
    if (!startDate || !endDate) return "";
    if (activeTab === "ytd") return `YTD ${new Date().getFullYear()}`;
    if (activeTab === "alltime") return "All Time";
    return `${format(new Date(startDate), "MMM d, yyyy")} - ${format(new Date(endDate), "MMM d, yyyy")}`;
  };


  const handleAddHighlight = async () => {
    try {
      const formData = new FormData();
      formData.append("title", highlightTitle);
      formData.append("description", highlightDescription);
      formData.append("category", highlightCategory);
      const { startDate } = getDateRange();
      formData.append("month", startDate);
      if (highlightPhoto) {
        formData.append("photo", highlightPhoto);
      }
      const res = await fetch("/api/report-highlights", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/report-highlights"] });
      refetchHighlights();
      setHighlightTitle("");
      setHighlightDescription("");
      setHighlightCategory("community");
      setHighlightPhoto(null);
      setShowHighlightDialog(false);
      toast({ title: "Added", description: "Highlight added to report" });
    } catch {
      toast({ title: "Error", description: "Failed to add highlight", variant: "destructive" });
    }
  };

  const handleDeleteHighlight = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/report-highlights/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/report-highlights"] });
      refetchHighlights();
    } catch {
      toast({ title: "Error", description: "Failed to delete highlight", variant: "destructive" });
    }
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;
    const rows: string[][] = [];
    const d = reportData;

    rows.push(["Report Period", getPeriodLabel()]);
    if (communityLens !== "all") rows.push(["Community Lens", COMMUNITY_LENS_LABELS[communityLens] || communityLens]);
    if (activeFunder) rows.push(["Funder Profile", activeFunder.name]);
    rows.push([]);

    const reach = d.reach || d.engagement;
    rows.push(["=== REACH ==="]);
    rows.push(["People Reached", String(reach?.peopleReached || 0)]);
    rows.push(["Unique Contacts", String(reach?.uniqueContacts || 0)]);
    rows.push(["Foot Traffic", String(reach?.footTraffic || 0)]);
    rows.push(["Total Engagements", String(reach?.totalEngagements || 0)]);
    rows.push(["Repeat Engagement Rate", `${reach?.repeatEngagementRate || 0}%`]);
    if (reach?.ecosystemGrowth) {
      rows.push(["New Contacts", String(reach.ecosystemGrowth.newContacts || 0)]);
      rows.push(["Promoted to Community", String(reach.ecosystemGrowth.promotedToCommunity || 0)]);
      rows.push(["Promoted to Innovators", String(reach.ecosystemGrowth.promotedToInnovator || 0)]);
      rows.push(["New Groups", String(reach.ecosystemGrowth.newGroups || 0)]);
    }
    if (reach?.sourceBreakdown) {
      rows.push(["Source: Debriefs", String(reach.sourceBreakdown.debriefs || 0)]);
      rows.push(["Source: Meetings", String(reach.sourceBreakdown.meetings || 0)]);
      rows.push(["Source: Events", String(reach.sourceBreakdown.events || 0)]);
      rows.push(["Source: External Events", String(reach.sourceBreakdown.externalEvents || 0)]);
      rows.push(["Source: Emails", String(reach.sourceBreakdown.emails || 0)]);
      rows.push(["Source: Venue Hires", String(reach.sourceBreakdown.bookings || 0)]);
      rows.push(["Source: Programmes", String(reach.sourceBreakdown.programmes || 0)]);
    }
    rows.push([]);

    rows.push(["=== DELIVERY ==="]);
    rows.push(["Total Activations", String(d.delivery?.totalActivations || 0)]);
    rows.push(["Events", String(d.delivery?.events?.total || 0)]);
    rows.push(["Venue Hires", String(d.delivery?.bookings?.total || 0)]);
    rows.push(["Mentoring Sessions", String(d.delivery?.mentoringSessions || 0)]);
    rows.push(["Partner Meetings", String(d.delivery?.partnerMeetings || 0)]);
    rows.push(["Workshops", String(d.delivery?.workshops || 0)]);
    rows.push(["Programmes", String(d.delivery?.programmes?.total || 0)]);
    rows.push(["Community Hours", String(d.delivery?.communityHours || 0)]);
    rows.push(["Total Attendees", String(d.delivery?.totalAttendees || 0)]);
    if (d.organisationsEngaged?.length > 0) {
      rows.push([]);
      rows.push(["=== ORGANISATIONS ENGAGED ==="]);
      rows.push(["Name", "Type", "Context", "Engaged Members", "Total Members"]);
      for (const org of d.organisationsEngaged) {
        rows.push([org.name, org.type, org.context, String(org.engagedMembers), String(org.totalMembers)]);
      }
    }
    rows.push([]);

    const imp = d.impact;
    rows.push(["=== IMPACT ==="]);
    rows.push(["Community Spend", `$${imp?.communitySpend || 0}`]);
    rows.push(["Milestones Achieved", String(imp?.milestoneCount || 0)]);
    rows.push(["People with Tracked Growth", String(imp?.contactsWithMetrics || 0)]);
    if (imp?.growthMetrics) {
      const metricLabels: Record<string, string> = {
        mindset: "Mindset", skill: "Skill", confidence: "Confidence",
        bizConfidence: "Biz Confidence", systemsInPlace: "Systems in Place",
        fundingReadiness: "Funding Readiness", networkStrength: "Network Strength",
        communityImpact: "Community Impact", digitalPresence: "Digital Presence",
      };
      for (const [key, label] of Object.entries(metricLabels)) {
        const data = imp.growthMetrics[key];
        if (data) {
          rows.push([`${label} Avg`, String(data.averageScore || 0)]);
          rows.push([`${label} Positive %`, `${data.positiveMovementPercent || 0}%`]);
        }
      }
    }
    rows.push(["Connections Deepened", String(imp?.connectionMovement || 0)]);
    if (d.economicRollup) {
      rows.push([]);
      rows.push(["=== ECONOMIC VALUE ==="]);
      rows.push(["Total Economic Value", `$${d.economicRollup.totalEconomicValue || 0}`]);
      rows.push(["Funding Secured", `$${d.economicRollup.fundingSecured || 0}`]);
      rows.push(["Businesses Launched", String(d.economicRollup.businessesLaunched || 0)]);
      rows.push(["Jobs Created", String(d.economicRollup.jobsCreated || 0)]);
      rows.push(["Revenue Milestones", `$${d.economicRollup.revenueMilestones || 0}`]);
      if (d.economicRollup.byType) {
        const typeLabels: Record<string, string> = {
          funding_secured: "Funding Secured", business_launched: "Business Launched",
          collaboration_formed: "Collaboration Formed", job_created: "Job Created",
          prototype_completed: "Prototype Completed", revenue_milestone: "Revenue Milestone",
          brand_launched: "Brand Launched", content_published: "Content Published",
          community_formed: "Community Formed", sponsorship_secured: "Sponsorship Secured",
          event_hosted: "Event Hosted", movement_milestone: "Movement Milestone",
          grant_received: "Grant Received", social_impact: "Social Impact", other: "Other",
        };
        rows.push([]);
        rows.push(["Milestone Type", "Count", "Total Value"]);
        for (const [type, data] of Object.entries(d.economicRollup.byType as Record<string, { count: number; totalValue: number }>)) {
          rows.push([typeLabels[type] || type, String(data.count), `$${data.totalValue}`]);
        }
      }
    }
    if (d.journeyProgression) {
      rows.push(["Journey Progressions", String(d.journeyProgression.totalProgressions || 0)]);
      rows.push(["Current Kakano", String(d.journeyProgression.currentDistribution?.kakano || 0)]);
      rows.push(["Current Tipu", String(d.journeyProgression.currentDistribution?.tipu || 0)]);
      rows.push(["Current Ora", String(d.journeyProgression.currentDistribution?.ora || 0)]);
    }
    if (d.connectionStrength?.distribution) {
      for (const item of d.connectionStrength.distribution) {
        rows.push([`Connection: ${item.strength}`, String(item.count)]);
      }
    }
    if (d.communityDiscounts) {
      rows.push(["Community Discounts Given", `$${d.communityDiscounts.totalDiscountValue || 0}`]);
      rows.push(["Discounted Venue Hires", String(d.communityDiscounts.discountedBookingsCount || 0)]);
    }
    if (imp?.taxonomyBreakdown) {
      rows.push([]);
      rows.push(["Impact Category", "Debriefs", "People Affected", "Impact Score"]);
      for (const cat of imp.taxonomyBreakdown) {
        rows.push([cat.name, String(cat.debriefCount), String(cat.peopleAffected), String(cat.impactScore)]);
      }
    }
    if (d.peopleFeatured?.length > 0) {
      rows.push([]);
      rows.push(["=== PEOPLE FEATURED ==="]);
      rows.push(["Name", "Role", "Stage", "Innovator", "Reasons", "Mindset", "Skill", "Confidence"]);
      for (const p of d.peopleFeatured) {
        rows.push([
          p.name, p.role || "", p.stage || "", p.isInnovator ? "Yes" : "No",
          p.reasons.join("; "),
          String(p.growthScores?.mindset ?? ""),
          String(p.growthScores?.skill ?? ""),
          String(p.growthScores?.confidence ?? ""),
        ]);
      }
    }
    rows.push([]);

    rows.push(["=== VALUE & CONTRIBUTION ==="]);
    rows.push(["Total Revenue", `$${d.value?.revenue?.total || 0}`]);
    rows.push(["In-Kind Value", `$${d.value?.inKindValue || 0}`]);
    rows.push(["Active Memberships", String(d.value?.memberships?.active || 0)]);
    rows.push(["Membership Revenue", `$${d.value?.memberships?.totalRevenue || 0}`]);

    if (narrativeData) {
      rows.push([]);
      rows.push(["=== NARRATIVE ==="]);
      rows.push(["Narrative Style", narrativeStyle]);
      rows.push([narrativeData]);
    }

    if (participantStory.trim()) {
      rows.push([]);
      rows.push(["=== PARTICIPANT STORY ==="]);
      rows.push([participantStory]);
    }

    if (whatsNext.trim()) {
      rows.push([]);
      rows.push(["=== WHAT'S NEXT ==="]);
      rows.push([whatsNext]);
    }

    const csvContent = rows.map(row =>
      row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const { startDate, endDate } = getDateRange();
    const funderPrefix = activeFunder ? `${activeFunder.name.replace(/\s+/g, "_")}-` : "";
    link.download = `${funderPrefix}report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reach = reportData?.reach || reportData?.engagement;
  const del = reportData?.delivery;
  const imp = reportData?.impact;
  const val = reportData?.value;
  const ment = reportData?.mentoring;
  const lm = reportData?.legacyMetrics;
  const isBlended = reportData?.isBlended;

  const { startDate: filterStart, endDate: filterEnd } = getDateRange();
  const periodHighlights = highlights?.filter((h: any) => {
    if (!filterStart || !filterEnd) return false;
    const hMonth = h.month?.slice(0, 10);
    return hMonth >= filterStart && hMonth <= filterEnd;
  }) || [];

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-reports-title">Reports</h1>
              <p className="text-muted-foreground mt-1">Generate funder-ready impact reports from your operational data.</p>
            </div>
          </div>

          <Card className="p-3" data-testid="report-toolbar">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg" data-testid="community-lens-selector">
                {([
                  { value: "all", label: "All", testId: "lens-all" },
                  { value: "maori", label: "Maori (matawaka)", testId: "lens-maori" },
                  { value: "pasifika", label: "Pasifika", testId: "lens-pasifika" },
                  { value: "maori_pasifika", label: "Maori + Pasifika", testId: "lens-maori-pasifika" },
                ] as const).map((opt) => (
                  <Button
                    key={opt.value}
                    variant={communityLens === opt.value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => { setCommunityLens(opt.value); setGenerated(false); }}
                    data-testid={opt.testId}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {communityLens !== "all" && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                  data-testid="banner-community-lens"
                >
                  <Users className="w-3 h-3 shrink-0" />
                  <span className="text-xs">{COMMUNITY_LENS_LABELS[communityLens]} only</span>
                  <button
                    onClick={() => { setCommunityLens("all"); setActiveFunder(null); setNarrativeStyle("compliance"); setGenerated(false); }}
                    className="ml-1 hover:bg-amber-200/50 rounded-full p-0.5"
                    data-testid="button-reset-lens"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}

              {fundersList && fundersList.length > 0 && (
                <>
                  <div className="hidden sm:block w-px h-6 bg-border" />
                  <div className="flex flex-wrap items-center gap-1.5" data-testid="funder-profile-selector">
                    {fundersList.map((funder) => {
                      const isActive = activeFunder?.id === funder.id;
                      return (
                        <Button
                          key={funder.id}
                          variant={isActive ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handleSelectFunder(funder)}
                          data-testid={`button-funder-${funder.id}`}
                        >
                          <Landmark className="w-3.5 h-3.5 mr-1" />
                          {funder.name}
                        </Button>
                      );
                    })}
                    <Link href="/funders">
                      <Button variant="ghost" size="icon" data-testid="link-manage-funders">
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setGenerated(false); }}>
              <TabsList className="bg-muted/50 p-1 rounded-xl mb-6 flex-wrap">
                <TabsTrigger value="monthly" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-monthly">
                  <CalendarDays className="w-4 h-4" /> Monthly
                </TabsTrigger>
                <TabsTrigger value="quarterly" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-quarterly">
                  <CalendarRange className="w-4 h-4" /> Quarterly
                </TabsTrigger>
                <TabsTrigger value="ytd" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-ytd">
                  <Zap className="w-4 h-4" /> YTD
                </TabsTrigger>
                <TabsTrigger value="alltime" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-alltime">
                  <History className="w-4 h-4" /> All Time
                </TabsTrigger>
                <TabsTrigger value="adhoc" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-adhoc">
                  <BarChart3 className="w-4 h-4" /> Custom
                </TabsTrigger>
              </TabsList>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <TabsContent value="monthly" className="mt-0 col-span-1">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger data-testid="select-month"><SelectValue placeholder="Select month" /></SelectTrigger>
                      <SelectContent>
                        {monthOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="quarterly" className="mt-0 col-span-1">
                  <div className="space-y-2">
                    <Label>Quarter</Label>
                    <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                      <SelectTrigger data-testid="select-quarter"><SelectValue placeholder="Select quarter" /></SelectTrigger>
                      <SelectContent>
                        {quarterOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="ytd" className="mt-0 col-span-1">
                  <div className="space-y-2">
                    <Label>Year to Date</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30 text-sm">
                      Jan 1, {new Date().getFullYear()} - Today
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="alltime" className="mt-0 col-span-1">
                  <div className="space-y-2">
                    <Label>All Time</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30 text-sm">
                      {dateRange?.earliestDate
                        ? `${format(new Date(dateRange.earliestDate), "MMM yyyy")} - Today`
                        : "All available data"}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="adhoc" className="mt-0 col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={adHocStart} onChange={e => setAdHocStart(e.target.value)} data-testid="input-adhoc-start" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={adHocEnd} onChange={e => setAdHocEnd(e.target.value)} data-testid="input-adhoc-end" />
                    </div>
                  </div>
                </TabsContent>

                <div className="space-y-2">
                  <Label>Programme</Label>
                  <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                    <SelectTrigger data-testid="select-programme-filter"><SelectValue placeholder="All programmes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programmes</SelectItem>
                      {programmes?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Impact Category</Label>
                  <Select value={taxonomyFilter} onValueChange={setTaxonomyFilter}>
                    <SelectTrigger data-testid="select-taxonomy-filter"><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {taxonomy?.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Funder</Label>
                  <Select value={funderFilter} onValueChange={setFunderFilter}>
                    <SelectTrigger data-testid="select-funder-filter"><SelectValue placeholder="All funders" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Funders</SelectItem>
                      {funderTags?.map((tag: string) => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleGenerate} disabled={isGenerating} data-testid="button-generate-report">
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> Generate Report</>
                  )}
                </Button>
              </div>
            </Tabs>
          </Card>

          {savedReports && savedReports.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Saved Reports
              </h3>
              <div className="flex flex-wrap gap-2">
                {savedReports.map((r: any) => (
                  <Button
                    key={r.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadReport(r.id)}
                    data-testid={`button-load-report-${r.id}`}
                  >
                    {r.title}
                    <Badge variant="secondary" className="ml-2 text-xs">{r.type}</Badge>
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {isGenerating && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {generated && reportData && !isGenerating && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="report-results">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-display font-bold" data-testid="text-report-header">
                    {activeFunder ? `${activeFunder.name} - ${COMMUNITY_LENS_LABELS[activeFunder.communityLens || "all"]}` : "Report Results"}
                  </h2>
                  <p className="text-sm text-muted-foreground" data-testid="text-report-period">{getPeriodLabel()}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSaveReport} data-testid="button-save-report">
                    <Save className="w-4 h-4 mr-2" /> Save Snapshot
                  </Button>
                  <Button variant="outline" onClick={handleDownloadCSV} data-testid="button-download-csv">
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
              </div>

              {isBlended && lm && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs" data-testid="banner-legacy-blend">
                  <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-indigo-800 dark:text-indigo-300">
                    Includes {reportData.legacyReportCount} legacy report{reportData.legacyReportCount > 1 ? "s" : ""} - {reportData.legacyPeriods?.join(", ")}
                  </span>
                </div>
              )}

              {/* Section 0: Trends */}
              <TrendsSection
                communityLens={communityLens}
                funderFilter={funderFilter}
                programmeFilter={programmeFilter}
                taxonomyFilter={taxonomyFilter}
                activeFunder={activeFunder}
                reportEndDate={filterEnd}
              />

              {/* Section 1: Reach */}
              <CollapsibleSection title="Reach" icon={Users} testId="section-reach" defaultOpen={isSectionDefaultOpen("reach")} key={`reach-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <HeadlineStatCard
                      icon={Users}
                      label="People Reached"
                      value={(reach?.peopleReached || 0).toLocaleString()}
                      color="primary"
                      testId="stat-people-reached"
                      subText={reach?.footTraffic > 0 ? `${reach.uniqueContacts || 0} tracked + ${(reach.footTraffic || 0).toLocaleString()} foot traffic` : undefined}
                    />
                    <StatCard icon={Activity} label="Total Engagements" value={(reach?.totalEngagements || 0).toLocaleString()} color="blue" testId="stat-total-engagements" />
                    <StatCard icon={TrendingUp} label="Repeat Engagement" value={`${reach?.repeatEngagementRate || 0}%`} color="amber" testId="stat-repeat-rate" subText={`${reach?.repeatEngagementCount || 0} people came back 2+ times`} />
                  </div>

                  {reach?.sourceBreakdown && (
                    <div className="flex flex-wrap gap-2" data-testid="reach-source-badges">
                      {Object.entries(reach.sourceBreakdown).filter(([_, v]) => (v as number) > 0).map(([source, count]) => (
                        <Badge key={source} variant="outline" className="text-xs capitalize py-1 px-2.5">
                          {source.replace(/([A-Z])/g, ' $1').trim()}: {count as number}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {reach?.ecosystemGrowth && (
                    <div className="pt-3 border-t">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-green-500" /> Ecosystem Growth
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={Users} label="New People" value={reach.ecosystemGrowth.newContacts || 0} color="green" testId="stat-new-contacts" />
                        <StatCard icon={ArrowUpRight} label="To Community" value={reach.ecosystemGrowth.promotedToCommunity || 0} color="blue" testId="stat-promoted-community" />
                        <StatCard icon={Star} label="To Innovators" value={reach.ecosystemGrowth.promotedToInnovator || 0} color="amber" testId="stat-promoted-innovator" />
                        <StatCard icon={Building2} label="New Groups" value={reach.ecosystemGrowth.newGroups || 0} color="violet" testId="stat-new-groups" />
                      </div>
                    </div>
                  )}

                  {reach?.demographicBreakdown?.ethnicity && Object.keys(reach.demographicBreakdown.ethnicity).length > 0 && (
                    <details className="pt-3 border-t">
                      <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors">Demographics</summary>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-3">Ethnicity</h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={Object.entries(reach.demographicBreakdown.ethnicity).map(([name, value]) => ({ name, value }))}
                                cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {Object.entries(reach.demographicBreakdown.ethnicity).map((_: any, i: number) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-3">Age Groups</h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={Object.entries(reach.demographicBreakdown.ageGroups || {}).filter(([_, v]) => (v as number) > 0).map(([name, value]) => ({ name: name.replace("_", "-"), value }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(14, 88%, 68%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 2: Delivery */}
              <CollapsibleSection title="Delivery" icon={CalendarDays} testId="section-delivery" defaultOpen={isSectionDefaultOpen("delivery")} key={`delivery-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  {communityLens !== "all" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2" data-testid="notice-delivery-unfiltered">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Events, venue hires, and programmes show organisation-level data (not filtered by community lens). Mentoring metrics are filtered.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <HeadlineStatCard
                      icon={Zap}
                      label="Total Activations"
                      value={(del?.totalActivations || 0).toLocaleString()}
                      color="indigo"
                      testId="stat-total-activations"
                    />
                    <StatCard icon={Users} label="Total Attendees" value={(del?.totalAttendees || 0).toLocaleString()} color="blue" testId="stat-total-attendees" />
                    <StatCard icon={Clock} label="Community Hours" value={del?.communityHours || 0} color="green" testId="stat-community-hours" />
                    {reportData?.communityDiscounts && reportData.communityDiscounts.discountedBookingsCount > 0 && (
                      <StatCard icon={DollarSign} label="Community Discounts" value={`$${reportData.communityDiscounts.totalDiscountValue.toLocaleString()}`} color="emerald" testId="stat-community-discounts" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard icon={CalendarDays} label="Events" value={del?.events?.total || 0} color="blue" testId="stat-events" />
                    <StatCard icon={Building2} label="Venue Hires" value={del?.bookings?.total || 0} color="orange" testId="stat-bookings" />
                    <StatCard icon={Users} label="Mentoring Sessions" value={del?.mentoringSessions || 0} color="purple" testId="stat-mentoring-sessions" />
                    <StatCard icon={Handshake} label="Partner Meetings" value={(del?.partnerMeetings || 0) + (isBlended && lm ? lm.activationsPartnerMeetings || 0 : 0)} color="teal" testId="stat-partner-meetings" />
                    <StatCard icon={Activity} label="Workshops" value={(del?.workshops || 0) + (isBlended && lm ? lm.activationsWorkshops || 0 : 0)} color="amber" testId="stat-workshops" />
                    <StatCard icon={Activity} label="Programmes" value={del?.programmes?.total || 0} color="indigo" testId="stat-programmes" />
                  </div>

                  {isBlended && lm && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="legacy-delivery-breakdown">
                      <StatCard icon={Users} label="Mentoring (legacy)" value={lm.activationsMentoring || 0} color="slate" testId="stat-legacy-mentoring" subText="legacy only" />
                      <StatCard icon={Activity} label="Legacy Activations" value={lm.activationsTotal || 0} color="indigo" testId="stat-legacy-activations" subText="legacy only" />
                    </div>
                  )}

                  <details className="pt-3 border-t">
                    <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors">Type Breakdowns</summary>
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

                  {ment && ment.totalSessions > 0 && (
                    <details className="pt-3 border-t">
                      <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-2">
                        <Users className="w-4 h-4" /> Mentoring Detail
                        {ment.byFocus && Object.keys(ment.byFocus).filter(k => k !== "Unspecified").length > 0 && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            Top: {Object.entries(ment.byFocus).filter(([k]) => k !== "Unspecified").sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3).map(([k]) => k).join(", ")}
                          </span>
                        )}
                      </summary>
                      <div className="mt-4 space-y-4" data-testid="subsection-mentoring">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          <StatCard icon={CalendarDays} label="Sessions" value={ment.totalSessions} color="purple" testId="stat-mentoring-total" />
                          <StatCard icon={Clock} label="Hours" value={Math.round(ment.totalHours * 10) / 10} color="violet" testId="stat-mentoring-hours" />
                          <StatCard icon={Users} label="Mentees" value={ment.uniqueMentees} color="indigo" testId="stat-mentoring-mentees" />
                          <StatCard icon={TrendingUp} label="Avg Sessions/Mentee" value={Math.round(ment.avgSessionsPerMentee * 10) / 10} color="blue" testId="stat-avg-sessions" />
                          <StatCard icon={Users} label="New Mentees" value={ment.newMentees} color="emerald" testId="stat-new-mentees" />
                          <StatCard icon={Activity} label="Completion Rate" value={`${Math.round(ment.completionRate)}%`} color="green" testId="stat-completion-rate" />
                        </div>
                        {ment.byFocus && Object.keys(ment.byFocus).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-3">Sessions by Focus Area</h4>
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={Object.entries(ment.byFocus).map(([name, value]) => ({ name, value }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="hsl(262, 80%, 50%)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {reportData?.organisationsEngaged && reportData.organisationsEngaged.length > 0 && (
                    <details className="pt-3 border-t">
                      <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Organisations Engaged ({reportData.organisationsEngaged.length})
                      </summary>
                      <div className="mt-4" data-testid="subsection-organisations-engaged">
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50">
                                <th className="text-left p-3 font-medium">Organisation</th>
                                <th className="text-left p-3 font-medium">Type</th>
                                <th className="text-left p-3 font-medium">Context</th>
                                <th className="text-center p-3 font-medium">Engaged</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.organisationsEngaged.map((org: any) => (
                                <tr key={org.id} className="border-t">
                                  <td className="p-3 font-medium">{org.name}</td>
                                  <td className="p-3 text-muted-foreground">{org.type}</td>
                                  <td className="p-3">
                                    <Badge variant="secondary" className="text-xs">{org.context}</Badge>
                                  </td>
                                  <td className="p-3 text-center">{org.engagedMembers}/{org.totalMembers}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  )}

                  {reportData?.surveyData?.postBooking && reportData.surveyData.postBooking.totalCompleted > 0 && (
                    <div className="pt-3 border-t" data-testid="post-booking-satisfaction">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" /> Post-Booking Feedback
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <StatCard icon={MessageSquare} label="Responses" value={reportData.surveyData.postBooking.totalCompleted} color="emerald" testId="stat-pb-responses" />
                        <StatCard icon={Activity} label="Response Rate" value={`${reportData.surveyData.postBooking.completionRate}%`} color="green" testId="stat-pb-response-rate" />
                        {reportData.surveyData.postBooking.overallSatisfaction !== null && (
                          <StatCard icon={Star} label="Avg Satisfaction" value={`${reportData.surveyData.postBooking.overallSatisfaction}/10`} color="amber" testId="stat-pb-satisfaction" />
                        )}
                        <StatCard icon={FileText} label="Surveys Sent" value={reportData.surveyData.postBooking.totalSent} color="slate" testId="stat-pb-sent" />
                      </div>
                      {reportData.surveyData.postBooking.aggregatedQuestions.length > 0 && (
                        <div className="space-y-2">
                          {reportData.surveyData.postBooking.aggregatedQuestions.filter((q: any) => q.averageRating !== null).map((q: any) => (
                            <div key={q.questionId} className="flex items-center gap-3 text-sm" data-testid={`pb-question-${q.questionId}`}>
                              <span className="flex-1 text-muted-foreground truncate">{q.question}</span>
                              <span className="font-semibold">{q.averageRating}/10</span>
                              <span className="text-xs text-muted-foreground">({q.responseCount} responses)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 3: Impact */}
              <CollapsibleSection title="Impact" icon={TrendingUp} testId="section-impact" defaultOpen={isSectionDefaultOpen("impact")} key={`impact-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  {reportData?.economicRollup && ((reportData.economicRollup.totalEconomicValue || 0) > 0 || (reportData.economicRollup.businessesLaunched || 0) > 0 || (reportData.economicRollup.jobsCreated || 0) > 0) && (
                    <>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid="economic-rollup-heading">Economic Value Generated</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        <HeadlineStatCard
                          icon={BadgeDollarSign}
                          label="Total Economic Value"
                          value={`$${reportData.economicRollup.totalEconomicValue.toLocaleString()}`}
                          color="emerald"
                          testId="stat-total-economic-value"
                        />
                        {(reportData.economicRollup.fundingSecured || 0) > 0 && (
                          <HeadlineStatCard
                            icon={Landmark}
                            label="Funding Secured"
                            value={`$${reportData.economicRollup.fundingSecured.toLocaleString()}`}
                            color="green"
                            testId="stat-funding-secured"
                          />
                        )}
                        {(reportData.economicRollup.businessesLaunched || 0) > 0 && (
                          <HeadlineStatCard
                            icon={Rocket}
                            label="Businesses Launched"
                            value={reportData.economicRollup.businessesLaunched}
                            color="blue"
                            testId="stat-businesses-launched"
                          />
                        )}
                        {(reportData.economicRollup.jobsCreated || 0) > 0 && (
                          <HeadlineStatCard
                            icon={Briefcase}
                            label="Jobs Created"
                            value={reportData.economicRollup.jobsCreated}
                            color="indigo"
                            testId="stat-jobs-created"
                          />
                        )}
                        {(reportData.economicRollup.revenueMilestones || 0) > 0 && (
                          <HeadlineStatCard
                            icon={DollarSign}
                            label="Revenue Milestones"
                            value={`$${reportData.economicRollup.revenueMilestones.toLocaleString()}`}
                            color="teal"
                            testId="stat-revenue-milestones"
                          />
                        )}
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(imp?.communitySpend || 0) > 0 && (
                      <HeadlineStatCard
                        icon={DollarSign}
                        label="Community Investment"
                        value={`$${(imp?.communitySpend || 0).toLocaleString()}`}
                        color="green"
                        testId="stat-community-spend"
                      />
                    )}
                    <HeadlineStatCard
                      icon={Star}
                      label="Milestones Achieved"
                      value={imp?.milestoneCount || 0}
                      color="amber"
                      testId="stat-milestones"
                    />
                    <HeadlineStatCard
                      icon={Users}
                      label="People with Tracked Growth"
                      value={imp?.contactsWithMetrics || 0}
                      color="violet"
                      testId="stat-tracked-growth"
                    />
                  </div>

                  {imp?.growthMetrics && (() => {
                    const METRIC_GROUPS = [
                      { title: "Personal Growth", metrics: [
                        { key: "mindset", label: "Mindset", color: "text-blue-600 dark:text-blue-400", barColor: "bg-blue-500" },
                        { key: "skill", label: "Skill", color: "text-green-600 dark:text-green-400", barColor: "bg-green-500" },
                        { key: "confidence", label: "Confidence", color: "text-violet-600 dark:text-violet-400", barColor: "bg-violet-500" },
                      ]},
                      { title: "Venture Development", metrics: [
                        { key: "bizConfidence", label: "Biz Confidence", color: "text-orange-600 dark:text-orange-400", barColor: "bg-orange-500" },
                        { key: "systemsInPlace", label: "Systems in Place", color: "text-teal-600 dark:text-teal-400", barColor: "bg-teal-500" },
                        { key: "fundingReadiness", label: "Funding Readiness", color: "text-emerald-600 dark:text-emerald-400", barColor: "bg-emerald-500" },
                      ]},
                      { title: "Community & Presence", metrics: [
                        { key: "networkStrength", label: "Network Strength", color: "text-indigo-600 dark:text-indigo-400", barColor: "bg-indigo-500" },
                        { key: "communityImpact", label: "Community Impact", color: "text-pink-600 dark:text-pink-400", barColor: "bg-pink-500" },
                        { key: "digitalPresence", label: "Digital Presence", color: "text-cyan-600 dark:text-cyan-400", barColor: "bg-cyan-500" },
                      ]},
                    ];
                    const ba = imp.beforeAfterMetrics as Record<string, { startAvg: number; endAvg: number; avgImprovement: number; improvedPercent: number }> | undefined;
                    const hasBeforeAfter = ba && Object.values(ba).some(v => v.startAvg > 0 || v.endAvg > 0);
                    const hasData = (keys: string[]) => keys.some(k => {
                      const d = imp.growthMetrics[k];
                      return d && (d.averageScore > 0 || d.positiveMovementPercent > 0);
                    });
                    return (
                      <div className="space-y-4">
                        {hasBeforeAfter && (
                          <div data-testid="before-after-comparison">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Before / After Comparison</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {METRIC_GROUPS.flatMap(g => g.metrics).map(metric => {
                                const baData = ba?.[metric.key];
                                if (!baData || (baData.startAvg === 0 && baData.endAvg === 0)) return null;
                                const improvement = baData.avgImprovement;
                                return (
                                  <Card key={metric.key} className="p-4" data-testid={`ba-card-${metric.key}`}>
                                    <h4 className={`text-sm font-semibold mb-3 ${metric.color}`}>{metric.label}</h4>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="text-center">
                                        <div className="text-xs text-muted-foreground mb-1">Start</div>
                                        <span className="text-lg font-bold">{baData.startAvg}</span>
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                      <div className="text-center">
                                        <div className="text-xs text-muted-foreground mb-1">End</div>
                                        <span className="text-lg font-bold">{baData.endAvg}</span>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xs text-muted-foreground mb-1">Change</div>
                                        <span className={`text-lg font-bold ${improvement > 0 ? "text-green-600 dark:text-green-400" : improvement < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                          {improvement > 0 ? "+" : ""}{improvement}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${metric.barColor} rounded-full transition-all`}
                                          style={{ width: `${baData.improvedPercent}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-green-600 dark:text-green-400">{baData.improvedPercent}% improved</span>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {METRIC_GROUPS.map(group => {
                          if (!hasData(group.metrics.map(m => m.key))) return null;
                          return (
                            <div key={group.title}>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{group.title}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {group.metrics.map(metric => {
                                  const data = imp.growthMetrics[metric.key];
                                  if (!data || (data.averageScore === 0 && data.positiveMovementPercent === 0)) return null;
                                  const baData = ba?.[metric.key];
                                  const hasBAData = hasBeforeAfter && baData && (baData.startAvg > 0 || baData.endAvg > 0);
                                  const pctValue = hasBAData ? baData.improvedPercent : data.positiveMovementPercent;
                                  const pctLabel = hasBAData ? `${pctValue}% improved` : `${pctValue}% positive`;
                                  return (
                                    <Card key={metric.key} className="p-4" data-testid={`metric-card-${metric.key}`}>
                                      <h4 className={`text-sm font-semibold mb-2 ${metric.color}`}>{metric.label}</h4>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold">{data.averageScore}</span>
                                        <span className="text-xs text-muted-foreground">/10 avg</span>
                                        {hasBAData && baData.avgImprovement !== 0 && (
                                          <span className={`text-xs font-medium ${baData.avgImprovement > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                            {baData.avgImprovement > 0 ? "+" : ""}{baData.avgImprovement} avg
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className={`h-full ${metric.barColor} rounded-full transition-all`}
                                            style={{ width: `${pctValue}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-green-600 dark:text-green-400">{pctLabel}</span>
                                      </div>
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}


                  {reportData?.surveyData?.growth && reportData.surveyData.growth.totalCompleted > 0 && (
                    <div className="pt-3 border-t" data-testid="community-voice">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-600" /> Community Voice
                        <span className="text-xs font-normal text-muted-foreground ml-1">Self-reported outcomes from growth surveys</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <StatCard icon={MessageSquare} label="Responses" value={reportData.surveyData.growth.totalCompleted} color="purple" testId="stat-survey-responses" />
                        <StatCard icon={Activity} label="Completion Rate" value={`${reportData.surveyData.growth.completionRate}%`} color="violet" testId="stat-survey-completion" />
                        <StatCard icon={FileText} label="Surveys Sent" value={reportData.surveyData.growth.totalSent} color="slate" testId="stat-survey-sent" />
                        <StatCard icon={Users} label="Completed Surveys" value={reportData.surveyData.totalCompletedSurveys} color="indigo" testId="stat-survey-total" />
                      </div>

                      {reportData.surveyData.growth.aggregatedQuestions.filter((q: any) => q.averageRating !== null).length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Self-Reported Growth Ratings</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {reportData.surveyData.growth.aggregatedQuestions.filter((q: any) => q.averageRating !== null).map((q: any) => {
                              const pct = q.averageRating ? Math.round((q.averageRating / 10) * 100) : 0;
                              const aiMetricKey = q.question.toLowerCase().includes("mindset") ? "mindset"
                                : q.question.toLowerCase().includes("skill") ? "skill"
                                : q.question.toLowerCase().includes("confidence") ? "confidence"
                                : null;
                              const aiData = aiMetricKey && imp?.growthMetrics?.[aiMetricKey];
                              return (
                                <Card key={q.questionId} className="p-4" data-testid={`survey-question-${q.questionId}`}>
                                  <h4 className="text-sm font-semibold mb-2 text-purple-600 dark:text-purple-400">{q.question}</h4>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold">{q.averageRating}</span>
                                    <span className="text-xs text-muted-foreground">/10 avg ({q.responseCount} responses)</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{q.averageRating}/10</span>
                                  </div>
                                  {aiData && (aiData.averageScore > 0 || aiData.positiveMovementPercent > 0) && (
                                    <div className="mt-3 pt-2 border-t border-dashed">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        AI-detected: {aiData.averageScore}/10 avg, {aiData.positiveMovementPercent}% positive movement
                                      </p>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {reportData.surveyData.growth.aggregatedQuestions.some((q: any) => q.sampleTextAnswers?.length > 0) && (
                        <details className="mt-3" data-testid="survey-open-ended-details">
                          <summary className="text-xs font-semibold cursor-pointer hover:text-primary transition-colors text-muted-foreground uppercase tracking-wider" data-testid="toggle-survey-open-ended">Open-Ended Responses</summary>
                          <div className="mt-2 space-y-2">
                            {reportData.surveyData.growth.aggregatedQuestions.filter((q: any) => q.sampleTextAnswers?.length > 0).map((q: any) => (
                              <div key={q.questionId} data-testid={`survey-text-${q.questionId}`}>
                                <p className="text-sm font-medium mb-1">{q.question}</p>
                                {q.sampleTextAnswers.slice(0, 3).map((a: string, i: number) => (
                                  <p key={i} className="text-sm italic text-muted-foreground border-l-2 border-purple-300 dark:border-purple-700 pl-3 mb-1">"{a}"</p>
                                ))}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {reportData?.journeyProgression && (reportData.journeyProgression.totalProgressions > 0 || Object.values(reportData.journeyProgression.currentDistribution).some((v: any) => v > 0)) && (
                    <div className="pt-3 border-t" data-testid="journey-progression">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" /> Journey Stage Progression
                      </h4>
                      <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
                        {["kakano", "tipu", "ora"].map((stage, idx) => {
                          const dist = reportData.journeyProgression.currentDistribution;
                          const stageColors: Record<string, string> = { kakano: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300", tipu: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300", ora: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300" };
                          const transition = reportData.journeyProgression.transitions?.find((t: any) => t.to === stage);
                          return (
                            <div key={stage} className="flex items-center gap-2">
                              {idx > 0 && (
                                <div className="flex flex-col items-center">
                                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                                  {transition && transition.count > 0 && (
                                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400">+{transition.count}</span>
                                  )}
                                </div>
                              )}
                              <div className={`rounded-lg border px-4 py-3 text-center ${stageColors[stage]}`}>
                                <p className="text-xs font-medium uppercase tracking-wider">{stage}</p>
                                <p className="text-2xl font-bold">{dist[stage] || 0}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {reportData.journeyProgression.totalProgressions > 0 && (
                        <p className="text-sm text-center text-muted-foreground">
                          <strong>{reportData.journeyProgression.totalProgressions}</strong> {reportData.journeyProgression.totalProgressions === 1 ? "person" : "people"} progressed during this period
                        </p>
                      )}
                    </div>
                  )}

                  {reportData?.connectionStrength?.distribution && reportData.connectionStrength.total > 0 && (
                    <div className="pt-3 border-t" data-testid="connection-strength-distribution">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-indigo-600" /> Connection Strength Distribution
                      </h4>
                      <div className="space-y-2">
                        {reportData.connectionStrength.distribution.map((item: any, idx: number) => {
                          const pct = reportData.connectionStrength.total > 0 ? Math.round((item.count / reportData.connectionStrength.total) * 100) : 0;
                          const strengthColors: Record<string, string> = { known: "bg-slate-400", connected: "bg-blue-400", engaged: "bg-green-500", embedded: "bg-violet-500", partnering: "bg-amber-500" };
                          const upTransitions = (reportData.connectionStrength.movements?.transitions || []).filter(
                            (t: any) => t.from === item.strength && t.direction === "up"
                          );
                          const downTransitions = (reportData.connectionStrength.movements?.transitions || []).filter(
                            (t: any) => t.from === item.strength && t.direction === "down"
                          );
                          const hasMovement = upTransitions.length > 0 || downTransitions.length > 0;
                          return (
                            <div key={item.strength}>
                              <div className="flex items-center gap-3" data-testid={`connection-${item.strength}`}>
                                <span className="text-xs font-medium w-20 capitalize">{item.strength}</span>
                                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full ${strengthColors[item.strength] || "bg-primary"} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-medium w-16 text-right">{item.count} ({pct}%)</span>
                              </div>
                              {hasMovement && (
                                <div className="flex items-center gap-1 ml-20 pl-3 py-0.5 flex-wrap">
                                  {upTransitions.map((t: any, i: number) => (
                                    <span key={`up-${i}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400" data-testid={`movement-${item.strength}-to-${t.to}`}>
                                      {i > 0 && <span className="text-muted-foreground mx-0.5">·</span>}
                                      <ArrowUpRight className="w-3 h-3" /> {t.count} <MoveRight className="w-3 h-3" /> {t.to}
                                    </span>
                                  ))}
                                  {upTransitions.length > 0 && downTransitions.length > 0 && <span className="text-muted-foreground mx-1">·</span>}
                                  {downTransitions.map((t: any, i: number) => (
                                    <span key={`down-${i}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500 dark:text-orange-400" data-testid={`movement-${item.strength}-to-${t.to}`}>
                                      {i > 0 && <span className="text-muted-foreground mx-0.5">·</span>}
                                      <ArrowDownRight className="w-3 h-3" /> {t.count} <MoveRight className="w-3 h-3" /> {t.to}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {reportData.connectionStrength.movements && reportData.connectionStrength.movements.totalDeepened > 0 && (
                        <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" data-testid="connection-movement-summary">
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium text-green-800 dark:text-green-200">{reportData.connectionStrength.movements.summary}</span>
                          </div>
                        </div>
                      )}
                      {reportData.connectionStrength.movements && reportData.connectionStrength.movements.totalDeclined > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800" data-testid="connection-decline-summary">
                          <div className="flex items-center gap-2">
                            <ArrowDownRight className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                            <span className="text-xs text-orange-700 dark:text-orange-300">{reportData.connectionStrength.movements.totalDeclined} {reportData.connectionStrength.movements.totalDeclined === 1 ? "person" : "people"} moved to a lower connection level</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {imp?.taxonomyBreakdown && imp.taxonomyBreakdown.length > 0 && (
                    <details className="pt-3 border-t">
                      <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Impact by Category ({imp.taxonomyBreakdown.length})
                      </summary>
                      <div className="mt-4 space-y-3">
                        {imp.taxonomyBreakdown.map((cat: any, idx: number) => (
                          <div key={idx} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "hsl(14, 88%, 68%)" }} />
                                <span className="font-semibold">{cat.name}</span>
                              </div>
                              <div className="flex gap-2 text-sm text-muted-foreground">
                                <span>{cat.debriefCount} debriefs</span>
                                <span>-</span>
                                <span>{cat.peopleAffected} people</span>
                                <span>-</span>
                                <span>Score: {cat.impactScore}</span>
                              </div>
                            </div>
                            {cat.topQuotes?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {cat.topQuotes.slice(0, 2).map((q: string, i: number) => (
                                  <p key={i} className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">"{q}"</p>
                                ))}
                              </div>
                            )}
                            {cat.evidence?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {cat.evidence.slice(0, 3).map((e: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{e.length > 80 ? e.slice(0, 80) + "..." : e}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {reportData?.peopleFeatured && reportData.peopleFeatured.length > 0 && (
                    <details className="pt-3 border-t">
                      <summary className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-2">
                        <Users className="w-4 h-4" /> People Featured ({reportData.peopleFeatured.length})
                      </summary>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="subsection-people-featured">
                        {reportData.peopleFeatured.map((person: any) => (
                          <Card key={person.id} className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <Link href={`/community/people/${person.id}`}>
                                  <span className="font-semibold hover:text-primary cursor-pointer" data-testid={`person-featured-${person.id}`}>{person.name}</span>
                                </Link>
                                {person.role && <p className="text-xs text-muted-foreground">{person.role}</p>}
                              </div>
                              <div className="flex items-center gap-1">
                                {person.stage && (
                                  <Badge variant="outline" className="text-xs capitalize">{person.stage}</Badge>
                                )}
                                {person.isInnovator && (
                                  <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Innovator</Badge>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {person.reasons.map((reason: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                                  {reason}
                                </p>
                              ))}
                            </div>
                            {person.growthScores && (person.growthScores.mindset != null || person.growthScores.skill != null || person.growthScores.confidence != null) && (
                              <div className="flex gap-3 mt-3 pt-2 border-t">
                                {person.growthScores.mindset != null && (
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-blue-600">{person.growthScores.mindset}</div>
                                    <div className="text-[10px] text-muted-foreground">Mindset</div>
                                  </div>
                                )}
                                {person.growthScores.skill != null && (
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-green-600">{person.growthScores.skill}</div>
                                    <div className="text-[10px] text-muted-foreground">Skill</div>
                                  </div>
                                )}
                                {person.growthScores.confidence != null && (
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-violet-600">{person.growthScores.confidence}</div>
                                    <div className="text-[10px] text-muted-foreground">Confidence</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 4: Highlights */}
              <CollapsibleSection title="Highlights" icon={Camera} testId="section-highlights" defaultOpen={isSectionDefaultOpen("highlights")} key={`highlights-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Key moments, achievements, and stories from this period.</p>
                    <Dialog open={showHighlightDialog} onOpenChange={setShowHighlightDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid="button-add-highlight">
                          <Plus className="w-4 h-4 mr-1" /> Add Highlight
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Highlight</DialogTitle>
                          <DialogDescription className="sr-only">Add a highlight to the report</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              value={highlightTitle}
                              onChange={e => setHighlightTitle(e.target.value)}
                              placeholder="e.g. Community Day Success"
                              data-testid="input-highlight-title"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={highlightDescription}
                              onChange={e => setHighlightDescription(e.target.value)}
                              placeholder="What happened and why it matters..."
                              className="min-h-[80px]"
                              data-testid="textarea-highlight-desc"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={highlightCategory} onValueChange={setHighlightCategory}>
                              <SelectTrigger data-testid="select-highlight-category"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {HIGHLIGHT_CATEGORY_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Photo (optional)</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={e => setHighlightPhoto(e.target.files?.[0] || null)}
                              data-testid="input-highlight-photo"
                            />
                            {highlightPhoto && (
                              <div className="mt-2 w-24 h-24 rounded-md overflow-hidden bg-muted">
                                <img src={URL.createObjectURL(highlightPhoto)} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                          <Button onClick={handleAddHighlight} disabled={!highlightTitle.trim()} data-testid="button-submit-highlight">
                            <Plus className="w-4 h-4 mr-2" /> Add
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {periodHighlights.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {periodHighlights.map((h: any) => (
                        <Card key={h.id} className="overflow-hidden" data-testid={`highlight-card-${h.id}`}>
                          {h.photoUrl && (
                            <div className="h-40 bg-muted">
                              <img src={h.photoUrl} alt={h.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-semibold text-sm">{h.title}</h4>
                                <Badge variant="secondary" className="text-xs mt-1 capitalize">{h.category}</Badge>
                              </div>
                              <button
                                onClick={() => handleDeleteHighlight(h.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                data-testid={`button-delete-highlight-${h.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {h.description && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{h.description}</p>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No highlights yet for this period. Add photos and key moments to enrich your report.
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 5: Value & Contribution */}
              <CollapsibleSection title="Value & Contribution" icon={DollarSign} testId="section-value" defaultOpen={isSectionDefaultOpen("value")} key={`value-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  {communityLens !== "all" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2" data-testid="notice-value-unfiltered">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Financial metrics show organisation-level data (not filtered by community lens)</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={DollarSign} label="Total Revenue" value={`$${val?.revenue?.total?.toLocaleString() || 0}`} color="green" testId="stat-total-revenue" />
                    <StatCard icon={Handshake} label="In-Kind Value" value={`$${val?.inKindValue?.toLocaleString() || 0}`} color="blue" testId="stat-inkind-value" />
                    <StatCard icon={Users} label="Active Memberships" value={val?.memberships?.active || 0} color="violet" testId="stat-memberships" />
                    <StatCard icon={Handshake} label="Partnership Agreements" value={val?.mouExchange?.active || 0} color="amber" testId="stat-mous" />
                  </div>

                  {val?.revenue?.byPricingTier && Object.keys(val.revenue.byPricingTier).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Revenue by Pricing Tier</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {Object.entries(val.revenue.byPricingTier).map(([tier, data]: [string, any]) => (
                          <Card key={tier} className="p-3">
                            <p className="text-sm text-muted-foreground capitalize">{tier.replace("_", " ")}</p>
                            <p className="text-lg font-bold">${data.revenue?.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{data.count} venue hires</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {val?.memberships?.details?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Membership Usage</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3">Membership</th>
                              <th className="text-right p-3">Value</th>
                              <th className="text-right p-3">Pays</th>
                              <th className="text-right p-3">Venue Hires</th>
                            </tr>
                          </thead>
                          <tbody>
                            {val.memberships.details.map((m: any) => (
                              <tr key={m.id} className="border-t">
                                <td className="p-3">{m.name}{m.membershipYear ? ` (${m.membershipYear})` : ""}</td>
                                <td className="text-right p-3">${(m.standardValue || 0).toFixed(2)}</td>
                                <td className="text-right p-3">${(m.annualFee || 0).toFixed(2)}</td>
                                <td className="text-right p-3">
                                  {m.bookingsUsed}/{m.bookingAllowance || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {val?.programmeCosts?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Programme Costs</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3">Programme</th>
                              <th className="text-right p-3">Facilitator</th>
                              <th className="text-right p-3">Catering</th>
                              <th className="text-right p-3">Promo</th>
                              <th className="text-right p-3 font-bold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {val.programmeCosts.map((p: any) => (
                              <tr key={p.id} className="border-t">
                                <td className="p-3">{p.name}</td>
                                <td className="text-right p-3">${p.facilitatorCost}</td>
                                <td className="text-right p-3">${p.cateringCost}</td>
                                <td className="text-right p-3">${p.promoCost}</td>
                                <td className="text-right p-3 font-bold">${p.totalCost}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 6: Benchmark Insights */}
              {benchmarkData && benchmarkData.insights?.length > 0 && (
                <CollapsibleSection title="Benchmark Insights" icon={TrendingUp} testId="section-benchmark" defaultOpen={true}>
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <MetricBenchmarkCard
                        title="Activations"
                        benchmarks={benchmarkData.benchmarks?.activations || benchmarkData.benchmarks}
                        color="indigo"
                      />
                      <MetricBenchmarkCard
                        title="Foot Traffic"
                        benchmarks={benchmarkData.benchmarks?.foottraffic}
                        color="cyan"
                      />
                      <MetricBenchmarkCard
                        title="Venue Hires"
                        benchmarks={benchmarkData.benchmarks?.bookings}
                        color="orange"
                      />
                    </div>

                    <div className="space-y-2">
                      {benchmarkData.insights.map((insight: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Section 7: Community Comparison */}
              {communityLens === "all" && communityComparisonData && (
                <CollapsibleSection title="Community Comparison" icon={Users} testId="section-community-comparison" defaultOpen={true}>
                  <div className="pt-4 space-y-4">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Community Split</span>
                        <span className="text-sm text-muted-foreground" data-testid="text-community-total">
                          {communityComparisonData.communitySplit?.totalParticipants || 0} total participants
                        </span>
                      </div>
                      <div className="w-full h-6 rounded-md overflow-hidden flex" data-testid="bar-community-split">
                        <div
                          className="h-full flex items-center justify-center text-xs font-medium text-white"
                          style={{
                            width: `${communityComparisonData.communitySplit?.maoriPercent || 0}%`,
                            backgroundColor: "hsl(14, 88%, 68%)",
                            minWidth: communityComparisonData.communitySplit?.maoriPercent > 0 ? "2rem" : "0",
                          }}
                          data-testid="bar-maori-split"
                        >
                          {communityComparisonData.communitySplit?.maoriPercent || 0}%
                        </div>
                        <div
                          className="h-full flex items-center justify-center text-xs font-medium text-white"
                          style={{
                            width: `${communityComparisonData.communitySplit?.pasifikaPercent || 0}%`,
                            backgroundColor: "hsl(161, 100%, 12%)",
                            minWidth: communityComparisonData.communitySplit?.pasifikaPercent > 0 ? "2rem" : "0",
                          }}
                          data-testid="bar-pasifika-split"
                        >
                          {communityComparisonData.communitySplit?.pasifikaPercent || 0}%
                        </div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(14, 88%, 68%)" }} />
                          <span className="text-xs text-muted-foreground">Maori</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(161, 100%, 12%)" }} />
                          <span className="text-xs text-muted-foreground">Pasifika</span>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm" data-testid="table-community-comparison">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3">Metric</th>
                            <th className="text-right p-3" style={{ color: "hsl(14, 88%, 68%)" }}>Maori</th>
                            <th className="text-right p-3" style={{ color: "hsl(161, 100%, 12%)" }}>Pasifika</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t">
                            <td className="p-3">Unique Participants</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-maori-participants">{communityComparisonData.maori?.uniqueParticipants || 0}</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-pasifika-participants">{communityComparisonData.pasifika?.uniqueParticipants || 0}</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-3">Rangatahi (under 25)</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-maori-rangatahi">{communityComparisonData.maori?.rangatahiUnder25 || 0}</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-pasifika-rangatahi">{communityComparisonData.pasifika?.rangatahiUnder25 || 0}</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-3">Active in Business Programmes</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-maori-business">{communityComparisonData.maori?.activeInBusinessProgrammes || 0}</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-pasifika-business">{communityComparisonData.pasifika?.activeInBusinessProgrammes || 0}</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-3">Confidence Growth</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-maori-confidence">{communityComparisonData.maori?.confidenceGrowthPercent || 0}%</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-pasifika-confidence">{communityComparisonData.pasifika?.confidenceGrowthPercent || 0}%</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-3">Milestones Achieved</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-maori-milestones">{communityComparisonData.maori?.milestonesAchieved || 0}</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-pasifika-milestones">{communityComparisonData.pasifika?.milestonesAchieved || 0}</td>
                          </tr>
                          <tr className="border-t">
                            <td className="p-3">New Contacts This Period</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-maori-new-contacts">{communityComparisonData.maori?.newContactsThisPeriod || 0}</td>
                            <td className="text-right p-3 font-medium" data-testid="stat-pasifika-new-contacts">{communityComparisonData.pasifika?.newContactsThisPeriod || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Section 8: Tamaki Ora Alignment */}
              {tamakiOraData && (
                <CollapsibleSection title="Tamaki Ora Alignment" icon={Landmark} testId="section-tamaki-ora" defaultOpen={isSectionDefaultOpen("tamaki-ora")}>
                  <div className="pt-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Alignment with the Tamaki Ora outcomes framework - measuring impact across three pou for Maori community wellbeing.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="p-4 space-y-3" data-testid="card-whai-rawa-ora">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-600">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">Whai Rawa Ora</h4>
                            <p className="text-xs text-muted-foreground">Economic Wellbeing</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">In business programmes</span>
                            <span className="font-medium" data-testid="stat-whai-rawa-biz">{tamakiOraData.whaiRawaOra?.contactsInBusinessProgrammes || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Funding milestones</span>
                            <span className="font-medium" data-testid="stat-whai-rawa-funding">{tamakiOraData.whaiRawaOra?.fundingMilestones || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Stage progressions</span>
                            <span className="font-medium" data-testid="stat-whai-rawa-stage">{tamakiOraData.whaiRawaOra?.stageProgressions || 0}</span>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4 space-y-3" data-testid="card-te-hapori-ora">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/10 text-green-600">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">Te Hapori Ora</h4>
                            <p className="text-xs text-muted-foreground">Thriving Communities</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">In community events</span>
                            <span className="font-medium" data-testid="stat-hapori-events">{tamakiOraData.teHaporiOra?.contactsInCommunityEvents || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Rangatahi count</span>
                            <span className="font-medium" data-testid="stat-hapori-rangatahi">{tamakiOraData.teHaporiOra?.rangatahiCount || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Repeat engagement</span>
                            <span className="font-medium" data-testid="stat-hapori-repeat">{tamakiOraData.teHaporiOra?.repeatEngagementRate || 0}%</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Active groups</span>
                            <span className="font-medium" data-testid="stat-hapori-groups">{tamakiOraData.teHaporiOra?.activeGroupsWithMaori || 0}</span>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4 space-y-3" data-testid="card-huatau-ora">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-600">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">Huatau Ora</h4>
                            <p className="text-xs text-muted-foreground">Innovation & Futures</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Rangatahi in innovation</span>
                            <span className="font-medium" data-testid="stat-huatau-rangatahi">{tamakiOraData.huatauOra?.rangatahiInInnovation || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">New venture milestones</span>
                            <span className="font-medium" data-testid="stat-huatau-ventures">{tamakiOraData.huatauOra?.newVentureMilestones || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Avg mindset shift</span>
                            <span className="font-medium" data-testid="stat-huatau-mindset">{tamakiOraData.huatauOra?.averageMindsetShift || 0}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Section 9: Narrative */}
              <CollapsibleSection title="Narrative Summary" icon={FileText} testId="section-narrative" defaultOpen={isSectionDefaultOpen("narrative")} key={`narrative-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Narrative Style:</span>
                      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg" data-testid="narrative-style-selector">
                        <Button
                          variant={narrativeStyle === "compliance" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => { setNarrativeStyle("compliance"); setNarrativeData(null); }}
                          data-testid="style-compliance"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" /> Compliance
                        </Button>
                        <Button
                          variant={narrativeStyle === "story" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => { setNarrativeStyle("story"); setNarrativeData(null); }}
                          data-testid="style-story"
                        >
                          <Pen className="w-3.5 h-3.5 mr-1.5" /> Story
                        </Button>
                      </div>
                      {activeFunder && (
                        <Badge variant="secondary" data-testid="badge-funder-style">
                          {activeFunder.name}: {narrativeStyle}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {narrativeData ? (
                    <div className="space-y-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-narrative">
                        {narrativeData.split("\n").map((line, i) => {
                          if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace("## ", "")}</h3>;
                          if (line.startsWith("- **")) {
                            const match = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
                            if (match) return <p key={i} className="ml-4 mb-1"><strong>{match[1]}</strong>: {match[2]}</p>;
                          }
                          if (line.startsWith("  > ")) return <blockquote key={i} className="border-l-2 border-primary/30 pl-3 ml-8 italic text-muted-foreground">{line.replace("  > ", "")}</blockquote>;
                          if (line.startsWith("- ")) return <p key={i} className="ml-4 mb-1">{line}</p>;
                          if (line.trim()) return <p key={i} className="mb-2">{line}</p>;
                          return <br key={i} />;
                        })}
                      </div>

                      <div className="border-t pt-4 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="participant-story" className="flex items-center gap-2">
                              <Pen className="w-4 h-4 text-primary" />
                              Participant Story
                            </Label>
                            <span className={`text-xs ${countWords(participantStory) > 150 ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-story-word-count">
                              {countWords(participantStory)}/150 words
                            </span>
                          </div>
                          <Textarea
                            id="participant-story"
                            placeholder="Share a real participant story that brings the data to life - a moment of change, growth, or connection..."
                            value={participantStory}
                            onChange={(e) => setParticipantStory(e.target.value)}
                            className="min-h-[100px] resize-y"
                            data-testid="textarea-participant-story"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="whats-next" className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" />
                              What's Next
                            </Label>
                            <span className={`text-xs ${countWords(whatsNext) > 150 ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-next-word-count">
                              {countWords(whatsNext)}/150 words
                            </span>
                          </div>
                          <Textarea
                            id="whats-next"
                            placeholder="Outline upcoming priorities, planned activities, or strategic focus for the next reporting period..."
                            value={whatsNext}
                            onChange={(e) => setWhatsNext(e.target.value)}
                            className="min-h-[100px] resize-y"
                            data-testid="textarea-whats-next"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      {isBlended && reportData?.legacyHighlights && reportData.legacyHighlights.length > 0 && (
                        <div className="text-left border rounded-lg p-4 mb-4">
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <History className="w-4 h-4 text-indigo-500" />
                            Historical Highlights
                          </h4>
                          <div className="space-y-1">
                            {reportData.legacyHighlights.slice(0, 6).map((h: string, i: number) => (
                              <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-1">-</span>
                                <span>{h}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-muted-foreground text-sm mb-3">Generate a structured narrative summary based on this report's data.</p>
                      <Button variant="outline" onClick={handleGenerateNarrative} data-testid="button-generate-narrative">
                        <FileText className="w-4 h-4 mr-2" /> Generate Narrative
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          )}
        </div>
    </main>
  );
}
