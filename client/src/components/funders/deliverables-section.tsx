import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MoreVertical,
  X,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DELIVERABLE_METRIC_TYPES,
  DELIVERABLE_UNITS,
  BOOKING_CLASSIFICATIONS,
  GROUP_TYPES,
  RELATIONSHIP_STAGES,
  type FunderDeliverable,
} from "@shared/schema";
import { useTaxonomy } from "@/hooks/use-taxonomy";

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

export function FunderDeliverablesSection({ funderId }: { funderId: number }) {
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
