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
  Sparkles,
  Handshake,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radar,
  ArrowRight,
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
  FUNDER_STATUSES,
  REPORTING_CADENCES,
  NARRATIVE_STYLES,
  FUNDER_DOCUMENT_TYPES,
  DELIVERABLE_METRIC_TYPES,
  DELIVERABLE_UNITS,
  BOOKING_CLASSIFICATIONS,
  GROUP_TYPES,
  RELATIONSHIP_STAGES,
  type Funder,
  type FunderDocument,
  type FunderDeliverable,
} from "@shared/schema";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { useLocation } from "wouter";

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

const FIT_TAG_COLORS: Record<string, string> = {
  maori: "bg-orange-100 text-orange-700",
  youth: "bg-pink-100 text-pink-700",
  enterprise: "bg-blue-100 text-blue-700",
  arts: "bg-purple-100 text-purple-700",
  placemaking: "bg-teal-100 text-teal-700",
  community: "bg-green-100 text-green-700",
  pasifika: "bg-cyan-100 text-cyan-700",
  innovation: "bg-indigo-100 text-indigo-700",
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

const METRIC_TYPE_LABELS: Record<string, string> = {
  activations: "Activations",
  programmes: "Programmes",
  mentoring: "Mentoring Sessions",
  contacts: "Contacts",
  groups: "Groups/Businesses",
  events: "Events",
  bookings: "Bookings",
  foot_traffic: "Foot Traffic",
  revenue: "Revenue",
  custom: "Custom",
};

const PULSE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  exceeded: { label: "Exceeded", color: "text-green-600", icon: TrendingUp },
  on_track: { label: "On Track", color: "text-green-600", icon: CheckCircle2 },
  needs_attention: { label: "Needs Attention", color: "text-yellow-600", icon: AlertTriangle },
  at_risk: { label: "At Risk", color: "text-red-600", icon: XCircle },
  no_target: { label: "No Target", color: "text-gray-400", icon: Target },
};

interface PulseResult {
  deliverableId: number;
  name: string;
  description: string | null;
  metricType: string;
  unit: string;
  actual: number;
  targetAnnual: number | null;
  targetTotal: number | null;
  proRataTarget: number | null;
  status: string;
  percentOfTarget: number | null;
}

// === FUNDER TAXONOMY LENS ===

interface FunderTaxCategory {
  id: number;
  funderId: number;
  name: string;
  description: string | null;
  color: string | null;
  keywords: string[] | null;
  rules: Record<string, any> | null;
  sortOrder: number | null;
  active: boolean | null;
}

interface FunderTaxMapping {
  id: number;
  funderCategoryId: number;
  genericTaxonomyId: number;
  confidenceModifier: number | null;
}

function FunderTaxonomySection({ funderId }: { funderId: number }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCat, setEditingCat] = useState<FunderTaxCategory | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [newKeywords, setNewKeywords] = useState("");
  const [isReclassifying, setIsReclassifying] = useState(false);

  const { data: categories = [], isLoading } = useQuery<FunderTaxCategory[]>({
    queryKey: ["/api/funders", funderId, "taxonomy"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/taxonomy`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load taxonomy");
      return res.json();
    },
  });

  const { data: mappings = [] } = useQuery<FunderTaxMapping[]>({
    queryKey: ["/api/funders", funderId, "taxonomy-mappings"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/taxonomy-mappings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load mappings");
      return res.json();
    },
  });

  const { data: genericTaxonomy = [] } = useQuery<any[]>({
    queryKey: ["/api/taxonomy"],
    queryFn: async () => {
      const res = await fetch("/api/taxonomy", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load taxonomy");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/funders/${funderId}/taxonomy`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy"] });
      setShowAdd(false);
      setNewName("");
      setNewDescription("");
      setNewKeywords("");
      toast({ title: "Category created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/funders/${funderId}/taxonomy/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy"] });
      setEditingCat(null);
      toast({ title: "Category updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/funders/${funderId}/taxonomy/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy-mappings"] });
      toast({ title: "Category deleted" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createMappingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/funders/${funderId}/taxonomy-mappings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy-mappings"] });
      toast({ title: "Mapping added" });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/funders/${funderId}/taxonomy-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy-mappings"] });
    },
  });

  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      const res = await fetch(`/api/funders/${funderId}/reclassify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      toast({ title: "Reclassification complete", description: `${result.processed} processed, ${result.classified} classified` });
    } catch (e: any) {
      toast({ title: "Reclassification failed", description: e.message, variant: "destructive" });
    } finally {
      setIsReclassifying(false);
    }
  };

  const COLORS: Record<string, string> = {
    purple: "bg-purple-100 text-purple-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    pink: "bg-pink-100 text-pink-800",
    teal: "bg-teal-100 text-teal-800",
    orange: "bg-orange-100 text-orange-800",
    cyan: "bg-cyan-100 text-cyan-800",
    indigo: "bg-indigo-100 text-indigo-800",
  };

  const getMappingsForCategory = (catId: number) =>
    mappings.filter((m) => m.funderCategoryId === catId);

  const getGenericName = (taxonomyId: number) =>
    genericTaxonomy.find((t: any) => t.id === taxonomyId)?.name || `#${taxonomyId}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium">Taxonomy Lens</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            How this funder sees impact — auto-classifies tracked data through their lens
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReclassify}
            disabled={isReclassifying || categories.length === 0}
          >
            {isReclassifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Reclassify
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : categories.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <Target className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No taxonomy categories set up for this funder</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add categories to define how this funder sees your impact, or seed defaults
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Category
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const catMappings = getMappingsForCategory(cat.id);
            return (
              <Card key={cat.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={COLORS[cat.color || "blue"] || COLORS.blue}>
                        {cat.name}
                      </Badge>
                      {!cat.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                    )}
                    {(cat.keywords?.length ?? 0) > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(cat.keywords || []).slice(0, 5).map((kw) => (
                          <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{kw}</span>
                        ))}
                        {(cat.keywords?.length ?? 0) > 5 && (
                          <span className="text-[10px] text-muted-foreground">+{(cat.keywords?.length ?? 0) - 5} more</span>
                        )}
                      </div>
                    )}
                    {catMappings.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
                        <span className="text-[10px] text-muted-foreground">Inherits:</span>
                        {catMappings.map((m) => (
                          <span key={m.id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-red-50 hover:text-red-700"
                            onClick={() => deleteMappingMutation.mutate(m.id)}
                            title="Click to remove mapping"
                          >
                            {getGenericName(m.genericTaxonomyId)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingCat(cat);
                        setNewName(cat.name);
                        setNewDescription(cat.description || "");
                        setNewColor(cat.color || "blue");
                        setNewKeywords((cat.keywords || []).join(", "));
                      }}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: cat.id, active: !cat.active })}>
                        {cat.active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      {genericTaxonomy.filter((g: any) => !catMappings.some((m) => m.genericTaxonomyId === g.id)).length > 0 && (
                        <DropdownMenuItem onClick={() => {
                          const unmapped = genericTaxonomy.filter((g: any) => !catMappings.some((m) => m.genericTaxonomyId === g.id));
                          if (unmapped.length > 0) {
                            // Add first unmapped as a quick action; for full control, use edit
                            const name = prompt(`Map from generic category:\n${unmapped.map((g: any) => g.name).join("\n")}\n\nType category name:`);
                            const match = unmapped.find((g: any) => g.name.toLowerCase() === (name || "").toLowerCase());
                            if (match) {
                              createMappingMutation.mutate({ funderCategoryId: cat.id, genericTaxonomyId: match.id });
                            }
                          }
                        }}>
                          <ArrowRight className="w-4 h-4 mr-2" /> Add Mapping
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showAdd || !!editingCat} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditingCat(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "Add Taxonomy Category"}</DialogTitle>
            <DialogDescription>
              Define how this funder sees a specific type of impact
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Inclusive Economic Growth" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="What this category means to the funder" rows={2} />
            </div>
            <div>
              <Label>Color</Label>
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(COLORS).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Keywords (comma-separated)</Label>
              <Textarea value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="enterprise, revenue, first sale, business growth" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingCat(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
                if (editingCat) {
                  updateMutation.mutate({ id: editingCat.id, name: newName, description: newDescription, color: newColor, keywords });
                } else {
                  createMutation.mutate({ name: newName, description: newDescription, color: newColor, keywords });
                }
              }}
              disabled={!newName.trim()}
            >
              {editingCat ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const COLOR_BG: Record<string, string> = {
  purple: "bg-purple-500", blue: "bg-blue-500", green: "bg-green-500",
  amber: "bg-amber-500", red: "bg-red-500", pink: "bg-pink-500",
  teal: "bg-teal-500", orange: "bg-orange-500", cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
};

const ENTITY_ICONS: Record<string, string> = {
  debrief: "Debrief", booking: "Booking", programme: "Programme", event: "Event",
};

function FunderClassificationsSection({ funderId }: { funderId: number }) {
  const now = new Date();
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(monthEnd);
  const [entityFilter, setEntityFilter] = useState("all");

  const params = new URLSearchParams({ startDate, endDate });
  if (entityFilter !== "all") params.set("entityType", entityFilter);

  const { data: classifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/funders", funderId, "classifications", startDate, endDate, entityFilter],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/classifications?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load classifications");
      return res.json();
    },
  });

  // Group by category
  const byCategory = useMemo(() => {
    const map = new Map<string, { color: string | null; items: any[] }>();
    for (const c of classifications) {
      const key = c.categoryName || "Uncategorised";
      if (!map.has(key)) map.set(key, { color: c.categoryColor, items: [] });
      map.get(key)!.items.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].items.length - a[1].items.length);
  }, [classifications]);

  const confLabel = (c: number) => c >= 80 ? "High" : c >= 50 ? "Med" : "Low";
  const confColor = (c: number) => c >= 80 ? "bg-green-100 text-green-800" : c >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";

  return (
    <div>
      <h3 className="font-medium mb-2" data-testid="text-classifications-heading">Classifications</h3>
      <p className="text-xs text-muted-foreground mb-3">What got classified through this funder's taxonomy lens</p>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-xs" data-testid="input-class-start" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-xs" data-testid="input-class-end" />
        <div className="flex gap-1">
          {["all", "debrief", "booking", "programme", "event"].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={entityFilter === t ? "default" : "ghost"}
              onClick={() => setEntityFilter(t)}
              className="text-xs h-7 px-2"
              data-testid={`button-filter-${t}`}
            >
              {t === "all" ? "All" : ENTITY_ICONS[t] || t}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-muted-foreground text-sm">Loading...</div>
      ) : classifications.length === 0 ? (
        <div className="py-4 text-center text-muted-foreground text-sm" data-testid="text-no-classifications">
          No classifications for this period
        </div>
      ) : (
        <div className="space-y-2">
          {byCategory.map(([catName, { color, items }]) => (
            <details key={catName} className="border border-border rounded-lg" data-testid={`details-category-${catName}`}>
              <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50">
                <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_BG[color || "purple"] || "bg-purple-500"}`} />
                <span className="font-medium text-sm flex-1">{catName}</span>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </summary>
              <div className="px-3 pb-3 space-y-1">
                {items.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 text-sm border-t border-border/50">
                    <Badge variant="outline" className="text-[10px] shrink-0">{ENTITY_ICONS[c.entityType] || c.entityType}</Badge>
                    <span className="flex-1 truncate">{c.entityTitle}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {c.entityDate ? format(new Date(c.entityDate), "d MMM") : ""}
                    </span>
                    <Badge className={`text-[10px] ${confColor(c.confidence)}`}>{confLabel(c.confidence)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function FunderDeliverablesSection({ funderId }: { funderId: number }) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: deliverables = [], isLoading } = useQuery<FunderDeliverable[]>({
    queryKey: ["/api/funders", funderId, "deliverables"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/deliverables`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: pulse } = useQuery<{ deliverables: PulseResult[]; summary: { overall: string } }>({
    queryKey: ["/api/funders", funderId, "pulse"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/pulse`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: deliverables.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/funders/${funderId}/deliverables`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "pulse"] });
      setShowAddForm(false);
      toast({ title: "Deliverable added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/funder-deliverables/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "pulse"] });
      setEditingId(null);
      toast({ title: "Deliverable updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/funder-deliverables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "pulse"] });
      toast({ title: "Deliverable removed" });
    },
  });

  const pulseByDeliverable = useMemo(() => {
    const map = new Map<number, PulseResult>();
    if (pulse?.deliverables) {
      for (const p of pulse.deliverables) map.set(p.deliverableId, p);
    }
    return map;
  }, [pulse]);

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Deliverables</h3>
          {pulse?.summary && (
            <Badge className={`text-xs ${
              pulse.summary.overall === "on_track" ? "bg-green-100 text-green-700" :
              pulse.summary.overall === "needs_attention" ? "bg-yellow-100 text-yellow-700" :
              pulse.summary.overall === "at_risk" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
            }`}>
              {PULSE_STATUS_CONFIG[pulse.summary.overall]?.label || pulse.summary.overall}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} data-testid="button-add-deliverable">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {deliverables.length === 0 && !showAddForm ? (
        <Card className="p-6 text-center border-dashed">
          <Target className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No deliverables defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add what this funder expects you to deliver</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Deliverable
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {deliverables.map(d => {
            const p = pulseByDeliverable.get(d.id);
            const statusConf = p ? PULSE_STATUS_CONFIG[p.status] : null;
            const StatusIcon = statusConf?.icon || Target;

            if (editingId === d.id) {
              return (
                <DeliverableForm
                  key={d.id}
                  initial={d}
                  onSubmit={(data) => updateMutation.mutate({ id: d.id, data })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              );
            }

            return (
              <Card key={d.id} className="p-3" data-testid={`deliverable-${d.id}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{d.name}</span>
                      <Badge variant="outline" className="text-xs">{METRIC_TYPE_LABELS[d.metricType] || d.metricType}</Badge>
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>}
                    {p && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="font-medium">{p.actual} {d.unit !== "count" ? d.unit : ""}</span>
                        {p.proRataTarget != null && (
                          <span className="text-muted-foreground">/ {p.proRataTarget} target</span>
                        )}
                        {p.percentOfTarget != null && (
                          <span className={statusConf?.color || ""}>{p.percentOfTarget}%</span>
                        )}
                        <span className={`flex items-center gap-1 ${statusConf?.color || ""}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConf?.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingId(d.id)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => deleteMutation.mutate(d.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <DeliverableForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  );
}

const EVENT_TYPES = ["Meeting", "Mentoring Session", "External Event", "Personal Development", "Planning", "Programme", "Catch Up", "Content"] as const;
const ETHNICITY_OPTIONS = ["Māori", "Pasifika", "NZ European", "Asian", "Other"] as const;
const SESSION_STATUSES = ["completed", "confirmed", "cancelled", "no-show"] as const;
const PROGRAMME_STATUSES = ["draft", "active", "completed", "cancelled"] as const;

function MultiSelectField({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 relative">
        <div
          className="flex flex-wrap gap-1 min-h-[36px] items-center border rounded-md px-2 py-1.5 cursor-pointer text-sm"
          onClick={() => setOpen(!open)}
        >
          {selected.length === 0 && <span className="text-muted-foreground text-xs">Any</span>}
          {selected.map(v => (
            <Badge key={v} variant="secondary" className="text-xs gap-1">
              {v}
              <X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); onChange(selected.filter(s => s !== v)); }} />
            </Badge>
          ))}
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
            {options.map(opt => (
              <div
                key={opt}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer text-sm"
                onClick={() => {
                  onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
                }}
              >
                <Checkbox checked={selected.includes(opt)} />
                <span>{opt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaxonomySelectField({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (val: number[]) => void;
}) {
  const { data: categories } = useTaxonomy();
  const [open, setOpen] = useState(false);
  if (!categories?.length) return null;

  return (
    <div>
      <Label className="text-xs">Taxonomy Tags</Label>
      <div className="mt-1 relative">
        <div
          className="flex flex-wrap gap-1 min-h-[36px] items-center border rounded-md px-2 py-1.5 cursor-pointer text-sm"
          onClick={() => setOpen(!open)}
        >
          {selected.length === 0 && <span className="text-muted-foreground text-xs">Any</span>}
          {selected.map(id => {
            const cat = categories.find((c: any) => c.id === id);
            return (
              <Badge key={id} variant="secondary" className="text-xs gap-1" style={cat?.color ? { backgroundColor: `${cat.color}20`, color: cat.color } : {}}>
                {cat?.name || id}
                <X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); onChange(selected.filter(s => s !== id)); }} />
              </Badge>
            );
          })}
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
            {categories.map((cat: any) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer text-sm"
                onClick={() => {
                  onChange(selected.includes(cat.id) ? selected.filter((s: number) => s !== cat.id) : [...selected, cat.id]);
                }}
              >
                <Checkbox checked={selected.includes(cat.id)} />
                <span className="flex items-center gap-1.5">
                  {cat.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />}
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBuilder({
  metricType,
  filter,
  onChange,
}: {
  metricType: string;
  filter: Record<string, any>;
  onChange: (filter: Record<string, any>) => void;
}) {
  const set = (key: string, val: any) => {
    const next = { ...filter };
    if (val === false || val === "" || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
      delete next[key];
    } else {
      next[key] = val;
    }
    onChange(next);
  };

  switch (metricType) {
    case "activations":
      return (
        <div className="space-y-2">
          <MultiSelectField label="Event Types (include)" options={EVENT_TYPES} selected={filter.eventTypes || []} onChange={v => set("eventTypes", v)} />
          <MultiSelectField label="Event Types (exclude)" options={EVENT_TYPES} selected={filter.excludeTypes || []} onChange={v => set("excludeTypes", v)} />
          <MultiSelectField label="Booking Classifications" options={BOOKING_CLASSIFICATIONS} selected={filter.classifications || []} onChange={v => set("classifications", v)} />
          <TaxonomySelectField selected={filter.taxonomyIds || []} onChange={v => set("taxonomyIds", v)} />
        </div>
      );

    case "events":
      return (
        <div className="space-y-2">
          <MultiSelectField label="Event Types (include)" options={EVENT_TYPES} selected={filter.eventTypes || []} onChange={v => set("eventTypes", v)} />
          <MultiSelectField label="Event Types (exclude)" options={EVENT_TYPES} selected={filter.excludeTypes || []} onChange={v => set("excludeTypes", v)} />
          <TaxonomySelectField selected={filter.taxonomyIds || []} onChange={v => set("taxonomyIds", v)} />
        </div>
      );

    case "programmes":
      return (
        <div className="space-y-2">
          <MultiSelectField label="Classifications" options={BOOKING_CLASSIFICATIONS} selected={filter.classifications || []} onChange={v => set("classifications", v)} />
          <div>
            <Label className="text-xs">Programme Status</Label>
            <Select value={filter.programmeStatus || ""} onValueChange={v => set("programmeStatus", v || null)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {PROGRAMME_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "mentoring":
      return (
        <div>
          <Label className="text-xs">Session Status</Label>
          <Select value={filter.sessionStatus || ""} onValueChange={v => set("sessionStatus", v || null)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Completed + Confirmed" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Completed + Confirmed (default)</SelectItem>
              {SESSION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );

    case "contacts":
      return (
        <div className="space-y-2">
          <MultiSelectField label="Ethnicity" options={ETHNICITY_OPTIONS} selected={filter.ethnicity || []} onChange={v => set("ethnicity", v)} />
          <div>
            <Label className="text-xs">Stage</Label>
            <Select value={filter.stage || ""} onValueChange={v => set("stage", v || null)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {RELATIONSHIP_STAGES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!filter.isRangatahi} onCheckedChange={v => set("isRangatahi", v)} />
              Rangatahi
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!filter.isInnovator} onCheckedChange={v => set("isInnovator", v)} />
              Innovator
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!filter.isCommunityMember} onCheckedChange={v => set("isCommunityMember", v)} />
              Community Member
            </label>
          </div>
          <TaxonomySelectField selected={filter.taxonomyIds || []} onChange={v => set("taxonomyIds", v)} />
        </div>
      );

    case "groups":
      return (
        <div className="space-y-2">
          <MultiSelectField label="Group Type" options={GROUP_TYPES} selected={filter.groupType || []} onChange={v => set("groupType", v)} />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!filter.isMaori} onCheckedChange={v => set("isMaori", v)} />
              Māori
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!filter.isPasifika} onCheckedChange={v => set("isPasifika", v)} />
              Pasifika
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!filter.createdInPeriod} onCheckedChange={v => set("createdInPeriod", v)} />
              Created in period only
            </label>
          </div>
          <TaxonomySelectField selected={filter.taxonomyIds || []} onChange={v => set("taxonomyIds", v)} />
        </div>
      );

    case "bookings":
      return (
        <div className="space-y-2">
          <MultiSelectField label="Classifications" options={BOOKING_CLASSIFICATIONS} selected={filter.classifications || []} onChange={v => set("classifications", v)} />
        </div>
      );

    case "foot_traffic":
    case "revenue":
    case "custom":
      return <p className="text-xs text-muted-foreground italic">No filters for this metric type</p>;

    default:
      return null;
  }
}

function DeliverableForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: FunderDeliverable;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [metricType, setMetricType] = useState(initial?.metricType || "activations");
  const [targetAnnual, setTargetAnnual] = useState(initial?.targetAnnual?.toString() || "");
  const [unit, setUnit] = useState(initial?.unit || "count");
  const [filter, setFilter] = useState<Record<string, any>>(
    (initial?.filter as Record<string, any>) || {}
  );

  const handleSubmit = () => {
    onSubmit({
      name,
      description: description || null,
      metricType,
      filter,
      targetAnnual: targetAnnual ? parseInt(targetAnnual) : null,
      unit,
      sortOrder: initial?.sortOrder ?? 0,
      isActive: true,
    });
  };

  return (
    <Card className="p-4 mt-2 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Programmes delivered" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Metric Type</Label>
          <Select value={metricType} onValueChange={v => { setMetricType(v); setFilter({}); }}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DELIVERABLE_METRIC_TYPES.map(t => (
                <SelectItem key={t} value={t}>{METRIC_TYPE_LABELS[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this measures" className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Annual Target</Label>
          <Input type="number" value={targetAnnual} onChange={e => setTargetAnnual(e.target.value)} placeholder="e.g. 50" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DELIVERABLE_UNITS.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Filter Rules</Label>
        <FilterBuilder metricType={metricType} filter={filter} onChange={setFilter} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!name || isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {initial ? "Update" : "Add"}
        </Button>
      </div>
    </Card>
  );
}

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

  // Group by organisation for the unified view
  const STATUS_PRIORITY: Record<string, number> = { active_funder: 0, in_conversation: 1, pending_eoi: 2, applied: 3, radar: 4, completed: 5 };
  const groupedByOrg = useMemo(() => {
    const groups: Record<string, Funder[]> = {};
    for (const f of fundersList) {
      const key = f.organisation?.trim() || f.name;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    // Sort funds within each org by status priority
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));
    }
    // Sort org groups: orgs with active funds first, then by total value
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aHasActive = a.some(f => f.status === "active_funder") ? 0 : 1;
      const bHasActive = b.some(f => f.status === "active_funder") ? 0 : 1;
      if (aHasActive !== bHasActive) return aHasActive - bHasActive;
      const aVal = a.reduce((s, f) => s + (f.estimatedValue || 0), 0);
      const bVal = b.reduce((s, f) => s + (f.estimatedValue || 0), 0);
      return bVal - aVal;
    });
  }, [fundersList]);

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

      {filtered ? (
        <div>
          <p className="text-sm text-muted-foreground mb-3">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-3">
            {filtered.map((funder) => (
              <FunderCard key={funder.id} funder={funder} onView={() => setViewingFunder(funder)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} onGenerateReport={() => setLocation(`/reports?funder=${funder.id}`)} />
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
        <div className="space-y-6">
          {groupedByOrg.map(([orgName, funds]) => {
            const orgTotal = funds.reduce((s, f) => s + (f.estimatedValue || 0), 0);
            const hasMultiple = funds.length > 1;
            const hasActive = funds.some(f => f.status === "active_funder");

            return (
              <div key={orgName}>
                {hasMultiple && (
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{orgName}</h3>
                    {orgTotal > 0 && (
                      <span className="text-xs text-muted-foreground">({formatCurrency(orgTotal)} total)</span>
                    )}
                  </div>
                )}
                <div className={`grid gap-3 ${hasMultiple ? "pl-6 border-l-2 border-muted" : ""}`}>
                  {funds.map((funder) => {
                    if (funder.status === "active_funder") {
                      return <ActiveFunderCard key={funder.id} funder={funder} onView={() => setViewingFunder(funder)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} onGenerateReport={() => setLocation(`/reports?funder=${funder.id}`)} />;
                    }
                    if (PIPELINE_STATUSES.includes(funder.status)) {
                      return <PipelineCard key={funder.id} funder={funder} onView={() => setViewingFunder(funder)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} />;
                    }
                    if (funder.status === "radar") {
                      return <RadarRow key={funder.id} funder={funder} onView={() => setViewingFunder(funder)} onMoveToPipeline={() => updateMutation.mutate({ id: funder.id, data: { status: "in_conversation" } })} onDelete={() => setDeleteConfirm(funder.id)} />;
                    }
                    return <FunderCard key={funder.id} funder={funder} onView={() => setViewingFunder(funder)} onEdit={() => setEditingFunder(funder)} onDelete={() => setDeleteConfirm(funder.id)} onGenerateReport={() => setLocation(`/reports?funder=${funder.id}`)} />;
                  })}
                </div>
              </div>
            );
          })}
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleAdd("radar")}>
            <Plus className="w-4 h-4 mr-1" /> Add Opportunity
          </Button>
        </div>
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
            {funder.reportingCadence && (
              <span className="text-xs text-muted-foreground">
                {CADENCE_LABELS[funder.reportingCadence] || funder.reportingCadence}
              </span>
            )}
            {funder.outcomeFocus && Array.isArray(funder.outcomeFocus) && funder.outcomeFocus.length > 0 && funder.outcomeFocus.map(f => (
              <Badge key={f} variant="outline" className="text-xs" data-testid={`badge-outcome-${f}-${funder.id}`}>
                {OUTCOME_FOCUS_LABELS[f]?.label || f}
              </Badge>
            ))}
            {funder.outcomeFocus && typeof funder.outcomeFocus === "string" && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={funder.outcomeFocus}>
                {funder.outcomeFocus.split("\n")[0].substring(0, 60)}{funder.outcomeFocus.length > 60 ? "…" : ""}
              </span>
            )}
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

function ActiveFunderCard({
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
  const contractProgress = useMemo(() => {
    if (!funder.contractStart || !funder.contractEnd) return null;
    const start = new Date(funder.contractStart).getTime();
    const end = new Date(funder.contractEnd).getTime();
    const now = Date.now();
    const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    return Math.round(pct);
  }, [funder.contractStart, funder.contractEnd]);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border" onClick={onView}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
            {funder.estimatedValue && (
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{formatCurrency(funder.estimatedValue)}/yr</span>
            )}
          </div>
          {funder.organisation && (
            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {funder.reportingCadence && (
              <span className="text-xs text-muted-foreground">{CADENCE_LABELS[funder.reportingCadence]}</span>
            )}
            {contractProgress !== null && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${contractProgress}%` }} />
                </div>
                <span className="text-muted-foreground">{contractProgress}%</span>
              </div>
            )}
            {funder.nextDeadline && (
              <span className={`text-xs ${deadlineWarning ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                {deadlineWarning && <AlertCircle className="w-3 h-3 inline mr-0.5" />}
                Due {formatDistanceToNow(new Date(funder.nextDeadline), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
    </Card>
  );
}

function PipelineCard({
  funder,
  onView,
  onEdit,
  onDelete,
}: {
  funder: Funder;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deadlineSoon = funder.applicationDeadline && !isPast(new Date(funder.applicationDeadline));
  const deadlinePast = funder.applicationDeadline && isPast(new Date(funder.applicationDeadline));

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border" onClick={onView}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
            <Badge className={STATUS_COLORS[funder.status]}>{STATUS_LABELS[funder.status]}</Badge>
          </div>
          {funder.organisation && (
            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {funder.estimatedValue && (
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                <DollarSign className="w-3 h-3 inline" />{formatCurrency(funder.estimatedValue)}
              </span>
            )}
            {deadlineSoon && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                <Clock className="w-3 h-3 inline mr-0.5" />
                Deadline {formatDistanceToNow(new Date(funder.applicationDeadline!), { addSuffix: true })}
              </span>
            )}
            {deadlinePast && (
              <span className="text-xs text-red-600">
                <AlertCircle className="w-3 h-3 inline mr-0.5" /> Deadline passed
              </span>
            )}
            {funder.fitTags && funder.fitTags.length > 0 && funder.fitTags.map(tag => (
              <Badge key={tag} className={`text-xs ${FIT_TAG_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>{tag}</Badge>
            ))}
          </div>
          {funder.nextAction && (
            <p className="text-xs text-muted-foreground mt-1.5">
              <ArrowRight className="w-3 h-3 inline mr-0.5" /> {funder.nextAction}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function RadarRow({
  funder,
  onView,
  onMoveToPipeline,
  onDelete,
}: {
  funder: Funder;
  onView: () => void;
  onMoveToPipeline: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-3 hover:shadow-sm transition-shadow cursor-pointer border" onClick={onView}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{funder.name}</span>
            {funder.estimatedValue && (
              <span className="text-xs text-muted-foreground">{formatCurrency(funder.estimatedValue)}</span>
            )}
            {funder.fitTags && funder.fitTags.length > 0 && funder.fitTags.map(tag => (
              <Badge key={tag} className={`text-xs ${FIT_TAG_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>{tag}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {funder.notes && (
              <p className="text-xs text-muted-foreground truncate">{funder.notes}</p>
            )}
            {funder.applicationDeadline && (
              <span className="text-xs text-muted-foreground shrink-0">
                {isPast(new Date(funder.applicationDeadline))
                  ? "Next round TBC"
                  : `Opens ${format(new Date(funder.applicationDeadline), "d MMM yyyy")}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onMoveToPipeline(); }}>
            <ArrowRight className="w-3 h-3 mr-1" /> Pipeline
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
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
    outcomesFramework: defaultValues?.outcomesFramework || "",
    outcomeFocus: typeof defaultValues?.outcomeFocus === "string"
      ? defaultValues.outcomeFocus
      : Array.isArray(defaultValues?.outcomeFocus)
      ? defaultValues.outcomeFocus.map((f: string) => OUTCOME_FOCUS_LABELS[f]?.label || f).join(", ")
      : "",
    reportingGuidance: defaultValues?.reportingGuidance || "",
    reportingCadence: defaultValues?.reportingCadence || "quarterly",
    narrativeStyle: defaultValues?.narrativeStyle || "compliance",
    prioritySections: defaultValues?.prioritySections || [],
    funderTag: defaultValues?.funderTag || "",
    contractStart: defaultValues?.contractStart ? format(new Date(defaultValues.contractStart), "yyyy-MM-dd") : "",
    contractEnd: defaultValues?.contractEnd ? format(new Date(defaultValues.contractEnd), "yyyy-MM-dd") : "",
    nextDeadline: defaultValues?.nextDeadline ? format(new Date(defaultValues.nextDeadline), "yyyy-MM-dd") : "",
    reviewDate: defaultValues?.reviewDate ? format(new Date(defaultValues.reviewDate), "yyyy-MM-dd") : "",
    partnershipStrategy: defaultValues?.partnershipStrategy || "",
    notes: defaultValues?.notes || "",
    estimatedValue: defaultValues?.estimatedValue?.toString() || "",
    nextAction: defaultValues?.nextAction || "",
    applicationDeadline: defaultValues?.applicationDeadline ? format(new Date(defaultValues.applicationDeadline), "yyyy-MM-dd") : "",
    fitTags: defaultValues?.fitTags || [],
  });

  const { toast } = useToast();

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
      outcomesFramework: form.outcomesFramework.trim() || null,
      outcomeFocus: form.outcomeFocus.trim() || null,
      reportingGuidance: form.reportingGuidance.trim() || null,
      reportingCadence: form.reportingCadence,
      narrativeStyle: form.narrativeStyle,
      prioritySections: form.prioritySections.length > 0 ? form.prioritySections : null,
      funderTag: form.funderTag.trim() || null,
      contractStart: form.contractStart || null,
      contractEnd: form.contractEnd || null,
      nextDeadline: form.nextDeadline || null,
      reviewDate: form.reviewDate || null,
      partnershipStrategy: form.partnershipStrategy.trim() || null,
      notes: form.notes.trim() || null,
      estimatedValue: form.estimatedValue ? parseInt(form.estimatedValue) : null,
      nextAction: form.nextAction.trim() || null,
      applicationDeadline: form.applicationDeadline || null,
      fitTags: form.fitTags.length > 0 ? form.fitTags : null,
    };
    onSubmit(data);
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
              <Label>Estimated Value ($)</Label>
              <Input
                type="number"
                value={form.estimatedValue}
                onChange={(e) => setForm(p => ({ ...p, estimatedValue: e.target.value }))}
                placeholder="e.g. 75000"
              />
            </div>
          </div>

          {(form.status === "in_conversation" || form.status === "pending_eoi" || form.status === "applied" || form.status === "radar") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Input
                  value={form.nextAction}
                  onChange={(e) => setForm(p => ({ ...p, nextAction: e.target.value }))}
                  placeholder="e.g. Contact Rochelle, prepare application"
                />
              </div>
              <div className="space-y-2">
                <Label>Application Deadline</Label>
                <Input
                  type="date"
                  value={form.applicationDeadline}
                  onChange={(e) => setForm(p => ({ ...p, applicationDeadline: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fit Tags</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(FIT_TAG_COLORS).map(tag => (
                <Badge
                  key={tag}
                  className={`cursor-pointer text-xs ${form.fitTags.includes(tag) ? FIT_TAG_COLORS[tag] : "bg-gray-100 text-gray-400 hover:text-gray-600"}`}
                  onClick={() => setForm(p => ({
                    ...p,
                    fitTags: p.fitTags.includes(tag) ? p.fitTags.filter((t: string) => t !== tag) : [...p.fitTags, tag],
                  }))}
                >
                  {tag}
                </Badge>
              ))}
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
              placeholder="Name of the outcomes framework, e.g. Tāmaki Ora 2025–2027, Auckland Plan, Community Wellbeing"
              rows={2}
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
              <Textarea
                value={form.outcomeFocus}
                onChange={(e) => setForm(p => ({ ...p, outcomeFocus: e.target.value }))}
                placeholder="Describe the funder's outcome focus areas and indicators, e.g.&#10;&#10;Whai Rawa Ora (Economic): Māori businesses grow wealth. Indicators: entrepreneur count, repeat usage, revenue.&#10;&#10;Te Hapori Ora (Community): Whānau connected and thriving. Indicators: events hosted, attendees, partnerships."
                rows={6}
                data-testid="input-outcome-focus"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Reporting Guidance</Label>
              <Textarea
                value={form.reportingGuidance}
                onChange={(e) => setForm(p => ({ ...p, reportingGuidance: e.target.value }))}
                placeholder="Reporting rhythm and guidance for the AI, e.g.&#10;&#10;• Monthly: Usage numbers, events, activations → Internal&#10;• Quarterly: Progress against Tāmaki Ora indicators, stories of change&#10;• Annual: Full Tāmaki Ora outcomes report with data visualisations"
                rows={6}
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

          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Handshake className="w-4 h-4 text-muted-foreground" />
              <Label className="text-base font-semibold">Partnership Strategy</Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">How we deliver on this funder's outcomes — activities, touchpoints, and reporting approach</p>
            <Textarea
              value={form.partnershipStrategy}
              onChange={(e) => setForm(p => ({ ...p, partnershipStrategy: e.target.value }))}
              placeholder="Describe how your organisation partners with this funder to deliver outcomes. Include:&#10;&#10;• Key activities and programmes that align with their goals&#10;• How impact is demonstrated&#10;• Relationship touchpoints and management approach&#10;• How reporting feeds into the partnership"
              rows={8}
              data-testid="input-partnership-strategy"
            />
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

          <FunderDeliverablesSection funderId={funder.id} />

          <FunderTaxonomySection funderId={funder.id} />

          <FunderClassificationsSection funderId={funder.id} />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium" data-testid="text-documents-heading">Documents</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Upload funder documents (framework, contract, profile) to enable AI enrichment</p>
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
                <p className="text-xs text-muted-foreground mt-1">Upload funder documents to get started with AI enrichment</p>
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

          <Card className={`p-4 ${documents.length === 0 ? "opacity-60" : ""}`} data-testid="card-enrichment">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-medium">Funder Enrichment</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {documents.length === 0
                    ? "Upload documents above first, then use AI to auto-generate profile fields"
                    : `Reads ${documents.length} uploaded document${documents.length === 1 ? "" : "s"} and auto-generates outcomes framework, reporting guidance, and partnership strategy`}
                </p>
              </div>
              <Button
                onClick={handleEnrichment}
                disabled={isEnriching || documents.length === 0}
                className="gap-1.5 shrink-0"
                data-testid="button-funder-enrichment"
              >
                {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isEnriching ? "Enriching…" : "Funder Enrichment"}
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