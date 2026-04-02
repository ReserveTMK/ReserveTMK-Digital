import { Button } from "@/components/ui/beautiful-button";
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
import { useState, useMemo } from "react";
import {
  Loader2,
  X,
  Handshake,
} from "lucide-react";
import { format } from "date-fns";
import {
  FUNDER_STATUSES,
  REPORTING_CADENCES,
  NARRATIVE_STYLES,
  type Funder,
} from "@shared/schema";
import { useGroups } from "@/hooks/use-groups";
import { useContacts as useContactsHook } from "@/hooks/use-contacts";

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

const OUTCOME_FOCUS_LABELS: Record<string, { label: string; description: string }> = {
  economic: { label: "Economic", description: "Jobs, revenue, businesses" },
  wellbeing: { label: "Wellbeing", description: "Growth, confidence, mindset" },
  cultural: { label: "Cultural", description: "Te reo, tikanga, whanaungatanga" },
  community: { label: "Community", description: "Connections, network, engagement" },
};

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

const REPORT_SECTIONS = [
  { id: "engagement", label: "Engagement" },
  { id: "delivery", label: "Delivery" },
  { id: "impact", label: "Impact by Taxonomy" },
  { id: "outcomes", label: "Outcome Movement" },
  { id: "value", label: "Value & Contribution" },
  { id: "narrative", label: "Narrative" },
];

export function FunderFormDialog({
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
    fundType: (defaultValues as any)?.fundType || "delivery",
  });

  const [groupId, setGroupId] = useState<number | null>(defaultValues?.groupId || null);
  const [headContactId, setHeadContactId] = useState<number | null>(defaultValues?.headContactId || null);
  const [liaisonContactId, setLiaisonContactId] = useState<number | null>(defaultValues?.liaisonContactId || null);
  const [leadContactId, setLeadContactId] = useState<number | null>(defaultValues?.leadContactId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [headSearch, setHeadSearch] = useState("");
  const [liaisonSearch, setLiaisonSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

  const { data: allGroups } = useGroups();
  const { data: allContacts } = useContactsHook();

  const filteredGroups = useMemo(() => {
    if (!allGroups || !groupSearch.trim()) return [];
    const term = groupSearch.toLowerCase();
    return (allGroups as any[]).filter((g: any) => g.name.toLowerCase().includes(term)).slice(0, 5);
  }, [allGroups, groupSearch]);

  const getGroupName = (id: number | null) => {
    if (!id || !allGroups) return null;
    return (allGroups as any[]).find((g: any) => g.id === id)?.name || null;
  };

  const getContactName = (id: number | null) => {
    if (!id || !allContacts) return null;
    return (allContacts as any[]).find((c: any) => c.id === id)?.name || null;
  };

  const filterContacts = (search: string, excludeIds: number[]) => {
    if (!allContacts || !search.trim()) return [];
    const term = search.toLowerCase();
    const excluded = new Set(excludeIds);
    return (allContacts as any[]).filter((c: any) => !excluded.has(c.id) && c.name.toLowerCase().includes(term)).slice(0, 5);
  };

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
      groupId: groupId || null,
      headContactId: headContactId || null,
      liaisonContactId: liaisonContactId || null,
      leadContactId: leadContactId || null,
      fundType: form.fundType,
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fund Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Ngā Mātārae"
                data-testid="input-funder-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Organisation</Label>
              {groupId ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary">{getGroupName(groupId) || `Group #${groupId}`}</Badge>
                  <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => { setGroupId(null); setForm(p => ({ ...p, organisation: "" })); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={groupSearch || form.organisation}
                    onChange={(e) => { setGroupSearch(e.target.value); setForm(p => ({ ...p, organisation: e.target.value })); }}
                    placeholder="Search orgs or type name..."
                    data-testid="input-funder-org"
                  />
                  {filteredGroups.length > 0 && groupSearch && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[150px] overflow-y-auto">
                      {filteredGroups.map((g: any) => (
                        <button key={g.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent" onClick={() => { setGroupId(g.id); setForm(p => ({ ...p, organisation: g.name })); setGroupSearch(""); }}>
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Fund Type</Label>
              <Select value={form.fundType} onValueChange={(v) => setForm(p => ({ ...p, fundType: v }))}>
                <SelectTrigger data-testid="select-fund-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Delivery Funder</SelectItem>
                  <SelectItem value="project">Project Fund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Key Personnel</Label>
            {([
              { label: "Head", id: headContactId, setId: setHeadContactId, search: headSearch, setSearch: setHeadSearch, testId: "head" },
              { label: "Liaison", id: liaisonContactId, setId: setLiaisonContactId, search: liaisonSearch, setSearch: setLiaisonSearch, testId: "liaison" },
              { label: "Lead", id: leadContactId, setId: setLeadContactId, search: leadSearch, setSearch: setLeadSearch, testId: "lead" },
            ] as const).map((role) => {
              const excludeIds = [headContactId, liaisonContactId, leadContactId].filter((id): id is number => id !== null && id !== role.id);
              const filtered = filterContacts(role.search, excludeIds);
              return (
                <div key={role.testId} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{role.label}</span>
                  {role.id ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary">{getContactName(role.id) || `Contact #${role.id}`}</Badge>
                      <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => role.setId(null)} type="button">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative flex-1">
                      <Input
                        value={role.search}
                        onChange={(e) => role.setSearch(e.target.value)}
                        placeholder="Search contacts..."
                        className="h-8 text-sm"
                        data-testid={`input-personnel-${role.testId}`}
                      />
                      {filtered.length > 0 && role.search && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[150px] overflow-y-auto">
                          {filtered.map((c: any) => (
                            <button key={c.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent" onClick={() => { role.setId(c.id); role.setSearch(""); }}>
                              {c.name}{c.email ? ` — ${c.email}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Contact (text fallback)</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm(p => ({ ...p, contactPerson: e.target.value }))}
                placeholder="Name"
                className="h-8 text-sm"
                data-testid="input-contact-person"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                className="h-8 text-sm"
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                className="h-8 text-sm"
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
