import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useMemo, useRef } from "react";
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  Calendar,
  MoreVertical,
  X,
  FileText,
  Upload,
  Download,
  Building2,
  Phone,
  Mail,
  User,
  Clock,
  Eye,
  ChevronLeft,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  FUNDER_STATUSES,
  COMMUNITY_LENS_OPTIONS,
  REPORTING_CADENCES,
  NARRATIVE_STYLES,
  FUNDER_DOCUMENT_TYPES,
  OUTCOME_FOCUS_OPTIONS,
  type Funder,
  type FunderDocument,
} from "@shared/schema";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  active_funder: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  in_conversation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pending_eoi: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  active_funder: "Active Funder",
  in_conversation: "In Conversation",
  pending_eoi: "Pending EOI",
  completed: "Completed",
};

const LENS_LABELS: Record<string, string> = {
  all: "All Communities",
  maori: "Māori",
  pasifika: "Pasifika",
  maori_pasifika: "Māori + Pasifika",
};

const LENS_COLORS: Record<string, string> = {
  all: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  maori: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  pasifika: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  maori_pasifika: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  adhoc: "Ad Hoc",
};

const STYLE_LABELS: Record<string, string> = {
  compliance: "Compliance (stats-first)",
  story: "Story (narrative-first)",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: "Contract",
  eoi: "EOI",
  framework: "Framework",
  report: "Report",
  other: "Other",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  contract: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  eoi: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  framework: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  report: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const OUTCOME_FOCUS_LABELS: Record<string, { label: string; description: string }> = {
  economic: { label: "Economic", description: "Jobs, revenue, businesses" },
  wellbeing: { label: "Wellbeing", description: "Growth, confidence, mindset" },
  cultural: { label: "Cultural", description: "Te reo, tikanga, whanaungatanga" },
  community: { label: "Community", description: "Connections, network, engagement" },
};

const REPORT_SECTIONS = [
  { id: "engagement", label: "Engagement" },
  { id: "delivery", label: "Delivery" },
  { id: "impact", label: "Impact by Taxonomy" },
  { id: "outcomes", label: "Outcome Movement" },
  { id: "value", label: "Value & Contribution" },
  { id: "narrative", label: "Narrative" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FundersPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFunder, setEditingFunder] = useState<Funder | null>(null);
  const [viewingFunder, setViewingFunder] = useState<Funder | null>(null);
  const [docFilter, setDocFilter] = useState<string>("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: fundersList = [], isLoading } = useQuery<Funder[]>({
    queryKey: ["/api/funders"],
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return fundersList;
    const q = search.toLowerCase();
    return fundersList.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.organisation?.toLowerCase().includes(q) ||
      f.contactPerson?.toLowerCase().includes(q)
    );
  }, [fundersList, search]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/funders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders"] });
      setShowCreateDialog(false);
      toast({ title: "Funder created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/funders/${id}`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funders", vars.id] });
      setEditingFunder(null);
      toast({ title: "Funder updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/funders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders"] });
      setDeleteConfirm(null);
      setViewingFunder(null);
      toast({ title: "Funder deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" data-testid="funders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Funders</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage funding relationships, documents, and reporting profiles</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-funder">
          <Plus className="w-4 h-4 mr-2" /> Add Funder
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search funders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-funders"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {search ? "No funders match your search" : "No funders yet. Add your first funder to get started."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((funder) => (
            <FunderCard
              key={funder.id}
              funder={funder}
              onView={() => setViewingFunder(funder)}
              onEdit={() => setEditingFunder(funder)}
              onDelete={() => setDeleteConfirm(funder.id)}
              onGenerateReport={() => setLocation(`/reports?funder=${funder.id}`)}
            />
          ))}
        </div>
      )}

      <FunderFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="Add Funder"
      />

      {editingFunder && (
        <FunderFormDialog
          open={true}
          onOpenChange={() => setEditingFunder(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingFunder.id, data })}
          isPending={updateMutation.isPending}
          title="Edit Funder"
          defaultValues={editingFunder}
        />
      )}

      {viewingFunder && (
        <FunderDetailDialog
          funder={viewingFunder}
          onClose={() => setViewingFunder(null)}
          onEdit={() => { setEditingFunder(viewingFunder); setViewingFunder(null); }}
          onDelete={() => { setDeleteConfirm(viewingFunder.id); }}
          onGenerateReport={() => setLocation(`/reports?funder=${viewingFunder.id}`)}
        />
      )}

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Funder</DialogTitle>
            <DialogDescription>
              This will permanently delete this funder and all associated documents. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FunderCard({
  funder,
  onView,
  onEdit,
  onDelete,
  onGenerateReport,
}: {
  funder: Funder;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGenerateReport: () => void;
}) {
  const deadlineWarning = funder.nextDeadline && isPast(new Date(funder.nextDeadline));

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow cursor-pointer border"
      onClick={onView}
      data-testid={`card-funder-${funder.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
            {funder.isDefault && (
              <Badge variant="outline" className="text-xs shrink-0">Default</Badge>
            )}
          </div>
          {funder.organisation && (
            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={STATUS_COLORS[funder.status] || STATUS_COLORS.in_conversation} data-testid={`badge-status-${funder.id}`}>
              {STATUS_LABELS[funder.status] || funder.status}
            </Badge>
            <Badge className={LENS_COLORS[funder.communityLens] || LENS_COLORS.all} data-testid={`badge-lens-${funder.id}`}>
              {LENS_LABELS[funder.communityLens] || funder.communityLens}
            </Badge>
            {funder.reportingCadence && (
              <span className="text-xs text-muted-foreground">
                {CADENCE_LABELS[funder.reportingCadence] || funder.reportingCadence}
              </span>
            )}
            {funder.outcomeFocus && funder.outcomeFocus.length > 0 && funder.outcomeFocus.map(f => (
              <Badge key={f} variant="outline" className="text-xs" data-testid={`badge-outcome-${f}-${funder.id}`}>
                {OUTCOME_FOCUS_LABELS[f]?.label || f}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {funder.nextDeadline && (
            <div className={`text-xs text-right ${deadlineWarning ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              {deadlineWarning && <AlertCircle className="w-3 h-3 inline mr-1" />}
              {formatDistanceToNow(new Date(funder.nextDeadline), { addSuffix: true })}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-menu-${funder.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="w-4 h-4 mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onGenerateReport(); }}>
                <FileText className="w-4 h-4 mr-2" /> Generate Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

function FunderFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  title,
  defaultValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  title: string;
  defaultValues?: Partial<Funder>;
}) {
  const [form, setForm] = useState({
    name: defaultValues?.name || "",
    organisation: defaultValues?.organisation || "",
    contactPerson: defaultValues?.contactPerson || "",
    contactEmail: defaultValues?.contactEmail || "",
    contactPhone: defaultValues?.contactPhone || "",
    status: defaultValues?.status || "in_conversation",
    communityLens: defaultValues?.communityLens || "all",
    outcomesFramework: defaultValues?.outcomesFramework || "",
    outcomeFocus: defaultValues?.outcomeFocus || [],
    reportingGuidance: defaultValues?.reportingGuidance || "",
    reportingCadence: defaultValues?.reportingCadence || "quarterly",
    narrativeStyle: defaultValues?.narrativeStyle || "compliance",
    prioritySections: defaultValues?.prioritySections || [],
    funderTag: defaultValues?.funderTag || "",
    contractStart: defaultValues?.contractStart ? format(new Date(defaultValues.contractStart), "yyyy-MM-dd") : "",
    contractEnd: defaultValues?.contractEnd ? format(new Date(defaultValues.contractEnd), "yyyy-MM-dd") : "",
    nextDeadline: defaultValues?.nextDeadline ? format(new Date(defaultValues.nextDeadline), "yyyy-MM-dd") : "",
    reviewDate: defaultValues?.reviewDate ? format(new Date(defaultValues.reviewDate), "yyyy-MM-dd") : "",
    notes: defaultValues?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data: any = {
      name: form.name.trim(),
      organisation: form.organisation.trim() || null,
      contactPerson: form.contactPerson.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      status: form.status,
      communityLens: form.communityLens,
      outcomesFramework: form.outcomesFramework.trim() || null,
      outcomeFocus: form.outcomeFocus.length > 0 ? form.outcomeFocus : null,
      reportingGuidance: form.reportingGuidance.trim() || null,
      reportingCadence: form.reportingCadence,
      narrativeStyle: form.narrativeStyle,
      prioritySections: form.prioritySections.length > 0 ? form.prioritySections : null,
      funderTag: form.funderTag.trim() || null,
      contractStart: form.contractStart || null,
      contractEnd: form.contractEnd || null,
      nextDeadline: form.nextDeadline || null,
      reviewDate: form.reviewDate || null,
      notes: form.notes.trim() || null,
    };
    onSubmit(data);
  };

  const toggleOutcomeFocus = (focusId: string) => {
    setForm(prev => ({
      ...prev,
      outcomeFocus: prev.outcomeFocus.includes(focusId)
        ? prev.outcomeFocus.filter(f => f !== focusId)
        : [...prev.outcomeFocus, focusId],
    }));
  };

  const toggleSection = (sectionId: string) => {
    setForm(prev => ({
      ...prev,
      prioritySections: prev.prioritySections.includes(sectionId)
        ? prev.prioritySections.filter(s => s !== sectionId)
        : [...prev.prioritySections, sectionId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {defaultValues ? "Update funder details" : "Add a new funder to track relationships and reporting"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Funder Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Ngā Mātārae"
                data-testid="input-funder-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Input
                value={form.organisation}
                onChange={(e) => setForm(p => ({ ...p, organisation: e.target.value }))}
                placeholder="e.g. Auckland Council"
                data-testid="input-funder-org"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm(p => ({ ...p, contactPerson: e.target.value }))}
                data-testid="input-contact-person"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                data-testid="input-contact-phone"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNDER_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Community Lens</Label>
              <Select value={form.communityLens} onValueChange={(v) => setForm(p => ({ ...p, communityLens: v }))}>
                <SelectTrigger data-testid="select-community-lens">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_LENS_OPTIONS.map(l => (
                    <SelectItem key={l} value={l}>{LENS_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reporting Cadence</Label>
              <Select value={form.reportingCadence} onValueChange={(v) => setForm(p => ({ ...p, reportingCadence: v }))}>
                <SelectTrigger data-testid="select-cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORTING_CADENCES.map(c => (
                    <SelectItem key={c} value={c}>{CADENCE_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Narrative Style</Label>
              <Select value={form.narrativeStyle} onValueChange={(v) => setForm(p => ({ ...p, narrativeStyle: v }))}>
                <SelectTrigger data-testid="select-narrative-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NARRATIVE_STYLES.map(s => (
                    <SelectItem key={s} value={s}>{STYLE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Outcomes Framework</Label>
            <Textarea
              value={form.outcomesFramework}
              onChange={(e) => setForm(p => ({ ...p, outcomesFramework: e.target.value }))}
              placeholder="Describe the funder's outcomes framework, e.g. Tāmaki Ora 2025–2027 — focused on community wellbeing, economic participation, and cultural identity outcomes."
              rows={3}
              data-testid="input-outcomes-framework"
            />
          </div>

          <div className="space-y-2">
            <Label>Funder Tag</Label>
            <Input
              value={form.funderTag}
              onChange={(e) => setForm(p => ({ ...p, funderTag: e.target.value }))}
              placeholder="Tag used on events/programmes"
              data-testid="input-funder-tag"
            />
          </div>

          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-base font-semibold">Report Context</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Help the AI understand what this funder cares about when generating reports</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Outcome Focus</Label>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOME_FOCUS_OPTIONS.map(o => (
                  <label key={o} className="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md border bg-background hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={form.outcomeFocus.includes(o)}
                      onCheckedChange={() => toggleOutcomeFocus(o)}
                      data-testid={`checkbox-outcome-${o}`}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-medium">{OUTCOME_FOCUS_LABELS[o]?.label}</span>
                      <p className="text-xs text-muted-foreground">{OUTCOME_FOCUS_LABELS[o]?.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Reporting Guidance</Label>
              <Textarea
                value={form.reportingGuidance}
                onChange={(e) => setForm(p => ({ ...p, reportingGuidance: e.target.value }))}
                placeholder="Any specific guidance for AI when generating reports for this funder, e.g. 'Always emphasise community-led outcomes and whānau wellbeing. Use te reo Māori terms where appropriate.'"
                rows={3}
                data-testid="input-reporting-guidance"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Priority Report Sections</Label>
            <div className="grid grid-cols-3 gap-2">
              {REPORT_SECTIONS.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.prioritySections.includes(s.id)}
                    onCheckedChange={() => toggleSection(s.id)}
                    data-testid={`checkbox-section-${s.id}`}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contract Start</Label>
              <Input type="date" value={form.contractStart} onChange={(e) => setForm(p => ({ ...p, contractStart: e.target.value }))} data-testid="input-contract-start" />
            </div>
            <div className="space-y-2">
              <Label>Contract End</Label>
              <Input type="date" value={form.contractEnd} onChange={(e) => setForm(p => ({ ...p, contractEnd: e.target.value }))} data-testid="input-contract-end" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Next Reporting Deadline</Label>
              <Input type="date" value={form.nextDeadline} onChange={(e) => setForm(p => ({ ...p, nextDeadline: e.target.value }))} data-testid="input-next-deadline" />
            </div>
            <div className="space-y-2">
              <Label>Review/Renewal Date</Label>
              <Input type="date" value={form.reviewDate} onChange={(e) => setForm(p => ({ ...p, reviewDate: e.target.value }))} data-testid="input-review-date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Relationship history, preferences, things to remember..."
              rows={3}
              data-testid="input-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.name.trim()} data-testid="button-submit-funder">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {defaultValues ? "Save Changes" : "Create Funder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FunderDetailDialog({
  funder,
  onClose,
  onEdit,
  onDelete,
  onGenerateReport,
}: {
  funder: Funder;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGenerateReport: () => void;
}) {
  const { toast } = useToast();
  const [docFilter, setDocFilter] = useState("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ["/api/funders", funder.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funder.id}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/funders/${funder.id}/documents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funder.id, "documents"] });
      setShowUploadDialog(false);
      toast({ title: "Document uploaded" });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => apiRequest("DELETE", `/api/funder-documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funder.id, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const filteredDocs = docFilter === "all" ? documents : documents.filter((d: any) => d.documentType === docFilter);

  const handleFileUpload = (file: File, docType: string, notes: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] || reader.result;
      uploadMutation.mutate({
        fileName: file.name,
        documentType: docType,
        fileData: base64,
        fileSize: file.size,
        notes: notes || null,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (docId: number, fileName: string) => {
    try {
      const res = await fetch(`/api/funder-documents/${docId}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const data = await res.json();
      const byteString = atob(data.fileData);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const dates = [
    { label: "Contract Start", value: funder.contractStart },
    { label: "Contract End", value: funder.contractEnd },
    { label: "Next Deadline", value: funder.nextDeadline, warn: true },
    { label: "Review Date", value: funder.reviewDate },
  ].filter(d => d.value);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{funder.name}</DialogTitle>
              {funder.organisation && (
                <DialogDescription className="mt-1">{funder.organisation}</DialogDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-funder">
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button size="sm" onClick={onGenerateReport} data-testid="button-generate-report">
                <FileText className="w-4 h-4 mr-1" /> Generate Report
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Badge className={STATUS_COLORS[funder.status]}>{STATUS_LABELS[funder.status]}</Badge>
            <Badge className={LENS_COLORS[funder.communityLens]}>{LENS_LABELS[funder.communityLens]}</Badge>
            {funder.narrativeStyle && <Badge variant="outline">{STYLE_LABELS[funder.narrativeStyle] || funder.narrativeStyle}</Badge>}
            {funder.reportingCadence && <Badge variant="outline">{CADENCE_LABELS[funder.reportingCadence]}</Badge>}
          </div>

          {(funder.contactPerson || funder.contactEmail || funder.contactPhone) && (
            <Card className="p-4">
              <h3 className="font-medium mb-2 text-sm text-muted-foreground">Contact</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {funder.contactPerson && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{funder.contactPerson}</span>
                  </div>
                )}
                {funder.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${funder.contactEmail}`} className="text-primary hover:underline">{funder.contactEmail}</a>
                  </div>
                )}
                {funder.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{funder.contactPhone}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {funder.outcomesFramework && (
            <div className="text-sm">
              <span className="text-muted-foreground">Outcomes Framework: </span>
              <p className="mt-1 whitespace-pre-wrap">{funder.outcomesFramework}</p>
            </div>
          )}

          {funder.outcomeFocus && funder.outcomeFocus.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Outcome Focus: </span>
              <span className="flex gap-1 mt-1 flex-wrap">
                {funder.outcomeFocus.map(f => (
                  <Badge key={f} variant="outline" className="text-xs">
                    {OUTCOME_FOCUS_LABELS[f]?.label || f}
                  </Badge>
                ))}
              </span>
            </div>
          )}

          {funder.reportingGuidance && (
            <div className="text-sm">
              <span className="text-muted-foreground">Reporting Guidance: </span>
              <p className="mt-1 whitespace-pre-wrap">{funder.reportingGuidance}</p>
            </div>
          )}

          {funder.funderTag && (
            <div className="text-sm">
              <span className="text-muted-foreground">Funder Tag: </span>
              <Badge variant="outline">{funder.funderTag}</Badge>
            </div>
          )}

          {funder.prioritySections && funder.prioritySections.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Priority Sections: </span>
              <span className="flex gap-1 mt-1 flex-wrap">
                {funder.prioritySections.map(s => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {REPORT_SECTIONS.find(rs => rs.id === s)?.label || s}
                  </Badge>
                ))}
              </span>
            </div>
          )}

          {dates.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-3 text-sm text-muted-foreground">Key Dates</h3>
              <div className="grid grid-cols-2 gap-3">
                {dates.map(d => {
                  const date = new Date(d.value!);
                  const isOverdue = d.warn && isPast(date);
                  return (
                    <div key={d.label} className="flex items-center gap-2 text-sm">
                      <Calendar className={`w-4 h-4 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
                      <div>
                        <span className="text-muted-foreground">{d.label}: </span>
                        <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                          {format(date, "d MMM yyyy")}
                          {d.warn && (
                            <span className="text-xs ml-1">
                              ({formatDistanceToNow(date, { addSuffix: true })})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {funder.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Notes: </span>
              <p className="mt-1 whitespace-pre-wrap">{funder.notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Documents</h3>
              <Button size="sm" variant="outline" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-doc">
                <Upload className="w-4 h-4 mr-1" /> Upload
              </Button>
            </div>
            <div className="flex gap-1 mb-3 flex-wrap">
              <Button
                size="sm"
                variant={docFilter === "all" ? "default" : "ghost"}
                onClick={() => setDocFilter("all")}
                className="h-7 text-xs"
              >
                All ({documents.length})
              </Button>
              {FUNDER_DOCUMENT_TYPES.map(t => {
                const cnt = documents.filter((d: any) => d.documentType === t).length;
                if (cnt === 0) return null;
                return (
                  <Button
                    key={t}
                    size="sm"
                    variant={docFilter === t ? "default" : "ghost"}
                    onClick={() => setDocFilter(t)}
                    className="h-7 text-xs"
                  >
                    {DOC_TYPE_LABELS[t]} ({cnt})
                  </Button>
                );
              })}
            </div>
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : filteredDocs.length === 0 ? (
              <Card className="p-6 text-center">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc: any) => (
                  <Card key={doc.id} className="p-3 flex items-center justify-between" data-testid={`doc-${doc.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge className={`${DOC_TYPE_COLORS[doc.documentType] || DOC_TYPE_COLORS.other} text-xs`}>
                            {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                          </Badge>
                          {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                          <span>{format(new Date(doc.createdAt), "d MMM yyyy")}</span>
                        </div>
                        {doc.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{doc.notes}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDownload(doc.id, doc.fileName)}
                        data-testid={`button-download-${doc.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600"
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {showUploadDialog && (
          <UploadDocumentDialog
            open={showUploadDialog}
            onClose={() => setShowUploadDialog(false)}
            onUpload={handleFileUpload}
            isPending={uploadMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDocumentDialog({
  open,
  onClose,
  onUpload,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, docType: string, notes: string) => void;
  isPending: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("other");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription className="sr-only">Upload a document for this funder</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Click or drag a file here</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger data-testid="select-doc-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUNDER_DOCUMENT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Brief note about this document"
              data-testid="input-doc-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => file && onUpload(file, docType, notes)}
            disabled={!file || isPending}
            data-testid="button-confirm-upload"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}