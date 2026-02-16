import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { useContacts } from "@/hooks/use-contacts";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Calendar,
  Users,
  MessageSquare,
  Brain,
  Sparkles,
  TrendingUp,
  Loader2,
  BarChart3,
  CalendarDays,
  CalendarRange,
  PartyPopper,
  Rocket,
  Settings,
  DollarSign,
  Network,
  Download,
  CheckCircle,
  Activity,
  Tag,
  Zap,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  subMonths,
} from "date-fns";

type ReportData = {
  period: { startDate: string; endDate: string };
  summary: {
    totalInteractions: number;
    totalMeetings: number;
    totalContacts: number;
    totalEvents: number;
    totalAttendees: number;
    interactionsByType: Record<string, number>;
    meetingsByStatus: Record<string, number>;
    eventsByType: Record<string, number>;
    avgMindset: number | null;
    avgSkill: number | null;
    avgConfidence: number | null;
    avgConfidenceScore: number | null;
    avgSystemsInPlace: number | null;
    avgFundingReadiness: number | null;
    avgNetworkStrength: number | null;
  };
  contactBreakdowns: {
    contactId: number;
    contactName: string;
    businessName: string | null;
    role: string;
    interactionCount: number;
    meetingCount: number;
    completedMeetings: number;
    avgMindset: number | null;
    avgSkill: number | null;
    avgConfidence: number | null;
    avgConfidenceScore: number | null;
    avgSystemsInPlace: number | null;
    avgFundingReadiness: number | null;
    avgNetworkStrength: number | null;
    currentMetrics: { mindset?: number; skill?: number; confidence?: number; confidenceScore?: number; systemsInPlace?: number; fundingReadiness?: number; networkStrength?: number } | null;
    revenueBand: string | null;
  }[];
};

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

function getSentimentLabel(score: number): string {
  if (score >= 0.75) return "Positive";
  if (score >= 0.25) return "Mixed";
  if (score >= -0.25) return "Neutral";
  return "Negative";
}

function getSentimentValue(sentiment: string | null | undefined): number {
  switch (sentiment?.toLowerCase()) {
    case "positive": return 1;
    case "mixed": return 0.5;
    case "neutral": return 0;
    case "negative": return -1;
    default: return 0;
  }
}

export default function Reports() {
  const { data: contacts } = useContacts();
  const { data: impactLogsRaw } = useImpactLogs();
  const { data: taxonomyData } = useQuery<any[]>({ queryKey: ['/api/taxonomy'] });
  const [activeTab, setActiveTab] = useState("monthly");

  const monthOptions = getMonthOptions();
  const quarterOptions = getQuarterOptions();

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || "");
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0]?.value || "");
  const [adHocStart, setAdHocStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [adHocEnd, setAdHocEnd] = useState(format(new Date(), "yyyy-MM-dd"));

  const [roleFilter, setRoleFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");

  const [generated, setGenerated] = useState(false);

  const getDateRange = () => {
    if (activeTab === "monthly") {
      const opt = monthOptions.find(o => o.value === selectedMonth);
      return { startDate: opt?.start || "", endDate: opt?.end || "" };
    } else if (activeTab === "quarterly") {
      const opt = quarterOptions.find(o => o.value === selectedQuarter);
      return { startDate: opt?.start || "", endDate: opt?.end || "" };
    } else {
      return { startDate: adHocStart, endDate: adHocEnd };
    }
  };

  const { startDate, endDate } = getDateRange();

  const queryParams = new URLSearchParams({
    startDate,
    endDate,
    ...(roleFilter !== "all" ? { role: roleFilter } : {}),
    ...(contactFilter !== "all" ? { contactId: contactFilter } : {}),
  });

  const {
    data: report,
    isLoading,
    refetch,
  } = useQuery<ReportData>({
    queryKey: ["/api/reports", startDate, endDate, roleFilter, contactFilter, generated],
    queryFn: async () => {
      const res = await fetch(`/api/reports?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    enabled: generated && !!startDate && !!endDate,
  });

  const handleGenerate = () => {
    setGenerated(true);
    refetch();
  };

  const impactSummary = useMemo(() => {
    if (!impactLogsRaw || !generated || !startDate || !endDate) return null;
    const logs = (impactLogsRaw as any[]).filter((log: any) => {
      if (!log.createdAt) return false;
      const logDate = new Date(log.createdAt).toISOString().slice(0, 10);
      return logDate >= startDate && logDate <= endDate;
    });

    const totalDebriefs = logs.length;
    const confirmedDebriefs = logs.filter((l: any) => l.status === "confirmed").length;

    const peopleSet = new Set<number>();
    for (const log of logs) {
      const extraction = log.status === "confirmed" && log.reviewedData
        ? log.reviewedData
        : log.rawExtraction;
      if (extraction?.people) {
        for (const p of extraction.people) {
          if (p.contactId) peopleSet.add(p.contactId);
        }
      }
    }

    const sentimentValues = logs
      .filter((l: any) => l.sentiment)
      .map((l: any) => getSentimentValue(l.sentiment));
    const avgSentiment = sentimentValues.length > 0
      ? sentimentValues.reduce((a: number, b: number) => a + b, 0) / sentimentValues.length
      : null;

    const tagCounts: Record<string, number> = {};
    let economicActivityCount = 0;
    for (const log of logs) {
      const extraction = log.status === "confirmed" && log.reviewedData
        ? log.reviewedData
        : log.rawExtraction;
      if (extraction?.impactTags) {
        for (const tag of extraction.impactTags) {
          const category = tag.category || tag.name || "Uncategorized";
          tagCounts[category] = (tagCounts[category] || 0) + 1;
        }
      }
      if (extraction?.economicActivity?.mentioned) {
        economicActivityCount++;
      }
    }

    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 0;

    return {
      totalDebriefs,
      confirmedDebriefs,
      peopleMentioned: peopleSet.size,
      avgSentiment,
      tagDistribution: sortedTags,
      maxTagCount,
      economicActivityCount,
    };
  }, [impactLogsRaw, generated, startDate, endDate]);

  const handleDownloadCSV = () => {
    if (!report) return;
    const rows: string[][] = [];

    rows.push(["Report Period", getPeriodLabel()]);
    rows.push([]);
    rows.push(["Summary Metrics"]);
    rows.push(["Total Contacts", String(report.summary.totalContacts)]);
    rows.push(["Total Interactions", String(report.summary.totalInteractions)]);
    rows.push(["Total Meetings", String(report.summary.totalMeetings)]);
    rows.push(["Total Events", String(report.summary.totalEvents)]);
    rows.push(["Total Connections", String(report.summary.totalAttendees)]);
    rows.push(["Avg Mindset", report.summary.avgMindset !== null ? String(report.summary.avgMindset) : "-"]);
    rows.push(["Avg Skill", report.summary.avgSkill !== null ? String(report.summary.avgSkill) : "-"]);
    rows.push(["Avg Confidence", report.summary.avgConfidence !== null ? String(report.summary.avgConfidence) : "-"]);

    if (impactSummary) {
      rows.push([]);
      rows.push(["Impact Summary"]);
      rows.push(["Total Debriefs", String(impactSummary.totalDebriefs)]);
      rows.push(["Confirmed Debriefs", String(impactSummary.confirmedDebriefs)]);
      rows.push(["People Mentioned", String(impactSummary.peopleMentioned)]);
      rows.push(["Avg Sentiment", impactSummary.avgSentiment !== null ? getSentimentLabel(impactSummary.avgSentiment) : "-"]);
      rows.push(["Economic Activity Signals", String(impactSummary.economicActivityCount)]);
      rows.push([]);
      rows.push(["Impact Tag", "Count"]);
      for (const [tag, count] of impactSummary.tagDistribution) {
        rows.push([tag, String(count)]);
      }
    }

    if (report.contactBreakdowns.length > 0) {
      rows.push([]);
      rows.push(["Member", "Role", "Revenue", "Interactions", "Mindset", "Skill", "Confidence", "Biz Conf.", "Systems", "Funding", "Network"]);
      for (const cb of report.contactBreakdowns) {
        rows.push([
          cb.contactName,
          cb.role,
          cb.revenueBand || "-",
          String(cb.interactionCount),
          cb.avgMindset !== null ? String(cb.avgMindset) : "-",
          cb.avgSkill !== null ? String(cb.avgSkill) : "-",
          cb.avgConfidence !== null ? String(cb.avgConfidence) : "-",
          cb.avgConfidenceScore !== null ? String(cb.avgConfidenceScore) : "-",
          cb.avgSystemsInPlace !== null ? String(cb.avgSystemsInPlace) : "-",
          cb.avgFundingReadiness !== null ? String(cb.avgFundingReadiness) : "-",
          cb.avgNetworkStrength !== null ? String(cb.avgNetworkStrength) : "-",
        ]);
      }
    }

    const csvContent = rows.map(row =>
      row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPeriodLabel = () => {
    if (!report) return "";
    const s = new Date(report.period.startDate);
    const e = new Date(report.period.endDate);
    return `${format(s, "MMM d, yyyy")} - ${format(e, "MMM d, yyyy")}`;
  };

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-reports-title">Reports</h1>
            <p className="text-muted-foreground mt-1">Generate reports to track mentorship progress and activity.</p>
          </div>

          <Card className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setGenerated(false); }}>
              <TabsList className="bg-muted/50 p-1 rounded-xl mb-6">
                <TabsTrigger value="monthly" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-monthly">
                  <CalendarDays className="w-4 h-4" />
                  Monthly
                </TabsTrigger>
                <TabsTrigger value="quarterly" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-quarterly">
                  <CalendarRange className="w-4 h-4" />
                  Quarterly
                </TabsTrigger>
                <TabsTrigger value="adhoc" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-adhoc">
                  <BarChart3 className="w-4 h-4" />
                  Custom
                </TabsTrigger>
              </TabsList>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <TabsContent value="monthly" className="mt-0 col-span-1">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger data-testid="select-month">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
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
                      <SelectTrigger data-testid="select-quarter">
                        <SelectValue placeholder="Select quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        {quarterOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="adhoc" className="mt-0 col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={adHocStart}
                        onChange={e => setAdHocStart(e.target.value)}
                        data-testid="input-adhoc-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={adHocEnd}
                        onChange={e => setAdHocEnd(e.target.value)}
                        data-testid="input-adhoc-end"
                      />
                    </div>
                  </div>
                </TabsContent>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger data-testid="select-report-role">
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="Mentee">Mentee</SelectItem>
                      <SelectItem value="Business Owner">Business Owner</SelectItem>
                      <SelectItem value="Innovator">Innovator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Community Member</Label>
                  <Select value={contactFilter} onValueChange={setContactFilter}>
                    <SelectTrigger data-testid="select-report-contact">
                      <SelectValue placeholder="All members" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {contacts?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}{c.businessName ? ` (${c.businessName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={isLoading} data-testid="button-generate-report">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Generate Report</>
                )}
              </Button>
            </Tabs>
          </Card>

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {report && !isLoading && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="report-results">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-display font-bold">Report Results</h2>
                  <p className="text-sm text-muted-foreground" data-testid="text-report-period">{getPeriodLabel()}</p>
                </div>
                <Button variant="outline" onClick={handleDownloadCSV} data-testid="button-download-csv">
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Community</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-contacts">{report.summary.totalContacts}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Interactions</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-interactions">{report.summary.totalInteractions}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Meetings</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-meetings">{report.summary.totalMeetings}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Avg Confidence</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-avg-confidence">
                    {report.summary.avgConfidence !== null ? `${report.summary.avgConfidence}/10` : "-"}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <PartyPopper className="w-4 h-4 text-violet-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Events</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-events">{report.summary.totalEvents}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-pink-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Total Connections</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-attendees">{report.summary.totalAttendees}</p>
                </Card>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs">Mindset</span>
                  </div>
                  <p className="text-2xl font-bold text-primary" data-testid="text-avg-mindset">
                    {report.summary.avgMindset !== null ? report.summary.avgMindset : "-"}
                    {report.summary.avgMindset !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-green-500" />
                    <span className="font-semibold text-xs">Skill</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-avg-skill">
                    {report.summary.avgSkill !== null ? report.summary.avgSkill : "-"}
                    {report.summary.avgSkill !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-xs">Confidence</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-500" data-testid="text-avg-confidence-detail">
                    {report.summary.avgConfidence !== null ? report.summary.avgConfidence : "-"}
                    {report.summary.avgConfidence !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-4 h-4 text-pink-500" />
                    <span className="font-semibold text-xs">Biz Conf.</span>
                  </div>
                  <p className="text-2xl font-bold text-pink-500" data-testid="text-avg-confidence-score">
                    {report.summary.avgConfidenceScore !== null ? report.summary.avgConfidenceScore : "-"}
                    {report.summary.avgConfidenceScore !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-cyan-500" />
                    <span className="font-semibold text-xs">Systems</span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-500" data-testid="text-avg-systems">
                    {report.summary.avgSystemsInPlace !== null ? report.summary.avgSystemsInPlace : "-"}
                    {report.summary.avgSystemsInPlace !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-teal-500" />
                    <span className="font-semibold text-xs">Funding</span>
                  </div>
                  <p className="text-2xl font-bold text-teal-500" data-testid="text-avg-funding">
                    {report.summary.avgFundingReadiness !== null ? report.summary.avgFundingReadiness : "-"}
                    {report.summary.avgFundingReadiness !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Network className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-xs">Network</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-500" data-testid="text-avg-network">
                    {report.summary.avgNetworkStrength !== null ? report.summary.avgNetworkStrength : "-"}
                    {report.summary.avgNetworkStrength !== null && <span className="text-xs font-normal text-muted-foreground">/10</span>}
                  </p>
                </Card>
              </div>

              {impactSummary && impactSummary.totalDebriefs > 0 && (
                <div className="space-y-4" data-testid="impact-signals-section">
                  <h3 className="text-lg font-display font-semibold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Impact Signals
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="p-4" data-testid="card-total-debriefs">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-indigo-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Total Debriefs</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-total-debriefs">{impactSummary.totalDebriefs}</p>
                    </Card>

                    <Card className="p-4" data-testid="card-confirmed-debriefs">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Confirmed Debriefs</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-confirmed-debriefs">{impactSummary.confirmedDebriefs}</p>
                    </Card>

                    <Card className="p-4" data-testid="card-people-mentioned">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-sky-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">People Mentioned</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-people-mentioned">{impactSummary.peopleMentioned}</p>
                    </Card>

                    <Card className="p-4" data-testid="card-avg-sentiment">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Avg Sentiment</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-avg-sentiment">
                        {impactSummary.avgSentiment !== null ? (
                          <Badge
                            variant={
                              impactSummary.avgSentiment >= 0.75 ? "default" :
                              impactSummary.avgSentiment <= -0.25 ? "destructive" : "secondary"
                            }
                          >
                            {getSentimentLabel(impactSummary.avgSentiment)}
                          </Badge>
                        ) : "-"}
                      </p>
                    </Card>

                    <Card className="p-4" data-testid="card-economic-activity">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-teal-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Economic Signals</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-economic-activity">{impactSummary.economicActivityCount}</p>
                    </Card>

                    <Card className="p-4" data-testid="card-tag-categories">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Tag className="w-4 h-4 text-violet-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Tag Categories</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-tag-categories">{impactSummary.tagDistribution.length}</p>
                    </Card>
                  </div>

                  {impactSummary.tagDistribution.length > 0 && (
                    <Card className="p-5" data-testid="card-tag-distribution">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        Impact Tags by Category
                      </h3>
                      <div className="space-y-3">
                        {impactSummary.tagDistribution.map(([category, count]) => (
                          <div key={category} className="space-y-1" data-testid={`tag-bar-${category}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{category}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">{count}</Badge>
                            </div>
                            <div className="w-full bg-muted/50 rounded-md h-2.5">
                              <div
                                className="bg-primary/70 h-2.5 rounded-md transition-all duration-500"
                                style={{ width: `${impactSummary.maxTagCount > 0 ? (count / impactSummary.maxTagCount) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {Object.keys(report.summary.interactionsByType).length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Interactions by Type
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(report.summary.interactionsByType).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium">{type}</span>
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {Object.keys(report.summary.meetingsByStatus).length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Meetings by Status
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(report.summary.meetingsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium capitalize">{status}</span>
                        <Badge
                          variant={status === "completed" ? "default" : status === "cancelled" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {report.summary.eventsByType && Object.keys(report.summary.eventsByType).length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <PartyPopper className="w-4 h-4 text-muted-foreground" />
                    Events by Type
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(report.summary.eventsByType).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2 bg-violet-500/5 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium">{type}</span>
                        <Badge variant="secondary" className="text-xs bg-violet-500/15 text-violet-700 dark:text-violet-300">{count}</Badge>
                      </div>
                    ))}
                  </div>
                  {report.summary.totalAttendees > 0 && (
                    <p className="text-sm text-muted-foreground mt-3">
                      Total connections made across events: <span className="font-semibold text-foreground">{report.summary.totalAttendees}</span>
                    </p>
                  )}
                </Card>
              )}

              {report.contactBreakdowns.length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Community Breakdown
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-contact-breakdown">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-semibold text-muted-foreground">Member</th>
                          <th className="text-left py-3 px-2 font-semibold text-muted-foreground">Role</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground">Revenue</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Interactions</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Mindset</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Skill</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Conf.</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Biz Conf.</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Systems</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Funding</th>
                          <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs">Network</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.contactBreakdowns.map(cb => (
                          <tr key={cb.contactId} className="border-b border-border/50 hover-elevate" data-testid={`row-contact-${cb.contactId}`}>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                  {cb.contactName[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-xs">{cb.contactName}</p>
                                  {cb.businessName && (
                                    <p className="text-xs text-muted-foreground">{cb.businessName}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="outline" className="text-xs">{cb.role}</Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="text-xs text-muted-foreground">{cb.revenueBand || "-"}</span>
                            </td>
                            <td className="py-3 px-2 text-center font-medium text-xs">{cb.interactionCount}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgMindset !== null ? "font-bold text-xs text-primary" : "text-xs text-muted-foreground"}>
                                {cb.avgMindset !== null ? cb.avgMindset : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgSkill !== null ? "font-bold text-xs text-green-600" : "text-xs text-muted-foreground"}>
                                {cb.avgSkill !== null ? cb.avgSkill : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgConfidence !== null ? "font-bold text-xs text-amber-500" : "text-xs text-muted-foreground"}>
                                {cb.avgConfidence !== null ? cb.avgConfidence : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgConfidenceScore !== null ? "font-bold text-xs text-pink-500" : "text-xs text-muted-foreground"}>
                                {cb.avgConfidenceScore !== null ? cb.avgConfidenceScore : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgSystemsInPlace !== null ? "font-bold text-xs text-cyan-500" : "text-xs text-muted-foreground"}>
                                {cb.avgSystemsInPlace !== null ? cb.avgSystemsInPlace : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgFundingReadiness !== null ? "font-bold text-xs text-teal-500" : "text-xs text-muted-foreground"}>
                                {cb.avgFundingReadiness !== null ? cb.avgFundingReadiness : "-"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={cb.avgNetworkStrength !== null ? "font-bold text-xs text-orange-500" : "text-xs text-muted-foreground"}>
                                {cb.avgNetworkStrength !== null ? cb.avgNetworkStrength : "-"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {report.contactBreakdowns.length === 0 && report.summary.totalInteractions === 0 && (
                <Card className="p-8 text-center">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">No data for this period</h3>
                  <p className="text-sm text-muted-foreground">Try selecting a different date range or adjusting your filters.</p>
                </Card>
              )}
            </div>
          )}

          {!generated && !isLoading && (
            <Card className="p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Select a report type and generate</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Choose monthly, quarterly, or a custom date range, apply any filters, then click Generate Report to see your mentorship activity summary.
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
