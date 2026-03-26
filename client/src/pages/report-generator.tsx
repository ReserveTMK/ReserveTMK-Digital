import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import {
  FileText, Loader2, Download, Copy, Sparkles, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Funder } from "@shared/schema";

// ── Period options ───────────────────────────────────────────────────────────

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const monthStr = format(d, "yyyy-MM");
    const start = format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");
    const end = format(new Date(d.getFullYear(), d.getMonth() + 1, 1), "yyyy-MM-dd");
    options.push({
      label: format(d, "MMMM yyyy"),
      value: `month-${monthStr}`,
      month: monthStr,
      start,
      end,
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
        label: `Q${q} ${year} (${format(quarterStart, "MMM")}–${format(quarterEnd, "MMM yyyy")})`,
        value: `${year}-Q${q}`,
        start: format(quarterStart, "yyyy-MM-dd"),
        end: format(quarterEnd, "yyyy-MM-dd"),
      });
    }
  }
  return options;
}

// ── Report section ────────────────────────────────────────────────────────────

function ReportSection({ title, content, onEdit }: {
  title: string;
  content: string;
  onEdit: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={() => {
            if (editing) { onEdit(draft); }
            setEditing(!editing);
          }}
        >
          {editing ? "Save" : "Edit"}
        </Button>
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="min-h-[120px] text-sm"
        />
      ) : (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ReportGenerator() {
  const { toast } = useToast();
  const quarterOptions = getQuarterOptions();
  const monthOptions = getMonthOptions();
  const [reportMode, setReportMode] = useState<"monthly" | "quarterly">("monthly");
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0]?.value || "");
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || "");
  const [audience, setAudience] = useState("general");
  const [reportData, setReportData] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [showNumbers, setShowNumbers] = useState(true);

  const { data: funders } = useQuery<Funder[]>({ queryKey: ["/api/funders"] });

  const quarter = quarterOptions.find(q => q.value === selectedQuarter);
  const month = monthOptions.find(m => m.value === selectedMonth);

  const previewMonthlyHTML = () => {
    if (!month) return;
    window.open(`/api/reports/html/monthly?month=${month.month}`, "_blank");
  };

  const downloadMonthlyHTML = async () => {
    if (!month) return;
    try {
      const res = await fetch(`/api/reports/html/monthly?month=${month.month}`, { credentials: "include" });
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ReserveTMK-${month.month}-Report.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `${month.label} report saved as HTML.` });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!quarter) throw new Error("No quarter selected");
      const res = await apiRequest("POST", "/api/reports/generate-narrative", {
        startDate: quarter.start,
        endDate: quarter.end,
        audience,
        periodLabel: quarter.label,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setReportData(data);
      setSections(data.sections || {});
      toast({ title: "Report generated", description: "Review and edit below." });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = () => {
    if (!reportData) return;
    const text = buildReportText();
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Report copied to clipboard — paste into Google Docs." });
  };

  const buildReportText = () => {
    if (!reportData) return "";
    const q = quarterOptions.find(q => q.value === selectedQuarter);
    const lines = [
      `Reserve Tāmaki — ${q?.label || "Report"}`,
      "",
      reportData.lede || "",
      "",
      "---",
      "",
      "Key Numbers",
      "",
    ];

    const nums = reportData.numbers || {};
    if (nums.activations !== undefined) lines.push(`Activations (This Quarter): ${nums.activations}`);
    if (nums.programmes !== undefined) lines.push(`Programmes Delivered: ${nums.programmes}`);
    if (nums.mentoringSessions !== undefined) lines.push(`Mentoring Sessions: ${nums.mentoringSessions}`);
    if (nums.communityReached !== undefined) lines.push(`Target Community Directly Reached: ${nums.communityReached}`);
    if (nums.activeMentees !== undefined) lines.push(`Active Mentees Currently: ${nums.activeMentees}`);
    if (nums.ecosystemMeetings !== undefined) lines.push(`Ecosystem Meetings: ${nums.ecosystemMeetings}`);
    if (nums.maori !== undefined) lines.push(`Māori community members: ${nums.maori}`);
    if (nums.pasifika !== undefined) lines.push(`Pasifika community members: ${nums.pasifika}`);
    if (nums.maoriPasifikaPercent !== undefined) lines.push(`% Māori & Pasifika: ${nums.maoriPasifikaPercent}%`);

    lines.push("", "---", "");

    Object.entries(sections).forEach(([key, val]) => {
      lines.push(key, "", val, "", "---", "");
    });

    lines.push("Reserve Tāmaki. Built in Tāmaki. Built for Tāmaki.");
    return lines.join("\n");
  };

  const printReport = () => {
    window.print();
  };

  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Report Generator</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Generate external narrative reports from your activity data</p>
          </div>
          {reportData && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy for Google Docs
              </Button>
              <Button variant="outline" size="sm" onClick={printReport}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Print / PDF
              </Button>
            </div>
          )}
        </div>

        {/* Config card */}
        <Card className="p-5 space-y-4">
          {/* Report type toggle */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
            <button
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reportMode === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReportMode("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reportMode === "quarterly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReportMode("quarterly")}
            >
              Quarterly
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{reportMode === "monthly" ? "Month" : "Quarter"}</Label>
              {reportMode === "monthly" ? (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quarterOptions.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="auckland_council_maori">Auckland Council — Māori Outcomes</SelectItem>
                  <SelectItem value="tpk">Te Puni Kōkiri</SelectItem>
                  <SelectItem value="foundation_north">Foundation North</SelectItem>
                  <SelectItem value="internal">Internal / Team</SelectItem>
                  {(funders || []).map(f => (
                    <SelectItem key={f.id} value={`funder_${f.id}`}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {reportMode === "monthly" ? (
              <>
                <Button onClick={previewMonthlyHTML} variant="default" className="sm:w-auto">
                  <FileText className="w-4 h-4 mr-2" /> Preview HTML Report
                </Button>
                <Button onClick={downloadMonthlyHTML} variant="outline" className="sm:w-auto">
                  <Download className="w-4 h-4 mr-2" /> Download HTML
                </Button>
              </>
            ) : (
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="sm:w-auto"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> {reportData ? "Regenerate" : "Generate Quarterly Report"}</>
                )}
              </Button>
            )}
          </div>
        </Card>

        {/* Loading state */}
        {generateMutation.isPending && (
          <Card className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </Card>
        )}

        {/* Report output */}
        {reportData && !generateMutation.isPending && (
          <div className="space-y-4 print:space-y-6" id="report-output">

            {/* Title block */}
            <div className="border-b-2 border-foreground pb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Quarterly Report</p>
              <h2 className="text-3xl font-bold mb-1">Reserve Tāmaki</h2>
              <p className="text-muted-foreground text-sm mb-4">{quarter?.label}</p>
              {reportData.lede && (
                <p className="font-medium text-sm border-l-2 border-foreground pl-4 leading-relaxed">
                  {reportData.lede}
                </p>
              )}
            </div>

            {/* Numbers */}
            {reportData.numbers && (
              <Card className="p-5">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setShowNumbers(!showNumbers)}
                >
                  <h3 className="font-semibold text-sm">Key Numbers</h3>
                  {showNumbers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showNumbers && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-muted/40 rounded-lg p-4">
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Delivery — This Quarter</p>
                      {[
                        ["Activations", reportData.numbers.activations],
                        ["Programmes Delivered", reportData.numbers.programmes],
                        ["Mentoring Sessions", reportData.numbers.mentoringSessions],
                      ].filter(([, v]) => v !== undefined).map(([label, value]) => (
                        <div key={label as string} className="flex justify-between items-baseline py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-lg font-bold">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/40 rounded-lg p-4">
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">People & Relationships</p>
                      {[
                        ["Target Community Reached", reportData.numbers.communityReached],
                        ["Active Mentees Currently", reportData.numbers.activeMentees],
                        ["Ecosystem Meetings", reportData.numbers.ecosystemMeetings],
                      ].filter(([, v]) => v !== undefined).map(([label, value]) => (
                        <div key={label as string} className="flex justify-between items-baseline py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-lg font-bold">{value}</span>
                        </div>
                      ))}
                    </div>
                    {(reportData.numbers.maori || reportData.numbers.pasifika) && (
                      <div className="col-span-2 bg-foreground text-background rounded-lg p-4">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Our Community — Currently Active</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Māori</p>
                            <p className="text-2xl font-bold">{reportData.numbers.maori}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Pasifika</p>
                            <p className="text-2xl font-bold">{reportData.numbers.pasifika}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">% Māori & Pasifika</p>
                            <p className="text-2xl font-bold">{reportData.numbers.maoriPasifikaPercent}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Narrative sections */}
            {Object.entries(sections).map(([key, content]) => (
              <Card key={key} className="p-5">
                <ReportSection
                  title={key}
                  content={content}
                  onEdit={(val) => setSections(prev => ({ ...prev, [key]: val }))}
                />
              </Card>
            ))}

            {/* Footer */}
            <div className="border-t-2 border-foreground pt-4 flex justify-between items-center">
              <p className="text-sm font-semibold">Reserve Tāmaki. Built in Tāmaki. Built for Tāmaki.</p>
              <p className="text-xs text-muted-foreground">{quarter?.label}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
