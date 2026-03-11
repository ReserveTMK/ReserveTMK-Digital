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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useContacts } from "@/hooks/use-contacts";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Meeting } from "@shared/schema";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Search,
  Users,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Contact,
  Sprout,
  TreePine,
  Sun,
  Calendar as CalendarIcon,
} from "lucide-react";
import { MenteeCard } from "@/components/mentoring/mentee-card";
import { ApplicationCard } from "@/components/mentoring/application-card";
import { ScheduleSessionDialog } from "@/components/mentoring/sessions-tab";
import {
  useEnrichedRelationships,
  useMentoringApplications,
  isOverdue,
  FREQUENCY_LABELS,
} from "@/components/mentoring/mentoring-hooks";
import { MENTORING_FOCUS_AREAS, VENTURE_TYPES } from "@shared/schema";

const ETHNICITY_OPTIONS_FLAT = [
  "Maori", "Samoan", "Tongan", "Cook Islands Maori", "Niuean", "Tokelauan", "Fijian",
  "NZ European/Pakeha", "Other European", "Chinese", "Indian", "Other Asian",
  "Middle Eastern", "Latin American", "African", "Other",
];

const VENTURE_TYPE_LABELS_MAP: Record<string, string> = {
  commercial_business: "Commercial Business",
  social_enterprise: "Social Enterprise",
  creative_movement: "Creative Movement",
  community_initiative: "Community Initiative",
  exploring: "Exploring",
};

function AddMenteeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: contacts } = useContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEthnicity, setNewEthnicity] = useState<string[]>([]);
  const [newVentureType, setNewVentureType] = useState("");
  const [newWhatBuilding, setNewWhatBuilding] = useState("");

  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState("kakano");

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return (contacts || []).slice(0, 10);
    const term = contactSearch.toLowerCase();
    return (contacts as any[]).filter((c: any) => c.name.toLowerCase().includes(term)).slice(0, 10);
  }, [contacts, contactSearch]);

  const selectedContact = useMemo(() => {
    if (!contactId || !contacts) return null;
    return (contacts as any[]).find((c: any) => c.id === parseInt(contactId));
  }, [contacts, contactId]);

  const toggleFocusArea = (area: string) => {
    setSelectedFocusAreas(prev => {
      if (prev.includes(area)) return prev.filter(a => a !== area);
      if (prev.length >= 3) return prev;
      return [...prev, area];
    });
  };

  const buildFocusString = () => {
    const parts = [...selectedFocusAreas];
    if (customFocus.trim()) parts.push(customFocus.trim());
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const resetForm = () => {
    setMode("existing");
    setContactId("");
    setContactSearch("");
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewEthnicity([]);
    setNewVentureType("");
    setNewWhatBuilding("");
    setSelectedFocusAreas([]);
    setCustomFocus("");
    setFrequency("monthly");
    setNotes("");
    setStage("kakano");
  };

  const createRelationship = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/mentoring-relationships", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Mentee added", description: "Mentoring relationship created" });
      onOpenChange(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createContact = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onError: (e: any) => toast({ title: "Error creating contact", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = async () => {
    const focusString = buildFocusString();

    if (mode === "existing") {
      if (!contactId) return;
      const patchData: any = {};
      if (notes.trim()) patchData.notes = notes.trim();
      if (stage) patchData.stage = stage;
      patchData.isCommunityMember = true;
      if (Object.keys(patchData).length > 0) {
        try {
          await apiRequest("PATCH", `/api/contacts/${parseInt(contactId)}`, patchData);
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        } catch (e: any) {
          toast({ title: "Warning", description: "Could not update contact details", variant: "destructive" });
        }
      }
      createRelationship.mutate({
        contactId: parseInt(contactId),
        status: "active",
        startDate: new Date().toISOString(),
        focusAreas: focusString,
        sessionFrequency: frequency,
      });
    } else {
      if (!newName.trim()) return;
      try {
        const contact = await createContact.mutateAsync({
          name: newName.trim(),
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
          ethnicity: newEthnicity.length > 0 ? newEthnicity : null,
          ventureType: newVentureType || null,
          whatTheyAreBuilding: newWhatBuilding.trim() || null,
          role: "entrepreneur",
          isCommunityMember: true,
          stage: stage || "kakano",
          notes: notes.trim() || null,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        createRelationship.mutate({
          contactId: contact.id,
          status: "active",
          startDate: new Date().toISOString(),
          focusAreas: focusString,
          sessionFrequency: frequency,
        });
      } catch (e: any) {
        toast({ title: "Error creating contact", description: e.message, variant: "destructive" });
      }
    }
  };

  const canSubmit = mode === "existing" ? !!contactId : !!newName.trim();
  const isPending = createRelationship.isPending || createContact.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Mentee</DialogTitle>
          <DialogDescription>Create a new mentoring relationship</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMode("existing")}
              data-testid="tab-existing-contact"
            >
              <Contact className="w-3.5 h-3.5" /> Existing Contact
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMode("new")}
              data-testid="tab-new-person"
            >
              <UserPlus className="w-3.5 h-3.5" /> New Person
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2">
              <Label>Person</Label>
              <Input
                placeholder="Search contacts..."
                value={selectedContact ? selectedContact.name : contactSearch}
                onChange={(e) => { setContactSearch(e.target.value); if (contactId) setContactId(""); }}
                data-testid="input-add-mentee-search"
              />
              {!contactId && contactSearch && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredContacts.map((c: any) => (
                    <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setContactId(String(c.id)); setContactSearch(""); }} data-testid={`option-mentee-${c.id}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-new-mentee-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input placeholder="Email address" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="input-new-mentee-email" />
                  <p className="text-[10px] text-muted-foreground">Used to recognise this person when they book online</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} data-testid="input-new-mentee-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ethnicity</Label>
                <div className="flex flex-wrap gap-1">
                  {ETHNICITY_OPTIONS_FLAT.slice(0, 8).map(eth => (
                    <button
                      key={eth}
                      type="button"
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                        newEthnicity.includes(eth) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
                      }`}
                      onClick={() => setNewEthnicity(prev => prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth])}
                      data-testid={`toggle-ethnicity-${eth.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {eth}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Venture Type</Label>
                  <Select value={newVentureType} onValueChange={setNewVentureType}>
                    <SelectTrigger data-testid="select-venture-type">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VENTURE_TYPES.map(vt => (
                        <SelectItem key={vt} value={vt}>{VENTURE_TYPE_LABELS_MAP[vt] || vt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>What they're building</Label>
                  <Input placeholder="e.g. Food truck business" value={newWhatBuilding} onChange={(e) => setNewWhatBuilding(e.target.value)} data-testid="input-new-mentee-building" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Journey Stage</Label>
            <div className="flex gap-2">
              {([
                { id: "kakano", label: "Kakano", desc: "Seed", icon: Sprout, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800" },
                { id: "tipu", label: "Tipu", desc: "Growth", icon: TreePine, color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10 border-green-200 dark:border-green-800" },
                { id: "ora", label: "Ora", desc: "Thriving", icon: Sun, color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-500/10 border-sky-200 dark:border-sky-800" },
              ] as const).map(s => {
                const Icon = s.icon;
                const isSelected = stage === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border-2 transition-all ${
                      isSelected ? `${s.bg} ${s.color} border-current font-semibold` : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => setStage(s.id)}
                    data-testid={`stage-${s.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{s.label}</span>
                    <span className="text-[10px] opacity-70">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Focus Areas (select up to 3)</Label>
            <div className="flex flex-wrap gap-1.5">
              {MENTORING_FOCUS_AREAS.map(area => (
                <button
                  key={area}
                  type="button"
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    selectedFocusAreas.includes(area)
                      ? "bg-primary text-primary-foreground border-primary"
                      : selectedFocusAreas.length >= 3
                        ? "bg-muted/50 text-muted-foreground border-border cursor-not-allowed opacity-50"
                        : "bg-background hover:bg-muted border-border"
                  }`}
                  onClick={() => toggleFocusArea(area)}
                  disabled={!selectedFocusAreas.includes(area) && selectedFocusAreas.length >= 3}
                  data-testid={`toggle-focus-${area.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {area}
                </button>
              ))}
            </div>
            <Input
              placeholder="Other focus area (optional)"
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              className="mt-1.5"
              data-testid="input-custom-focus"
            />
          </div>

          <div className="space-y-2">
            <Label>Session Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Initial context, goals, background..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-mentee-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending} data-testid="button-submit-mentee">
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add Mentee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MenteesTab() {
  const { data: enrichedRelationships, isLoading } = useEnrichedRelationships();
  const { data: applications, isLoading: appsLoading } = useMentoringApplications();
  const { data: contacts } = useContacts();
  const { data: allMeetings } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings/all-mentors"],
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddMentee, setShowAddMentee] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [appsOpen, setAppsOpen] = useState(true);
  const [schedulePrompt, setSchedulePrompt] = useState<{ contactId: number; contactName: string; showScheduler?: boolean } | null>(null);

  const pendingApps = applications?.filter(a => a.status === "pending") || [];

  const acceptApp = useMutation({
    mutationFn: async ({ id, notes, extra, contactId, contactName }: { id: number; notes?: string; extra?: { focusAreas?: string; sessionFrequency?: string; stage?: string }; contactId?: number; contactName?: string }) => {
      const res = await apiRequest("POST", `/api/mentoring-applications/${id}/accept`, {
        reviewNotes: notes,
        ...(extra || {}),
      });
      const data = await res.json();
      return { ...data, _contactId: contactId, _contactName: contactName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      toast({ title: "Application accepted", description: "Mentoring relationship created" });
      if (data._contactId && data._contactName) {
        setSchedulePrompt({ contactId: data._contactId, contactName: data._contactName });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declineApp = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/mentoring-applications/${id}`, { status: "declined", reviewNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      toast({ title: "Application declined" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deferApp = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/mentoring-applications/${id}`, { status: "deferred", reviewNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      toast({ title: "Application deferred", description: "You can revisit this later" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!enrichedRelationships) return [];
    let list = enrichedRelationships;
    if (statusFilter !== "all") {
      list = list.filter(r => r.status === statusFilter);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(r => r.contactName.toLowerCase().includes(term) || r.focusAreas?.toLowerCase().includes(term));
    }
    return list.sort((a, b) => {
      if (isOverdue(a) && !isOverdue(b)) return -1;
      if (!isOverdue(a) && isOverdue(b)) return 1;
      return (b.completedSessionCount || 0) - (a.completedSessionCount || 0);
    });
  }, [enrichedRelationships, statusFilter, search]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {pendingApps.length > 0 && (
        <Collapsible open={appsOpen} onOpenChange={setAppsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-muted transition-colors" data-testid="button-toggle-applications">
              {appsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-semibold text-sm">Pending Applications</span>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{pendingApps.length}</Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {pendingApps.map(app => (
              <ApplicationCard
                key={app.id}
                application={app}
                contacts={(contacts || []) as any[]}
                meetings={allMeetings || []}
                isPending={acceptApp.isPending || declineApp.isPending}
                onAccept={(id, notes, extra) => {
                  const c = (contacts as any[])?.find((ct: any) => ct.id === app.contactId);
                  acceptApp.mutate({ id, notes, extra, contactId: c?.id, contactName: c?.name });
                }}
                onDecline={(id, notes) => declineApp.mutate({ id, notes })}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search mentees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-mentee-search" />
          </div>
          <div className="flex gap-1">
            {(["active", "on_hold", "graduated", "all"] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={statusFilter === f ? "default" : "outline"}
                className="text-xs h-8 capitalize"
                onClick={() => setStatusFilter(f)}
                data-testid={`filter-mentee-${f}`}
              >
                {f === "on_hold" ? "On Hold" : f === "all" ? "All" : f}
              </Button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddMentee(true)} data-testid="button-add-mentee">
          <Plus className="w-4 h-4 mr-1" /> Add Mentee
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all" ? "No mentees yet" : `No ${statusFilter.replace("_", " ")} mentees`}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddMentee(true)} data-testid="button-add-mentee-empty">
            <Plus className="w-4 h-4 mr-1" /> Add your first mentee
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <MenteeCard key={r.id} relationship={r} />
          ))}
        </div>
      )}

      <AddMenteeDialog open={showAddMentee} onOpenChange={setShowAddMentee} />

      {schedulePrompt && !schedulePrompt.showScheduler && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setSchedulePrompt(null); }}>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader>
              <DialogTitle>Schedule First Session?</DialogTitle>
              <DialogDescription>
                {schedulePrompt.contactName} has been accepted. Would you like to schedule their first mentoring session now?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSchedulePrompt(null)} data-testid="button-skip-schedule">
                Not now
              </Button>
              <Button onClick={() => setSchedulePrompt({ ...schedulePrompt, showScheduler: true })} data-testid="button-schedule-first">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Schedule Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {schedulePrompt?.showScheduler && (
        <ScheduleSessionDialog
          open={true}
          onOpenChange={(v) => { if (!v) setSchedulePrompt(null); }}
          prefillContactId={schedulePrompt.contactId}
          prefillContactName={schedulePrompt.contactName}
        />
      )}
    </div>
  );
}
