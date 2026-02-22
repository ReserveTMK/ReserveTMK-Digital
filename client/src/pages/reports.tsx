import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  FileText, Users, Loader2, BarChart3, CalendarDays, CalendarRange,
  Download, Activity, Tag, TrendingUp, Building2, DollarSign,
  Save, BookOpen, ChevronDown, ChevronUp, Handshake, Clock,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths,
} from "date-fns";

const CHART_COLORS = [
  "#7c3aed", "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
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

function StatCard({ icon: Icon, label, value, color = "primary", testId }: {
  icon: any; label: string; value: string | number; color?: string; testId: string;
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
          <h3 className="text-lg font-display font-semibold">{title}</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 border-t">{children}</div>}
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

  const { data: savedReports } = useQuery<any[]>({
    queryKey: ["/api/reports"],
  });

  const { data: programmes } = useQuery<any[]>({
    queryKey: ["/api/programmes"],
  });

  const { data: taxonomy } = useQuery<any[]>({
    queryKey: ["/api/taxonomy"],
  });

  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [taxonomyFilter, setTaxonomyFilter] = useState("all");
  const [benchmarkData, setBenchmarkData] = useState<any>(null);

  const getDateRange = () => {
    if (activeTab === "monthly") {
      const opt = monthOptions.find(o => o.value === selectedMonth);
      return { startDate: opt?.start || "", endDate: opt?.end || "" };
    } else if (activeTab === "quarterly") {
      const opt = quarterOptions.find(o => o.value === selectedQuarter);
      return { startDate: opt?.start || "", endDate: opt?.end || "" };
    }
    return { startDate: adHocStart, endDate: adHocEnd };
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
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateNarrative = async () => {
    const { startDate, endDate } = getDateRange();
    const filters: any = { startDate, endDate };
    if (programmeFilter !== "all") filters.programmeIds = [parseInt(programmeFilter)];
    if (taxonomyFilter !== "all") filters.taxonomyIds = [parseInt(taxonomyFilter)];

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
      await apiRequest("POST", "/api/reports/save", {
        title: `Report: ${periodLabel}`,
        type: activeTab === "quarterly" ? "quarterly" : activeTab === "adhoc" ? "ad_hoc" : "monthly",
        startDate,
        endDate,
        filters: {
          programmeIds: programmeFilter !== "all" ? [parseInt(programmeFilter)] : undefined,
          taxonomyIds: taxonomyFilter !== "all" ? [parseInt(taxonomyFilter)] : undefined,
        },
        snapshotData: reportData,
        narrative: narrativeData,
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
    return `${format(new Date(startDate), "MMM d, yyyy")} – ${format(new Date(endDate), "MMM d, yyyy")}`;
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;
    const rows: string[][] = [];
    const d = reportData;

    rows.push(["Report Period", getPeriodLabel()]);
    rows.push([]);
    rows.push(["=== ENGAGEMENT ==="]);
    rows.push(["Unique Contacts", String(d.engagement?.uniqueContacts || 0)]);
    rows.push(["Total Engagement Instances", String(d.engagement?.totalEngagementInstances || 0)]);
    rows.push(["New Contacts", String(d.engagement?.newContacts || 0)]);
    rows.push(["Active Groups", String(d.engagement?.activeGroups || 0)]);
    rows.push(["Repeat Engagement Rate", `${d.engagement?.repeatEngagementRate || 0}%`]);
    rows.push([]);
    rows.push(["=== DELIVERY ==="]);
    rows.push(["Total Events", String(d.delivery?.events?.total || 0)]);
    if (d.delivery?.events?.byType) {
      for (const [type, count] of Object.entries(d.delivery.events.byType)) {
        rows.push([`  ${type}`, String(count)]);
      }
    }
    rows.push(["Total Bookings", String(d.delivery?.bookings?.total || 0)]);
    rows.push(["Community Hours", String(d.delivery?.bookings?.communityHours || 0)]);
    rows.push(["Programmes Total", String(d.delivery?.programmes?.total || 0)]);
    rows.push(["Programmes Completed", String(d.delivery?.programmes?.completed || 0)]);
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
      rows.push([narrativeData]);
    }

    const csvContent = rows.map(row =>
      row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const { startDate, endDate } = getDateRange();
    link.download = `report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const eng = reportData?.engagement;
  const del = reportData?.delivery;
  const imp = reportData?.impact;
  const out = reportData?.outcomes;
  const val = reportData?.value;

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-reports-title">Reports</h1>
            <p className="text-muted-foreground mt-1">Generate funder-ready impact reports from your operational data.</p>
          </div>

          <Card className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setGenerated(false); }}>
              <TabsList className="bg-muted/50 p-1 rounded-xl mb-6">
                <TabsTrigger value="monthly" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-monthly">
                  <CalendarDays className="w-4 h-4" /> Monthly
                </TabsTrigger>
                <TabsTrigger value="quarterly" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-quarterly">
                  <CalendarRange className="w-4 h-4" /> Quarterly
                </TabsTrigger>
                <TabsTrigger value="adhoc" className="rounded-lg gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-adhoc">
                  <BarChart3 className="w-4 h-4" /> Custom
                </TabsTrigger>
              </TabsList>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                  <h2 className="text-xl font-display font-bold">Report Results</h2>
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

              {/* Section 1: Engagement */}
              <CollapsibleSection title="Engagement" icon={Users} testId="section-engagement">
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard icon={Users} label="Unique Contacts" value={eng?.uniqueContacts || 0} color="primary" testId="stat-unique-contacts" />
                    <StatCard icon={Activity} label="Engagements" value={eng?.totalEngagementInstances || 0} color="blue" testId="stat-engagements" />
                    <StatCard icon={Users} label="New Contacts" value={eng?.newContacts || 0} color="green" testId="stat-new-contacts" />
                    <StatCard icon={Building2} label="Active Groups" value={eng?.activeGroups || 0} color="violet" testId="stat-active-groups" />
                    <StatCard icon={TrendingUp} label="Repeat Rate" value={`${eng?.repeatEngagementRate || 0}%`} color="amber" testId="stat-repeat-rate" />
                    <StatCard icon={Users} label="Repeat Contacts" value={eng?.repeatEngagementCount || 0} color="pink" testId="stat-repeat-contacts" />
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
                            <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 2: Delivery */}
              <CollapsibleSection title="Delivery" icon={CalendarDays} testId="section-delivery">
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard icon={CalendarDays} label="Events" value={del?.events?.total || 0} color="blue" testId="stat-events" />
                    <StatCard icon={Building2} label="Bookings" value={del?.bookings?.total || 0} color="orange" testId="stat-bookings" />
                    <StatCard icon={Clock} label="Community Hours" value={del?.bookings?.communityHours || 0} color="green" testId="stat-community-hours" />
                    <StatCard icon={Activity} label="Programmes" value={del?.programmes?.total || 0} color="indigo" testId="stat-programmes" />
                    <StatCard icon={TrendingUp} label="Completed" value={del?.programmes?.completed || 0} color="amber" testId="stat-completed" />
                  </div>

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
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                            <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 3: Impact by Taxonomy */}
              <CollapsibleSection title="Impact by Taxonomy" icon={Tag} testId="section-impact">
                <div className="pt-4">
                  {imp && imp.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={Math.max(200, imp.length * 40)}>
                        <BarChart data={imp} layout="vertical" margin={{ left: 120 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="taxonomyName" tick={{ fontSize: 12 }} width={120} />
                          <Tooltip />
                          <Bar dataKey="weightedImpactScore" name="Impact Score" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="space-y-3 mt-4">
                        {imp.map((cat: any) => (
                          <div key={cat.taxonomyId} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.taxonomyColor || "#7c3aed" }} />
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
              <CollapsibleSection title="Outcome Movement" icon={TrendingUp} testId="section-outcomes">
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={Users} label="Contacts Tracked" value={out?.totalContacts || 0} color="primary" testId="stat-tracked-contacts" />
                    <StatCard icon={Activity} label="With Metrics" value={out?.contactsWithMetrics || 0} color="blue" testId="stat-with-metrics" />
                    <StatCard icon={TrendingUp} label="Milestones" value={out?.milestoneCount || 0} color="amber" testId="stat-milestones" />
                    <StatCard icon={Activity} label="Positive Movement" value={`${out?.positiveMovementPercent?.confidence || 0}%`} color="green" testId="stat-positive-movement" />
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
              <CollapsibleSection title="Value & Contribution" icon={DollarSign} testId="section-value">
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={DollarSign} label="Total Revenue" value={`$${val?.revenue?.total?.toLocaleString() || 0}`} color="green" testId="stat-total-revenue" />
                    <StatCard icon={Handshake} label="In-Kind Value" value={`$${val?.inKindValue?.toLocaleString() || 0}`} color="blue" testId="stat-inkind-value" />
                    <StatCard icon={Users} label="Active Memberships" value={val?.memberships?.active || 0} color="violet" testId="stat-memberships" />
                    <StatCard icon={Handshake} label="Active MOUs" value={val?.mouExchange?.active || 0} color="amber" testId="stat-mous" />
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
                              <th className="text-right p-3">Allocated</th>
                              <th className="text-right p-3">Used</th>
                              <th className="text-right p-3">Usage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {val.memberships.details.map((m: any) => (
                              <tr key={m.id} className="border-t">
                                <td className="p-3">{m.name}</td>
                                <td className="text-right p-3">{m.allocatedHours}h</td>
                                <td className="text-right p-3">{m.usedHours}h</td>
                                <td className="text-right p-3">
                                  <Badge variant={m.usagePercent > 80 ? "destructive" : "secondary"}>{m.usagePercent}%</Badge>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard icon={BarChart3} label="Historic Avg" value={benchmarkData.benchmarks?.historicAverage || 0} color="indigo" testId="stat-historic-avg" />
                      <StatCard icon={TrendingUp} label="Highest Quarter" value={benchmarkData.benchmarks?.highestValue || 0} color="green" testId="stat-highest-quarter" />
                      <StatCard
                        icon={Activity}
                        label="QoQ Change"
                        value={benchmarkData.benchmarks?.qoqChange !== null ? `${benchmarkData.benchmarks.qoqChange >= 0 ? "+" : ""}${benchmarkData.benchmarks.qoqChange}%` : "N/A"}
                        color={benchmarkData.benchmarks?.qoqChange >= 0 ? "green" : "orange"}
                        testId="stat-qoq-change"
                      />
                      <StatCard
                        icon={Activity}
                        label="vs Average"
                        value={benchmarkData.benchmarks?.pctVsAverage !== null ? `${benchmarkData.benchmarks.pctVsAverage >= 0 ? "+" : ""}${benchmarkData.benchmarks.pctVsAverage}%` : "N/A"}
                        color={benchmarkData.benchmarks?.pctVsAverage >= 0 ? "blue" : "amber"}
                        testId="stat-pct-vs-avg"
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
                    {benchmarkData.benchmarks?.highestQuarter && (
                      <p className="text-xs text-muted-foreground italic">
                        Best quarter: {benchmarkData.benchmarks.highestQuarter} &middot; Current ranks #{benchmarkData.benchmarks.currentRank} of {benchmarkData.benchmarks.totalQuarters} quarters
                      </p>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Section 7: Narrative */}
              <CollapsibleSection title="Narrative Summary" icon={FileText} testId="section-narrative">
                <div className="pt-4">
                  {narrativeData ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-narrative">
                      {narrativeData.split("\n").map((line, i) => {
                        if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace("## ", "")}</h3>;
                        if (line.startsWith("- **")) {
                          const match = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
                          if (match) return <p key={i} className="ml-4 mb-1"><strong>{match[1]}</strong>: {match[2]}</p>;
                        }
                        if (line.startsWith("  > ")) return <blockquote key={i} className="border-l-2 border-primary/30 pl-3 ml-8 italic text-muted-foreground">{line.replace("  > ", "")}</blockquote>;
                        if (line.trim()) return <p key={i} className="mb-2">{line}</p>;
                        return <br key={i} />;
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm mb-3">Generate a structured narrative summary based on this report's data.</p>
                      <Button onClick={handleGenerateNarrative} data-testid="button-generate-narrative">
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
    </div>
  );
}
