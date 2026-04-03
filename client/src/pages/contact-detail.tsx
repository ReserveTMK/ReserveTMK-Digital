import { useContact, useContacts } from "@/hooks/use-contacts";
import { useInteractions } from "@/hooks/use-interactions";
import { useActionItems } from "@/hooks/use-action-items";
import { useContactGroups, useGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember } from "@/hooks/use-groups";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Brain, TrendingUp, Sparkles, DollarSign, Settings, Rocket, Network, Users, ChevronLeft, ChevronRight, History } from "lucide-react";
import type { MentoringApplication } from "@shared/schema";
import { normalizeStage } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

import { ContactHeader } from "@/components/contacts/contact-header";
import { GrowthChart } from "@/components/contacts/growth-chart";
import { ActivityTab } from "@/components/contacts/activity-tab";
import type { TimelineItem } from "@/components/contacts/activity-tab";
import { MentoringTab } from "@/components/contacts/mentoring-tab";
import { EditContactDialog } from "@/components/contacts/contact-edit-dialog";
import { ContactGroups } from "@/components/contacts/contact-groups";


export default function ContactDetail() {
  const [match, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");
  const { data: contact, isLoading: contactLoading } = useContact(id);
  const { data: interactions, isLoading: interactionsLoading } = useInteractions(id);
  const { data: contactJourney } = useQuery<{
    debriefCount: number;
    milestones: Array<{ text: string; date: string; debriefTitle: string }>;
    quotes: Array<{ text: string; debriefTitle: string }>;
    sentimentArc: Array<{ date: string; sentiment: string; title: string }>;
  }>({
    queryKey: ['/api/contacts', id, 'journey'],
    queryFn: () => fetch(`/api/contacts/${id}/journey`, { credentials: 'include' }).then(r => r.json()),
    enabled: id > 0,
  });

  const { data: contactDebriefs } = useQuery({
    queryKey: ['/api/contacts', id, 'debriefs'],
    queryFn: () => fetch(`/api/contacts/${id}/debriefs`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });
  const { data: actionItems } = useActionItems();

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['/api/contacts', id, 'activity'],
    queryFn: () => fetch(`/api/contacts/${id}/activity`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });

  const { data: programmeRegistrations } = useQuery<any[]>({
    queryKey: ['/api/contacts', id, 'programme-registrations'],
    queryFn: () => fetch(`/api/contacts/${id}/programme-registrations`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });

  const { data: allApplications } = useQuery<MentoringApplication[]>({
    queryKey: ["/api/mentoring-applications"],
  });
  const contactApplication = allApplications?.find(a => a.contactId === id);

  const { data: contactGroups } = useContactGroups(id);
  const { data: allGroups } = useGroups();
  const addGroupMember = useAddGroupMember();
  const removeGroupMember = useRemoveGroupMember();
  const createGroupForTagging = useCreateGroup();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);
  const [catchUpPopoverOpen, setCatchUpPopoverOpen] = useState(false);
  const [catchUpNote, setCatchUpNote] = useState("");
  const [catchUpPriority, setCatchUpPriority] = useState("soon");
  const [showDetails, setShowDetails] = useState(false);

  const { data: stageHistory } = useQuery({
    queryKey: ['/api/relationship-stage-history', 'contact', id],
    queryFn: async () => {
      const res = await fetch(`/api/relationship-stage-history/contact/${id}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const { data: metricSnapshotsData } = useQuery<Array<{ id: number; contactId: number; metrics: any; source: string; createdAt: string }>>({
    queryKey: ['/api/contacts', id, 'metric-snapshots'],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${id}/metric-snapshots`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const { data: mentoringRelationships } = useQuery<any[]>({
    queryKey: ['/api/contacts', id, 'mentoring-relationships'],
    queryFn: () => fetch(`/api/contacts/${id}/mentoring-relationships`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!id,
  });

  const { data: mentorProfiles } = useQuery<any[]>({
    queryKey: ['/api/mentor-profiles'],
  });

  const stageMutation = useMutation({
    mutationFn: (stage: string) =>
      apiRequest('PATCH', `/api/contacts/${id}/relationship-stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/relationship-stage-history', 'contact', id] });
    },
  });

  type CatchUpItemData = {
    id: number;
    userId: string;
    contactId: number;
    note: string | null;
    priority: string | null;
    createdAt: string | null;
    dismissedAt: string | null;
    contactName: string | null;
    contactRole: string | null;
    contactStage: string | null;
    contactConnectionStrength: string | null;
    contactIsInnovator: boolean | null;
    contactIsCommunityMember: boolean | null;
  };

  const { data: catchUpItems } = useQuery<CatchUpItemData[]>({
    queryKey: ["/api/catch-up-list"],
  });

  const catchUpItem = catchUpItems?.find((item) => item.contactId === id);

  const addToCatchUpMutation = useMutation({
    mutationFn: async (data: { contactId: number; note: string; priority: string }) => {
      await apiRequest("POST", "/api/catch-up-list", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      setCatchUpPopoverOpen(false);
      setCatchUpNote("");
      setCatchUpPriority("soon");
      toast({ title: "Added to catch-up list" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const dismissCatchUpMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("PATCH", `/api/catch-up-list/${itemId}`, { dismiss: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list/history"] });
      toast({ title: "Marked as done" });
    },
  });

  const removeCatchUpMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/catch-up-list/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      toast({ title: "Removed from catch-up list" });
    },
  });

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  const { data: allContacts } = useContacts();
  const contactIds = useMemo(() => (allContacts || []).map((c: any) => c.id), [allContacts]);
  const currentIndex = contactIds.indexOf(id);
  const prevContactId = currentIndex >= 0 && contactIds.length > 1 ? contactIds[(currentIndex - 1 + contactIds.length) % contactIds.length] : null;
  const nextContactId = currentIndex >= 0 && contactIds.length > 1 ? contactIds[(currentIndex + 1) % contactIds.length] : null;

  const swipeRef = useRef<{ startX: number; startY: number; swiping: boolean }>({ startX: 0, startY: 0, swiping: false });
  const mainRef = useRef<HTMLElement>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  useEffect(() => {
    if (!isMobile || contactIds.length <= 1) return;
    const el = mainRef.current;
    if (!el) return;

    const SWIPE_THRESHOLD = 60;
    const VERTICAL_THRESHOLD_RATIO = 1.5;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      swipeRef.current = { startX: touch.clientX, startY: touch.clientY, swiping: true };
    };

    const onTouchMove = (_e: TouchEvent) => {};

    const onTouchEnd = (e: TouchEvent) => {
      if (!swipeRef.current.swiping) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - swipeRef.current.startX;
      const dy = touch.clientY - swipeRef.current.startY;
      swipeRef.current.swiping = false;

      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dy) > Math.abs(dx) / VERTICAL_THRESHOLD_RATIO) return;

      if (dx < 0 && nextContactId != null) {
        setLocation(`/contacts/${nextContactId}`);
      } else if (dx > 0 && prevContactId != null) {
        setLocation(`/contacts/${prevContactId}`);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile, contactIds, prevContactId, nextContactId, setLocation]);

  useEffect(() => {
    if (showSwipeHint) {
      const timer = setTimeout(() => setShowSwipeHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSwipeHint, id]);

  const currentTier = contact?.isInnovator ? "innovator" : contact?.isCommunityMember ? "community" : "all";

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${id}/promote`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', id] });
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      toast({ title: `Promoted to ${data.newTier === 'innovator' ? 'Innovator' : 'Community'}` });
    },
    onError: () => {
      toast({ title: "Failed to promote", variant: "destructive" });
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${id}/demote`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', id] });
      toast({ title: `Demoted to ${data.newTier === 'innovator' ? 'Innovator' : data.newTier === 'community' ? 'Community' : 'All'}` });
    },
    onError: () => {
      toast({ title: "Failed to demote", variant: "destructive" });
    },
  });

  const toggleVipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${id}/toggle-vip`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', id] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/vip"] });
      toast({ title: data.isVip ? "Marked as VIP" : "VIP removed" });
    },
    onError: () => {
      toast({ title: "Failed to toggle VIP", variant: "destructive" });
    },
  });

  const toggleRangatahiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${id}/toggle-rangatahi`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', id] });
      toast({ title: data.isRangatahi ? "Marked as Rangatahi" : "Rangatahi flag removed" });
    },
    onError: () => {
      toast({ title: "Failed to toggle Rangatahi", variant: "destructive" });
    },
  });

  const snapshotChartData = useMemo(() => {
    const points: Array<{ date: string; timestamp: number; source: string; mindset?: number; skill?: number; confidence?: number; bizConfidence?: number; systems?: number; funding?: number; network?: number; community?: number }> = [];

    if (metricSnapshotsData && metricSnapshotsData.length > 0) {
      const sorted = [...metricSnapshotsData].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      for (const snap of sorted) {
        const m = snap.metrics || {};
        points.push({
          date: format(new Date(snap.createdAt), 'MM/dd/yy'),
          timestamp: new Date(snap.createdAt).getTime(),
          source: snap.source,
          mindset: m.mindset,
          skill: m.skill,
          confidence: m.confidence,
          bizConfidence: m.bizConfidence || m.confidenceScore,
          systems: m.systemsInPlace,
          funding: m.fundingReadiness,
          network: m.networkStrength,
          community: m.communityImpact,
        });
      }
    }

    if (contact?.metrics) {
      const m = contact.metrics as any;
      points.push({
        date: "Current",
        timestamp: Date.now(),
        source: "current",
        mindset: m.mindset,
        skill: m.skill,
        confidence: m.confidence,
        bizConfidence: m.bizConfidence || m.confidenceScore,
        systems: m.systemsInPlace,
        funding: m.fundingReadiness,
        network: m.networkStrength,
        community: m.communityImpact,
      });
    }

    return points;
  }, [metricSnapshotsData, contact?.metrics]);

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
        <Link href="/community/people"><Button>Go Back</Button></Link>
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
      bizConfidence: i.analysis?.bizConfidenceScore || i.analysis?.confidenceScoreMetric || 0,
      systems: i.analysis?.systemsInPlaceScore || 0,
      funding: i.analysis?.fundingReadinessScore || 0,
      network: i.analysis?.networkStrengthScore || 0,
    }));

  const timelineItems: TimelineItem[] = [];

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

  (programmeRegistrations || []).forEach((reg: any) => {
    timelineItems.push({
      date: new Date(reg.registeredAt),
      type: 'programme_registration',
      data: reg,
    });
  });

  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <>
    <main ref={mainRef} className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto relative">
        {isMobile && contactIds.length > 1 && (
          <>
            <button
              onClick={() => prevContactId != null && setLocation(`/contacts/${prevContactId}`)}
              className={cn(
                "fixed left-0 top-1/2 -translate-y-1/2 z-40 p-1 rounded-r-md bg-muted/60 text-muted-foreground transition-opacity duration-500",
                showSwipeHint ? "opacity-70" : "opacity-20"
              )}
              aria-label="Previous contact"
              data-testid="button-swipe-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => nextContactId != null && setLocation(`/contacts/${nextContactId}`)}
              className={cn(
                "fixed right-0 top-1/2 -translate-y-1/2 z-40 p-1 rounded-l-md bg-muted/60 text-muted-foreground transition-opacity duration-500",
                showSwipeHint ? "opacity-70" : "opacity-20"
              )}
              aria-label="Next contact"
              data-testid="button-swipe-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <ContactHeader
            contact={contact}
            id={id}
            interactions={interactions}
            currentTier={currentTier}
            isMobile={isMobile}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            editDialogOpen={editDialogOpen}
            setEditDialogOpen={setEditDialogOpen}
            stageMutation={stageMutation}
            promoteMutation={promoteMutation}
            demoteMutation={demoteMutation}
            toggleVipMutation={toggleVipMutation}
            toggleRangatahiMutation={toggleRangatahiMutation}
            catchUpItem={catchUpItem}
            catchUpPopoverOpen={catchUpPopoverOpen}
            setCatchUpPopoverOpen={setCatchUpPopoverOpen}
            catchUpNote={catchUpNote}
            setCatchUpNote={setCatchUpNote}
            catchUpPriority={catchUpPriority}
            setCatchUpPriority={setCatchUpPriority}
            addToCatchUpMutation={addToCatchUpMutation}
            dismissCatchUpMutation={dismissCatchUpMutation}
            removeCatchUpMutation={removeCatchUpMutation}
          />

          {/* Current Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            <MetricCard
              title="Mindset"
              value={contact.metrics?.mindset || "-"}
              icon={<Brain className="w-5 h-5" />}
              color="primary"
              data-testid="metric-mindset"
            />
            <MetricCard
              title="Skill"
              value={contact.metrics?.skill || "-"}
              icon={<Sparkles className="w-5 h-5" />}
              color="secondary"
              data-testid="metric-skill"
            />
            <MetricCard
              title="Confidence"
              value={contact.metrics?.confidence || "-"}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
              data-testid="metric-confidence"
            />
            <MetricCard
              title="Biz Confidence"
              value={contact.metrics?.bizConfidence || contact.metrics?.confidenceScore || "-"}
              icon={<Rocket className="w-5 h-5" />}
              color="primary"
              data-testid="metric-biz-confidence"
            />
            <MetricCard
              title="Systems"
              value={contact.metrics?.systemsInPlace || "-"}
              icon={<Settings className="w-5 h-5" />}
              color="secondary"
              data-testid="metric-systems"
            />
            <MetricCard
              title="Funding Ready"
              value={contact.metrics?.fundingReadiness || "-"}
              icon={<DollarSign className="w-5 h-5" />}
              color="green"
              data-testid="metric-funding"
            />
            <MetricCard
              title="Network"
              value={contact.metrics?.networkStrength || "-"}
              icon={<Network className="w-5 h-5" />}
              color="primary"
              data-testid="metric-network"
            />
            <MetricCard
              title="Community"
              value={contact.metrics?.communityImpact || "-"}
              icon={<Users className="w-5 h-5" />}
              color="secondary"
              data-testid="metric-community-impact"
            />
          </div>

          {/* Group Memberships */}
          <ContactGroups
            contactId={id}
            contactGroups={contactGroups}
            allGroups={allGroups}
            addGroupMember={addGroupMember}
            removeGroupMember={removeGroupMember}
            createGroupForTagging={createGroupForTagging}
          />

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
            <TabsList className="bg-card border border-border p-1 rounded-xl w-full overflow-x-auto flex-nowrap justify-start sm:justify-center">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-overview">Overview</TabsTrigger>
              {mentoringRelationships && mentoringRelationships.length > 0 && (
                <TabsTrigger value="mentoring" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-mentoring">Mentoring</TabsTrigger>
              )}
              <TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <GrowthChart
                snapshotChartData={snapshotChartData}
                chartData={chartData}
                metricSnapshotsData={metricSnapshotsData}
                contactJourney={contactJourney}
              />
            </TabsContent>

            {mentoringRelationships && mentoringRelationships.length > 0 && (
              <TabsContent value="mentoring" className="space-y-6" data-testid="mentoring-content">
                <MentoringTab
                  mentoringRelationships={mentoringRelationships}
                  mentorProfiles={mentorProfiles}
                  contactMetrics={contact?.metrics as Record<string, number> | undefined}
                />
              </TabsContent>
            )}

            <TabsContent value="activity" className="space-y-4" data-testid="activity-content">
              <ActivityTab
                interactions={interactions}
                interactionsLoading={interactionsLoading}
                programmeRegistrations={programmeRegistrations}
                timelineItems={timelineItems}
                activityData={activityData}
                activityLoading={activityLoading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
      />
    </>
  );
}
