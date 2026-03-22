import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { useContacts } from "@/hooks/use-contacts";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, useSearch } from "wouter";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { format, isBefore } from "date-fns";
import {
  Plus,
  Loader2,
  Trash2,
  HeartHandshake,
  Search,
  Pencil,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  Coffee,
  AlertTriangle,
  UserPlus,
  Building2,
  RefreshCw,
  ArrowRight,
  Mic,
  Calendar as CalendarIcon,
  Eye,
  Sprout,
  TreePine,
  Sun,
  Users,
  Lightbulb,
} from "lucide-react";
import type { ImpactLog, Event, Contact } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ReviewView } from "@/components/debriefs/review-view";

import { CalendarDebriefTab } from "@/components/debriefs/calendar-debrief-tab";
import { WeeklyDebriefTab } from "@/components/debriefs/weekly-debrief-tab";
import { NewDebriefDialog } from "@/components/debriefs/new-debrief-dialog";
import { ManualUpdateDialog } from "@/components/debriefs/manual-update-dialog";
import { DebriefCardList } from "@/components/debriefs/shared";
import { DebriefBoard } from "@/components/debriefs/debrief-board";
import {
  useEnrichedRelationships,
  useMentoringApplications,
  isOverdue,
  FREQUENCY_DAYS,
  type EnrichedRelationship,
} from "@/components/mentoring/mentoring-hooks";

export default function Debriefs() {
  const params = useParams<{ id?: string }>();
  const id = params.id ? parseInt(params.id) : undefined;

  if (id) {
    return <ReviewView id={id} />;
  }
  return <ListView />;
}

function ListView() {
  const { data: logs, isLoading } = useImpactLogs() as { data: ImpactLog[] | undefined; isLoading: boolean };
  const [createOpen, setCreateOpen] = useState(false);
  const [manualUpdateOpen, setManualUpdateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImpactLog | null>(null);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const params = new URLSearchParams(searchString);
  const tabParam = params.get("tab");
  const reconcileId = params.get("reconcile");
  const [activeTab, setActiveTab] = useState(tabParam || "queue");

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = tab === "queue" ? "/debriefs" : `/debriefs?tab=${tab}`;
    window.history.replaceState(null, "", url);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/impact-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      toast({ title: "Debrief deleted", description: "The debrief has been removed." });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    },
  });

  const allLogs = logs || [];
  const manualUpdates = useMemo(() => allLogs.filter(l => l.type === "manual_update"), [allLogs]);
  const archivedLogs = useMemo(() => allLogs.filter(l => l.status === "confirmed"), [allLogs]);

  return (
    <>
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-debriefs-title">Debriefs</h1>
              <p className="text-muted-foreground mt-1">Record, review, and track all debrief activity</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setManualUpdateOpen(true)} data-testid="button-new-manual-update">
                <HeartHandshake className="w-4 h-4 mr-2" />
                Manual Update
              </Button>
              <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-new-debrief">
                <Plus className="w-4 h-4 mr-2" />
                New Debrief
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full grid grid-cols-5" data-testid="tabs-debriefs">
              <TabsTrigger value="queue" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-queue">Board</TabsTrigger>
              <TabsTrigger value="operations" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-operations">Ops</TabsTrigger>
              <TabsTrigger value="archive" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-archive">Archive</TabsTrigger>
              <TabsTrigger value="weekly" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-weekly">Weekly</TabsTrigger>
              <TabsTrigger value="updates" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-updates">Updates</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4">
              <DebriefBoard />
            </TabsContent>

            <TabsContent value="operations" className="mt-4">
              <OperationsView />
            </TabsContent>

            <TabsContent value="archive" className="mt-4">
              <ArchiveView
                logs={archivedLogs}
                isLoading={isLoading}
                onSelect={(id) => setLocation(`/debriefs/${id}`)}
                onDelete={setDeleteTarget}
              />
            </TabsContent>

            <TabsContent value="weekly" className="mt-4">
              <WeeklyDebriefTab />
            </TabsContent>

            <TabsContent value="updates" className="mt-4">
              <DebriefCardList
                logs={manualUpdates}
                isLoading={isLoading}
                onSelect={(id) => setLocation(`/debriefs/${id}`)}
                onDelete={setDeleteTarget}
                onCreateNew={() => setManualUpdateOpen(true)}
                emptyIcon={<HeartHandshake className="w-8 h-8 text-muted-foreground" />}
                emptyTitle="No manual updates yet"
                emptyDescription="Log a conversation, news update, or informal connection."
                emptyButtonText="New Manual Update"
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <NewDebriefDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ManualUpdateDialog open={manualUpdateOpen} onOpenChange={setManualUpdateOpen} />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Debrief</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OperationsView() {
  const { data: contacts } = useContacts();
  const { data: bookings } = useBookings();
  const { data: venues } = useVenues();
  const { data: impactLogs } = useImpactLogs() as { data: ImpactLog[] | undefined };
  const { toast } = useToast();

  const { data: debriefQueue } = useQuery<any[]>({
    queryKey: ["/api/events/needs-debrief"],
  });

  const { data: outstandingActions } = useQuery<{
    id: number; title: string; status: string; dueDate: string | null; contactId: number | null; impactLogId: number | null; createdAt: string;
  }[]>({
    queryKey: ["/api/dashboard/outstanding-actions"],
  });

  const { data: enrichedRelationships } = useEnrichedRelationships();
  const { data: mentoringApplications } = useMentoringApplications();

  const { data: catchUpItems } = useQuery<{
    id: number; contactId: number; note: string | null; priority: string; createdAt: string;
    contactName?: string; contactRole?: string; contactStage?: string; connectionStrength?: string;
  }[]>({
    queryKey: ["/api/catch-up-list"],
  });

  const { data: changeRequests } = useQuery<any[]>({
    queryKey: ['/api/booking-change-requests'],
  });

  const { data: mentoringRelationships } = useQuery<any[]>({
    queryKey: ["/api/mentoring-relationships"],
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("DELETE", `/api/events/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete event", description: err.message, variant: "destructive" });
    },
  });

  const skipDebriefMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("POST", `/api/events/${id}/skip-debrief`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      toast({ title: "Debrief dismissed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to dismiss debrief", description: err.message, variant: "destructive" });
    },
  });

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [skipTarget, setSkipTarget] = useState<any | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const debriefAttention = useMemo(() => {
    const items: { id: number; eventId: number | null; name: string; date: string; status: string; statusColor: string; link: string; type: "event" | "debrief" }[] = [];
    (debriefQueue || []).forEach((item: any) => {
      items.push({
        id: item.id, eventId: item.id, name: item.name,
        date: item.startTime ? format(new Date(item.startTime), "d MMM") : "",
        status: item.queueStatus === "overdue" ? "Overdue" : "Needs Debrief",
        statusColor: item.queueStatus === "overdue" ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        link: `/debriefs?tab=queue&reconcile=${item.id}`, type: "event",
      });
    });
    (impactLogs as any[] || [])
      .filter((l: any) => l.status !== "confirmed")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((l: any) => {
        items.push({
          id: l.id, eventId: l.eventId || null, name: l.title || "Untitled debrief",
          date: l.createdAt ? format(new Date(l.createdAt), "d MMM") : "",
          status: l.status === "draft" ? "Draft" : l.status === "reviewed" ? "Reviewed" : "Pending",
          statusColor: l.status === "draft" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300",
          link: `/debriefs/${l.id}`, type: "debrief",
        });
      });
    return items;
  }, [debriefQueue, impactLogs]);

  const overdueMentees = useMemo(() => {
    if (!enrichedRelationships) return [];
    return enrichedRelationships
      .filter((r: EnrichedRelationship) => isOverdue(r))
      .map((r: EnrichedRelationship) => {
        const daysSince = r.lastSessionDate
          ? Math.floor((Date.now() - new Date(r.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const threshold = FREQUENCY_DAYS[r.sessionFrequency || "monthly"] || 30;
        return { ...r, daysSince, daysOverdue: daysSince - threshold };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [enrichedRelationships]);

  const pendingApplicationCount = useMemo(() => {
    if (!mentoringApplications) return 0;
    return mentoringApplications.filter((a: any) => a.status === "pending").length;
  }, [mentoringApplications]);

  const pendingEnquiries = useMemo(() => {
    if (!bookings) return [];
    return (bookings as any[]).filter((b: any) => b.status === "enquiry");
  }, [bookings]);

  const pendingChangeRequests = useMemo(() => {
    if (!changeRequests) return [];
    return changeRequests.filter((cr: any) => cr.status === "pending");
  }, [changeRequests]);

  const catchUpSummary = useMemo(() => {
    if (!catchUpItems || catchUpItems.length === 0) return null;
    const urgent = catchUpItems.filter(i => i.priority === "urgent");
    const soon = catchUpItems.filter(i => i.priority === "soon");
    const whenever = catchUpItems.filter(i => i.priority === "whenever");
    const topItems = [...urgent, ...soon, ...whenever].slice(0, 5);
    return { total: catchUpItems.length, urgentCount: urgent.length, soonCount: soon.length, wheneverCount: whenever.length, topItems };
  }, [catchUpItems]);

  const journeySnapshot = useMemo(() => {
    const kakano = contacts?.filter((c: any) => c.stage === "kakano").length || 0;
    const tipu = contacts?.filter((c: any) => c.stage === "tipu").length || 0;
    const ora = contacts?.filter((c: any) => c.stage === "ora").length || 0;
    const inactive = contacts?.filter((c: any) => c.stage === "inactive").length || 0;
    const activeMentoring = mentoringRelationships?.filter((r: any) => r.status === "active").length || 0;
    const communityCount = (contacts as any[])?.filter((c: any) => c.isCommunityMember).length || 0;
    const innovatorCount = (contacts as any[])?.filter((c: any) => c.isInnovator).length || 0;
    return { kakano, tipu, ora, inactive, activeMentoring, communityCount, innovatorCount };
  }, [contacts, mentoringRelationships]);

  return (
    <>
      <div className="space-y-4">
        {debriefAttention.length > 0 && (
          <Card className="border-l-4 border-l-amber-500 p-4 md:p-6" data-testid="card-debriefs-attention">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display" data-testid="text-debriefs-attention-heading">Debriefs Needing Attention</h2>
                  <p className="text-sm text-muted-foreground">{debriefAttention.length} item{debriefAttention.length !== 1 ? "s" : ""} to review</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {debriefAttention.slice(0, 6).map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40" data-testid={`debrief-attention-${item.type}-${item.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${item.statusColor}`}>{item.status}</Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link href={item.link}>
                      <Button size="sm" variant="default" className="gap-1" data-testid={`button-log-debrief-${item.type}-${item.id}`}>
                        <Mic className="w-3 h-3" /> Log
                      </Button>
                    </Link>
                    {item.type === "event" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground"
                        onClick={() => { setSkipTarget(item); setSkipReason(""); }}
                        data-testid={`button-skip-debrief-${item.id}`}
                      >Dismiss</Button>
                    )}
                    {item.type === "event" && (
                      <Button size="sm" variant="ghost"
                        onClick={() => { setDeleteTarget(item); setDeleteReason(""); }}
                        data-testid={`button-delete-event-${item.id}`}
                      ><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {outstandingActions && outstandingActions.length > 0 && (
          <Card className="border-l-4 border-l-orange-500 p-4 md:p-6" data-testid="card-outstanding-actions">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <ListChecks className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display" data-testid="text-outstanding-actions-title">Outstanding Actions</h2>
                  <p className="text-sm text-muted-foreground">{outstandingActions.length} action{outstandingActions.length !== 1 ? "s" : ""} needing follow-up</p>
                </div>
              </div>
              <Link href="/actions" data-testid="link-view-all-actions">
                <Button variant="outline" size="sm" className="gap-1">View All <ArrowRight className="w-4 h-4" /></Button>
              </Link>
            </div>
            <div className="space-y-2">
              {outstandingActions.slice(0, 5).map((action) => {
                const contact = contacts?.find((c: Contact) => c.id === action.contactId);
                const actionOverdue = action.dueDate ? isBefore(new Date(action.dueDate), new Date()) : false;
                return (
                  <div key={action.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`action-item-${action.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge variant="secondary" className={`shrink-0 text-xs ${action.status === "pending" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"}`}>
                        {action.status === "in_progress" ? "In Progress" : "Pending"}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{action.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {contact && <span className="text-xs text-muted-foreground">{contact.name}</span>}
                          {action.dueDate && (
                            <span className={`text-xs ${actionOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                              Due {format(new Date(action.dueDate), "d MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {(pendingEnquiries.length > 0 || pendingChangeRequests.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingEnquiries.length > 0 && (
              <Card className="border-l-4 border-l-yellow-500 p-4 md:p-6" data-testid="card-pending-enquiries">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Building2 className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold" data-testid="text-pending-enquiries-heading">Venue Enquiries</h3>
                      <p className="text-xs text-muted-foreground">{pendingEnquiries.length} enquir{pendingEnquiries.length !== 1 ? "ies" : "y"} awaiting review</p>
                    </div>
                  </div>
                  <Link href="/spaces?tab=venue-hire" data-testid="link-review-enquiries">
                    <Button size="sm" className="gap-1">Review <ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {pendingEnquiries.slice(0, 4).map((b: any) => {
                    const venueName = venues?.find((v: any) => v.id === b.venueId)?.name || "Venue";
                    const dateStr = b.startDate ? new Date(b.startDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" }) : "";
                    return (
                      <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors" data-testid={`enquiry-card-${b.id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{b.bookerName || b.title}</p>
                          <p className="text-xs text-muted-foreground">{venueName} · {dateStr}{b.startTime ? ` · ${b.startTime}` : ""}</p>
                        </div>
                        <Link href={`/bookings/${b.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`enquiry-view-${b.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                  {pendingEnquiries.length > 4 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">+ {pendingEnquiries.length - 4} more</p>
                  )}
                </div>
              </Card>
            )}
            {pendingChangeRequests.length > 0 && (
              <Card className="border-l-4 border-l-orange-500 p-4 md:p-6" data-testid="card-pending-change-requests">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <RefreshCw className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold">Booking Change Requests</h3>
                    <p className="text-xs text-muted-foreground">{pendingChangeRequests.length} change request{pendingChangeRequests.length !== 1 ? "s" : ""} pending</p>
                  </div>
                  <Link href="/spaces?tab=venue-hire" data-testid="link-review-change-requests">
                    <Button size="sm" className="gap-1" data-testid="button-review-change-requests">Review <ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        )}

        {catchUpSummary && (
          <Card className="border-l-4 border-l-teal-500 p-4 md:p-6" data-testid="card-catch-up-summary">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <Coffee className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display" data-testid="text-catch-up-heading">Catch Up</h2>
                  <p className="text-sm text-muted-foreground">
                    {catchUpSummary.total} contact{catchUpSummary.total !== 1 ? "s" : ""} to catch up with
                    {catchUpSummary.urgentCount > 0 || catchUpSummary.soonCount > 0 ? " — " : ""}
                    {[
                      catchUpSummary.urgentCount > 0 ? `${catchUpSummary.urgentCount} urgent` : "",
                      catchUpSummary.soonCount > 0 ? `${catchUpSummary.soonCount} soon` : "",
                    ].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
              <Link href="/catch-up" data-testid="link-view-all-catchup">
                <Button variant="outline" size="sm" className="gap-1" data-testid="button-view-all-catchup">View All <ArrowRight className="w-4 h-4" /></Button>
              </Link>
            </div>
            <div className="space-y-1.5">
              {catchUpSummary.topItems.map((item) => {
                const addedDate = new Date(item.createdAt);
                const daysAgo = Math.floor((Date.now() - addedDate.getTime()) / (1000 * 60 * 60 * 24));
                const priorityColor = item.priority === "urgent"
                  ? "bg-red-500/15 text-red-700 dark:text-red-300"
                  : item.priority === "soon"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground";
                return (
                  <Link key={item.id} href={`/contacts/${item.contactId}`}>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.contactName || "Contact"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {item.note && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.note}</span>}
                          <span className="text-xs text-muted-foreground">{daysAgo === 0 ? "added today" : `added ${daysAgo}d ago`}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${priorityColor}`}>{item.priority}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {(overdueMentees.length > 0 || pendingApplicationCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overdueMentees.length > 0 && (
              <Card className="border-l-4 border-l-red-500 p-4 md:p-6" data-testid="card-overdue-mentees">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">Overdue Mentees</h3>
                      <p className="text-xs text-muted-foreground">{overdueMentees.length} mentee{overdueMentees.length !== 1 ? "s" : ""} past due</p>
                    </div>
                  </div>
                  <Link href="/mentoring" data-testid="link-view-overdue-mentees">
                    <Button variant="ghost" size="sm" className="gap-1 text-primary" data-testid="button-view-overdue-mentees">View <ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {overdueMentees.slice(0, 4).map((r) => (
                    <Link key={r.id} href={`/contacts/${r.contactId}`}>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.contactName}</p>
                          <p className="text-xs text-muted-foreground">{r.sessionFrequency} sessions</p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] shrink-0">{r.daysOverdue}d overdue</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
            {pendingApplicationCount > 0 && (
              <Card className="border-l-4 border-l-blue-500 p-4 md:p-6" data-testid="card-pending-applications">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold">Pending Applications</h3>
                    <p className="text-xs text-muted-foreground">{pendingApplicationCount} mentoring application{pendingApplicationCount !== 1 ? "s" : ""} awaiting review</p>
                  </div>
                  <Link href="/mentoring" data-testid="link-review-applications">
                    <Button size="sm" className="gap-1" data-testid="button-review-applications">Review <ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        )}

        <Card className="p-4 md:p-6" data-testid="card-innovator-snapshot">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Sprout className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Innovator Snapshot</h3>
              <p className="text-xs text-muted-foreground">Journey stages</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-200/50 dark:border-amber-800/30">
              <div className="p-1.5 rounded-md bg-amber-500/10"><Sprout className="w-4 h-4 text-amber-600" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Kakano</p><p className="text-[11px] text-muted-foreground">Seed / Foundation</p></div>
              <span className="text-lg font-bold tabular-nums">{journeySnapshot.kakano}</span>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-800/30">
              <div className="p-1.5 rounded-md bg-emerald-500/10"><TreePine className="w-4 h-4 text-emerald-600" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Tipu</p><p className="text-[11px] text-muted-foreground">Actively Growing</p></div>
              <div className="text-right">
                <span className="text-lg font-bold tabular-nums">{journeySnapshot.tipu}</span>
                {journeySnapshot.activeMentoring > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{journeySnapshot.activeMentoring} in mentoring</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-200/50 dark:border-blue-800/30">
              <div className="p-1.5 rounded-md bg-blue-500/10"><Sun className="w-4 h-4 text-blue-600" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Ora</p><p className="text-[11px] text-muted-foreground">Thriving / Sustained</p></div>
              <span className="text-lg font-bold tabular-nums">{journeySnapshot.ora}</span>
            </div>
            {journeySnapshot.inactive > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                <div className="p-1.5 rounded-md bg-muted"><Eye className="w-4 h-4 text-muted-foreground" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-muted-foreground">Inactive</p></div>
                <span className="text-lg font-bold tabular-nums text-muted-foreground">{journeySnapshot.inactive}</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /><span>{journeySnapshot.communityCount} community</span></span>
            {journeySnapshot.innovatorCount > 0 && (
              <span className="flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-500" /><span>{journeySnapshot.innovatorCount} innovator{journeySnapshot.innovatorCount !== 1 ? "s" : ""}</span></span>
            )}
          </div>
        </Card>

        {debriefAttention.length === 0 && (!outstandingActions || outstandingActions.length === 0) && pendingEnquiries.length === 0 && !catchUpSummary && overdueMentees.length === 0 && pendingApplicationCount === 0 && pendingChangeRequests.length === 0 && (
          <Card className="p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No outstanding operational items to review.</p>
          </Card>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Event</DialogTitle>
            <DialogDescription className="sr-only">Confirm event removal</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{deleteTarget.name}</p>
                <p className="text-xs text-muted-foreground">{deleteTarget.date}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="ops-delete-reason" className="text-sm font-medium">Why is this event being removed?</label>
                <textarea
                  id="ops-delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Cancelled, duplicate entry, entered in error..."
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  data-testid="input-delete-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteReason(""); }} data-testid="button-cancel-ops-delete">Cancel</Button>
            <Button variant="destructive" disabled={!deleteReason.trim() || deleteEventMutation.isPending}
              onClick={() => { if (deleteTarget?.eventId) deleteEventMutation.mutate({ id: deleteTarget.eventId, reason: deleteReason.trim() }); }}
              data-testid="button-confirm-ops-delete"
            >
              {deleteEventMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!skipTarget} onOpenChange={(open) => { if (!open) { setSkipTarget(null); setSkipReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dismiss Debrief</DialogTitle>
            <DialogDescription className="sr-only">Confirm debrief dismissal</DialogDescription>
          </DialogHeader>
          {skipTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{skipTarget.name}</p>
                <p className="text-xs text-muted-foreground">{skipTarget.date}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="ops-skip-reason" className="text-sm font-medium">Why is this debrief being dismissed?</label>
                <textarea
                  id="ops-skip-reason"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="e.g. Not relevant, already documented elsewhere..."
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  data-testid="input-skip-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSkipTarget(null); setSkipReason(""); }} data-testid="button-cancel-ops-skip">Cancel</Button>
            <Button disabled={!skipReason.trim() || skipDebriefMutation.isPending}
              onClick={() => { if (skipTarget?.id) skipDebriefMutation.mutate({ id: skipTarget.id, reason: skipReason.trim() }); }}
              data-testid="button-confirm-ops-skip"
            >
              {skipDebriefMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getGroupingDate(log: ImpactLog, eventsMap: Map<number, Event>): Date {
  if (log.eventId) {
    const event = eventsMap.get(log.eventId);
    if (event?.startTime) {
      return new Date(event.startTime);
    }
  }
  if (log.confirmedAt) return new Date(log.confirmedAt);
  return new Date(log.createdAt || Date.now());
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthHeading(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}

function ArchiveView({ logs, isLoading, onSelect, onDelete }: {
  logs: ImpactLog[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  onDelete: (log: ImpactLog) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [reanalysingId, setReanalysingId] = useState<number | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: eventsData } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const eventsMap = useMemo(() => {
    const map = new Map<number, Event>();
    if (eventsData) {
      for (const event of eventsData) {
        map.set(event.id, event);
      }
    }
    return map;
  }, [eventsData]);

  const reanalyseMutation = useMutation({
    mutationFn: async (log: ImpactLog) => {
      setReanalysingId(log.id);
      const res = await apiRequest("POST", `/api/impact-logs/${log.id}/reanalyse-tags`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      toast({ title: "Impact tags updated", description: "Tags have been re-analysed from the transcript." });
      setReanalysingId(null);
    },
    onError: () => {
      toast({ title: "Re-analysis failed", description: "Could not re-analyse impact tags. Please try again.", variant: "destructive" });
      setReanalysingId(null);
    },
  });

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.summary?.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, ImpactLog[]>();
    for (const log of filteredLogs) {
      const date = getGroupingDate(log, eventsMap);
      const key = getMonthKey(date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map(key => ({
      key,
      label: formatMonthHeading(key),
      logs: groups.get(key)!,
    }));
  }, [filteredLogs, eventsMap]);

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived debriefs..."
            className="pl-9"
            data-testid="input-archive-search"
          />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <DebriefCardList
          logs={[]}
          isLoading={false}
          onSelect={onSelect}
          onDelete={onDelete}
          onCreateNew={() => {}}
          emptyTitle={searchQuery ? "No matching debriefs" : "No completed debriefs yet"}
          emptyDescription={searchQuery ? "Try a different search term." : "Complete debriefs from the Queue to see them here."}
        />
      ) : (
        <div className="space-y-6">
          {groupedByMonth.map(({ key, label, logs: monthLogs }) => {
            const isCollapsed = collapsedMonths.has(key);
            return (
              <div key={key} data-testid={`section-month-${key}`}>
                <button
                  onClick={() => toggleMonth(key)}
                  className="flex items-center gap-2 w-full text-left mb-3 group"
                  data-testid={`button-toggle-month-${key}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                  <h2 className="text-lg font-semibold font-display" data-testid={`text-month-heading-${key}`}>
                    {label}
                  </h2>
                  <span className="text-sm text-muted-foreground" data-testid={`text-month-count-${key}`}>
                    ({monthLogs.length})
                  </span>
                </button>
                {!isCollapsed && (
                  <DebriefCardList
                    logs={monthLogs}
                    isLoading={false}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onCreateNew={() => {}}
                    onReanalyse={(log) => reanalyseMutation.mutate(log)}
                    reanalysingId={reanalysingId}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
