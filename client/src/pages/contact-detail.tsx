import { useContact } from "@/hooks/use-contacts";
import { useInteractions, useCreateInteraction, useAnalyzeInteraction } from "@/hooks/use-interactions";
import { useActionItems } from "@/hooks/use-action-items";
import { useContactGroups } from "@/hooks/use-groups";
import { Button } from "@/components/ui/beautiful-button";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mic, StopCircle, ArrowLeft, Brain, TrendingUp, Sparkles, AlertCircle, DollarSign, Settings, Rocket, Network, Shield, FileText, CheckSquare, Calendar, Clock } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
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

  const { data: contactGroups } = useContactGroups(id);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

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
                  <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground">{contact.name}</h1>
                  {contact.businessName && (
                    <p className="text-muted-foreground/80 text-base" data-testid="text-business-name">{contact.businessName}</p>
                  )}
                  <p className="text-muted-foreground text-lg">{contact.role}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {contact.age && <span>{contact.age} years old</span>}
                    {contact.ethnicity && contact.ethnicity.length > 0 && (
                      <div className="flex gap-1">
                        {contact.ethnicity.map((e, i) => (
                          <span key={i} className="after:content-[','] last:after:content-none">{e}</span>
                        ))}
                      </div>
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
          {contactGroups && contactGroups.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <Network className="w-4 h-4" />
                Group Memberships
              </h3>
              <div className="flex flex-wrap gap-2">
                {contactGroups.map((gm: any) => (
                  <Link key={gm.id} href="/groups">
                    <Badge className="cursor-pointer" data-testid={`badge-group-membership-${gm.id}`}>
                      {gm.groupName || `Group #${gm.groupId}`}
                      {gm.role && <span className="ml-1 opacity-70">({gm.role})</span>}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tabs Content */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card border border-border p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-history">History</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-timeline">Timeline</TabsTrigger>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="mindset" stroke="#8b5cf6" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="skill" stroke="#10b981" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="confidence" stroke="#f59e0b" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="bizConfidence" name="Biz Confidence" stroke="#ec4899" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="systems" name="Systems" stroke="#06b6d4" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="funding" name="Funding" stroke="#14b8a6" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
                        <Line type="monotone" dataKey="network" name="Network" stroke="#f97316" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
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
          </Tabs>
        </div>
      </main>

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
