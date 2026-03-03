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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Search,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { MenteeCard } from "@/components/mentoring/mentee-card";
import { ApplicationCard } from "@/components/mentoring/application-card";
import {
  useEnrichedRelationships,
  useMentoringApplications,
  isOverdue,
} from "@/components/mentoring/mentoring-hooks";

function AddMenteeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: contacts } = useContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return (contacts || []).slice(0, 10);
    const term = contactSearch.toLowerCase();
    return (contacts as any[]).filter((c: any) => c.name.toLowerCase().includes(term)).slice(0, 10);
  }, [contacts, contactSearch]);

  const selectedContact = useMemo(() => {
    if (!contactId || !contacts) return null;
    return (contacts as any[]).find((c: any) => c.id === parseInt(contactId));
  }, [contacts, contactId]);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/mentoring-relationships", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      toast({ title: "Mentee added", description: "Mentoring relationship created" });
      onOpenChange(false);
      setContactId("");
      setContactSearch("");
      setFocusAreas("");
      setFrequency("monthly");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!contactId) return;
    create.mutate({
      contactId: parseInt(contactId),
      status: "active",
      startDate: new Date().toISOString(),
      focusAreas: focusAreas || null,
      sessionFrequency: frequency,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add Mentee</DialogTitle>
          <DialogDescription>Create a new mentoring relationship</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
          <div className="space-y-2">
            <Label>Focus Areas</Label>
            <Textarea placeholder="What will mentoring focus on?" value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} rows={2} data-testid="input-focus-areas" />
          </div>
          <div className="space-y-2">
            <Label>Session Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!contactId || create.isPending} data-testid="button-submit-mentee">
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddMentee, setShowAddMentee] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [appsOpen, setAppsOpen] = useState(true);

  const pendingApps = applications?.filter(a => a.status === "pending") || [];

  const acceptApp = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest("POST", `/api/mentoring-applications/${id}/accept`, { reviewNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      toast({ title: "Application accepted", description: "Mentoring relationship created" });
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
                onAccept={(id, notes) => acceptApp.mutate({ id, notes })}
                onDecline={(id, notes) => declineApp.mutate({ id, notes })}
                onDefer={(id, notes) => deferApp.mutate({ id, notes })}
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
    </div>
  );
}
