import { Button } from "@/components/ui/beautiful-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, useSearch } from "wouter";
import { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import type { ImpactLog } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ReviewView } from "@/components/debriefs/review-view";

import { WeeklyDebriefTab } from "@/components/debriefs/weekly-debrief-tab";
import { NewDebriefDialog } from "@/components/debriefs/new-debrief-dialog";
import { DebriefBoard } from "@/components/debriefs/debrief-board";

export default function Debriefs() {
  const params = useParams<{ id?: string }>();
  const id = params.id ? parseInt(params.id) : undefined;

  if (id) {
    return <ReviewView id={id} />;
  }
  return <ListView />;
}

function ListView() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImpactLog | null>(null);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const params = new URLSearchParams(searchString);
  const tabParam = params.get("tab");
  // Redirect old tab URLs
  const resolvedTab = tabParam === "weekly" ? "pulse"
    : tabParam === "operations" || tabParam === "archive" || tabParam === "updates" ? "queue"
    : tabParam || "queue";
  const [activeTab, setActiveTab] = useState(resolvedTab);

  useEffect(() => {
    if (tabParam && resolvedTab !== activeTab) {
      setActiveTab(resolvedTab);
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
              <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-new-debrief">
                <Plus className="w-4 h-4 mr-2" />
                New Debrief
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full grid grid-cols-2" data-testid="tabs-debriefs">
              <TabsTrigger value="queue" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-queue">Board</TabsTrigger>
              <TabsTrigger value="pulse" className="min-h-[44px] text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-pulse">Pulse</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4">
              <DebriefBoard />
            </TabsContent>

            <TabsContent value="pulse" className="mt-4">
              <WeeklyDebriefTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <NewDebriefDialog open={createOpen} onOpenChange={setCreateOpen} />

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
