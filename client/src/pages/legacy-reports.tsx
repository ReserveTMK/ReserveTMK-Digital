import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import {
  Plus, Loader2, Trash2, FileText, Upload, Calendar,
  TrendingUp, Settings, Save, ChevronDown, ChevronUp, AlertCircle, Sparkles, X,
} from "lucide-react";
import { format } from "date-fns";

const CHART_COLORS = [
  "hsl(14, 88%, 68%)", "hsl(161, 100%, 12%)", "hsl(199, 85%, 83%)", "hsl(335, 82%, 76%)", "hsl(161, 40%, 35%)",
];

interface LegacyReportSnapshot {
  activationsTotal: number;
  activationsWorkshops: number;
  activationsMentoring: number;
  activationsEvents: number;
  activationsPartnerMeetings: number;
  peopleUnique: number | null;
  engagementsTotal: number | null;
  groupsUnique: number | null;
  bookingsTotal: number | null;
  hoursTotal: string | null;
}

interface LegacyReportWithSnapshot {
  id: number;
  userId: string;
  quarterLabel: string;
  periodStart: string;
  periodEnd: string;
  pdfFileName: string | null;
  pdfData: string | null;
  notes: string | null;
  createdAt: string;
  snapshot: LegacyReportSnapshot | null;
}

const emptySnapshot: LegacyReportSnapshot = {
  activationsTotal: 0,
  activationsWorkshops: 0,
  activationsMentoring: 0,
  activationsEvents: 0,
  activationsPartnerMeetings: 0,
  peopleUnique: null,
  engagementsTotal: null,
  groupsUnique: null,
  bookingsTotal: null,
  hoursTotal: null,
};

export default function LegacyReportsPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedTrend, setExpandedTrend] = useState(true);

  const [aiReview, setAiReview] = useState<{ reportId: number; analysis: string; quarterLabel: string } | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    quarterLabel: "",
    periodStart: "",
    periodEnd: "",
    pdfFileName: "",
    pdfData: "",
    notes: "",
    snapshot: { ...emptySnapshot },
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: legacyReports, isLoading } = useQuery<LegacyReportWithSnapshot[]>({
    queryKey: ["/api/legacy-reports"],
  });

  const { data: reportingSettings } = useQuery<{ boundaryDate: string | null }>({
    queryKey: ["/api/reporting-settings"],
  });

  const { data: trendData } = useQuery<{
    trendData: Array<{
      quarterLabel: string;
      activationsTotal: number;
      activationsWorkshops: number;
      activationsMentoring: number;
      activationsEvents: number;
      peopleUnique: number | null;
      engagementsTotal: number | null;
    }>;
    boundaryDate: string | null;
  }>({
    queryKey: ["/api/legacy-trend-data"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/legacy-reports", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Saved", description: "Legacy report uploaded" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/legacy-reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });
      setShowForm(false);
      setEditingId(null);
      resetForm();
      toast({ title: "Updated", description: "Legacy report updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/legacy-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });
      toast({ title: "Deleted", description: "Legacy report removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const aiReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      setReviewingId(id);
      const res = await apiRequest("POST", `/api/legacy-reports/${id}/ai-review`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setAiReview(data);
      setReviewingId(null);
    },
    onError: (err: any) => {
      setReviewingId(null);
      toast({ title: "Error", description: err.message || "Failed to generate AI review", variant: "destructive" });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (boundaryDate: string | null) => {
      const res = await apiRequest("PUT", "/api/reporting-settings", { boundaryDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reporting-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });
      setShowSettings(false);
      toast({ title: "Saved", description: "Reporting boundary date updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [boundaryDateInput, setBoundaryDateInput] = useState(
    reportingSettings?.boundaryDate ? format(new Date(reportingSettings.boundaryDate), "yyyy-MM-dd") : ""
  );

  function resetForm() {
    setFormData({
      quarterLabel: "",
      periodStart: "",
      periodEnd: "",
      pdfFileName: "",
      pdfData: "",
      notes: "",
      snapshot: { ...emptySnapshot },
    });
    setEditingId(null);
  }

  function openEdit(report: LegacyReportWithSnapshot) {
    setEditingId(report.id);
    setFormData({
      quarterLabel: report.quarterLabel,
      periodStart: format(new Date(report.periodStart), "yyyy-MM-dd"),
      periodEnd: format(new Date(report.periodEnd), "yyyy-MM-dd"),
      pdfFileName: report.pdfFileName || "",
      pdfData: "",
      notes: report.notes || "",
      snapshot: report.snapshot || { ...emptySnapshot },
    });
    setShowForm(true);
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData(prev => ({ ...prev, pdfFileName: file.name }));
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setFormData(prev => ({ ...prev, pdfData: base64 }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!formData.quarterLabel || !formData.periodStart || !formData.periodEnd) {
      toast({ title: "Missing fields", description: "Quarter label and period dates are required", variant: "destructive" });
      return;
    }
    const payload = {
      quarterLabel: formData.quarterLabel,
      periodStart: formData.periodStart,
      periodEnd: formData.periodEnd,
      pdfFileName: formData.pdfFileName || null,
      pdfData: formData.pdfData || null,
      notes: formData.notes || null,
      snapshot: formData.snapshot,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function updateSnapshot(field: keyof LegacyReportSnapshot, value: string) {
    setFormData(prev => ({
      ...prev,
      snapshot: {
        ...prev.snapshot,
        [field]: value === "" ? null : (field === "hoursTotal" ? value : parseInt(value) || 0),
      },
    }));
  }

  const chartData = trendData?.trendData || [];

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-legacy-heading">
                Legacy Reports
              </h1>
              <p className="text-sm text-muted-foreground">
                Upload past quarterly reports and snapshot data to build historical trends.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBoundaryDateInput(
                    reportingSettings?.boundaryDate ? format(new Date(reportingSettings.boundaryDate), "yyyy-MM-dd") : ""
                  );
                  setShowSettings(true);
                }}
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4 mr-1" />
                Boundary Date
              </Button>
              <Button
                size="sm"
                onClick={() => { resetForm(); setShowForm(true); }}
                data-testid="button-add-legacy"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Report
              </Button>
            </div>
          </div>

          {reportingSettings?.boundaryDate && (
            <Card className="p-3 border-indigo-500/20 bg-indigo-500/5">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-indigo-500" />
                <span className="text-muted-foreground">
                  Reporting boundary: <strong className="text-foreground">{format(new Date(reportingSettings.boundaryDate), "d MMMM yyyy")}</strong>
                  &mdash; periods before this use legacy data, after uses live system data.
                </span>
              </div>
            </Card>
          )}

          {chartData.length > 0 && (
            <Card className="overflow-hidden" data-testid="card-trend-chart">
              <button
                onClick={() => setExpandedTrend(!expandedTrend)}
                className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-display font-semibold">Historical Trend</h3>
                  <Badge variant="secondary" className="text-xs">{chartData.length} quarters</Badge>
                </div>
                {expandedTrend ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedTrend && (
                <div className="px-5 pb-5 border-t space-y-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="quarterLabel" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="activationsTotal" stroke={CHART_COLORS[0]} strokeWidth={2} name="Total Activations" dot />
                        <Line type="monotone" dataKey="activationsWorkshops" stroke={CHART_COLORS[1]} strokeWidth={1.5} name="Workshops" dot />
                        <Line type="monotone" dataKey="activationsMentoring" stroke={CHART_COLORS[2]} strokeWidth={1.5} name="Mentoring" dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {chartData.some(d => d.peopleUnique || d.engagementsTotal) && (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.filter(d => d.peopleUnique || d.engagementsTotal)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="quarterLabel" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="peopleUnique" fill={CHART_COLORS[3]} name="Unique People" />
                          <Bar dataKey="engagementsTotal" fill={CHART_COLORS[4]} name="Total Engagements" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!legacyReports || legacyReports.length === 0) && (
            <Card className="p-8 text-center" data-testid="card-empty">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <h3 className="font-medium text-foreground">No legacy reports yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your past quarterly PDF reports and enter snapshot metrics to build historical baselines.
              </p>
            </Card>
          )}

          {legacyReports && legacyReports.length > 0 && (
            <div className="space-y-3" data-testid="list-legacy-reports">
              {legacyReports.map((report) => (
                <Card key={report.id} className="p-4" data-testid={`card-legacy-report-${report.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm" data-testid={`text-quarter-${report.id}`}>
                          {report.quarterLabel}
                        </h4>
                        {report.pdfFileName && (
                          <Badge variant="secondary" className="text-[10px]">
                            <FileText className="w-3 h-3 mr-0.5" />
                            PDF
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(report.periodStart), "d MMM yyyy")} — {format(new Date(report.periodEnd), "d MMM yyyy")}
                      </p>
                      {report.snapshot && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span><strong>{report.snapshot.activationsTotal}</strong> activations</span>
                          {report.snapshot.activationsWorkshops > 0 && <span>{report.snapshot.activationsWorkshops} workshops</span>}
                          {report.snapshot.activationsMentoring > 0 && <span>{report.snapshot.activationsMentoring} mentoring</span>}
                          {report.snapshot.activationsEvents > 0 && <span>{report.snapshot.activationsEvents} events</span>}
                          {report.snapshot.peopleUnique && <span>{report.snapshot.peopleUnique} people</span>}
                          {report.snapshot.engagementsTotal && <span>{report.snapshot.engagementsTotal} engagements</span>}
                          {report.snapshot.hoursTotal && <span>{report.snapshot.hoursTotal} hrs</span>}
                        </div>
                      )}
                      {report.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{report.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => aiReviewMutation.mutate(report.id)}
                        disabled={reviewingId === report.id}
                        data-testid={`button-ai-review-${report.id}`}
                      >
                        {reviewingId === report.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1" />
                        )}
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(report)}
                        data-testid={`button-edit-${report.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(report.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${report.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {aiReview && (
            <Card className="p-5 border-primary/20 bg-primary/5" data-testid="card-ai-review">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">AI Metrics Review: {aiReview.quarterLabel}</h3>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setAiReview(null)} data-testid="button-close-review">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground">
                {aiReview.analysis.split("\n").map((line, i) => {
                  if (line.startsWith("##") || line.match(/^\d+\.\s*\*\*/)) {
                    return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{line.replace(/^#+\s*/, "").replace(/\*\*/g, "")}</p>;
                  }
                  if (line.startsWith("- ")) return <p key={i} className="ml-3 mb-1">{line}</p>;
                  if (line.trim()) return <p key={i} className="mb-1">{line}</p>;
                  return null;
                })}
              </div>
            </Card>
          )}
        </div>

        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Legacy Report" : "Add Legacy Report"}</DialogTitle>
              <DialogDescription>
                Upload a quarterly PDF and enter snapshot metrics.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Quarter Label</Label>
                <Input
                  value={formData.quarterLabel}
                  onChange={(e) => setFormData(prev => ({ ...prev, quarterLabel: e.target.value }))}
                  placeholder="e.g. 2025 Q2"
                  data-testid="input-quarter-label"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                    data-testid="input-period-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                    data-testid="input-period-end"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>PDF Report (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="text-xs"
                    data-testid="input-pdf-upload"
                  />
                  {formData.pdfFileName && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <FileText className="w-3 h-3 mr-1" />
                      {formData.pdfFileName}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-3">Snapshot Metrics</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Total Activations</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.activationsTotal || ""}
                      onChange={(e) => updateSnapshot("activationsTotal", e.target.value)}
                      placeholder="0"
                      data-testid="input-activations-total"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Workshops</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.activationsWorkshops || ""}
                      onChange={(e) => updateSnapshot("activationsWorkshops", e.target.value)}
                      placeholder="0"
                      data-testid="input-activations-workshops"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mentoring</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.activationsMentoring || ""}
                      onChange={(e) => updateSnapshot("activationsMentoring", e.target.value)}
                      placeholder="0"
                      data-testid="input-activations-mentoring"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Events</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.activationsEvents || ""}
                      onChange={(e) => updateSnapshot("activationsEvents", e.target.value)}
                      placeholder="0"
                      data-testid="input-activations-events"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Partner Meetings</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.activationsPartnerMeetings || ""}
                      onChange={(e) => updateSnapshot("activationsPartnerMeetings", e.target.value)}
                      placeholder="0"
                      data-testid="input-activations-partner"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unique People</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.peopleUnique ?? ""}
                      onChange={(e) => updateSnapshot("peopleUnique", e.target.value)}
                      placeholder="Optional"
                      data-testid="input-people-unique"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Engagements</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.engagementsTotal ?? ""}
                      onChange={(e) => updateSnapshot("engagementsTotal", e.target.value)}
                      placeholder="Optional"
                      data-testid="input-engagements-total"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unique Groups</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.groupsUnique ?? ""}
                      onChange={(e) => updateSnapshot("groupsUnique", e.target.value)}
                      placeholder="Optional"
                      data-testid="input-groups-unique"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Bookings</Label>
                    <Input
                      type="number"
                      value={formData.snapshot.bookingsTotal ?? ""}
                      onChange={(e) => updateSnapshot("bookingsTotal", e.target.value)}
                      placeholder="Optional"
                      data-testid="input-bookings-total"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Hours</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.snapshot.hoursTotal ?? ""}
                      onChange={(e) => updateSnapshot("hoursTotal", e.target.value)}
                      placeholder="Optional"
                      data-testid="input-hours-total"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any notes about this reporting period..."
                  className="min-h-[60px]"
                  data-testid="textarea-notes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                <Save className="w-4 h-4 mr-1" />
                {editingId ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reporting Boundary Date</DialogTitle>
              <DialogDescription>
                Set the date that separates legacy data from live system data. Periods before this date use uploaded snapshot metrics. Periods after use live data from the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Boundary Date</Label>
                <Input
                  type="date"
                  value={boundaryDateInput}
                  onChange={(e) => setBoundaryDateInput(e.target.value)}
                  data-testid="input-boundary-date"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to disable boundary. When set, dashboard trend charts will blend legacy snapshot data with live data seamlessly.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button
                onClick={() => settingsMutation.mutate(boundaryDateInput || null)}
                disabled={settingsMutation.isPending}
                data-testid="button-save-boundary"
              >
                {settingsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
  );
}
