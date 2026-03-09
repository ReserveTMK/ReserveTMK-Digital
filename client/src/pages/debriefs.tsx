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
} from "lucide-react";
import type { ImpactLog } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
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

function ArchiveView({ logs, isLoading, onSelect, onDelete }: {
  logs: ImpactLog[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  onDelete: (log: ImpactLog) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.summary?.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

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

      <DebriefCardList
        logs={filteredLogs}
        isLoading={isLoading}
        onSelect={onSelect}
        onDelete={onDelete}
        emptyTitle={searchQuery ? "No matching debriefs" : "No completed debriefs yet"}
        emptyDescription={searchQuery ? "Try a different search term." : "Complete debriefs from the Queue to see them here."}
      />
    </div>
  );
}
