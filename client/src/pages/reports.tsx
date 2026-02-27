import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  FileText, Users, Loader2, BarChart3, CalendarDays, CalendarRange,
  Download, Activity, Tag, TrendingUp, Building2, DollarSign,
  Save, BookOpen, ChevronDown, ChevronUp, Handshake, Clock,
  Info, History, Zap, X, Pen, Landmark, Settings,
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
    maori: "Māori (mātāwaka)",
    pasifika: "Pasifika",
    maori_pasifika: "Māori + Pasifika",
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
        activeFunder.name.toLowerCase().includes("ngā mātārae") ||
        activeFunder.name.toLowerCase().includes("nga matarae") ||
        (activeFunder.outcomesFramework && activeFunder.outcomesFramework.toLowerCase().includes("tāmaki ora")) ||
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
    return `${format(new Date(startDate), "MMM d, yyyy")} – ${format(new Date(endDate), "MMM d, yyyy")}`;
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;
    const rows: string[][] = [];
    const d = reportData;

    rows.push(["Report Period", getPeriodLabel()]);
    if (communityLens !== "all") {
      rows.push(["Community Lens", COMMUNITY_LENS_LABELS[communityLens] || communityLens]);
    }
    if (activeFunder) {
      rows.push(["Funder Profile", activeFunder.name]);
    }
    rows.push([]);

    if (d.isBlended && d.legacyMetrics) {
      rows.push(["Legacy Reports Included", String(d.legacyReportCount || 0)]);
      rows.push(["Legacy Periods", d.legacyPeriods?.join(", ") || ""]);
      rows.push([]);
    }

    rows.push(["=== ENGAGEMENT ==="]);
    if (d.isBlended && d.legacyMetrics) {
      rows.push(["Total Reach (legacy + live)", String((d.legacyMetrics.foottrafficUnique || 0) + (d.engagement?.uniqueContacts || 0))]);
      rows.push(["  Legacy Foot Traffic", String(d.legacyMetrics.foottrafficUnique || 0)]);
      rows.push(["  Live Unique Contacts", String(d.engagement?.uniqueContacts || 0)]);
    } else {
      rows.push(["Unique Contacts", String(d.engagement?.uniqueContacts || 0)]);
    }
    rows.push(["Total Engagement Instances", String(d.engagement?.totalEngagementInstances || 0)]);
    rows.push(["Avg Engagements per Contact", String(d.engagement?.uniqueContacts ? Math.round(((d.engagement?.totalEngagementInstances || 0) / d.engagement.uniqueContacts) * 10) / 10 : 0)]);
    rows.push(["New Contacts", String(d.engagement?.newContacts || 0)]);
    rows.push(["Active Groups", String(d.engagement?.activeGroups || 0)]);
    rows.push(["Repeat Engagement Rate", `${d.engagement?.repeatEngagementRate || 0}%`]);
    rows.push([]);
    rows.push(["=== DELIVERY ==="]);
    if (d.isBlended && d.legacyMetrics) {
      rows.push(["Events (combined)", String((d.legacyMetrics.activationsEvents || 0) + (d.delivery?.events?.total || 0))]);
      rows.push(["  Legacy Events", String(d.legacyMetrics.activationsEvents || 0)]);
      rows.push(["  Live Events", String(d.delivery?.events?.total || 0)]);
      rows.push(["Bookings (combined)", String((d.legacyMetrics.bookingsTotal || 0) + (d.delivery?.bookings?.total || 0))]);
      rows.push(["  Legacy Bookings", String(d.legacyMetrics.bookingsTotal || 0)]);
      rows.push(["  Live Bookings", String(d.delivery?.bookings?.total || 0)]);
    } else {
      rows.push(["Total Events", String(d.delivery?.events?.total || 0)]);
      rows.push(["Total Bookings", String(d.delivery?.bookings?.total || 0)]);
    }
    if (d.delivery?.events?.byType) {
      for (const [type, count] of Object.entries(d.delivery.events.byType)) {
        rows.push([`  ${type}`, String(count)]);
      }
    }
    rows.push(["Community Hours", String(d.delivery?.bookings?.communityHours || 0)]);
    rows.push(["Programmes Total", String(d.delivery?.programmes?.total || 0)]);
    rows.push(["Programmes Completed", String(d.delivery?.programmes?.completed || 0)]);
    rows.push(["Community Spend", `$${d.delivery?.communitySpend || 0}`]);
    if (d.isBlended && d.legacyMetrics) {
      rows.push(["Workshops (incl. legacy)", String((d.legacyMetrics.activationsWorkshops || 0) + (d.delivery?.events?.byType?.workshop || 0))]);
      rows.push(["Mentoring (incl. legacy)", String((d.legacyMetrics.activationsMentoring || 0) + (d.delivery?.events?.byType?.mentoring || 0))]);
      rows.push(["Partner Meetings (incl. legacy)", String((d.legacyMetrics.activationsPartnerMeetings || 0) + (d.delivery?.events?.byType?.partner_meeting || 0))]);
      rows.push(["Total Activations (legacy)", String(d.legacyMetrics.activationsTotal || 0)]);
    };
    rows.push([]);
    rows.push(["=== IMPACT BY TAXONOMY ==="]);
    rows.push(["Category", "Debriefs", "Impact Score", "Contacts Affected"]);
    if (d.impact) {
      for (const cat of d.impact) {
        rows.push([cat.taxonomyName, String(cat.debriefCount), String(cat.weightedImpactScore), String(cat.uniqueContactsAffected)]);
      }
    }
    rows.push([]);
    rows.push(["=== OUTCOME MOVEMENT ==="]);
    rows.push(["Contacts Tracked", String(d.outcomes?.totalContacts || 0)]);
    rows.push(["With Metrics", String(d.outcomes?.contactsWithMetrics || 0)]);
    rows.push(["Avg Mindset", String(d.outcomes?.averageChange?.mindset || 0)]);
    rows.push(["Avg Skill", String(d.outcomes?.averageChange?.skill || 0)]);
    rows.push(["Avg Confidence", String(d.outcomes?.averageChange?.confidence || 0)]);
    rows.push(["Milestones Recorded", String(d.outcomes?.milestoneCount || 0)]);
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

  const eng = reportData?.engagement;
  const del = reportData?.delivery;
  const imp = reportData?.impact;
  const out = reportData?.outcomes;
  const val = reportData?.value;
  const lm = reportData?.legacyMetrics;
  const isBlended = reportData?.isBlended;

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-reports-title">Reports</h1>
            <p className="text-muted-foreground mt-1">Generate funder-ready impact reports from your operational data.</p>
          </div>

          <Card className="p-3" data-testid="report-toolbar">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg" data-testid="community-lens-selector">
                {([
                  { value: "all", label: "All", testId: "lens-all" },
                  { value: "maori", label: "Māori (mātāwaka)", testId: "lens-maori" },
                  { value: "pasifika", label: "Pasifika", testId: "lens-pasifika" },
                  { value: "maori_pasifika", label: "Māori + Pasifika", testId: "lens-maori-pasifika" },
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
                      Jan 1, {new Date().getFullYear()} – Today
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="alltime" className="mt-0 col-span-1">
                  <div className="space-y-2">
                    <Label>All Time</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30 text-sm">
                      {dateRange?.earliestDate
                        ? `${format(new Date(dateRange.earliestDate), "MMM yyyy")} – Today`
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
                    {activeFunder ? `${activeFunder.name} — ${COMMUNITY_LENS_LABELS[activeFunder.communityLens || "all"]}` : "Report Results"}
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
                    Includes {reportData.legacyReportCount} legacy report{reportData.legacyReportCount > 1 ? "s" : ""} · {reportData.legacyPeriods?.join(", ")}
                  </span>
                </div>
              )}

              {/* Section 1: Engagement */}
              <CollapsibleSection title="Engagement" icon={Users} testId="section-engagement" defaultOpen={isSectionDefaultOpen("engagement")} key={`engagement-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {isBlended && lm ? (
                      <StatCard icon={Users} label="Total Reach" value={((lm.foottrafficUnique || 0) + (eng?.uniqueContacts || 0)).toLocaleString()} color="primary" testId="stat-total-reach" subText={`${(lm.foottrafficUnique || 0).toLocaleString()} legacy + ${eng?.uniqueContacts || 0} live`} />
                    ) : (
                      <StatCard icon={Users} label="Unique Contacts" value={eng?.uniqueContacts || 0} color="primary" testId="stat-unique-contacts" />
                    )}
                    <StatCard icon={Activity} label="Engagements" value={eng?.totalEngagementInstances || 0} color="blue" testId="stat-engagements" />
                    <StatCard icon={Users} label="New Contacts" value={eng?.newContacts || 0} color="green" testId="stat-new-contacts" />
                    <StatCard icon={Building2} label="Active Groups" value={eng?.activeGroups || 0} color="violet" testId="stat-active-groups" />
                    <StatCard icon={TrendingUp} label="Repeat Rate" value={`${eng?.repeatEngagementRate || 0}%`} color="amber" testId="stat-repeat-rate" />
                    <StatCard icon={Activity} label="Avg per Contact" value={eng?.uniqueContacts ? Math.round(((eng?.totalEngagementInstances || 0) / eng.uniqueContacts) * 10) / 10 : 0} color="pink" testId="stat-avg-per-contact" />
                  </div>

                  {eng?.demographicBreakdown?.ethnicity && Object.keys(eng.demographicBreakdown.ethnicity).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Ethnicity Breakdown</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={Object.entries(eng.demographicBreakdown.ethnicity).map(([name, value]) => ({ name, value }))}
                              cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {Object.entries(eng.demographicBreakdown.ethnicity).map((_: any, i: number) => (
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
                          <BarChart data={Object.entries(eng.demographicBreakdown.ageGroups || {}).filter(([_, v]) => (v as number) > 0).map(([name, value]) => ({ name: name.replace("_", "-"), value }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(14, 88%, 68%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 2: Delivery */}
              <CollapsibleSection title="Delivery" icon={CalendarDays} testId="section-delivery" defaultOpen={isSectionDefaultOpen("delivery")} key={`delivery-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  {communityLens !== "all" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2" data-testid="notice-delivery-unfiltered">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Delivery metrics show organisation-level data (not filtered by community lens)</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {isBlended && lm ? (
                      <StatCard icon={CalendarDays} label="Events" value={(lm.activationsEvents || 0) + (del?.events?.total || 0)} color="blue" testId="stat-events" subText={`${lm.activationsEvents || 0} legacy + ${del?.events?.total || 0} live`} />
                    ) : (
                      <StatCard icon={CalendarDays} label="Events" value={del?.events?.total || 0} color="blue" testId="stat-events" />
                    )}
                    {isBlended && lm ? (
                      <StatCard icon={Building2} label="Bookings" value={(lm.bookingsTotal || 0) + (del?.bookings?.total || 0)} color="orange" testId="stat-bookings" subText={`${lm.bookingsTotal || 0} legacy + ${del?.bookings?.total || 0} live`} />
                    ) : (
                      <StatCard icon={Building2} label="Bookings" value={del?.bookings?.total || 0} color="orange" testId="stat-bookings" />
                    )}
                    <StatCard icon={Clock} label="Community Hours" value={del?.bookings?.communityHours || 0} color="green" testId="stat-community-hours" />
                    <StatCard icon={Activity} label="Programmes" value={del?.programmes?.total || 0} color="indigo" testId="stat-programmes" />
                    <StatCard icon={TrendingUp} label="Programmes Completed" value={del?.programmes?.completed || 0} color="amber" testId="stat-completed" />
                    <StatCard icon={DollarSign} label="Community Spend" value={`$${(del?.communitySpend || 0).toLocaleString()}`} color="cyan" testId="stat-community-spend" />
                  </div>

                  {isBlended && lm && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="legacy-delivery-breakdown">
                      <StatCard icon={Activity} label="Workshops" value={(lm.activationsWorkshops || 0) + (del?.events?.byType?.workshop || 0)} color="slate" testId="stat-workshops" subText="incl. legacy" />
                      <StatCard icon={Users} label="Mentoring" value={(lm.activationsMentoring || 0) + (del?.events?.byType?.mentoring || 0)} color="slate" testId="stat-mentoring" subText="incl. legacy" />
                      <StatCard icon={Handshake} label="Partner Meetings" value={(lm.activationsPartnerMeetings || 0) + (del?.events?.byType?.partner_meeting || 0)} color="slate" testId="stat-partner-meetings" subText="incl. legacy" />
                      <StatCard icon={Activity} label="Total Activations" value={lm.activationsTotal || 0} color="indigo" testId="stat-legacy-activations" subText="legacy only" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <h4 className="text-sm font-semibold mb-3">Bookings by Type</h4>
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
                </div>
              </CollapsibleSection>

              {/* Section 3: Impact by Taxonomy */}
              <CollapsibleSection title="Impact by Taxonomy" icon={Tag} testId="section-impact" defaultOpen={isSectionDefaultOpen("impact")} key={`impact-${activeFunder?.id || 'none'}`}>
                <div className="pt-4">
                  {imp && imp.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={Math.max(200, imp.length * 40)}>
                        <BarChart data={imp} layout="vertical" margin={{ left: 120 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="taxonomyName" tick={{ fontSize: 12 }} width={120} />
                          <Tooltip />
                          <Bar dataKey="weightedImpactScore" name="Impact Score" fill="hsl(14, 88%, 68%)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="space-y-3 mt-4">
                        {imp.map((cat: any) => (
                          <div key={cat.taxonomyId} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.taxonomyColor || "hsl(14, 88%, 68%)" }} />
                                <span className="font-semibold">{cat.taxonomyName}</span>
                              </div>
                              <div className="flex gap-2 text-sm text-muted-foreground">
                                <span>{cat.debriefCount} debriefs</span>
                                <span>·</span>
                                <span>{cat.uniqueContactsAffected} people</span>
                                <span>·</span>
                                <span>Score: {cat.weightedImpactScore}</span>
                              </div>
                            </div>
                            {cat.representativeQuotes?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {cat.representativeQuotes.slice(0, 2).map((q: string, i: number) => (
                                  <p key={i} className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">"{q}"</p>
                                ))}
                              </div>
                            )}
                            {cat.evidenceSnippets?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {cat.evidenceSnippets.slice(0, 3).map((e: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{e.length > 80 ? e.slice(0, 80) + "..." : e}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm py-4">No confirmed debriefs with taxonomy tags found in this period.</p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 4: Outcome Movement */}
              <CollapsibleSection title="Outcome Movement" icon={TrendingUp} testId="section-outcomes" defaultOpen={isSectionDefaultOpen("outcomes")} key={`outcomes-${activeFunder?.id || 'none'}`}>
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={Users} label="Contacts Tracked" value={out?.totalContacts || 0} color="primary" testId="stat-tracked-contacts" />
                    <StatCard icon={Activity} label="With Metrics" value={out?.contactsWithMetrics || 0} color="blue" testId="stat-with-metrics" />
                    <StatCard icon={TrendingUp} label="Milestones" value={out?.milestoneCount || 0} color="amber" testId="stat-milestones" />
                    <StatCard icon={Activity} label="Avg Positive Movement" value={`${out?.positiveMovementPercent ? Math.round(((out.positiveMovementPercent.mindset || 0) + (out.positiveMovementPercent.skill || 0) + (out.positiveMovementPercent.confidence || 0)) / 3) : 0}%`} color="green" testId="stat-positive-movement" />
                  </div>

                  {out && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {["mindset", "skill", "confidence"].map(metric => (
                        <Card key={metric} className="p-4">
                          <h4 className="text-sm font-semibold capitalize mb-2">{metric}</h4>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">{out.averageChange?.[metric] || 0}</span>
                            <span className="text-xs text-muted-foreground">/10 avg</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{out.positiveMovementPercent?.[metric] || 0}% positive movement</p>
                        </Card>
                      ))}
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
                            <p className="text-xs text-muted-foreground">{data.count} bookings</p>
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
                              <th className="text-right p-3">Bookings</th>
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
                        title="Bookings"
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

              {/* Section 8: Tāmaki Ora Alignment */}
              {tamakiOraData && (
                <CollapsibleSection title="Tāmaki Ora Alignment" icon={Landmark} testId="section-tamaki-ora" defaultOpen={isSectionDefaultOpen("tamaki-ora")}>
                  <div className="pt-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Alignment with the Tāmaki Ora outcomes framework — measuring impact across three pou for Māori community wellbeing.
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
                            placeholder="Share a real participant story that brings the data to life — a moment of change, growth, or connection..."
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
                                <span className="text-primary mt-1">•</span>
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
