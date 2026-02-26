import { useContact, useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useInteractions, useCreateInteraction, useAnalyzeInteraction } from "@/hooks/use-interactions";
import { useActionItems } from "@/hooks/use-action-items";
import { useContactGroups, useGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember } from "@/hooks/use-groups";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/beautiful-button";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mic, StopCircle, ArrowLeft, Brain, TrendingUp, Sparkles, AlertCircle, DollarSign, Settings, Rocket, Network, Shield, FileText, CheckSquare, Calendar, Clock, ChevronDown, History, MessageSquare, Pencil, Check, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { RelationshipStageSelector } from "@/components/relationship-stage-selector";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect, useRef, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { searchSuburbs, getLocalBoard, SUBURB_TO_LOCAL_BOARD } from "@shared/auckland-suburbs";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

function getConsentBadge(status: string | null | undefined) {
  if (!status || status === "") {
    return { label: "No consent record", className: "bg-gray-500/15 text-gray-700 dark:text-gray-300" };
  }
  switch (status) {
    case "given":
      return { label: "Consent: Given", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
    case "withdrawn":
      return { label: "Consent: Withdrawn", className: "bg-red-500/15 text-red-700 dark:text-red-300" };
    case "pending":
      return { label: "Consent: Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
    default:
      return { label: "No consent record", className: "bg-gray-500/15 text-gray-700 dark:text-gray-300" };
  }
}

export default function ContactDetail() {
  const [match, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");
  const { data: contact, isLoading: contactLoading } = useContact(id);
  const { data: interactions, isLoading: interactionsLoading } = useInteractions(id);
  const { data: contactDebriefs } = useQuery({
    queryKey: ['/api/contacts', id, 'debriefs'],
    queryFn: () => fetch(`/api/contacts/${id}/debriefs`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });
  const { data: actionItems } = useActionItems();
  const { data: consentRecords } = useQuery({
    queryKey: ['/api/contacts', id, 'consent'],
    queryFn: () => fetch(`/api/contacts/${id}/consent`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['/api/contacts', id, 'activity'],
    queryFn: () => fetch(`/api/contacts/${id}/activity`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });

  const { data: contactGroups } = useContactGroups(id);
  const { data: allGroups } = useGroups();
  const addGroupMember = useAddGroupMember();
  const removeGroupMember = useRemoveGroupMember();
  const createGroupForTagging = useCreateGroup();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroupRole, setSelectedGroupRole] = useState("Member");
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickAddGroupName, setQuickAddGroupName] = useState("");
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);

  const { data: stageHistory } = useQuery({
    queryKey: ['/api/relationship-stage-history', 'contact', id],
    queryFn: async () => {
      const res = await fetch(`/api/relationship-stage-history/contact/${id}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: string) =>
      apiRequest('PATCH', `/api/contacts/${id}/relationship-stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/relationship-stage-history', 'contact', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/relationship-stages'] });
    },
  });

  if (contactLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background/50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-screen items-center justify-center bg-background/50 flex-col gap-4">
        <h1 className="text-2xl font-bold">Community member not found</h1>
        <Link href="/contacts"><Button>Go Back</Button></Link>
      </div>
    );
  }

  const contactImpactLogs = (contactDebriefs as any[]) || [];

  const contactActionItems = (actionItems as any[])?.filter((item: any) => item.contactId === id) || [];

  const chartData = [...(interactions || [])]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(i => ({
      date: format(new Date(i.date), 'MM/dd'),
      mindset: i.analysis?.mindsetScore || 0,
      skill: i.analysis?.skillScore || 0,
      confidence: i.analysis?.confidenceScore || 0,
      bizConfidence: i.analysis?.confidenceScoreMetric || 0,
      systems: i.analysis?.systemsInPlaceScore || 0,
      funding: i.analysis?.fundingReadinessScore || 0,
      network: i.analysis?.networkStrengthScore || 0,
    }));

  const timelineItems: Array<{
    date: Date;
    type: 'impact_log' | 'action_item' | 'interaction' | 'consent';
    data: any;
  }> = [];

  contactImpactLogs.forEach((log: any) => {
    timelineItems.push({
      date: new Date(log.createdAt),
      type: 'impact_log',
      data: log,
    });
  });

  contactActionItems.forEach((item: any) => {
    timelineItems.push({
      date: new Date(item.createdAt),
      type: 'action_item',
      data: item,
    });
  });

  (interactions || []).forEach((interaction: any) => {
    timelineItems.push({
      date: new Date(interaction.date),
      type: 'interaction',
      data: interaction,
    });
  });

  (consentRecords || []).forEach((record: any) => {
    timelineItems.push({
      date: new Date(record.createdAt),
      type: 'consent',
      data: record,
    });
  });

  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  const consentBadge = getConsentBadge(contact.consentStatus);

  return (
    <>
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="space-y-4">
            <Link href="/contacts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Community
            </Link>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-4xl shadow-inner">
                  {contact.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground">
                      {contact.name}
                      {contact.nickname && (
                        <span className="text-muted-foreground ml-2 text-xl font-normal">({contact.nickname})</span>
                      )}
                    </h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditDialogOpen(true)}
                      data-testid="button-edit-contact"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                  {contact.businessName && (
                    <p className="text-muted-foreground/80 text-base" data-testid="text-business-name">{contact.businessName}</p>
                  )}
                  <p className="text-muted-foreground text-lg">{contact.role}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {contact.age && <span>{contact.age} years old</span>}
                    <EthnicityQuickEdit contact={contact} />
                      {contact.suburb && <span>{contact.suburb}</span>}
                      {contact.localBoard && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-md text-xs font-medium">
                          {contact.localBoard}
                        </span>
                      )}
                      {contact.location && <span>{contact.location}</span>}
                    {contact.revenueBand && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-medium">
                        <DollarSign className="w-3 h-3" /> {contact.revenueBand}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {contact.tags?.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-secondary rounded-md text-xs font-medium text-secondary-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${consentBadge.className}`}
                      data-testid="badge-consent-status"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      {consentBadge.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConsentDialogOpen(true)}
                      data-testid="button-record-consent"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1" />
                      Record Consent
                    </Button>
                  </div>
                  <div className="mt-4">
                    <RelationshipStageSelector
                      currentStage={contact.relationshipStage || "new"}
                      onStageChange={(stage) => stageMutation.mutate(stage)}
                      disabled={stageMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="shadow-lg shadow-primary/20">
                    <Mic className="w-4 h-4 mr-2" /> Log Interaction
                  </Button>
                </DialogTrigger>
                <LogInteractionDialog contactId={id} />
              </Dialog>
            </div>
          </div>

          {/* Current Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MetricCard 
              title="Mindset" 
              value={contact.metrics?.mindset || "-"} 
              icon={<Brain className="w-5 h-5" />} 
              color="primary"
            />
            <MetricCard 
              title="Skill" 
              value={contact.metrics?.skill || "-"} 
              icon={<Sparkles className="w-5 h-5" />} 
              color="secondary"
            />
            <MetricCard 
              title="Confidence" 
              value={contact.metrics?.confidence || "-"} 
              icon={<TrendingUp className="w-5 h-5" />} 
              color="green"
            />
            <MetricCard 
              title="Biz Confidence" 
              value={contact.metrics?.confidenceScore || "-"} 
              icon={<Rocket className="w-5 h-5" />} 
              color="primary"
            />
            <MetricCard 
              title="Systems" 
              value={contact.metrics?.systemsInPlace || "-"} 
              icon={<Settings className="w-5 h-5" />} 
              color="secondary"
            />
            <MetricCard 
              title="Funding Ready" 
              value={contact.metrics?.fundingReadiness || "-"} 
              icon={<DollarSign className="w-5 h-5" />} 
              color="green"
            />
            <MetricCard 
              title="Network" 
              value={contact.metrics?.networkStrength || "-"} 
              icon={<Network className="w-5 h-5" />} 
              color="primary"
            />
          </div>

          {/* Group Memberships */}
          <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Network className="w-4 h-4" />
                Groups & Organisations
              </h3>
              <Popover open={addGroupOpen} onOpenChange={(open) => { setAddGroupOpen(open); if (!open) { setGroupSearch(""); setShowQuickAddGroup(false); setQuickAddGroupName(""); } }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-add-group-tag">
                    <span className="text-xs">+ Add</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-3 border-b">
                    <Select value={selectedGroupRole} onValueChange={setSelectedGroupRole}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-group-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lead Contact">Lead Contact</SelectItem>
                        <SelectItem value="Representative">Representative</SelectItem>
                        <SelectItem value="Member">Member</SelectItem>
                        <SelectItem value="Advisor">Advisor</SelectItem>
                        <SelectItem value="Volunteer">Volunteer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Command>
                    <CommandInput placeholder="Search groups..." value={groupSearch} onValueChange={setGroupSearch} data-testid="input-group-search" />
                    <CommandList>
                      <CommandEmpty>
                        {!showQuickAddGroup ? (
                          <div className="p-2 text-center">
                            <p className="text-sm text-muted-foreground mb-2">No groups found</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setShowQuickAddGroup(true); setQuickAddGroupName(groupSearch); }}
                              data-testid="button-quick-add-group-tag"
                            >
                              Create "{groupSearch}"
                            </Button>
                          </div>
                        ) : (
                          <div className="p-2 space-y-2">
                            <Input
                              placeholder="Group name"
                              value={quickAddGroupName}
                              onChange={(e) => setQuickAddGroupName(e.target.value)}
                              className="h-8 text-sm"
                              data-testid="input-quick-add-group-name"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                disabled={!quickAddGroupName.trim() || createGroupForTagging.isPending}
                                onClick={async () => {
                                  try {
                                    const newGroup = await createGroupForTagging.mutateAsync({ name: quickAddGroupName.trim(), type: "Organisation" });
                                    addGroupMember.mutate({ groupId: newGroup.id, contactId: id, role: selectedGroupRole }, {
                                      onSuccess: () => {
                                        setAddGroupOpen(false);
                                        setShowQuickAddGroup(false);
                                        setQuickAddGroupName("");
                                        setGroupSearch("");
                                      },
                                    });
                                  } catch {}
                                }}
                                data-testid="button-confirm-quick-add-group"
                              >
                                {createGroupForTagging.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create & Add"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowQuickAddGroup(false)} data-testid="button-cancel-quick-add-group">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {(() => {
                          const existingGroupIds = new Set((contactGroups || []).map((gm: any) => gm.groupId));
                          const filtered = (allGroups || []).filter((g: any) =>
                            !existingGroupIds.has(g.id) &&
                            g.name.toLowerCase().includes(groupSearch.toLowerCase())
                          );
                          return filtered.map((g: any) => (
                            <CommandItem
                              key={g.id}
                              value={g.name}
                              onSelect={() => {
                                addGroupMember.mutate({ groupId: g.id, contactId: id, role: selectedGroupRole }, {
                                  onSuccess: () => {
                                    setAddGroupOpen(false);
                                    setGroupSearch("");
                                  },
                                });
                              }}
                              className="cursor-pointer"
                              data-testid={`item-group-${g.id}`}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">{g.name}</span>
                                {g.type && <span className="text-xs text-muted-foreground">{g.type}</span>}
                              </div>
                            </CommandItem>
                          ));
                        })()}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {contactGroups && contactGroups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contactGroups.map((gm: any) => (
                  <Badge key={gm.id} className="cursor-pointer group pr-1 flex items-center gap-1" data-testid={`badge-group-membership-${gm.id}`}>
                    <Link href="/groups">
                      <span>
                        {gm.groupName || `Group #${gm.groupId}`}
                        {gm.role && <span className="ml-1 opacity-70">({gm.role})</span>}
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 rounded-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeGroupMember.mutate({ groupId: gm.groupId, memberId: gm.id, contactId: id });
                      }}
                      data-testid={`button-remove-group-${gm.id}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No groups tagged yet</p>
            )}
          </div>

          {stageHistory && stageHistory.length > 0 && (
            <Collapsible open={stageHistoryOpen} onOpenChange={setStageHistoryOpen}>
              <Card className="p-4" data-testid="stage-history-section">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left focus:outline-none"
                    data-testid="button-toggle-stage-history"
                  >
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                      <History className="w-4 h-4" />
                      Stage History
                    </h3>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", stageHistoryOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 space-y-3">
                    {(stageHistory as any[]).map((entry: any, idx: number) => (
                      <div key={entry.id || idx} className="flex items-start gap-3" data-testid={`stage-history-entry-${entry.id || idx}`}>
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                          {idx < stageHistory.length - 1 && <div className="w-px flex-1 bg-border min-h-[16px]" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.previousStage && (
                              <>
                                <Badge variant="secondary" className="text-xs capitalize">{entry.previousStage}</Badge>
                                <span className="text-muted-foreground text-xs">&rarr;</span>
                              </>
                            )}
                            <Badge variant="secondary" className="text-xs capitalize bg-primary/10">{entry.newStage}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(entry.changedAt), 'MMM d, yyyy · h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Tabs Content */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card border border-border p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-history">History</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-timeline">Timeline</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Growth Trajectory
                </h3>
                <div className="h-[300px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="mindset" stroke="hsl(var(--brand-coral))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="skill" stroke="hsl(var(--brand-green))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="confidence" stroke="hsl(var(--brand-pink))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="bizConfidence" name="Biz Confidence" stroke="hsl(var(--brand-blue))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="systems" name="Systems" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="funding" name="Funding" stroke="hsl(var(--brand-dark-green))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="network" name="Network" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <p>No enough data to show trends.</p>
                      <p className="text-sm">Log some interactions to see progress.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
               {interactionsLoading ? (
                 <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
               ) : interactions?.length === 0 ? (
                 <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                   No interactions logged yet.
                 </div>
               ) : (
                 <div className="grid gap-4">
                   {interactions?.map((interaction) => (
                     <div key={interaction.id} className="bg-card p-6 rounded-2xl border border-border hover:shadow-md transition-all">
                       <div className="flex justify-between items-start mb-3">
                         <div>
                           <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                             {interaction.type}
                           </span>
                           <h4 className="font-bold text-lg">{format(new Date(interaction.date), 'MMMM d, yyyy')}</h4>
                         </div>
                         <div className="flex gap-2">
                           {interaction.analysis?.keyInsights?.map((insight, i) => (
                             <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
                               {insight}
                             </span>
                           ))}
                         </div>
                       </div>
                       
                       <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                         {interaction.summary || interaction.transcript}
                       </p>
                       
                       <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 border-t border-border pt-4">
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Mindset</p>
                           <p className="font-bold text-primary">{interaction.analysis?.mindsetScore || "-"}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Skill</p>
                           <p className="font-bold text-secondary-foreground">{interaction.analysis?.skillScore || "-"}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                           <p className="font-bold text-amber-500">{interaction.analysis?.confidenceScore || "-"}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Biz Conf.</p>
                           <p className="font-bold text-pink-500">{interaction.analysis?.confidenceScoreMetric || "-"}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Systems</p>
                           <p className="font-bold text-cyan-500">{interaction.analysis?.systemsInPlaceScore || "-"}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Funding</p>
                           <p className="font-bold text-teal-500">{interaction.analysis?.fundingReadinessScore || "-"}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Network</p>
                           <p className="font-bold text-orange-500">{interaction.analysis?.networkStrengthScore || "-"}</p>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4" data-testid="timeline-content">
              {timelineItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                  No timeline activity yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {timelineItems.map((item, idx) => (
                    <TimelineCard key={`${item.type}-${item.data.id}-${idx}`} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4" data-testid="activity-content">
              {activityLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="activity-loading" />
                </div>
              ) : !activityData || (activityData as any[]).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border" data-testid="activity-empty">
                  No activity recorded yet.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2" data-testid="activity-summary">
                    {(() => {
                      const counts: Record<string, number> = {};
                      (activityData as any[]).forEach((item: any) => {
                        counts[item.type] = (counts[item.type] || 0) + 1;
                      });
                      const typeLabels: Record<string, string> = {
                        interaction: 'Interactions',
                        booking: 'Bookings',
                        programme: 'Programmes',
                        event: 'Events',
                        membership: 'Memberships',
                        mou: 'MOUs',
                        community_spend: 'Community Spend',
                        legacy_report: 'Legacy Reports',
                      };
                      return Object.entries(counts).map(([type, count]) => (
                        <Badge key={type} variant="secondary" className="text-xs" data-testid={`badge-activity-count-${type}`}>
                          {count} {typeLabels[type] || type}
                        </Badge>
                      ));
                    })()}
                  </div>
                  <div className="space-y-3">
                    {(activityData as any[]).map((item: any, idx: number) => (
                      <ActivityCard key={`${item.type}-${item.id}-${idx}`} item={item} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
      />
      <RecordConsentDialog
        open={consentDialogOpen}
        onOpenChange={setConsentDialogOpen}
        contactId={id}
      />
    </>
  );
}

function TimelineCard({ item }: { item: { date: Date; type: string; data: any } }) {
  const iconMap: Record<string, { icon: any; color: string; label: string }> = {
    impact_log: { icon: FileText, color: "text-violet-500", label: "Impact Log" },
    action_item: { icon: CheckSquare, color: "text-blue-500", label: "Action Item" },
    interaction: { icon: Calendar, color: "text-emerald-500", label: "Interaction" },
    consent: { icon: Shield, color: "text-amber-500", label: "Consent Record" },
  };

  const config = iconMap[item.type] || iconMap.interaction;
  const Icon = config.icon;

  return (
    <Card className="p-4" data-testid={`timeline-item-${item.type}-${item.data.id}`}>
      <div className="flex gap-4">
        <div className="shrink-0 text-right min-w-[80px]">
          <p className="text-xs text-muted-foreground font-medium">
            {format(item.date, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {format(item.date, 'h:mm a')}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="w-px flex-1 bg-border mt-1" />
        </div>
        <div className="flex-1 min-w-0 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {config.label}
          </p>

          {item.type === 'impact_log' && (
            <Link href={`/debriefs?id=${item.data.id}`} className="block hover-elevate rounded-md -m-1 p-1" data-testid={`link-debrief-${item.data.id}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{item.data.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {item.data.status}
                </Badge>
                {item.data.linkRole && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.data.linkRole}
                  </Badge>
                )}
                {item.data.sentiment && (
                  <Badge variant="outline" className="text-xs">
                    {item.data.sentiment}
                  </Badge>
                )}
              </div>
              {item.data.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2">{item.data.summary}</p>
              )}
            </Link>
          )}

          {item.type === 'action_item' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{item.data.title}</span>
                <Badge variant="secondary" className={`text-xs ${
                  item.data.status === 'completed' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  item.data.status === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  ''
                }`}>
                  {item.data.status}
                </Badge>
              </div>
              {item.data.dueDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Due: {format(new Date(item.data.dueDate), 'MMM d, yyyy')}
                </p>
              )}
              {item.data.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.data.description}</p>
              )}
            </div>
          )}

          {item.type === 'interaction' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{item.data.type}</span>
              </div>
              {(item.data.summary || item.data.transcript) && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {item.data.summary || item.data.transcript}
                </p>
              )}
              {item.data.analysis && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {item.data.analysis.mindsetScore != null && (
                    <span className="text-muted-foreground">Mindset: <span className="font-semibold text-primary">{item.data.analysis.mindsetScore}</span></span>
                  )}
                  {item.data.analysis.skillScore != null && (
                    <span className="text-muted-foreground">Skill: <span className="font-semibold">{item.data.analysis.skillScore}</span></span>
                  )}
                  {item.data.analysis.confidenceScore != null && (
                    <span className="text-muted-foreground">Confidence: <span className="font-semibold text-amber-500">{item.data.analysis.confidenceScore}</span></span>
                  )}
                </div>
              )}
            </div>
          )}

          {item.type === 'consent' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="secondary" className={`text-xs ${
                  item.data.action === 'given' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  item.data.action === 'withdrawn' ? 'bg-red-500/15 text-red-700 dark:text-red-300' :
                  item.data.action === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  ''
                }`}>
                  {item.data.action}
                </Badge>
              </div>
              {item.data.notes && (
                <p className="text-sm text-muted-foreground">{item.data.notes}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ActivityCard({ item }: { item: { type: string; subType: string; date: string; title: string; details?: string; id: number } }) {
  const iconMap: Record<string, { icon: any; color: string; bg: string }> = {
    interaction: { icon: MessageSquare, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    booking: { icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    programme: { icon: Rocket, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
    event: { icon: Calendar, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    membership: { icon: Shield, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
    mou: { icon: FileText, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
    community_spend: { icon: DollarSign, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    legacy_report: { icon: History, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  };

  const config = iconMap[item.type] || iconMap.interaction;
  const Icon = config.icon;

  return (
    <Card className="p-4" data-testid={`activity-item-${item.type}-${item.id}`}>
      <div className="flex gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-xs text-muted-foreground font-medium" data-testid={`activity-date-${item.id}`}>
              {format(new Date(item.date), 'MMM d, yyyy')}
            </p>
            {item.subType && (
              <Badge variant="secondary" className="text-xs" data-testid={`activity-subtype-${item.id}`}>
                {item.subType}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-sm" data-testid={`activity-title-${item.id}`}>{item.title}</p>
          {item.details && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`activity-details-${item.id}`}>{item.details}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

const ETHNICITY_OPTIONS = [
  { group: "Polynesian", options: ["Samoan", "Tongan", "Cook Islands Māori", "Niuean", "Tokelauan", "Fijian", "Hawaiian", "Tahitian", "Māori", "Other Polynesian"] },
  { group: "Pacific", options: ["Micronesian", "Melanesian"] },
  { group: "European", options: ["NZ European/Pākehā", "Other European"] },
  { group: "Asian", options: ["Chinese", "Indian", "Other Asian"] },
  { group: "Other", options: ["Middle Eastern", "Latin American", "African", "Other"] },
];

function EthnicityQuickEdit({ contact }: { contact: any }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(contact.ethnicity || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(contact.ethnicity || []);
    }
  }, [open, contact.ethnicity]);

  const toggle = (eth: string) => {
    setSelected(prev =>
      prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contact.id}`, { ethnicity: selected });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contact.id] });
      toast({ title: "Ethnicity updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update ethnicity", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasEthnicity = contact.ethnicity && contact.ethnicity.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {hasEthnicity ? (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer group"
            data-testid="button-quick-edit-ethnicity"
          >
            <div className="flex gap-1">
              {contact.ethnicity.map((e: string, i: number) => (
                <span key={i} className="after:content-[','] last:after:content-none">{e}</span>
              ))}
            </div>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1"
            data-testid="button-add-ethnicity"
          >
            + Add Ethnicity
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {ETHNICITY_OPTIONS.map((group) => (
            <div key={group.group}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{group.group}</p>
              <div className="space-y-1">
                {group.options.map((eth) => (
                  <label
                    key={eth}
                    className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5"
                    data-testid={`quick-ethnicity-${eth.toLowerCase().replace(/[\s/]+/g, '-')}`}
                  >
                    <Checkbox
                      checked={selected.includes(eth)}
                      onCheckedChange={() => toggle(eth)}
                    />
                    {eth}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} data-testid="button-cancel-ethnicity">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-ethnicity">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditContactDialog({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (v: boolean) => void; contact: any }) {
  const { toast } = useToast();
  const [name, setName] = useState(contact.name || "");
  const [nickname, setNickname] = useState(contact.nickname || "");
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [location, setLocation] = useState(contact.location || "");
  const [suburb, setSuburb] = useState(contact.suburb || "");
  const [suburbSearch, setSuburbSearch] = useState(contact.suburb || "");
  const [localBoard, setLocalBoard] = useState(contact.localBoard || "");
  const [showSuburbDropdown, setShowSuburbDropdown] = useState(false);
  const [businessName, setBusinessName] = useState(contact.businessName || "");
  const [businessSearch, setBusinessSearch] = useState(contact.businessName || "");
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [showQuickAddBusiness, setShowQuickAddBusiness] = useState(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [showQuickAddEmail, setShowQuickAddEmail] = useState(false);
  const [quickAddEmailName, setQuickAddEmailName] = useState("");
  const [role, setRole] = useState(contact.role || "Entrepreneur");
  const [age, setAge] = useState(contact.age?.toString() || "");
  const [revenueBand, setRevenueBand] = useState(contact.revenueBand || "");
  const [selectedEthnicities, setSelectedEthnicities] = useState<string[]>(contact.ethnicity || []);
  const suburbRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);

  const { data: allContacts } = useContacts();
  const { data: allGroups } = useGroups();
  const createContact = useCreateContact();
  const createGroup = useCreateGroup();

  const filteredEmailContacts = useMemo(() => {
    if (!allContacts || !email.trim()) return [];
    const term = email.toLowerCase();
    return allContacts
      .filter((c: any) => c.id !== contact.id && c.email && c.email.toLowerCase().includes(term))
      .slice(0, 8);
  }, [allContacts, email, contact.id]);

  const filteredGroups = useMemo(() => {
    if (!allGroups || !businessSearch.trim()) return [];
    const term = businessSearch.toLowerCase();
    return (allGroups as any[]).filter((g: any) => g.name.toLowerCase().includes(term)).slice(0, 8);
  }, [allGroups, businessSearch]);

  const suburbResults = searchSuburbs(suburbSearch);

  useEffect(() => {
    if (open) {
      setName(contact.name || "");
      setNickname(contact.nickname || "");
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setLocation(contact.location || "");
      setSuburb(contact.suburb || "");
      setSuburbSearch(contact.suburb || "");
      setLocalBoard(contact.localBoard || "");
      setBusinessName(contact.businessName || "");
      setBusinessSearch(contact.businessName || "");
      setRole(contact.role || "Entrepreneur");
      setAge(contact.age?.toString() || "");
      setRevenueBand(contact.revenueBand || "");
      setSelectedEthnicities(contact.ethnicity || []);
      setShowEmailDropdown(false);
      setShowBusinessDropdown(false);
      setShowQuickAddEmail(false);
      setShowQuickAddBusiness(false);
      setQuickAddEmailName("");
    }
  }, [open, contact]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suburbRef.current && !suburbRef.current.contains(e.target as Node)) {
        setShowSuburbDropdown(false);
      }
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) {
        setShowEmailDropdown(false);
      }
      if (businessRef.current && !businessRef.current.contains(e.target as Node)) {
        setShowBusinessDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickAddEmailContact = async () => {
    if (!quickAddEmailName.trim() || !email.trim()) return;
    try {
      await createContact.mutateAsync({ name: quickAddEmailName.trim(), email: email.trim(), role: "Professional" });
      setShowQuickAddEmail(false);
      setQuickAddEmailName("");
    } catch (err: any) {}
  };

  const handleQuickAddGroup = async () => {
    if (!businessSearch.trim()) return;
    try {
      const newGroup = await createGroup.mutateAsync({ name: businessSearch.trim(), type: "Organisation" });
      setBusinessName(businessSearch.trim());
      setShowQuickAddBusiness(false);
      setShowBusinessDropdown(false);
    } catch (err: any) {}
  };

  const toggleEthnicity = (eth: string) => {
    setSelectedEthnicities(prev =>
      prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth]
    );
  };

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/contacts/${contact.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/:id', contact.id] });
      toast({ title: "Contact updated" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      nickname: nickname.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      location: location.trim() || null,
      suburb: suburb.trim() || null,
      localBoard: localBoard.trim() || null,
      businessName: businessName.trim() || null,
      role: role,
      age: age ? parseInt(age) : null,
      revenueBand: revenueBand || null,
      ethnicity: selectedEthnicities,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-nickname">Preferred Name / Nickname</Label>
              <Input
                id="edit-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. 'AJ' or 'Mana'"
                data-testid="input-edit-nickname"
              />
            </div>
            <div className="space-y-2" ref={emailRef}>
              <Label htmlFor="edit-email">Email</Label>
              <div className="relative">
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setShowEmailDropdown(true);
                    setShowQuickAddEmail(false);
                  }}
                  onFocus={() => email.trim() && setShowEmailDropdown(true)}
                  placeholder="Search or enter email..."
                  data-testid="input-edit-email"
                />
                {showEmailDropdown && email.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredEmailContacts.length > 0 ? (
                      filteredEmailContacts.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                          onClick={() => {
                            setEmail(c.email);
                            setShowEmailDropdown(false);
                          }}
                          data-testid={`email-option-${c.id}`}
                        >
                          <span className="truncate">{c.email}</span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">{c.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground" data-testid="text-no-email-matches">
                        <p>No matching contacts found</p>
                        {!showQuickAddEmail && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-1"
                            onClick={() => setShowQuickAddEmail(true)}
                            data-testid="button-quick-add-email-contact"
                          >
                            + Quick Add as new contact
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {showQuickAddEmail && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={quickAddEmailName}
                      onChange={(e) => setQuickAddEmailName(e.target.value)}
                      placeholder="Contact name for this email..."
                      className="flex-1"
                      data-testid="input-quick-add-email-name"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleQuickAddEmailContact}
                      disabled={!quickAddEmailName.trim() || createContact.isPending}
                      data-testid="button-save-quick-add-email"
                    >
                      {createContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowQuickAddEmail(false); setQuickAddEmailName(""); }}
                      data-testid="button-cancel-quick-add-email"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2" ref={businessRef}>
              <Label htmlFor="edit-business">Business Name</Label>
              <div className="relative">
                <Input
                  id="edit-business"
                  value={businessSearch}
                  onChange={(e) => {
                    setBusinessSearch(e.target.value);
                    setBusinessName(e.target.value);
                    setShowBusinessDropdown(true);
                    setShowQuickAddBusiness(false);
                  }}
                  onFocus={() => businessSearch && setShowBusinessDropdown(true)}
                  placeholder="Search or enter business name..."
                  data-testid="input-edit-business"
                />
                {showBusinessDropdown && businessSearch.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                          onClick={() => {
                            setBusinessName(g.name);
                            setBusinessSearch(g.name);
                            setShowBusinessDropdown(false);
                          }}
                          data-testid={`business-option-${g.id}`}
                        >
                          <span className="truncate">{g.name}</span>
                          {g.type && <span className="text-xs text-muted-foreground ml-2 shrink-0">{g.type}</span>}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground" data-testid="text-no-business-matches">
                        <p>No matching groups found</p>
                        {!showQuickAddBusiness && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-1"
                            onClick={() => setShowQuickAddBusiness(true)}
                            data-testid="button-quick-add-business"
                          >
                            + Quick Add as new group
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {showQuickAddBusiness && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-muted-foreground truncate flex-1">Create "{businessSearch.trim()}"?</span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleQuickAddGroup}
                      disabled={!businessSearch.trim() || createGroup.isPending}
                      data-testid="button-save-quick-add-business"
                    >
                      {createGroup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowQuickAddBusiness(false)}
                      data-testid="button-cancel-quick-add-business"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Innovator">Innovator</SelectItem>
                  <SelectItem value="Want-trepreneur">Want-trepreneur</SelectItem>
                  <SelectItem value="Rangatahi">Rangatahi</SelectItem>
                  <SelectItem value="Business Owner">Business Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                data-testid="input-edit-location"
              />
            </div>
            <div className="space-y-2 col-span-2" ref={suburbRef}>
              <Label htmlFor="edit-suburb">Suburb</Label>
              <div className="relative">
                <Input
                  id="edit-suburb"
                  value={suburbSearch}
                  onChange={(e) => {
                    setSuburbSearch(e.target.value);
                    setShowSuburbDropdown(true);
                    if (!e.target.value.trim()) {
                      setSuburb("");
                      setLocalBoard("");
                    }
                  }}
                  onFocus={() => suburbSearch && setShowSuburbDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (suburbSearch.trim() && suburbSearch !== suburb) {
                        const board = getLocalBoard(suburbSearch.trim());
                        if (board) {
                          const matched = Object.keys(SUBURB_TO_LOCAL_BOARD).find(
                            k => k.toLowerCase() === suburbSearch.trim().toLowerCase()
                          );
                          if (matched) {
                            setSuburb(matched);
                            setSuburbSearch(matched);
                            setLocalBoard(board);
                          }
                        }
                      }
                    }, 200);
                  }}
                  placeholder="Type to search Auckland suburbs..."
                  data-testid="input-edit-suburb"
                />
                {showSuburbDropdown && suburbResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {suburbResults.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                        onClick={() => {
                          setSuburb(s);
                          setSuburbSearch(s);
                          const board = getLocalBoard(s);
                          if (board) setLocalBoard(board);
                          setShowSuburbDropdown(false);
                        }}
                        data-testid={`suburb-option-${s.toLowerCase().replace(/[\s/]+/g, '-')}`}
                      >
                        <span>{s}</span>
                        <span className="text-xs text-muted-foreground">{getLocalBoard(s)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {localBoard && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-local-board">
                  Local Board: <span className="font-medium text-foreground">{localBoard}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-age">Age</Label>
              <Input
                id="edit-age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                data-testid="input-edit-age"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-revenue">Revenue Band</Label>
              <Select value={revenueBand} onValueChange={setRevenueBand}>
                <SelectTrigger data-testid="select-edit-revenue">
                  <SelectValue placeholder="Select revenue band" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pre-revenue">Pre-revenue</SelectItem>
                  <SelectItem value="$0-$50k">$0-$50k</SelectItem>
                  <SelectItem value="$50k-$100k">$50k-$100k</SelectItem>
                  <SelectItem value="$100k-$250k">$100k-$250k</SelectItem>
                  <SelectItem value="$250k-$500k">$250k-$500k</SelectItem>
                  <SelectItem value="$500k-$1M">$500k-$1M</SelectItem>
                  <SelectItem value="$1M+">$1M+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Ethnicity</Label>
            <div className="border border-border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
              {ETHNICITY_OPTIONS.map((group) => (
                <div key={group.group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group.group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.options.map((eth) => (
                      <label
                        key={eth}
                        className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1"
                        data-testid={`checkbox-ethnicity-${eth.toLowerCase().replace(/[\s/]+/g, '-')}`}
                      >
                        <Checkbox
                          checked={selectedEthnicities.includes(eth)}
                          onCheckedChange={() => toggleEthnicity(eth)}
                        />
                        <span className="text-sm">{eth}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {selectedEthnicities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedEthnicities.map((eth) => (
                  <Badge key={eth} variant="secondary" className="text-xs gap-1 pr-1">
                    {eth}
                    <button
                      type="button"
                      onClick={() => toggleEthnicity(eth)}
                      aria-label={`Remove ${eth}`}
                      className="inline-flex items-center justify-center rounded-full"
                      data-testid={`button-remove-ethnicity-${eth.toLowerCase().replace(/[\s/]+/g, '-')}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending} data-testid="button-save-contact">
              <Check className="w-4 h-4 mr-1" /> Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordConsentDialog({ open, onOpenChange, contactId }: { open: boolean; onOpenChange: (v: boolean) => void; contactId: number }) {
  const [action, setAction] = useState("given");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { action: string; notes: string }) =>
      apiRequest('POST', `/api/contacts/${contactId}/consent`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', contactId, 'consent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setAction("given");
      setNotes("");
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ action, notes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Record Consent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="consent-status">Consent Status</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger data-testid="select-consent-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="given">Given</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consent-notes">Notes</Label>
            <Textarea
              id="consent-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this consent record..."
              className="resize-none"
              rows={3}
              data-testid="input-consent-notes"
            />
          </div>
          <DialogFooter>
            <Button type="submit" isLoading={mutation.isPending} className="w-full" data-testid="button-submit-consent">
              Save Consent Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogInteractionDialog({ contactId }: { contactId: number }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const { mutate: analyze, isPending: isAnalyzing } = useAnalyzeInteraction();
  const { mutate: createInteraction, isPending: isSaving } = useCreateInteraction();
  
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // @ts-ignore
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + " " + finalTranscript);
        }
      };
      
      setRecognition(recognition);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
      setIsRecording(false);
    } else {
      if (!recognition) {
        alert("Voice recording not supported in this browser.");
        return;
      }
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleAnalyze = () => {
    if (!transcript.trim()) return;
    analyze({ text: transcript }, {
      onSuccess: (data) => {
        setAnalysisResult(data);
      }
    });
  };

  const handleSave = () => {
    if (!analysisResult) return;
    
    createInteraction({
      contactId,
      date: new Date(),
      type: "Voice Note",
      transcript: transcript,
      summary: analysisResult.summary,
      analysis: {
        mindsetScore: analysisResult.metrics.mindset,
        skillScore: analysisResult.metrics.skill,
        confidenceScore: analysisResult.metrics.confidence,
        confidenceScoreMetric: analysisResult.metrics.confidenceScore,
        systemsInPlaceScore: analysisResult.metrics.systemsInPlace,
        fundingReadinessScore: analysisResult.metrics.fundingReadiness,
        networkStrengthScore: analysisResult.metrics.networkStrength,
        keyInsights: analysisResult.keywords
      },
      keywords: analysisResult.keywords
    });
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Log Interaction</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6 py-4">
        {!analysisResult ? (
          <>
            <div className="space-y-2">
              <Label>Voice Input</Label>
              <div className="flex gap-4">
                <Button 
                  type="button" 
                  variant={isRecording ? "destructive" : "secondary"} 
                  onClick={toggleRecording}
                  className={isRecording ? "animate-pulse" : ""}
                >
                  {isRecording ? (
                    <><StopCircle className="w-4 h-4 mr-2" /> Stop Recording</>
                  ) : (
                    <><Mic className="w-4 h-4 mr-2" /> Start Recording</>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground flex items-center">
                  {isRecording ? "Listening..." : "Click to record or type below"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript / Notes</Label>
              <Textarea 
                id="transcript" 
                value={transcript} 
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Speak or type your session notes here..."
                className="min-h-[150px] resize-none text-base p-4 bg-muted/30"
              />
            </div>
            
            <Button 
              onClick={handleAnalyze} 
              isLoading={isAnalyzing} 
              disabled={!transcript.trim()} 
              className="w-full"
            >
              Analyze with AI
            </Button>
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Analysis
              </h3>
              <p className="text-sm text-foreground/80 mb-4">{analysisResult.summary}</p>
              
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Mindset</div>
                  <div className="font-bold text-lg text-primary">{analysisResult.metrics.mindset}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Skill</div>
                  <div className="font-bold text-lg text-secondary-foreground">{analysisResult.metrics.skill}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-bold text-lg text-amber-500">{analysisResult.metrics.confidence}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Biz Conf.</div>
                  <div className="font-bold text-lg text-pink-500">{analysisResult.metrics.confidenceScore}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Systems</div>
                  <div className="font-bold text-lg text-cyan-500">{analysisResult.metrics.systemsInPlace}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Funding</div>
                  <div className="font-bold text-lg text-teal-500">{analysisResult.metrics.fundingReadiness}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Network</div>
                  <div className="font-bold text-lg text-orange-500">{analysisResult.metrics.networkStrength}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {analysisResult.keywords.map((k: string, i: number) => (
                  <span key={i} className="text-xs bg-background px-2 py-1 rounded-md border border-border text-muted-foreground">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAnalysisResult(null)} className="flex-1">
                Edit Notes
              </Button>
              <Button onClick={handleSave} isLoading={isSaving} className="flex-[2]">
                Save Interaction
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
