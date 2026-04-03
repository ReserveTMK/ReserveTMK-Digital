import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Loader2, Download, Landmark, Settings, CalendarDays, CalendarRange, Sparkles, X, Plus, MessageSquareQuote, Check,
} from "lucide-react";
import { format, subMonths, endOfQuarter } from "date-fns";
import { Link } from "wouter";
import type { Funder } from "@shared/schema";

// ── Period helpers ────────────────────────────────────────────────────────────

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

// ── Embeddable report generator ──────────────────────────────────────────────

export function ReportGenerator({ funderId }: { funderId?: number }) {
  return <ReportGeneratorInner funderId={funderId} />;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Reports() {
  return <ReportGeneratorInner />;
}

function ReportGeneratorInner({ funderId }: { funderId?: number } = {}) {
  const { toast } = useToast();
  const monthOptions = getMonthOptions();
  const quarterOptions = getQuarterOptions();

  // State
  const [reportMode, setReportMode] = useState<"monthly" | "quarterly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || "");
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0]?.value || "");
  const [activeFunder, setActiveFunder] = useState<Funder | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Editable sections
  const [quotes, setQuotes] = useState<Array<{ text: string; attribution: string }>>([]);
  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteAttribution, setNewQuoteAttribution] = useState("");
  const [plannedNext, setPlannedNext] = useState<Array<{ title: string; description: string }>>([]);
  const [newNextTitle, setNewNextTitle] = useState("");
  const [newNextDescription, setNewNextDescription] = useState("");

  // Data
  const { data: fundersList } = useQuery<Funder[]>({ queryKey: ["/api/funders"] });

  // Pre-select funder when embedded in funder detail
  const isEmbedded = funderId !== undefined;
  const embeddedFunder = fundersList?.find(f => f.id === funderId) || null;
  const effectiveFunder = isEmbedded ? embeddedFunder : activeFunder;

  const month = monthOptions.find((m) => m.value === selectedMonth);
  const quarter = quarterOptions.find((q) => q.value === selectedQuarter);

  // Quote suggestions from debriefs
  const periodStart = reportMode === "monthly" ? month?.start : quarter?.start;
  const periodEnd = reportMode === "monthly" ? month?.end : quarter?.end;
  const funderParam = effectiveFunder ? `&funder=${encodeURIComponent(effectiveFunder.name)}` : "";
  const { data: quoteSuggestions } = useQuery<Array<{
    text: string; attribution: string; debriefTitle: string; debriefId: number; hasMilestone: boolean; sentiment: string | null;
  }>>({
    queryKey: ["/api/reports/quote-suggestions", periodStart, periodEnd, effectiveFunder?.name],
    queryFn: () => fetch(`/api/reports/quote-suggestions?startDate=${periodStart}&endDate=${periodEnd}${funderParam}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!periodStart && !!periodEnd,
  });

  // ── Generate report ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let url: string;
      const body: any = { quotes, plannedNext };
      const funderParam = effectiveFunder ? `&funder=${encodeURIComponent(effectiveFunder.name)}` : "";
      if (reportMode === "monthly" && month) {
        url = `/api/reports/html/monthly?month=${month.month}${funderParam}`;
      } else if (reportMode === "quarterly" && quarter) {
        url = `/api/reports/html/quarterly?quarter=${quarter.value}&startDate=${quarter.start}&endDate=${quarter.end}${funderParam}`;
      } else {
        toast({ title: "Select a period first", variant: "destructive" });
        setIsGenerating(false);
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const html = await res.text();
      setReportHtml(html);
      toast({ title: "Report generated", description: `${reportMode === "monthly" ? month?.label : quarter?.label} report ready.` });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Preview in new tab ───────────────────────────────────────────────────

  const handlePreview = () => {
    if (!reportHtml) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
    }
  };

  // ── Download HTML ────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const funderPrefix = effectiveFunder ? effectiveFunder.name.replace(/\s+/g, "-") + "-" : "";
    const period = reportMode === "monthly" ? month?.month || "report" : quarter?.value || "report";
    a.href = url;
    a.download = `ReserveTMK-${funderPrefix}${period}-Report.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Report saved as HTML." });
  };

  // ── Helpers for editable sections ────────────────────────────────────────

  const addQuote = () => {
    if (!newQuoteText.trim()) return;
    setQuotes([...quotes, { text: newQuoteText.trim(), attribution: newQuoteAttribution.trim() || "Anonymous" }]);
    setNewQuoteText("");
    setNewQuoteAttribution("");
  };

  const removeQuote = (idx: number) => setQuotes(quotes.filter((_, i) => i !== idx));

  const addPlannedItem = () => {
    if (!newNextTitle.trim()) return;
    setPlannedNext([...plannedNext, { title: newNextTitle.trim(), description: newNextDescription.trim() }]);
    setNewNextTitle("");
    setNewNextDescription("");
  };

  const removePlannedItem = (idx: number) => setPlannedNext(plannedNext.filter((_, i) => i !== idx));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-6", !isEmbedded && "p-4 md:p-6 max-w-6xl mx-auto")}>
      {/* Header — only on standalone page */}
      {!isEmbedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Funder Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate branded reports for funders. Select a funder, pick a period, generate.
            </p>
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <Card className="p-4 space-y-4">
        {/* Row 1: Funder selector — only on standalone page */}
        {!isEmbedded && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Landmark className="h-3 w-3 inline mr-1" />
                Funder
              </Label>
              <Link href="/funders">
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                  <Settings className="h-3 w-3" /> Manage Funders
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={activeFunder === null ? "default" : "outline"}
                onClick={() => setActiveFunder(null)}
                className="h-8 text-xs"
              >
                All / General
              </Button>
              {(fundersList || []).map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={activeFunder?.id === f.id ? "default" : "outline"}
                  onClick={() => setActiveFunder(f)}
                  className="h-8 text-xs"
                >
                  {f.name}
                  {f.reportingCadence && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                      {f.reportingCadence}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: Mode toggle + period selector + actions */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Mode toggle */}
          <div className="space-y-1">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mode</Label>
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setReportMode("monthly")}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                  reportMode === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                <CalendarDays className="h-3 w-3" /> Monthly
              </button>
              <button
                onClick={() => setReportMode("quarterly")}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                  reportMode === "quarterly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                <CalendarRange className="h-3 w-3" /> Quarterly
              </button>
            </div>
          </div>

          {/* Period dropdown */}
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Period</Label>
            {reportMode === "monthly" ? (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 ml-auto">
            <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="h-8 gap-1">
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Generate Report
            </Button>
            {reportHtml && (
              <>
                <Button onClick={handlePreview} variant="outline" size="sm" className="h-8 gap-1">
                  <FileText className="h-3 w-3" /> Preview
                </Button>
                <Button onClick={handleDownload} variant="outline" size="sm" className="h-8 gap-1">
                  <Download className="h-3 w-3" /> Download HTML
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* ── Report preview ──────────────────────────────────────────────────── */}
      {reportHtml && (
        <Card className="p-0 overflow-hidden mx-auto" style={{ maxWidth: 820 }}>
          <iframe
            srcDoc={reportHtml}
            title="Report Preview"
            className="w-full border-0 bg-white"
            style={{ height: 1200 }}
          />
        </Card>
      )}

      {/* ── Editable sections — only show after first generation ─────────── */}
      {reportHtml && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add to report</h2>
          {(quotes.length > 0 || plannedNext.length > 0) && (
            <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="h-8 gap-1">
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Regenerate with additions
            </Button>
          )}
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* In Their Words */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4" />
            In Their Words
          </h3>

          {/* Selected quotes */}
          {quotes.length > 0 && (
            <div className="space-y-2">
              {quotes.map((q, i) => (
                <div key={i} className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md p-2">
                  <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 text-xs">
                    <p className="italic">"{q.text}"</p>
                    <p className="text-muted-foreground mt-0.5">— {q.attribution}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => removeQuote(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions from debriefs */}
          {quoteSuggestions && quoteSuggestions.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t">
              <p className="text-xs text-muted-foreground">From your debriefs this period:</p>
              <div className="max-h-[240px] overflow-y-auto space-y-1.5">
                {quoteSuggestions
                  .filter(s => !quotes.some(q => q.text === s.text))
                  .map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 bg-muted/30 hover:bg-muted/60 rounded-md p-2 cursor-pointer transition-colors"
                    onClick={() => {
                      setQuotes([...quotes, { text: s.text, attribution: s.attribution }]);
                    }}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="italic text-muted-foreground">"{s.text.length > 150 ? s.text.slice(0, 150) + "..." : s.text}"</p>
                      <p className="text-muted-foreground/70 mt-0.5">— {s.attribution} · {s.debriefTitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual add */}
          <div className="space-y-2 pt-1 border-t">
            <p className="text-xs text-muted-foreground">Or add manually:</p>
            <Textarea
              placeholder="Quote text..."
              value={newQuoteText}
              onChange={(e) => setNewQuoteText(e.target.value)}
              className="min-h-[60px] text-xs"
            />
            <div className="flex gap-2">
              <Input
                placeholder="Attribution (name, role)"
                value={newQuoteAttribution}
                onChange={(e) => setNewQuoteAttribution(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={addQuote} disabled={!newQuoteText.trim()}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
        </Card>

        {/* Planned Next */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">
            Planned Next {reportMode === "monthly" ? "Month" : "Quarter"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Add upcoming activities, then regenerate.
          </p>

          {plannedNext.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plannedNext.map((item, i) => (
                <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-md p-2">
                  <div className="flex-1 text-xs">
                    <p className="font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => removePlannedItem(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-1 border-t">
            <Input
              placeholder="Title (e.g. Creators Club Cohort 2)"
              value={newNextTitle}
              onChange={(e) => setNewNextTitle(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex gap-2">
              <Input
                placeholder="Description (optional)"
                value={newNextDescription}
                onChange={(e) => setNewNextDescription(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={addPlannedItem} disabled={!newNextTitle.trim()}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
        </Card>
      </div>
      </div>
      )}
    </div>
  );
}
