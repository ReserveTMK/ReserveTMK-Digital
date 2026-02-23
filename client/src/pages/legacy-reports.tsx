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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import {
  Plus, Loader2, Trash2, FileText, Upload, Calendar,
  TrendingUp, Settings, Save, ChevronDown, ChevronUp, AlertCircle, Sparkles, X,
  CheckCircle, Eye,
} from "lucide-react";
import { format } from "date-fns";

const CHART_COLORS = [
  "hsl(14, 88%, 68%)", "hsl(161, 100%, 12%)", "hsl(199, 85%, 83%)", "hsl(335, 82%, 76%)", "hsl(161, 40%, 35%)",
];

const ACTIVITY_TYPE_OPTIONS = [
  "workshop", "mentoring", "event", "meeting", "activation", "programme",
  "booking", "partnership", "community", "training", "presentation", "other",
];

const PEOPLE_ROLE_OPTIONS = [
  "mentee", "mentor", "facilitator", "partner", "speaker", "coordinator",
  "volunteer", "board member", "staff", "community leader", "participant", "other",
];

const METRIC_KEY_TO_LABEL: Record<string, string> = {
  activations_total: "Total Activations",
  activations_workshops: "Workshops",
  activations_mentoring: "Mentoring",
  activations_events: "Events",
  activations_partner_meetings: "Partner Meetings",
  people_unique: "Unique People",
  engagements_total: "Total Engagements",
  groups_unique: "Unique Groups",
  bookings_total: "Total Bookings",
  hours_total: "Total Hours",
  revenue_total: "Total Revenue",
  in_kind_total: "In-Kind Value",
};

const METRIC_KEY_TO_SNAPSHOT_FIELD: Record<string, keyof LegacyReportSnapshot> = {
  activations_total: "activationsTotal",
  activations_workshops: "activationsWorkshops",
  activations_mentoring: "activationsMentoring",
  activations_events: "activationsEvents",
  activations_partner_meetings: "activationsPartnerMeetings",
  people_unique: "peopleUnique",
  engagements_total: "engagementsTotal",
  groups_unique: "groupsUnique",
  bookings_total: "bookingsTotal",
  hours_total: "hoursTotal",
  revenue_total: "revenueTotal",
  in_kind_total: "inKindTotal",
};

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
  revenueTotal: string | null;
  inKindTotal: string | null;
}

interface LegacyReportWithSnapshot {
  id: number;
  userId: string;
  year: number | null;
  quarter: number | null;
  month: number | null;
  quarterLabel: string;
  periodStart: string;
  periodEnd: string;
  pdfFileName: string | null;
  pdfData: string | null;
  notes: string | null;
  status: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdAt: string;
  snapshot: LegacyReportSnapshot | null;
}

interface ExtractionMetric {
  metricKey: string;
  metricValue: number | null;
  metricUnit: string | null;
  confidence: number;
  evidenceSnippet: string | null;
}

interface ExtractedOrganisation {
  name: string;
  type: string;
  description: string | null;
  relationship: string | null;
}

interface ExtractedHighlight {
  theme: string;
  summary: string;
  activityType: string | null;
}

interface ExtractedPerson {
  name: string;
  role: string | null;
  context: string | null;
}

interface Extraction {
  id: number;
  legacyReportId: number;
  suggestedMetrics: ExtractionMetric[];
  extractedOrganisations?: ExtractedOrganisation[];
  extractedHighlights?: ExtractedHighlight[];
  extractedPeople?: ExtractedPerson[];
  rawText: string | null;
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
  revenueTotal: null,
  inKindTotal: null,
};

const currentYear = new Date().getFullYear();
const currentMonthIndex = new Date().getMonth();

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  value: i + 1,
  label: name,
}));

function getYearOptions() {
  const years: number[] = [];
  for (let y = 2023; y <= currentYear; y++) {
    years.push(y);
  }
  return years;
}

function isMonthInFuture(year: number, month: number): boolean {
  if (year < currentYear) return false;
  if (year > currentYear) return true;
  return month > currentMonthIndex + 1;
}

function isMonthBeforeStart(year: number, month: number): boolean {
  return year === 2023 && month < 11;
}

export default function LegacyReportsPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedTrend, setExpandedTrend] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dropUploading, setDropUploading] = useState(false);

  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const [formData, setFormData] = useState({
    pdfFileName: "",
    pdfData: "",
    notes: "",
    snapshot: { ...emptySnapshot },
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [extractingId, setExtractingId] = useState<number | null>(null);
  const [extractionData, setExtractionData] = useState<{
    reportId: number;
    metrics: ExtractionMetric[];
    organisations?: ExtractedOrganisation[];
    highlights?: ExtractedHighlight[];
    people?: ExtractedPerson[];
  } | null>(null);
  const [editedMetricValues, setEditedMetricValues] = useState<Record<string, string>>({});
  const [editedHighlightTypes, setEditedHighlightTypes] = useState<Record<number, string>>({});
  const [editedPeopleRoles, setEditedPeopleRoles] = useState<Record<number, string>>({});
  const [addingMetric, setAddingMetric] = useState(false);
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [editDateYear, setEditDateYear] = useState<string>("");
  const [editDateMonth, setEditDateMonth] = useState<string>("");
  const [suggestingTaxonomyId, setSuggestingTaxonomyId] = useState<number | null>(null);
  const [taxonomySuggestions, setTaxonomySuggestions] = useState<{
    reportId: number;
    suggestions: Array<{ category: string; description: string; matchesExisting: string | null; confidence: number }>;
  } | null>(null);

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
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });
      setShowForm(false);
      resetForm();
      if (result.autoExtracted && result.extraction) {
        const { autoAppliedCount, reviewNeededCount, suggestedMetrics } = result.extraction;
        toast({
          title: "Report Created & Metrics Extracted",
          description: `${autoAppliedCount} metrics auto-applied, ${reviewNeededCount} need review`,
        });
        const values: Record<string, string> = {};
        suggestedMetrics.forEach((m: ExtractionMetric) => {
          values[m.metricKey] = m.metricValue !== null ? String(m.metricValue) : "";
        });
        setEditedMetricValues(values);
        setExtractionData({
          reportId: result.id,
          metrics: suggestedMetrics,
          organisations: result.extraction.extractedOrganisations,
          highlights: result.extraction.extractedHighlights,
          people: result.extraction.extractedPeople,
        });
      } else if (result.autoExtracted === false && result.extractionError) {
        toast({
          title: "Report Created",
          description: result.extractionError,
          variant: "destructive",
        });
      } else {
        toast({ title: "Saved", description: "Legacy report uploaded" });
      }
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

  const confirmMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/legacy-reports/${id}`, { status });
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      const parts: string[] = [];
      if (result.taxonomySuggestionsAvailable) {
        parts.push("Taxonomy suggestions available — click 'Taxonomy' to view.");
      }
      if (result.createdGroups && result.createdGroups.length > 0) {
        parts.push(`${result.createdGroups.length} organisation(s) added to Groups: ${result.createdGroups.join(", ")}`);
      }
      toast({
        title: result.status === "confirmed" ? "Report Confirmed" : "Status Updated",
        description: parts.length > 0 ? parts.join(" ") : "Report status updated.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const extractMetricsMutation = useMutation({
    mutationFn: async (id: number) => {
      setExtractingId(id);
      const res = await apiRequest("POST", `/api/legacy-reports/${id}/extract-metrics`);
      return res.json();
    },
    onSuccess: (data: Extraction, id: number) => {
      setExtractingId(null);
      const values: Record<string, string> = {};
      data.suggestedMetrics.forEach((m) => {
        values[m.metricKey] = m.metricValue !== null ? String(m.metricValue) : "";
      });
      setEditedMetricValues(values);
      setExtractionData({
        reportId: id,
        metrics: data.suggestedMetrics,
        organisations: data.extractedOrganisations,
        highlights: data.extractedHighlights,
        people: data.extractedPeople,
      });
    },
    onError: (err: any) => {
      setExtractingId(null);
      toast({ title: "Error", description: err.message || "Failed to extract metrics", variant: "destructive" });
    },
  });

  const taxonomyMutation = useMutation({
    mutationFn: async (id: number) => {
      setSuggestingTaxonomyId(id);
      const res = await apiRequest("POST", `/api/legacy-reports/${id}/suggest-taxonomy`);
      return res.json();
    },
    onSuccess: (data: any, id: number) => {
      setSuggestingTaxonomyId(null);
      setTaxonomySuggestions({ reportId: id, suggestions: data.suggestions || [] });
    },
    onError: (err: any) => {
      setSuggestingTaxonomyId(null);
      toast({ title: "Error", description: err.message || "Failed to generate taxonomy suggestions", variant: "destructive" });
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
      pdfFileName: "",
      pdfData: "",
      notes: "",
      snapshot: { ...emptySnapshot },
    });
    setSelectedYear("");
    setSelectedMonth("");
    setEditingId(null);
  }

  function openEdit(report: LegacyReportWithSnapshot) {
    setEditingId(report.id);
    setFormData({
      pdfFileName: report.pdfFileName || "",
      pdfData: "",
      notes: report.notes || "",
      snapshot: report.snapshot || { ...emptySnapshot },
    });
    setSelectedYear("");
    setSelectedMonth("");
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

  async function handleDropUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please drop a PDF file", variant: "destructive" });
      return;
    }
    setDropUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const now = new Date();
      const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const payload = {
        year: defaultYear,
        month: defaultMonth,
        pdfFileName: file.name,
        pdfData: base64,
        notes: null,
      };

      const res = await apiRequest("POST", "/api/legacy-reports", payload);
      const result = await res.json();

      queryClient.invalidateQueries({ queryKey: ["/api/legacy-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-trend-data"] });

      if (result.autoExtracted && result.extraction) {
        const { autoAppliedCount, reviewNeededCount, suggestedMetrics } = result.extraction;
        toast({
          title: "PDF Uploaded & Metrics Extracted",
          description: `${autoAppliedCount} metrics auto-applied, ${reviewNeededCount} need review. You can edit the month/year from the report card.`,
        });
        const values: Record<string, string> = {};
        suggestedMetrics.forEach((m: ExtractionMetric) => {
          values[m.metricKey] = m.metricValue !== null ? String(m.metricValue) : "";
        });
        setEditedMetricValues(values);
        setExtractionData({
          reportId: result.id,
          metrics: suggestedMetrics,
          organisations: result.extraction.extractedOrganisations,
          highlights: result.extraction.extractedHighlights,
          people: result.extraction.extractedPeople,
        });
      } else {
        toast({
          title: "PDF Uploaded",
          description: `Draft report created for ${MONTH_NAMES[defaultMonth - 1]} ${defaultYear}. Edit the report to adjust the date or add metrics.`,
        });
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to upload PDF";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setDropUploading(false);
    }
  }

  function handleSubmit() {
    if (!editingId && (!selectedYear || !selectedMonth)) {
      toast({ title: "Missing fields", description: "Year and month are required", variant: "destructive" });
      return;
    }

    if (editingId) {
      const payload = {
        notes: formData.notes || null,
        snapshot: formData.snapshot,
      };
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      const payload = {
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        pdfFileName: formData.pdfFileName || null,
        pdfData: formData.pdfData || null,
        notes: formData.notes || null,
      };
      createMutation.mutate(payload);
    }
  }

  function updateSnapshot(field: keyof LegacyReportSnapshot, value: string) {
    setFormData(prev => ({
      ...prev,
      snapshot: {
        ...prev.snapshot,
        [field]: value === "" ? null : (field === "hoursTotal" || field === "revenueTotal" || field === "inKindTotal" ? value : parseInt(value) || 0),
      },
    }));
  }

  async function applyExtractionToSnapshot(reportId: number) {
    if (!extractionData) return;
    const snapshotUpdate: Record<string, any> = {};
    for (const [metricKey, value] of Object.entries(editedMetricValues)) {
      const snapshotField = METRIC_KEY_TO_SNAPSHOT_FIELD[metricKey];
      if (snapshotField) {
        if (value === "") {
          snapshotUpdate[snapshotField] = null;
        } else if (snapshotField === "hoursTotal" || snapshotField === "revenueTotal" || snapshotField === "inKindTotal") {
          snapshotUpdate[snapshotField] = value;
        } else {
          snapshotUpdate[snapshotField] = parseInt(value) || 0;
        }
      }
    }

    const report = legacyReports?.find(r => r.id === reportId);
    const existingSnapshot = report?.snapshot || { ...emptySnapshot };
    const { id: _sid, legacyReportId: _lrid, createdAt: _ca, ...cleanSnapshot } = existingSnapshot as any;
    const mergedSnapshot = { ...cleanSnapshot, ...snapshotUpdate };

    const hasHighlightEdits = Object.keys(editedHighlightTypes).length > 0;
    const hasPeopleEdits = Object.keys(editedPeopleRoles).length > 0;

    if (hasHighlightEdits || hasPeopleEdits) {
      const extractionUpdate: any = {};
      if (hasHighlightEdits && extractionData.highlights) {
        extractionUpdate.extractedHighlights = extractionData.highlights.map((h, i) => ({
          ...h,
          activityType: editedHighlightTypes[i] ?? h.activityType,
        }));
      }
      if (hasPeopleEdits && extractionData.people) {
        extractionUpdate.extractedPeople = extractionData.people.map((p, i) => ({
          ...p,
          role: editedPeopleRoles[i] ?? p.role,
        }));
      }
      try {
        await apiRequest("PATCH", `/api/legacy-report-extractions/${reportId}`, extractionUpdate);
      } catch (err) {
        console.error("Failed to save extraction edits:", err);
      }
    }

    updateMutation.mutate({ id: reportId, data: { snapshot: mergedSnapshot } });
    setExtractionData(null);
    setEditedMetricValues({});
    setEditedHighlightTypes({});
    setEditedPeopleRoles({});
    setAddingMetric(false);
  }

  function confidenceBadgeVariant(confidence: number): string {
    if (confidence >= 70) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (confidence >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
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
                Upload past monthly reports and snapshot data to build historical trends.
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

          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            }`}
            data-testid="drop-zone-pdf"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleDropUpload(file);
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleDropUpload(file);
              };
              input.click();
            }}
          >
            {dropUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">Uploading & extracting metrics...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className={`w-8 h-8 ${isDragging ? "text-primary" : "text-muted-foreground/50"}`} />
                <p className="text-sm font-medium text-foreground">
                  {isDragging ? "Drop your PDF here" : "Drag & drop a PDF report here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse — a draft report will be created automatically
                </p>
              </div>
            )}
          </div>

          {chartData.length > 0 && (
            <Card className="overflow-hidden" data-testid="card-trend-chart">
              <button
                onClick={() => setExpandedTrend(!expandedTrend)}
                className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-display font-semibold">Historical Trend</h3>
                  <Badge variant="secondary" className="text-xs">{chartData.length} periods</Badge>
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
                Upload your past monthly PDF reports and enter snapshot metrics to build historical baselines.
              </p>
            </Card>
          )}

          {legacyReports && legacyReports.length > 0 && (
            <div className="space-y-3" data-testid="list-legacy-reports">
              {legacyReports.map((report) => (
                <Card key={report.id} className="p-4" data-testid={`card-legacy-report-${report.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {editingDateId === report.id ? (
                          <div className="flex items-center gap-1" data-testid={`date-edit-${report.id}`}>
                            <Select value={editDateMonth} onValueChange={setEditDateMonth}>
                              <SelectTrigger className="h-7 text-xs w-[110px]">
                                <SelectValue placeholder="Month" />
                              </SelectTrigger>
                              <SelectContent>
                                {MONTH_OPTIONS.map((m) => (
                                  <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={editDateYear} onValueChange={setEditDateYear}>
                              <SelectTrigger className="h-7 text-xs w-[80px]">
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                              <SelectContent>
                                {getYearOptions().map((y) => (
                                  <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              data-testid={`button-save-date-${report.id}`}
                              disabled={!editDateYear || !editDateMonth || (editDateYear && editDateMonth ? (isMonthInFuture(parseInt(editDateYear), parseInt(editDateMonth)) || isMonthBeforeStart(parseInt(editDateYear), parseInt(editDateMonth))) : false)}
                              onClick={() => {
                                if (editDateYear && editDateMonth) {
                                  updateMutation.mutate({
                                    id: report.id,
                                    data: { year: parseInt(editDateYear), month: parseInt(editDateMonth) },
                                  });
                                }
                                setEditingDateId(null);
                              }}
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingDateId(null)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <h4
                            className={`font-medium text-sm ${report.status === "draft" ? "cursor-pointer hover:text-primary" : ""}`}
                            data-testid={`text-quarter-${report.id}`}
                            onClick={() => {
                              if (report.status === "draft") {
                                setEditingDateId(report.id);
                                setEditDateYear(report.year ? String(report.year) : "");
                                setEditDateMonth(report.month ? String(report.month) : "");
                              }
                            }}
                            title={report.status === "draft" ? "Click to change date" : undefined}
                          >
                            {report.quarterLabel}
                            {report.status === "draft" && (
                              <Calendar className="w-3 h-3 inline ml-1 text-muted-foreground" />
                            )}
                          </h4>
                        )}
                        {report.status === "confirmed" ? (
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-status-${report.id}`}>
                            <CheckCircle className="w-3 h-3 mr-0.5" />
                            Confirmed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-status-${report.id}`}>
                            Draft
                          </Badge>
                        )}
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
                      {report.status === "confirmed" && report.confirmedAt && (
                        <p className="text-xs text-muted-foreground">
                          Confirmed {format(new Date(report.confirmedAt), "d MMM yyyy")}
                        </p>
                      )}
                      {report.snapshot && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span><strong>{report.snapshot.activationsTotal}</strong> activations</span>
                          {report.snapshot.activationsWorkshops > 0 && <span>{report.snapshot.activationsWorkshops} workshops</span>}
                          {report.snapshot.activationsMentoring > 0 && <span>{report.snapshot.activationsMentoring} mentoring</span>}
                          {report.snapshot.activationsEvents > 0 && <span>{report.snapshot.activationsEvents} events</span>}
                          {report.snapshot.peopleUnique && <span>{report.snapshot.peopleUnique} people</span>}
                          {report.snapshot.engagementsTotal && <span>{report.snapshot.engagementsTotal} engagements</span>}
                          {report.snapshot.hoursTotal && <span>{report.snapshot.hoursTotal} hrs</span>}
                          {report.snapshot.revenueTotal && <span>${report.snapshot.revenueTotal} revenue</span>}
                          {report.snapshot.inKindTotal && <span>${report.snapshot.inKindTotal} in-kind</span>}
                        </div>
                      )}
                      {report.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{report.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 flex-wrap">
                      {report.pdfFileName && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => extractMetricsMutation.mutate(report.id)}
                            disabled={extractingId === report.id}
                            data-testid={`button-extract-metrics-${report.id}`}
                          >
                            {extractingId === report.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Eye className="w-3 h-3 mr-1" />
                            )}
                            Extract
                          </Button>
                        </>
                      )}
                      {report.status === "draft" || !report.status ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confirmMutation.mutate({ id: report.id, status: "confirmed" })}
                          disabled={confirmMutation.isPending}
                          data-testid={`button-confirm-${report.id}`}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Confirm
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confirmMutation.mutate({ id: report.id, status: "draft" })}
                          disabled={confirmMutation.isPending}
                          data-testid={`button-unconfirm-${report.id}`}
                        >
                          Unconfirm
                        </Button>
                      )}
                      {report.status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => taxonomyMutation.mutate(report.id)}
                          disabled={suggestingTaxonomyId === report.id}
                          data-testid={`button-suggest-taxonomy-${report.id}`}
                        >
                          {suggestingTaxonomyId === report.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="w-3 h-3 mr-1" />
                          )}
                          Taxonomy
                        </Button>
                      )}
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

          {extractionData && (
            <Card className="p-5 border-primary/20 bg-primary/5" data-testid="card-extraction-review">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">Extracted Data Review</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setExtractionData(null); setEditedMetricValues({}); setEditedHighlightTypes({}); setEditedPeopleRoles({}); setAddingMetric(false); }}
                  data-testid="button-dismiss-extraction"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Metrics</h4>
              <div className="space-y-2 mb-4">
                {extractionData.metrics
                  .filter((metric) => metric.metricValue !== null && metric.metricValue !== undefined)
                  .map((metric) => (
                  <div
                    key={metric.metricKey}
                    className="flex items-center gap-3 flex-wrap"
                    data-testid={`row-extraction-metric-${metric.metricKey}`}
                  >
                    <span className="text-sm font-medium w-40 shrink-0">
                      {METRIC_KEY_TO_LABEL[metric.metricKey] || metric.metricKey}
                    </span>
                    <Input
                      type="number"
                      step="any"
                      className="w-28"
                      value={editedMetricValues[metric.metricKey] ?? ""}
                      onChange={(e) => setEditedMetricValues(prev => ({ ...prev, [metric.metricKey]: e.target.value }))}
                      placeholder=""
                      data-testid={`input-extraction-${metric.metricKey}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-6 h-6"
                      onClick={() => {
                        const updated = { ...editedMetricValues };
                        delete updated[metric.metricKey];
                        setEditedMetricValues(updated);
                        setExtractionData(prev => prev ? {
                          ...prev,
                          metrics: prev.metrics.filter(m => m.metricKey !== metric.metricKey),
                        } : null);
                      }}
                      data-testid={`button-remove-metric-${metric.metricKey}`}
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    {metric.evidenceSnippet && (
                      <span className="text-xs text-muted-foreground italic flex-1 min-w-0 truncate" data-testid={`text-evidence-${metric.metricKey}`}>
                        "{metric.evidenceSnippet}"
                      </span>
                    )}
                  </div>
                ))}
                {Object.keys(editedMetricValues).filter(k =>
                  !extractionData.metrics.some(m => m.metricKey === k && m.metricValue !== null && m.metricValue !== undefined) &&
                  editedMetricValues[k] !== undefined
                ).map((key) => (
                  <div key={key} className="flex items-center gap-3 flex-wrap" data-testid={`row-extraction-metric-${key}`}>
                    <span className="text-sm font-medium w-40 shrink-0">
                      {METRIC_KEY_TO_LABEL[key] || key}
                    </span>
                    <Input
                      type="number"
                      step="any"
                      className="w-28"
                      value={editedMetricValues[key] ?? ""}
                      onChange={(e) => setEditedMetricValues(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder=""
                      data-testid={`input-extraction-${key}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-6 h-6"
                      onClick={() => {
                        const updated = { ...editedMetricValues };
                        delete updated[key];
                        setEditedMetricValues(updated);
                      }}
                      data-testid={`button-remove-metric-${key}`}
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <span className="text-xs text-muted-foreground italic">manually added</span>
                  </div>
                ))}
                {addingMetric ? (
                  <div className="flex items-center gap-2" data-testid="row-add-metric-select">
                    <Select onValueChange={(val) => {
                      setEditedMetricValues(prev => ({ ...prev, [val]: "" }));
                      setAddingMetric(false);
                    }}>
                      <SelectTrigger className="w-48" data-testid="select-add-metric">
                        <SelectValue placeholder="Choose metric..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(METRIC_KEY_TO_LABEL)
                          .filter(([key]) => !(editedMetricValues[key] !== undefined || extractionData.metrics.some(m => m.metricKey === key && m.metricValue !== null)))
                          .map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => setAddingMetric(false)} data-testid="button-cancel-add-metric">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() => setAddingMetric(true)}
                    data-testid="button-add-metric"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Metric
                  </Button>
                )}
              </div>

              {extractionData.organisations && extractionData.organisations.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Organisations Found</h4>
                  <p className="text-xs text-muted-foreground mb-2">These will be added to your Groups when you confirm the report.</p>
                  <div className="flex flex-wrap gap-2 mb-4" data-testid="section-extracted-orgs">
                    {extractionData.organisations.map((org, i) => (
                      <Badge key={i} variant="secondary" className="text-xs py-1 px-2" data-testid={`badge-org-${i}`}>
                        <span className="font-medium">{org.name}</span>
                        {org.type && org.type !== "other" && (
                          <span className="text-muted-foreground ml-1">({org.type.replace(/_/g, " ")})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </>
              )}

              {extractionData.highlights && extractionData.highlights.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Key Highlights</h4>
                  <div className="space-y-2 mb-4" data-testid="section-extracted-highlights">
                    {extractionData.highlights.map((h, i) => (
                      <div key={i} className="text-sm border-l-2 border-primary/30 pl-3" data-testid={`highlight-${i}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{h.theme}</span>
                          <Select
                            value={editedHighlightTypes[i] ?? h.activityType ?? ""}
                            onValueChange={(val) => setEditedHighlightTypes(prev => ({ ...prev, [i]: val }))}
                          >
                            <SelectTrigger className="h-6 w-auto min-w-[100px] text-[10px] px-2 py-0" data-testid={`select-highlight-type-${i}`}>
                              <SelectValue placeholder="Type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTIVITY_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-muted-foreground text-xs mt-0.5">{h.summary}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {extractionData.people && extractionData.people.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">People Mentioned</h4>
                  <div className="space-y-2 mb-4" data-testid="section-extracted-people">
                    {extractionData.people.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`person-row-${i}`}>
                        <span className="text-sm font-medium">{p.name}</span>
                        <Select
                          value={editedPeopleRoles[i] ?? p.role ?? ""}
                          onValueChange={(val) => setEditedPeopleRoles(prev => ({ ...prev, [i]: val }))}
                        >
                          <SelectTrigger className="h-6 w-auto min-w-[100px] text-[10px] px-2 py-0" data-testid={`select-person-role-${i}`}>
                            <SelectValue placeholder="Role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {PEOPLE_ROLE_OPTIONS.map(opt => (
                              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {p.context && (
                          <span className="text-xs text-muted-foreground italic">{p.context}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => applyExtractionToSnapshot(extractionData.reportId)}
                  disabled={updateMutation.isPending}
                  data-testid="button-apply-extraction"
                >
                  {updateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                  Apply to Snapshot
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setExtractionData(null); setEditedMetricValues({}); setEditedHighlightTypes({}); setEditedPeopleRoles({}); setAddingMetric(false); }}
                  data-testid="button-dismiss-extraction-footer"
                >
                  Dismiss
                </Button>
              </div>
            </Card>
          )}

          {taxonomySuggestions && taxonomySuggestions.suggestions.length > 0 && (
            <Card className="p-5 border-primary/20 bg-primary/5" data-testid="card-taxonomy-suggestions">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">Taxonomy Suggestions</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setTaxonomySuggestions(null)}
                  data-testid="button-dismiss-taxonomy"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {taxonomySuggestions.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-background rounded-lg border" data-testid={`taxonomy-suggestion-${i}`}>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.category}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${confidenceBadgeVariant(s.confidence)}`}
                        >
                          {s.confidence}%
                        </Badge>
                        {s.matchesExisting && (
                          <Badge variant="outline" className="text-[10px]">
                            Matches: {s.matchesExisting}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTaxonomySuggestions(null)}
                  data-testid="button-dismiss-taxonomy-footer"
                >
                  Dismiss
                </Button>
              </div>
            </Card>
          )}

        </div>

        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Legacy Report" : "Add Legacy Report"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update notes and snapshot metrics." : "Select a quarter, upload a PDF and enter snapshot metrics."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {!editingId && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear} data-testid="select-year">
                      <SelectTrigger data-testid="select-year-trigger">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {getYearOptions().map((y) => (
                          <SelectItem key={y} value={String(y)} data-testid={`select-year-${y}`}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth} data-testid="select-month">
                      <SelectTrigger data-testid="select-month-trigger">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map((m) => (
                          <SelectItem
                            key={m.value}
                            value={String(m.value)}
                            disabled={selectedYear ? (isMonthInFuture(parseInt(selectedYear), m.value) || isMonthBeforeStart(parseInt(selectedYear), m.value)) : false}
                            data-testid={`select-month-${m.value}`}
                          >
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {!editingId && (
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
                  <p className="text-xs text-muted-foreground">
                    Upload a PDF and use "Extract Metrics" after saving to automatically populate snapshot data.
                  </p>
                </div>
              )}

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
