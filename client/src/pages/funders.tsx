import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  FileText,
  Upload,
  Download,
  Building2,
  Phone,
  Mail,
  User,
  Eye,
  AlertCircle,
  Sparkles,
  Handshake,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  FUNDER_DOCUMENT_TYPES,
  type Funder,
} from "@shared/schema";
import { useGroups } from "@/hooks/use-groups";
import { useContacts as useContactsHook } from "@/hooks/use-contacts";
import { useLocation, Link } from "wouter";
import { Target, Radar, Archive, FolderOpen } from "lucide-react";

// Extracted components
import { FunderTaxonomySection } from "@/components/funders/taxonomy-section";
import { FunderClassificationsSection } from "@/components/funders/classifications-section";
import { FunderDeliverablesSection } from "@/components/funders/deliverables-section";
import { FunderCard, ActiveFunderCard, PipelineCard, RadarRow } from "@/components/funders/funder-cards";
import { FunderFormDialog } from "@/components/funders/funder-form";

// Re-export for consumers that import from this file
export { FunderTaxonomySection } from "@/components/funders/taxonomy-section";
export { FunderClassificationsSection } from "@/components/funders/classifications-section";
export { FunderDeliverablesSection } from "@/components/funders/deliverables-section";

const STATUS_COLORS: Record<string, string> = {
  active_funder: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  in_conversation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pending_eoi: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  applied: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  radar: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  active_funder: "Active",
  in_conversation: "In Conversation",
  pending_eoi: "Pending EOI",
  applied: "Applied",
  radar: "Radar",
  completed: "Completed",
};

const ACTIVE_STATUSES = ["active_funder"];
const PIPELINE_STATUSES = ["in_conversation", "pending_eoi", "applied"];
const RADAR_STATUSES = ["radar"];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
  return `$${amount}`;
}

const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  adhoc: "Ad Hoc",
  on_completion: "On Completion",
};

const STYLE_LABELS: Record<string, string> = {
  compliance: "Compliance (stats-first)",
  story: "Story (narrative-first)",
  partnership: "Partnership (relationship-first)",
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
  const [activeTab, setActiveTab] = useState<"active" | "pipeline" | "archive">("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<string | undefined>();
  const [editingFunder, setEditingFunder] = useState<Funder | null>(null);
  const [viewingFunder, setViewingFunder] = useState<Funder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: fundersList = [], isLoading } = useQuery<Funder[]>({
    queryKey: ["/api/funders"],
  });

  const active = useMemo(() => fundersList.filter(f => ACTIVE_STATUSES.includes(f.status)), [fundersList]);
  const pipeline = useMemo(() => {
    const items = fundersList.filter(f => PIPELINE_STATUSES.includes(f.status));
    return items.sort((a, b) => {
      if (a.applicationDeadline && b.applicationDeadline) return new Date(a.applicationDeadline).getTime() - new Date(b.applicationDeadline).getTime();
      if (a.applicationDeadline) return -1;
      if (b.applicationDeadline) return 1;
      return 0;
    });
  }, [fundersList]);
  const radar = useMemo(() => fundersList.filter(f => RADAR_STATUSES.includes(f.status)), [fundersList]);
  const completed = useMemo(() => fundersList.filter(f => f.status === "completed"), [fundersList]);

  const activeValue = useMemo(() => active.reduce((s, f) => s + (f.estimatedValue || 0), 0), [active]);
  const pipelineValue = useMemo(() => pipeline.reduce((s, f) => s + (f.estimatedValue || 0), 0), [pipeline]);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
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
      setCreateDefaultStatus(undefined);
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

  const handleAdd = (defaultStatus?: string) => {
    setCreateDefaultStatus(defaultStatus);
    setShowCreateDialog(true);
  };

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
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Funding</h1>
          <p className="text-sm text-muted-foreground mt-1">Active agreements, pipeline, and opportunities</p>
        </div>
        <Button onClick={() => handleAdd()} data-testid="button-create-funder">
          <Plus className="w-4 h-4 mr-2" /> Add
        </Button>
      </div>

      {/* Summary strip */}
      <div className="flex gap-4 flex-wrap">
        {activeValue > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Active:</span>
            <span className="font-medium">{formatCurrency(activeValue)}/yr</span>
          </div>
        )}
        {pipelineValue > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Pipeline:</span>
            <span className="font-medium">{formatCurrency(pipelineValue)}</span>
          </div>
        )}
        {radar.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-muted-foreground">Radar:</span>
            <span className="font-medium">{radar.length} opportunities</span>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="border-b">
        <div className="flex gap-0">
          {([
            { key: "active", label: "Active", icon: Handshake, count: active.length },
            { key: "pipeline", label: "Pipeline", icon: Target, count: pipeline.length + radar.length },
            { key: "archive", label: "Archive", icon: Archive, count: completed.length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {"count" in tab && tab.count > 0 && (
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search — show on Active, Pipeline, Archive tabs */}
      {(
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search all funders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-funders"
          />
        </div>
      )}

      {/* Search results — override tab content when searching */}
      {filtered ? (
        <div>
          <p className="text-sm text-muted-foreground mb-3">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-3">
            {filtered.map((funder) => (
              <FunderCard key={funder.id} funder={funder} onView={() => setViewingFunder(funder)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} onGenerateReport={() => setLocation(`/funders/${funder.id}?tab=reports`)} />
            ))}
          </div>
        </div>
      ) : fundersList.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold mb-1">No funders yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Track active funding, pipeline opportunities, and prospects</p>
          <Button onClick={() => handleAdd()}>
            <Plus className="w-4 h-4 mr-2" /> Add Funder
          </Button>
        </Card>
      ) : (
        <>
        {/* ═══════════ ACTIVE TAB ═══════════ */}
        {activeTab === "active" && (
          <div className="space-y-8">
            {active.filter(f => (f as any).fundType !== "project").length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Managing</h2>
                <div className="grid gap-3">
                  {active.filter(f => (f as any).fundType !== "project").map((funder) => (
                    <ActiveFunderCard key={funder.id} funder={funder} onView={() => setLocation(`/funders/${funder.id}`)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} onGenerateReport={() => setLocation(`/funders/${funder.id}?tab=reports`)} />
                  ))}
                </div>
              </div>
            )}

            {active.filter(f => (f as any).fundType === "project").length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Projects</h2>
                <div className="grid gap-3">
                  {active.filter(f => (f as any).fundType === "project").map((funder) => (
                    <Card key={funder.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer border" onClick={() => setViewingFunder(funder)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
                            {funder.estimatedValue && (
                              <span className="text-sm font-medium text-green-700 dark:text-green-400">{formatCurrency(funder.estimatedValue)}</span>
                            )}
                            <Badge variant="outline" className="text-[10px]">Project</Badge>
                          </div>
                          {funder.organisation && (
                            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
                          )}
                          {funder.nextAction && (
                            <p className="text-xs text-muted-foreground mt-1">{funder.nextAction}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingFunder(funder); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteConfirm(funder.id); }} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {active.length === 0 && (
              <Card className="p-8 text-center border-dashed">
                <Handshake className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No active agreements</p>
              </Card>
            )}
          </div>
        )}

        {/* ═══════════ PIPELINE TAB ═══════════ */}
        {activeTab === "pipeline" && (
          <div className="space-y-8">
            {pipeline.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pursuing</h2>
                <div className="grid gap-3">
                  {pipeline.map((funder) => (
                    <PipelineCard key={funder.id} funder={funder} onView={() => setLocation(`/funders/${funder.id}`)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} />
                  ))}
                </div>
              </div>
            )}

            {radar.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Radar</h2>
                <div className="space-y-2">
                  {radar.map((funder) => (
                    <RadarRow key={funder.id} funder={funder} onView={() => setLocation(`/funders/${funder.id}`)} onMoveToPipeline={() => updateMutation.mutate({ id: funder.id, data: { status: "in_conversation" } })} onDelete={() => setDeleteConfirm(funder.id)} />
                  ))}
                </div>
              </div>
            )}

            {pipeline.length === 0 && radar.length === 0 && (
              <Card className="p-8 text-center border-dashed">
                <Target className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No funders in the pipeline</p>
              </Card>
            )}

            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleAdd("radar")}>
              <Plus className="w-4 h-4 mr-1" /> Add Opportunity
            </Button>
          </div>
        )}

        {/* ═══════════ ARCHIVE TAB ═══════════ */}
        {activeTab === "archive" && (
          <div className="space-y-4">
            {completed.length > 0 ? (
              <div className="grid gap-3">
                {completed.map((funder) => (
                  <FunderCard key={funder.id} funder={funder} onView={() => setLocation(`/funders/${funder.id}`)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} onGenerateReport={() => setLocation(`/funders/${funder.id}?tab=reports`)} />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center border-dashed">
                <Archive className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No completed agreements</p>
              </Card>
            )}
          </div>
        )}
        </>
      )}

      <FunderFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="Add Funder"
        defaultValues={createDefaultStatus ? { status: createDefaultStatus } as Partial<Funder> : undefined}
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
          onEditWithData={(enrichedData) => {
            setEditingFunder({ ...viewingFunder, ...enrichedData } as Funder);
            setViewingFunder(null);
          }}
          onDelete={() => { setDeleteConfirm(viewingFunder.id); }}
          onGenerateReport={() => setLocation(`/funders/${viewingFunder.id}?tab=reports`)}
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

function FunderDetailDialog({
  funder,
  onClose,
  onEdit,
  onEditWithData,
  onDelete,
  onGenerateReport,
}: {
  funder: Funder;
  onClose: () => void;
  onEdit: () => void;
  onEditWithData: (enrichedData: Partial<Funder>) => void;
  onDelete: () => void;
  onGenerateReport: () => void;
}) {
  const { toast } = useToast();
  const [docFilter, setDocFilter] = useState("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const { data: detailGroups } = useGroups();
  const { data: detailContacts } = useContactsHook();
  const linkedGroupName = detailGroups && funder.groupId ? (detailGroups as any[]).find((g: any) => g.id === funder.groupId)?.name : null;
  const getDetailContactName = (id: number | null | undefined) => {
    if (!id || !detailContacts) return null;
    return (detailContacts as any[]).find((c: any) => c.id === id)?.name || null;
  };

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

  const handleEnrichment = async () => {
    setIsEnriching(true);
    try {
      const response = await apiRequest("POST", `/api/funders/${funder.id}/ai-generate`);
      const result = await response.json();
      toast({ title: "Enrichment complete", description: "Review the generated profile fields and save when ready." });
      setIsEnriching(false);
      onEditWithData({
        outcomesFramework: result.outcomesFramework || funder.outcomesFramework,
        outcomeFocus: result.outcomeFocus || funder.outcomeFocus,
        reportingGuidance: result.reportingGuidance || funder.reportingGuidance,
        narrativeStyle: result.narrativeStyle || funder.narrativeStyle,
        prioritySections: Array.isArray(result.prioritySections) ? result.prioritySections : funder.prioritySections,
        partnershipStrategy: result.partnershipStrategy || funder.partnershipStrategy,
      } as Partial<Funder>);
    } catch (err: any) {
      toast({ title: "Enrichment failed", description: err.message || "Could not generate profile", variant: "destructive" });
      setIsEnriching(false);
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
            {funder.narrativeStyle && <Badge variant="outline">{STYLE_LABELS[funder.narrativeStyle] || funder.narrativeStyle}</Badge>}
            {funder.reportingCadence && <Badge variant="outline">{CADENCE_LABELS[funder.reportingCadence]}</Badge>}
          </div>

          {(linkedGroupName || funder.headContactId || funder.liaisonContactId || funder.leadContactId) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {linkedGroupName && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  <Link href={`/community/groups`} className="text-primary hover:underline">{linkedGroupName}</Link>
                </span>
              )}
              {funder.headContactId && getDetailContactName(funder.headContactId) && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  Head: <Link href={`/contacts/${funder.headContactId}`} className="text-primary hover:underline">{getDetailContactName(funder.headContactId)}</Link>
                </span>
              )}
              {funder.liaisonContactId && getDetailContactName(funder.liaisonContactId) && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  Liaison: <Link href={`/contacts/${funder.liaisonContactId}`} className="text-primary hover:underline">{getDetailContactName(funder.liaisonContactId)}</Link>
                </span>
              )}
              {funder.leadContactId && getDetailContactName(funder.leadContactId) && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  Lead: <Link href={`/contacts/${funder.leadContactId}`} className="text-primary hover:underline">{getDetailContactName(funder.leadContactId)}</Link>
                </span>
              )}
            </div>
          )}

          <FunderDeliverablesSection funderId={funder.id} />

          <FunderTaxonomySection funderId={funder.id} />

          <FunderClassificationsSection funderId={funder.id} />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium" data-testid="text-documents-heading">Documents</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Upload funder documents (framework, contract, profile) for reference</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-doc">
                <Upload className="w-4 h-4 mr-1" /> Upload
              </Button>
            </div>
            {documents.length > 0 && (
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
            )}
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : filteredDocs.length === 0 ? (
              <Card className="p-6 text-center border-dashed">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload funder documents for easy access and reference</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-doc-empty">
                  <Upload className="w-4 h-4 mr-1" /> Upload Document
                </Button>
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

          <Card className="p-4" data-testid="card-enrichment">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-medium">AI Profile</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {documents.length > 0
                    ? `Uses Claude Code context + ${documents.length} document${documents.length === 1 ? "" : "s"} to generate profile`
                    : "Uses Claude Code's knowledge of this funder to auto-generate profile fields"}
                </p>
              </div>
              <Button
                onClick={handleEnrichment}
                disabled={isEnriching}
                className="gap-1.5 shrink-0"
                data-testid="button-funder-enrichment"
              >
                {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isEnriching ? "Generating..." : "Generate Profile"}
              </Button>
            </div>
          </Card>

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

          {funder.outcomeFocus && (
            <div className="text-sm">
              <span className="text-muted-foreground">Outcome Focus: </span>
              {Array.isArray(funder.outcomeFocus) ? (
                <span className="flex gap-1 mt-1 flex-wrap">
                  {funder.outcomeFocus.map(f => (
                    <Badge key={f} variant="outline" className="text-xs">
                      {OUTCOME_FOCUS_LABELS[f]?.label || f}
                    </Badge>
                  ))}
                </span>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{funder.outcomeFocus}</p>
              )}
            </div>
          )}

          {funder.reportingGuidance && (
            <div className="text-sm">
              <span className="text-muted-foreground">Reporting Guidance: </span>
              <p className="mt-1 whitespace-pre-wrap">{funder.reportingGuidance}</p>
            </div>
          )}

          {funder.partnershipStrategy && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Handshake className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium text-sm text-muted-foreground">Partnership Strategy</h3>
              </div>
              <p className="text-sm whitespace-pre-wrap">{funder.partnershipStrategy}</p>
            </Card>
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
