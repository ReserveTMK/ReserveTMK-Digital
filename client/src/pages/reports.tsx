import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { useContacts } from "@/hooks/use-contacts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
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

export default function Reports() {
  const { data: contacts } = useContacts();
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

  const getPeriodLabel = () => {
    if (!report) return "";
    const s = new Date(report.period.startDate);
    const e = new Date(report.period.endDate);
    return `${format(s, "MMM d, yyyy")} - ${format(e, "MMM d, yyyy")}`;
  };

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto">
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-display font-bold">Report Results</h2>
                  <p className="text-sm text-muted-foreground" data-testid="text-report-period">{getPeriodLabel()}</p>
                </div>
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
