import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, useSearch } from "wouter";
import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  HeartHandshake,
  Search,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { ImpactLog, Event } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ReviewView } from "@/components/debriefs/review-view";
import { CalendarDebriefTab } from "@/components/debriefs/calendar-debrief-tab";
import { WeeklyDebriefTab } from "@/components/debriefs/weekly-debrief-tab";
import { NewDebriefDialog } from "@/components/debriefs/new-debrief-dialog";
import { ManualUpdateDialog } from "@/components/debriefs/manual-update-dialog";
import { DebriefCardList } from "@/components/debriefs/shared";

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
            <TabsList className="w-full grid grid-cols-4" data-testid="tabs-debriefs">
              <TabsTrigger value="queue" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-queue">Queue</TabsTrigger>
              <TabsTrigger value="archive" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-archive">Archive</TabsTrigger>
              <TabsTrigger value="weekly" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-weekly">Weekly</TabsTrigger>
              <TabsTrigger value="updates" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-updates">Updates</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4">
              <CalendarDebriefTab reconcileId={reconcileId} />
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
