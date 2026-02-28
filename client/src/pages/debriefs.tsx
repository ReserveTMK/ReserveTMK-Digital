import { Button } from "@/components/ui/beautiful-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImpactLogs, useImpactLog, useUpdateImpactLog } from "@/hooks/use-impact-logs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Loader2,
  Mic,
  Square,
  Play,
  X,
  ArrowLeft,
  Trash2,
  FileText,
  Search,
  UserPlus,
  Link2,
  Unlink,
  MessageCirclePlus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  HeartHandshake,
  AlertTriangle,
  Clock,
  SkipForward,
  MapPin,
  Users,
  Calendar,
  Check,
  CalendarDays,
  CheckCircle,
  RotateCcw,
  ClipboardCheck,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ImpactLog, Contact } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { getNZWeekStart } from "@shared/nz-week";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  pending_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  confirmed: "bg-green-500/15 text-green-700 dark:text-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  confirmed: "Confirmed",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-500/15 text-green-700 dark:text-green-300",
  neutral: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  negative: "bg-red-500/15 text-red-700 dark:text-red-300",
  mixed: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

const SENTIMENTS = ["positive", "neutral", "negative", "mixed"];

export default function Debriefs() {
  const params = useParams<{ id?: string }>();
  const id = params.id ? parseInt(params.id) : undefined;

  if (id) {
    return <ReviewView id={id} />;
  }
  return <ListView />;
}

type QueueItem = {
  id: number;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  attendeeCount: number | null;
  description: string | null;
  linkedProgrammeId: number | null;
  queueStatus: "overdue" | "due" | "in_progress";
  existingDebriefId: number | null;
  existingDebriefStatus: string | null;
};

const QUEUE_STATUS_CONFIG = {
  overdue: {
    label: "Overdue",
    variant: "destructive" as const,
    icon: AlertTriangle,
    borderColor: "border-l-red-500",
  },
  due: {
    label: "Due",
    variant: "outline" as const,
    icon: Clock,
    borderColor: "border-l-orange-500",
  },
  in_progress: {
    label: "In Progress",
    variant: "secondary" as const,
    icon: FileText,
    borderColor: "border-l-blue-500",
  },
};

type WeeklyDebrief = {
  id: number;
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
  generatedSummaryText: string | null;
  finalSummaryText: string | null;
  metricsJson: {
    confirmedDebriefs?: number | null;
    completedProgrammes?: number | null;
    completedBookings?: number | null;
    milestonesCreated?: number | null;
    outstandingDebriefs?: number | null;
    upcomingEventsNextWeek?: number | null;
    actionsCreated?: number | null;
    actionsCompleted?: number | null;
  } | null;
  themesJson: string[] | null;
  sentimentJson: {
    average: number | null;
    sampleSize: number;
    breakdown: { positive: number; neutral: number; negative: number };
  } | null;
  createdAt: string;
  confirmedAt: string | null;
};

function getSentimentLabel(avg: number | null): string {
  if (avg === null) return "N/A";
  if (avg >= 2.5) return "Positive";
  if (avg >= 1.5) return "Neutral";
  return "Negative";
}

function formatMetric(val: number | null | undefined): string {
  if (val === null || val === undefined) return "not tracked";
  return String(val);
}

function formatWeekPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${format(s, "EEE dd MMM")} – ${format(e, "EEE dd MMM yyyy")}`;
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
  const [activeTab, setActiveTab] = useState(tabParam || "all");

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = tab === "all" ? "/debriefs" : `/debriefs?tab=${tab}`;
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
  const regularDebriefs = useMemo(() => allLogs.filter(l => l.type !== "manual_update"), [allLogs]);

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
              <TabsTrigger value="all" data-testid="tab-all">All Debriefs</TabsTrigger>
              <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
              <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly</TabsTrigger>
              <TabsTrigger value="updates" data-testid="tab-updates">Updates</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <DebriefCardList
                logs={allLogs}
                isLoading={isLoading}
                onSelect={(id) => setLocation(`/debriefs/${id}`)}
                onDelete={setDeleteTarget}
                onCreateNew={() => setCreateOpen(true)}
              />
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <CalendarDebriefTab reconcileId={reconcileId} />
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

function DebriefCardList({
  logs,
  isLoading,
  onSelect,
  onDelete,
  onCreateNew,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyButtonText,
}: {
  logs: ImpactLog[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  onDelete: (log: ImpactLog) => void;
  onCreateNew: () => void;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyButtonText?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          {emptyIcon || <Mic className="w-8 h-8 text-muted-foreground" />}
        </div>
        <h3 className="text-lg font-semibold mb-2">{emptyTitle || "No debriefs yet"}</h3>
        <p className="text-muted-foreground mb-6">{emptyDescription || "Record or paste a debrief to get started."}</p>
        <Button onClick={onCreateNew} variant="outline" data-testid="button-new-debrief-empty">
          {emptyButtonText || "New Debrief"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {logs.map((log) => (
        <Card
          key={log.id}
          className="p-5 cursor-pointer hover-elevate transition-all duration-200"
          onClick={() => onSelect(log.id)}
          data-testid={`card-debrief-${log.id}`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {log.type === "manual_update" && (
                <HeartHandshake className="w-4 h-4 text-pink-500 shrink-0" />
              )}
              <h3 className="font-bold text-lg font-display truncate" data-testid={`text-debrief-title-${log.id}`}>
                {log.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {log.type === "manual_update" && (
                <Badge variant="secondary" className="text-xs bg-pink-500/15 text-pink-700 dark:text-pink-300" data-testid={`badge-type-${log.id}`}>
                  Manual Update
                </Badge>
              )}
              <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[log.status] || ""}`} data-testid={`badge-status-${log.id}`}>
                {STATUS_LABELS[log.status] || log.status}
              </Badge>
              {log.sentiment && (
                <Badge variant="secondary" className={`text-xs ${SENTIMENT_COLORS[log.sentiment] || ""}`} data-testid={`badge-sentiment-${log.id}`}>
                  {log.sentiment}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={(e) => { e.stopPropagation(); onDelete(log); }}
                data-testid={`button-delete-debrief-${log.id}`}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
          {log.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3" data-testid={`text-summary-${log.id}`}>
              {log.summary}
            </p>
          )}
          <p className="text-xs text-muted-foreground" data-testid={`text-date-${log.id}`}>
            {log.createdAt ? new Date(log.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </p>
        </Card>
      ))}
    </div>
  );
}

function CalendarDebriefTab({ reconcileId }: { reconcileId: string | null }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [skipDialogEventId, setSkipDialogEventId] = useState<number | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipCustomReason, setSkipCustomReason] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [reconcileEventId, setReconcileEventId] = useState<number | null>(null);

  const { data: queue, isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/events/needs-debrief"],
  });

  useEffect(() => {
    if (reconcileId && queue) {
      const id = parseInt(reconcileId);
      const exists = queue.find(q => q.id === id);
      if (exists) {
        setReconcileEventId(id);
      }
    }
  }, [reconcileId, queue]);

  const skipMutation = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: number; reason: string }) => {
      await apiRequest("POST", `/api/events/${eventId}/skip-debrief`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      toast({ title: "Debrief skipped", description: "Event removed from queue." });
      setSkipDialogEventId(null);
      setSkipReason("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredQueue = (queue || []).filter(item => {
    if (filterStatus === "all") return true;
    return item.queueStatus === filterStatus;
  });

  const overdueCt = queue?.filter(q => q.queueStatus === "overdue").length || 0;
  const dueCt = queue?.filter(q => q.queueStatus === "due").length || 0;
  const inProgressCt = queue?.filter(q => q.queueStatus === "in_progress").length || 0;

  const reconcileEvent = reconcileEventId ? queue?.find(q => q.id === reconcileEventId) : null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Events that need a debrief recorded before they can be reconciled.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("all")}
            data-testid="filter-all"
          >
            All ({queue?.length || 0})
          </Button>
          {overdueCt > 0 && (
            <Button
              variant={filterStatus === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("overdue")}
              className={filterStatus !== "overdue" ? "text-red-600 border-red-200" : ""}
              data-testid="filter-overdue"
            >
              <AlertTriangle className="w-3 h-3 mr-1" /> Overdue ({overdueCt})
            </Button>
          )}
          {dueCt > 0 && (
            <Button
              variant={filterStatus === "due" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("due")}
              className={filterStatus !== "due" ? "text-orange-600 border-orange-200" : ""}
              data-testid="filter-due"
            >
              <Clock className="w-3 h-3 mr-1" /> Due ({dueCt})
            </Button>
          )}
          {inProgressCt > 0 && (
            <Button
              variant={filterStatus === "in_progress" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("in_progress")}
              className={filterStatus !== "in_progress" ? "text-blue-600 border-blue-200" : ""}
              data-testid="filter-in-progress"
            >
              <FileText className="w-3 h-3 mr-1" /> In Progress ({inProgressCt})
            </Button>
          )}
        </div>

        {filteredQueue.length === 0 ? (
          <Card className="p-8 text-center" data-testid="empty-queue">
            <ClipboardCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">All caught up!</h3>
            <p className="text-muted-foreground text-sm">
              {filterStatus === "all"
                ? "No events are waiting for a debrief. Great work!"
                : `No ${filterStatus.replace("_", " ")} items right now.`}
            </p>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="list-debrief-queue">
            {filteredQueue.map((item) => {
              const config = QUEUE_STATUS_CONFIG[item.queueStatus];
              const StatusIcon = config.icon;
              return (
                <Card
                  key={item.id}
                  className={`border-l-4 ${config.borderColor} p-4`}
                  data-testid={`queue-card-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={config.variant} className="text-xs shrink-0" data-testid={`queue-badge-${item.id}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {item.type}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-base truncate" data-testid={`queue-name-${item.id}`}>
                        {item.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(item.startTime), "d MMM yyyy, h:mm a")}
                        </span>
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {item.location}
                          </span>
                        )}
                        {item.attendeeCount && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {item.attendeeCount} attendees
                          </span>
                        )}
                        {item.linkedProgrammeId && (
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                            <Link2 className="w-3.5 h-3.5" />
                            Programme #{item.linkedProgrammeId}
                          </span>
                        )}
                        <span className="text-xs italic">
                          {formatDistanceToNow(new Date(item.endTime || item.startTime), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSkipDialogEventId(item.id); setSkipReason(""); }}
                        className="text-muted-foreground hover:text-foreground"
                        data-testid={`button-skip-${item.id}`}
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                      {item.existingDebriefId ? (
                        <Link href={`/debriefs/${item.existingDebriefId}`} data-testid={`button-continue-${item.id}`}>
                          <Button size="sm" variant="secondary" className="gap-1">
                            <FileText className="w-3.5 h-3.5" /> Continue
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1"
                          onClick={() => setReconcileEventId(item.id)}
                          data-testid={`button-reconcile-${item.id}`}
                        >
                          <Mic className="w-3.5 h-3.5" /> Reconcile
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={skipDialogEventId !== null} onOpenChange={(open) => { if (!open) { setSkipDialogEventId(null); setSkipReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Debrief</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Provide a reason for skipping the debrief. This event will be removed from the queue.
          </p>
          <Select value={skipReason} onValueChange={(val) => { setSkipReason(val); if (val !== "Other") setSkipCustomReason(""); }}>
            <SelectTrigger data-testid="select-skip-reason">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Not relevant">Not relevant</SelectItem>
              <SelectItem value="Duplicate event">Duplicate event</SelectItem>
              <SelectItem value="Event didn't happen">Event didn't happen</SelectItem>
              <SelectItem value="Debrief not required">Debrief not required</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {skipReason === "Other" && (
            <Input
              value={skipCustomReason}
              onChange={(e) => setSkipCustomReason(e.target.value)}
              placeholder="Please specify a reason..."
              data-testid="input-skip-custom-reason"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSkipDialogEventId(null); setSkipReason(""); setSkipCustomReason(""); }} data-testid="button-cancel-skip">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!skipReason || (skipReason === "Other" && !skipCustomReason.trim()) || skipMutation.isPending}
              onClick={() => skipDialogEventId && skipMutation.mutate({
                eventId: skipDialogEventId,
                reason: skipReason === "Other" ? skipCustomReason.trim() : skipReason,
              })}
              data-testid="button-confirm-skip"
            >
              {skipMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <SkipForward className="w-4 h-4 mr-1" />}
              Skip Debrief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReconcileDialog
        event={reconcileEvent || null}
        open={reconcileEventId !== null}
        onClose={() => {
          setReconcileEventId(null);
          navigate("/debriefs?tab=calendar", { replace: true });
        }}
      />
    </>
  );
}

function WeeklyDebriefTab() {
  const { toast } = useToast();

  const { data: debriefs, isLoading } = useQuery<WeeklyDebrief[]>({
    queryKey: ["/api/weekly-hub-debriefs"],
  });

  const generateMutation = useMutation({
    mutationFn: async (weekStartDate: string) => {
      const res = await apiRequest("POST", "/api/weekly-hub-debriefs/generate", { weekStartDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
      toast({ title: "Weekly debrief generated" });
    },
    onError: (error: Error) => {
      const msg = error.message || "";
      if (msg.startsWith("409:")) {
        toast({ title: "Already exists", description: msg.replace("409: ", ""), variant: "destructive" });
      } else {
        toast({ title: "Error generating debrief", description: msg, variant: "destructive" });
      }
    },
  });

  const thisWeekMonday = getNZWeekStart();
  const lastWeekDate = new Date(thisWeekMonday);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekMonday = getNZWeekStart(lastWeekDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => generateMutation.mutate(format(thisWeekMonday, "yyyy-MM-dd"))}
          isLoading={generateMutation.isPending}
          disabled={generateMutation.isPending}
          data-testid="button-generate-this-week"
        >
          <CalendarDays className="w-4 h-4 mr-2" />
          Generate This Week
        </Button>
        <Button
          variant="outline"
          onClick={() => generateMutation.mutate(format(lastWeekMonday, "yyyy-MM-dd"))}
          isLoading={generateMutation.isPending}
          disabled={generateMutation.isPending}
          data-testid="button-generate-last-week"
        >
          <CalendarDays className="w-4 h-4 mr-2" />
          Generate Last Week
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-debriefs" />
        </div>
      )}

      {!isLoading && (!debriefs || debriefs.length === 0) && (
        <Card className="p-12 text-center border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No weekly debriefs yet</h3>
          <p className="text-muted-foreground mb-6">Generate one to get started.</p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {debriefs?.map((debrief) => (
          <WeeklyDebriefCard key={debrief.id} debrief={debrief} />
        ))}
      </div>
    </div>
  );
}

function WeeklyDebriefCard({ debrief }: { debrief: WeeklyDebrief }) {
  const { toast } = useToast();
  const [finalSummary, setFinalSummary] = useState(debrief.finalSummaryText || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRecordingSummary, setIsRecordingSummary] = useState(false);
  const [summaryRecordingTime, setSummaryRecordingTime] = useState(0);
  const [summaryAudioBlob, setSummaryAudioBlob] = useState<Blob | null>(null);
  const [summaryAudioUrl, setSummaryAudioUrl] = useState<string | null>(null);
  const [isSummaryTranscribing, setIsSummaryTranscribing] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const summaryMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const summaryChunksRef = useRef<Blob[]>([]);
  const summaryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSummaryRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      summaryMediaRecorderRef.current = mediaRecorder;
      summaryChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) summaryChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(summaryChunksRef.current, { type: "audio/webm" });
        setSummaryAudioBlob(blob);
        setSummaryAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecordingSummary(true);
      setSummaryRecordingTime(0);
      summaryTimerRef.current = setInterval(() => setSummaryRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopSummaryRecording = () => {
    summaryMediaRecorderRef.current?.stop();
    setIsRecordingSummary(false);
    if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
  };

  const transcribeSummaryAudio = async () => {
    if (!summaryAudioBlob) return;
    setIsSummaryTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: summaryAudioBlob,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      const transcribed = data.transcript || data.text || "";
      setFinalSummary(prev => prev ? prev + "\n\n" + transcribed : transcribed);
      setSummaryAudioBlob(null);
      setSummaryAudioUrl(null);
      setShowVoiceRecorder(false);
      toast({ title: "Transcribed", description: "Voice summary has been added." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Transcription failed", variant: "destructive" });
    } finally {
      setIsSummaryTranscribing(false);
    }
  };

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/weekly-hub-debriefs/${debrief.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/weekly-hub-debriefs/${debrief.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-hub-debriefs"] });
      toast({ title: "Debrief deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    },
  });

  const metrics = debrief.metricsJson;
  const sentiment = debrief.sentimentJson;
  const themes = debrief.themesJson;
  const isDraft = debrief.status === "draft";

  const sentimentLabel = sentiment ? getSentimentLabel(sentiment.average) : "N/A";
  const totalSentiment = sentiment
    ? (sentiment.breakdown.positive + sentiment.breakdown.neutral + sentiment.breakdown.negative) || 1
    : 1;

  return (
    <Card data-testid={`card-weekly-debrief-${debrief.id}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg" data-testid={`text-week-period-${debrief.id}`}>
            {formatWeekPeriod(debrief.weekStartDate, debrief.weekEndDate)}
          </CardTitle>
          <span className="text-xs text-muted-foreground" data-testid={`text-created-${debrief.id}`}>
            Generated {format(new Date(debrief.createdAt), "dd MMM yyyy HH:mm")}
          </span>
        </div>
        <Badge
          variant={isDraft ? "outline" : "default"}
          className={isDraft ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 no-default-hover-elevate" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate"}
          data-testid={`badge-status-${debrief.id}`}
        >
          {isDraft ? "Draft" : "Confirmed"}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {metrics && (
          <div data-testid={`section-metrics-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <WeeklyMetricItem label="Confirmed Debriefs" value={formatMetric(metrics.confirmedDebriefs)} id={`metric-confirmed-debriefs-${debrief.id}`} />
              <WeeklyMetricItem label="Completed Programmes" value={formatMetric(metrics.completedProgrammes)} id={`metric-completed-programmes-${debrief.id}`} />
              <WeeklyMetricItem label="Completed Bookings" value={formatMetric(metrics.completedBookings)} id={`metric-completed-bookings-${debrief.id}`} />
              <WeeklyMetricItem label="Milestones Created" value={formatMetric(metrics.milestonesCreated)} id={`metric-milestones-${debrief.id}`} />
              <WeeklyMetricItem label="Outstanding Debriefs" value={formatMetric(metrics.outstandingDebriefs)} id={`metric-outstanding-${debrief.id}`} />
              <WeeklyMetricItem label="Upcoming Events" value={formatMetric(metrics.upcomingEventsNextWeek)} id={`metric-upcoming-${debrief.id}`} />
              <WeeklyMetricItem label="Actions Created" value={formatMetric(metrics.actionsCreated)} id={`metric-actions-created-${debrief.id}`} />
              <WeeklyMetricItem label="Actions Completed" value={formatMetric(metrics.actionsCompleted)} id={`metric-actions-completed-${debrief.id}`} />
            </div>
          </div>
        )}

        {themes && themes.length > 0 && (
          <div data-testid={`section-themes-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Top Themes</h3>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <Badge key={i} variant="secondary" data-testid={`badge-theme-${debrief.id}-${i}`}>
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {sentiment && (
          <div data-testid={`section-sentiment-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Sentiment</h3>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-sm font-medium" data-testid={`text-sentiment-label-${debrief.id}`}>
                {sentimentLabel}
              </span>
              <span className="text-xs text-muted-foreground" data-testid={`text-sentiment-sample-${debrief.id}`}>
                (n={sentiment.sampleSize})
              </span>
            </div>
            <div className="flex h-3 rounded-md overflow-hidden">
              {sentiment.breakdown.positive > 0 && (
                <div className="bg-green-500" style={{ width: `${(sentiment.breakdown.positive / totalSentiment) * 100}%` }} title={`Positive: ${sentiment.breakdown.positive}`} />
              )}
              {sentiment.breakdown.neutral > 0 && (
                <div className="bg-yellow-400" style={{ width: `${(sentiment.breakdown.neutral / totalSentiment) * 100}%` }} title={`Neutral: ${sentiment.breakdown.neutral}`} />
              )}
              {sentiment.breakdown.negative > 0 && (
                <div className="bg-red-500" style={{ width: `${(sentiment.breakdown.negative / totalSentiment) * 100}%` }} title={`Negative: ${sentiment.breakdown.negative}`} />
              )}
            </div>
          </div>
        )}

        {debrief.generatedSummaryText && (
          <div data-testid={`section-generated-summary-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Generated Summary</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {debrief.generatedSummaryText}
            </p>
          </div>
        )}

        {isDraft && (
          <div data-testid={`section-final-summary-${debrief.id}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary">Final Summary</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                data-testid={`button-record-summary-${debrief.id}`}
              >
                <Mic className="w-3.5 h-3.5 mr-1" />
                {showVoiceRecorder ? "Hide Recorder" : "Record Summary"}
              </Button>
            </div>

            {showVoiceRecorder && (
              <div className="mb-3 p-3 bg-muted/30 rounded-lg border border-border">
                {!summaryAudioBlob && !isRecordingSummary && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Button
                      onClick={startSummaryRecording}
                      className="rounded-full w-14 h-14 flex items-center justify-center"
                      data-testid={`button-start-summary-recording-${debrief.id}`}
                    >
                      <Mic className="w-6 h-6" />
                    </Button>
                    <p className="text-xs text-muted-foreground">Tap to record your weekly summary</p>
                  </div>
                )}
                {isRecordingSummary && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                    </div>
                    <p className="text-lg font-mono font-bold">{formatRecTime(summaryRecordingTime)}</p>
                    <Button variant="destructive" size="sm" onClick={stopSummaryRecording} data-testid={`button-stop-summary-recording-${debrief.id}`}>
                      <Square className="w-3.5 h-3.5 mr-1" /> Stop
                    </Button>
                  </div>
                )}
                {summaryAudioBlob && !isRecordingSummary && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <audio controls src={summaryAudioUrl || undefined} className="flex-1 h-8" />
                      <Button variant="ghost" size="icon" onClick={() => { setSummaryAudioBlob(null); setSummaryAudioUrl(null); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={transcribeSummaryAudio}
                      disabled={isSummaryTranscribing}
                      className="w-full"
                      data-testid={`button-transcribe-summary-${debrief.id}`}
                    >
                      {isSummaryTranscribing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Transcribing...</> : <><FileText className="w-3.5 h-3.5 mr-1" /> Transcribe & Add to Summary</>}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Textarea
              value={finalSummary}
              onChange={(e) => setFinalSummary(e.target.value)}
              placeholder="Edit the final summary before confirming..."
              className="min-h-[100px]"
              data-testid={`textarea-final-summary-${debrief.id}`}
            />
          </div>
        )}

        {!isDraft && debrief.finalSummaryText && (
          <div data-testid={`section-final-summary-${debrief.id}`}>
            <h3 className="text-sm font-semibold text-primary mb-2">Final Summary</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {debrief.finalSummaryText}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {isDraft && (
            <Button
              size="sm"
              onClick={() => patchMutation.mutate({ status: "confirmed", finalSummaryText: finalSummary })}
              isLoading={patchMutation.isPending}
              disabled={patchMutation.isPending}
              data-testid={`button-confirm-${debrief.id}`}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Confirm
            </Button>
          )}

          {!isDraft && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => patchMutation.mutate({ status: "draft" })}
              isLoading={patchMutation.isPending}
              disabled={patchMutation.isPending}
              data-testid={`button-revert-${debrief.id}`}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Revert to Draft
            </Button>
          )}

          {!showDeleteConfirm ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid={`button-delete-${debrief.id}`}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Are you sure?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                isLoading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                data-testid={`button-confirm-delete-${debrief.id}`}
              >
                Yes, delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                data-testid={`button-cancel-delete-${debrief.id}`}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyMetricItem({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="flex flex-col" data-testid={id}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}

function ReconcileDialog({ event, open, onClose }: { event: QueueItem | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"input" | "creating" | "done">("input");
  const [debriefTitle, setDebriefTitle] = useState("");
  const [debriefTranscript, setDebriefTranscript] = useState("");
  const [inputMode, setInputMode] = useState<"record" | "text">("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (event) {
      setDebriefTitle(event.name + " - Debrief");
      setDebriefTranscript("");
      setStep("input");
      setInputMode("record");
      setAudioBlob(null);
      setAudioUrl(null);
      setCreatedId(null);
    }
  }, [event]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audioBlob,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setDebriefTranscript(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Audio has been converted to text." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Transcription failed", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!event) return;
      setStep("creating");
      const res = await apiRequest("POST", "/api/impact-logs", {
        title: debriefTitle,
        transcript: debriefTranscript,
        eventId: event.id,
        status: "draft",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      setCreatedId(data?.id || null);
      setStep("done");
      toast({ title: "Debrief created", description: "Your debrief has been linked to the event." });
    },
    onError: () => {
      setStep("input");
      toast({ title: "Error", description: "Failed to create debrief.", variant: "destructive" });
    },
  });

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Reconcile Event
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium text-sm">{event.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(event.startTime), "d MMM yyyy, h:mm a")} · {event.type}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Debrief Title</Label>
              <Input
                value={debriefTitle}
                onChange={(e) => setDebriefTitle(e.target.value)}
                placeholder="Title for this debrief..."
                data-testid="input-debrief-title"
              />
            </div>

            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "record" | "text")}>
              <TabsList className="w-full">
                <TabsTrigger value="record" className="flex-1" data-testid="tab-reconcile-record">
                  <Mic className="w-3.5 h-3.5 mr-1" /> Record Audio
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1" data-testid="tab-reconcile-text">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Paste Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="record" className="space-y-3 mt-3">
                {!audioBlob && !isRecording && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Button
                      onClick={startRecording}
                      className="rounded-full w-16 h-16 flex items-center justify-center"
                      data-testid="button-start-reconcile-recording"
                    >
                      <Mic className="w-7 h-7" />
                    </Button>
                    <p className="text-sm text-muted-foreground">Tap to start recording your debrief</p>
                  </div>
                )}
                {isRecording && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="w-16 h-16 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-destructive" />
                    </div>
                    <p className="text-lg font-mono font-bold">{fmtTime(recordingTime)}</p>
                    <Button variant="destructive" onClick={stopRecording} data-testid="button-stop-reconcile-recording">
                      <Square className="w-4 h-4 mr-2" /> Stop Recording
                    </Button>
                  </div>
                )}
                {audioBlob && !isRecording && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                      <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                      <audio controls src={audioUrl || undefined} className="flex-1 h-8" data-testid="audio-reconcile-playback" />
                      <Button variant="ghost" size="icon" onClick={() => { setAudioBlob(null); setAudioUrl(null); setDebriefTranscript(""); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {!debriefTranscript && (
                      <Button onClick={transcribeAudio} disabled={isTranscribing} className="w-full" data-testid="button-transcribe-reconcile">
                        {isTranscribing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transcribing...</> : <><FileText className="w-4 h-4 mr-2" /> Transcribe</>}
                      </Button>
                    )}
                    {debriefTranscript && (
                      <div className="space-y-2">
                        <Label>Transcript</Label>
                        <Textarea
                          value={debriefTranscript}
                          onChange={(e) => setDebriefTranscript(e.target.value)}
                          className="min-h-[100px] resize-none"
                          data-testid="textarea-reconcile-transcript"
                        />
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="text" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label>Transcript / Notes</Label>
                  <Textarea
                    value={debriefTranscript}
                    onChange={(e) => setDebriefTranscript(e.target.value)}
                    placeholder="Paste your transcript or type notes about the event..."
                    className="min-h-[150px] resize-none"
                    data-testid="textarea-reconcile-text"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === "creating" && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Creating debrief and linking to event...</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center">
            <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">Debrief Created!</h3>
            <p className="text-sm text-muted-foreground">
              The debrief has been linked to "{event.name}". You can continue editing and analyzing it from the review page.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "input" && (
            <>
              <Button variant="outline" onClick={onClose} data-testid="button-cancel-reconcile">
                Cancel
              </Button>
              <Button
                disabled={!debriefTitle.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                data-testid="button-create-debrief"
              >
                <ClipboardCheck className="w-4 h-4 mr-1" />
                Create Debrief
              </Button>
            </>
          )}
          {step === "done" && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-close-reconcile">
                Done
              </Button>
              {createdId && (
                <Button onClick={() => { onClose(); setLocation(`/debriefs/${createdId}`); }} className="flex-1" data-testid="button-view-debrief">
                  <FileText className="w-4 h-4 mr-1" /> Review & Analyse
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDebriefDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [activeTab, setActiveTab] = useState("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const resetState = useCallback(() => {
    setTitle("");
    setTranscript("");
    setActiveTab("record");
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsTranscribing(false);
    setIsAnalyzing(false);
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone. Please grant permission.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audioBlob,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setTranscript(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Audio transcription complete." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Transcription failed", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      toast({ title: "Missing transcript", description: "Please record or paste a transcript first.", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Missing title", description: "Please enter a title for this debrief.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/impact-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, title }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs'] });
      resetState();
      onOpenChange(false);
      setLocation(`/debriefs/${data.id}`);
      toast({ title: "Analysis complete", description: "Review the extracted impact data." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Debrief</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="debrief-title">Title</Label>
            <Input
              id="debrief-title"
              data-testid="input-debrief-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly check-in with Jane"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="record" className="flex-1" data-testid="tab-record-audio">Record Audio</TabsTrigger>
              <TabsTrigger value="text" className="flex-1" data-testid="tab-paste-text">Paste Text</TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="space-y-4 mt-4">
              {!audioBlob && !isRecording && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Button
                    onClick={startRecording}
                    className="rounded-full w-20 h-20 flex items-center justify-center"
                    data-testid="button-start-recording"
                  >
                    <Mic className="w-8 h-8" />
                  </Button>
                  <p className="text-sm text-muted-foreground">Tap to start recording</p>
                </div>
              )}

              {isRecording && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-destructive" />
                    </div>
                  </div>
                  <p className="text-lg font-mono font-bold" data-testid="text-recording-timer">{formatTime(recordingTime)}</p>
                  <Button
                    variant="destructive"
                    onClick={stopRecording}
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                </div>
              )}

              {audioBlob && !isRecording && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border">
                    <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                    <audio controls src={audioUrl || undefined} className="flex-1 h-10" data-testid="audio-playback" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                      data-testid="button-discard-recording"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {!transcript && (
                    <Button
                      onClick={transcribeAudio}
                      disabled={isTranscribing}
                      className="w-full"
                      data-testid="button-transcribe"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Transcribing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Transcribe
                        </>
                      )}
                    </Button>
                  )}
                  {transcript && (
                    <div className="space-y-2">
                      <Label>Transcript</Label>
                      <Textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="min-h-[120px] resize-none"
                        data-testid="textarea-transcript-result"
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Transcript Text</Label>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste or type your debrief transcript here..."
                  className="min-h-[200px] resize-none"
                  data-testid="textarea-transcript"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !transcript.trim() || !title.trim()}
            className="w-full"
            data-testid="button-analyze"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing impact...
              </>
            ) : (
              "Analyze & Extract"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewView({ id }: { id: number }) {
  const { data: log, isLoading } = useImpactLog(id);
  const { data: contacts } = useQuery<Contact[]>({ queryKey: ['/api/contacts'] });
  const updateMutation = useUpdateImpactLog();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const impactLog = log as ImpactLog | undefined;
  const extraction = impactLog?.status === "confirmed"
    ? (impactLog.reviewedData as any)
    : (impactLog?.rawExtraction as any);

  const [summary, setSummary] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [milestones, setMilestones] = useState<string[]>([]);
  const [newMilestone, setNewMilestone] = useState("");
  const [funderTags, setFunderTags] = useState<string[]>(impactLog?.funderTags || []);
  const [funderTagInput, setFunderTagInput] = useState("");
  const [actionItemsList, setActionItemsList] = useState<any[]>([]);
  const [newAction, setNewAction] = useState({ title: "", owner: "", priority: "medium" });
  const [impactTags, setImpactTags] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [communityActions, setCommunityActions] = useState<any[]>([]);
  const [operationalActions, setOperationalActions] = useState<any[]>([]);
  const [reflections, setReflections] = useState<{ wins: string[]; concerns: string[]; learnings: string[] }>({ wins: [], concerns: [], learnings: [] });
  const [initialized, setInitialized] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingTranscript, setRecordingTranscript] = useState("");
  const [recordingTab, setRecordingTab] = useState("record");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpAudioBlob, setFollowUpAudioBlob] = useState<Blob | null>(null);
  const [followUpAudioUrl, setFollowUpAudioUrl] = useState<string | null>(null);
  const [isFollowUpRecording, setIsFollowUpRecording] = useState(false);
  const [followUpRecordingTime, setFollowUpRecordingTime] = useState(0);
  const [isFollowUpTranscribing, setIsFollowUpTranscribing] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [followUpTab, setFollowUpTab] = useState("record");
  const followUpMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const followUpChunksRef = useRef<Blob[]>([]);
  const followUpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/impact-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      toast({ title: "Debrief deleted", description: "The debrief has been removed." });
      setLocation("/debriefs");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone. Please grant permission.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audioBlob,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setRecordingTranscript(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Audio transcription complete." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Transcription failed", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAnalyzeRecording = async () => {
    if (!recordingTranscript.trim()) {
      toast({ title: "Missing transcript", description: "Please record or paste a transcript first.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/impact-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: recordingTranscript, title: impactLog?.title || "Debrief", existingLogId: id }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Extraction failed");

      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id] });
      setInitialized(false);
      toast({ title: "Analysis complete", description: "Review the extracted impact data." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const startFollowUpRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      followUpMediaRecorderRef.current = mediaRecorder;
      followUpChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) followUpChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(followUpChunksRef.current, { type: "audio/webm" });
        setFollowUpAudioBlob(blob);
        setFollowUpAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsFollowUpRecording(true);
      setFollowUpRecordingTime(0);
      followUpTimerRef.current = setInterval(() => setFollowUpRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopFollowUpRecording = () => {
    followUpMediaRecorderRef.current?.stop();
    setIsFollowUpRecording(false);
    if (followUpTimerRef.current) clearInterval(followUpTimerRef.current);
  };

  const transcribeFollowUpAudio = async () => {
    if (!followUpAudioBlob) return;
    setIsFollowUpTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: followUpAudioBlob,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setFollowUpText(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Follow-up audio transcribed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Transcription failed", variant: "destructive" });
    } finally {
      setIsFollowUpTranscribing(false);
    }
  };

  const handleAppendFollowUp = async () => {
    if (!followUpText.trim()) return;
    setIsAppending(true);
    try {
      const now = new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const appendedTranscript = (impactLog?.transcript || "") + `\n\n--- Follow-up (${now}) ---\n${followUpText.trim()}`;
      await apiRequest("PATCH", `/api/impact-logs/${id}`, { transcript: appendedTranscript });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id] });
      setFollowUpText("");
      setFollowUpAudioBlob(null);
      setFollowUpAudioUrl(null);
      setShowFollowUp(false);
      setFollowUpTab("record");
      toast({ title: "Follow-up added", description: "Your additional notes have been appended to the transcript." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add follow-up", variant: "destructive" });
    } finally {
      setIsAppending(false);
    }
  };

  const handleReanalyze = async () => {
    if (!impactLog?.transcript) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/impact-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: impactLog.transcript, title: impactLog.title, existingLogId: id }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Re-analysis failed");
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id] });
      setInitialized(false);
      toast({ title: "Re-analysis complete", description: "Tags and insights updated from the full transcript." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Re-analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const needsRecording = impactLog && impactLog.status === "draft" && !impactLog.transcript && !extraction;

  useEffect(() => {
    if (impactLog && extraction && !initialized) {
      setSummary(extraction.summary || impactLog.summary || "");
      setSentiment(extraction.sentiment || impactLog.sentiment || "neutral");
      setMilestones(extraction.milestones || impactLog.milestones || []);
      setActionItemsList(extraction.actionItems || []);
      setImpactTags(extraction.impactTags || []);
      setPeople(extraction.people || []);
      setMetrics(extraction.metrics || {});
      setCommunityActions(extraction.communityActions || []);
      setOperationalActions(extraction.operationalActions || []);
      setReflections(extraction.reflections || { wins: [], concerns: [], learnings: [] });
      setInitialized(true);
    }
  }, [impactLog, extraction, initialized]);

  const handleSave = async (status: string) => {
    const reviewedData = {
      summary,
      sentiment,
      milestones,
      actionItems: actionItemsList,
      impactTags,
      people,
      metrics,
      communityActions,
      operationalActions,
      reflections,
    };

    try {
      await apiRequest('PATCH', `/api/impact-logs/${id}`, {
        status,
        summary,
        sentiment,
        milestones,
        funderTags,
        reviewedData,
        reviewedAt: status === "confirmed" ? new Date().toISOString() : undefined,
      });

      if (status === "confirmed") {
        for (const person of people) {
          if (person.contactId) {
            try {
              await apiRequest('POST', `/api/impact-logs/${id}/contacts`, {
                impactLogId: id,
                contactId: person.contactId,
                role: person.role || "mentioned",
              });
            } catch {}
          }
        }

        for (const tag of impactTags) {
          if (tag.taxonomyId) {
            try {
              await apiRequest('POST', `/api/impact-logs/${id}/tags`, {
                impactLogId: id,
                taxonomyId: tag.taxonomyId,
                confidence: tag.confidence,
                notes: tag.evidence,
              });
            } catch {}
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs', id] });

      toast({
        title: status === "confirmed" ? "Debrief Confirmed" : "Draft Saved",
        description: status === "confirmed" ? "Impact data has been confirmed and saved." : "Your draft has been saved.",
      });

      if (status === "confirmed") {
        setLocation("/debriefs");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center overflow-y-auto">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
    );
  }

  if (!impactLog) {
    return (
      <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <Card className="p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">Debrief not found</h3>
              <Button variant="outline" onClick={() => setLocation("/debriefs")} data-testid="button-back-to-list">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Debriefs
              </Button>
            </Card>
          </div>
        </main>
    );
  }

  const keyQuotes = impactLog.keyQuotes || extraction?.keyQuotes || [];

  const highlightQuotes = (text: string) => {
    if (!keyQuotes.length || !text) return text;
    let result = text;
    const parts: { text: string; highlighted: boolean }[] = [];
    let remaining = result;
    for (const quote of keyQuotes) {
      const idx = remaining.toLowerCase().indexOf(quote.toLowerCase());
      if (idx >= 0) {
        if (idx > 0) parts.push({ text: remaining.slice(0, idx), highlighted: false });
        parts.push({ text: remaining.slice(idx, idx + quote.length), highlighted: true });
        remaining = remaining.slice(idx + quote.length);
      }
    }
    if (remaining) parts.push({ text: remaining, highlighted: false });
    if (parts.length === 0) return text;
    return parts;
  };

  const transcriptParts = highlightQuotes(impactLog.transcript || "");

  const confidenceColor = (c: number) => {
    if (c > 70) return "bg-green-500";
    if (c >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  const cycleSentiment = () => {
    const idx = SENTIMENTS.indexOf(sentiment);
    setSentiment(SENTIMENTS[(idx + 1) % SENTIMENTS.length]);
  };

  const METRIC_LABELS: Record<string, string> = {
    mindset: "Mindset",
    skill: "Capability",
    confidence: "Confidence",
    systemsInPlace: "Structure & Systems",
    fundingReadiness: "Sustainability Readiness",
    networkStrength: "Connection Strength",
    communityImpact: "Community Impact",
    digitalPresence: "Digital Presence",
  };

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/debriefs")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {impactLog.type === "manual_update" && <HeartHandshake className="w-5 h-5 text-pink-500 shrink-0" />}
                <h1 className="text-2xl font-display font-bold truncate" data-testid="text-review-title">{impactLog.title}</h1>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {impactLog.type === "manual_update" && (
                  <Badge variant="secondary" className="text-xs bg-pink-500/15 text-pink-700 dark:text-pink-300">
                    Manual Update
                  </Badge>
                )}
                <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[impactLog.status] || ""}`}>
                  {STATUS_LABELS[impactLog.status] || impactLog.status}
                </Badge>
                {impactLog.createdAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(impactLog.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteConfirmOpen(true)}
              data-testid="button-delete-debrief-detail"
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              {needsRecording ? (
                <Card className="p-5">
                  <h2 className="font-bold text-lg font-display mb-3" data-testid="text-record-heading">Record Your Debrief</h2>
                  <p className="text-sm text-muted-foreground mb-4">Record audio or paste text to capture your debrief, then analyse it for impact data.</p>

                  <Tabs value={recordingTab} onValueChange={setRecordingTab}>
                    <TabsList className="w-full">
                      <TabsTrigger value="record" className="flex-1" data-testid="tab-record-audio-review">Record Audio</TabsTrigger>
                      <TabsTrigger value="text" className="flex-1" data-testid="tab-paste-text-review">Paste Text</TabsTrigger>
                    </TabsList>

                    <TabsContent value="record" className="space-y-4 mt-4">
                      {!audioBlob && !isRecording && (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <Button
                            onClick={startRecording}
                            className="rounded-full w-20 h-20 flex items-center justify-center"
                            data-testid="button-start-recording-review"
                          >
                            <Mic className="w-8 h-8" />
                          </Button>
                          <p className="text-sm text-muted-foreground">Tap to start recording</p>
                        </div>
                      )}

                      {isRecording && (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <div className="w-20 h-20 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-destructive" />
                          </div>
                          <p className="text-lg font-mono font-bold" data-testid="text-recording-timer-review">{formatRecTime(recordingTime)}</p>
                          <Button
                            variant="destructive"
                            onClick={stopRecording}
                            data-testid="button-stop-recording-review"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            Stop Recording
                          </Button>
                        </div>
                      )}

                      {audioBlob && !isRecording && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border">
                            <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                            <audio controls src={audioUrl || undefined} className="flex-1 h-10" data-testid="audio-playback-review" />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                              data-testid="button-discard-recording-review"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {!recordingTranscript && (
                            <Button
                              onClick={transcribeAudio}
                              disabled={isTranscribing}
                              className="w-full"
                              data-testid="button-transcribe-review"
                            >
                              {isTranscribing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Transcribing...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Transcribe
                                </>
                              )}
                            </Button>
                          )}
                          {recordingTranscript && (
                            <div className="space-y-2">
                              <Label>Transcript</Label>
                              <Textarea
                                value={recordingTranscript}
                                onChange={(e) => setRecordingTranscript(e.target.value)}
                                className="min-h-[120px] resize-none"
                                data-testid="textarea-transcript-result-review"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="text" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Transcript Text</Label>
                        <Textarea
                          value={recordingTranscript}
                          onChange={(e) => setRecordingTranscript(e.target.value)}
                          placeholder="Paste or type your debrief transcript here..."
                          className="min-h-[200px] resize-none"
                          data-testid="textarea-transcript-review"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button
                    onClick={handleAnalyzeRecording}
                    disabled={isAnalyzing || !recordingTranscript.trim()}
                    className="w-full mt-4"
                    data-testid="button-analyze-review"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing impact...
                      </>
                    ) : (
                      "Analyze & Extract"
                    )}
                  </Button>
                </Card>
              ) : (
                <>
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <h2 className="font-bold text-lg font-display" data-testid="text-transcript-heading">Transcript</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFollowUp(!showFollowUp)}
                        data-testid="button-toggle-followup"
                      >
                        <MessageCirclePlus className="w-4 h-4 mr-1.5" />
                        Add Follow-up
                        {showFollowUp ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReanalyze}
                        disabled={isAnalyzing || !impactLog?.transcript}
                        data-testid="button-reanalyze"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                        )}
                        Re-analyse
                      </Button>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap max-h-[60vh] overflow-y-auto" data-testid="text-transcript-content">
                    {Array.isArray(transcriptParts) ? (
                      transcriptParts.map((part, i) => (
                        part.highlighted ? (
                          <mark key={i} className="bg-primary/20 text-foreground px-0.5 rounded">{part.text}</mark>
                        ) : (
                          <span key={i}>{part.text}</span>
                        )
                      ))
                    ) : (
                      transcriptParts || <span className="text-muted-foreground italic">No transcript available</span>
                    )}
                  </div>
                </Card>

                {showFollowUp && (
                  <Card className="p-5">
                    <h3 className="font-bold font-display mb-3" data-testid="text-followup-heading">Add Follow-up Notes</h3>
                    <p className="text-sm text-muted-foreground mb-4">Record or type anything you forgot to mention. It will be appended to the transcript above.</p>

                    <Tabs value={followUpTab} onValueChange={setFollowUpTab}>
                      <TabsList className="w-full">
                        <TabsTrigger value="record" className="flex-1" data-testid="tab-followup-record">Record Audio</TabsTrigger>
                        <TabsTrigger value="text" className="flex-1" data-testid="tab-followup-text">Type Text</TabsTrigger>
                      </TabsList>

                      <TabsContent value="record" className="space-y-4 mt-4">
                        {!followUpAudioBlob && !isFollowUpRecording && (
                          <div className="flex flex-col items-center gap-4 py-6">
                            <Button
                              onClick={startFollowUpRecording}
                              className="rounded-full w-16 h-16 flex items-center justify-center"
                              data-testid="button-followup-start-recording"
                            >
                              <Mic className="w-6 h-6" />
                            </Button>
                            <p className="text-sm text-muted-foreground">Tap to record follow-up</p>
                          </div>
                        )}

                        {isFollowUpRecording && (
                          <div className="flex flex-col items-center gap-4 py-6">
                            <div className="w-16 h-16 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                              <div className="w-3.5 h-3.5 rounded-full bg-destructive" />
                            </div>
                            <p className="text-lg font-mono font-bold" data-testid="text-followup-timer">{formatRecTime(followUpRecordingTime)}</p>
                            <Button
                              variant="destructive"
                              onClick={stopFollowUpRecording}
                              data-testid="button-followup-stop-recording"
                            >
                              <Square className="w-4 h-4 mr-2" />
                              Stop Recording
                            </Button>
                          </div>
                        )}

                        {followUpAudioBlob && !isFollowUpRecording && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                              <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                              <audio controls src={followUpAudioUrl || undefined} className="flex-1 h-10" data-testid="audio-followup-playback" />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setFollowUpAudioBlob(null); setFollowUpAudioUrl(null); setFollowUpText(""); }}
                                data-testid="button-followup-discard"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {!followUpText && (
                              <Button
                                onClick={transcribeFollowUpAudio}
                                disabled={isFollowUpTranscribing}
                                className="w-full"
                                data-testid="button-followup-transcribe"
                              >
                                {isFollowUpTranscribing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Transcribing...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Transcribe
                                  </>
                                )}
                              </Button>
                            )}
                            {followUpText && (
                              <div className="space-y-2">
                                <Label>Transcribed follow-up</Label>
                                <Textarea
                                  value={followUpText}
                                  onChange={(e) => setFollowUpText(e.target.value)}
                                  className="min-h-[100px] resize-none"
                                  data-testid="textarea-followup-transcript"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="text" className="space-y-4 mt-4">
                        <Textarea
                          value={followUpText}
                          onChange={(e) => setFollowUpText(e.target.value)}
                          placeholder="Type what you forgot to mention..."
                          className="min-h-[120px] resize-none"
                          data-testid="textarea-followup-text"
                        />
                      </TabsContent>
                    </Tabs>

                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setShowFollowUp(false); setFollowUpText(""); setFollowUpAudioBlob(null); setFollowUpAudioUrl(null); }}
                        data-testid="button-followup-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleAppendFollowUp}
                        disabled={isAppending || !followUpText.trim()}
                        data-testid="button-followup-append"
                      >
                        {isAppending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Appending...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Append to Transcript
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                )}
                </>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5">
                <h3 className="font-bold font-display mb-2">Summary</h3>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="textarea-summary"
                />
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-2">Sentiment</h3>
                <Badge
                  variant="secondary"
                  className={`text-sm cursor-pointer ${SENTIMENT_COLORS[sentiment] || ""}`}
                  onClick={cycleSentiment}
                  data-testid="badge-sentiment-toggle"
                >
                  {sentiment}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">Click to change</p>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3">Impact Tags</h3>
                {impactTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags extracted</p>
                ) : (
                  <div className="space-y-3">
                    {impactTags.map((tag: any, i: number) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{tag.category || tag.name || `Tag ${i + 1}`}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setImpactTags(impactTags.filter((_: any, j: number) => j !== i))}
                            data-testid={`button-remove-tag-${i}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${confidenceColor(tag.confidence || 0)}`}
                              style={{ width: `${tag.confidence || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{tag.confidence || 0}%</span>
                        </div>
                        {tag.evidence && (
                          <p className="text-xs text-muted-foreground italic">{tag.evidence}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setImpactTags([...impactTags, { category: "New Tag", confidence: 50, evidence: "" }])}
                  data-testid="button-add-tag"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Tag
                </Button>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold font-display">Linked Community Members</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPeople([...people, { name: "", role: "mentioned", contactId: null, confidence: null }])}
                    data-testid="button-add-person"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    Add Person
                  </Button>
                </div>
                {people.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No community members linked to this debrief yet. Click "Add Person" to link one.</p>
                ) : (
                  <div className="space-y-3">
                    {people.map((person: any, i: number) => {
                      const linkedContact = person.contactId ? contacts?.find((c) => c.id === person.contactId) : null;
                      return (
                        <div key={i} className="p-3 bg-muted/30 rounded-lg border border-border space-y-2" data-testid={`person-entry-${i}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 space-y-2">
                              {linkedContact ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="text-sm font-medium text-primary">{linkedContact.name}</span>
                                  {linkedContact.role && (
                                    <Badge variant="secondary" className="text-xs">{linkedContact.role}</Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground"
                                    onClick={() => {
                                      const updated = [...people];
                                      updated[i] = { ...updated[i], contactId: null };
                                      setPeople(updated);
                                    }}
                                    data-testid={`button-unlink-${i}`}
                                  >
                                    <Unlink className="w-3 h-3 mr-1" />
                                    Unlink
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {person.name && (
                                    <p className="text-sm text-muted-foreground">
                                      AI identified: <span className="font-medium text-foreground">{person.name}</span>
                                      {person.confidence && <span className="text-xs ml-1">({person.confidence}% match)</span>}
                                    </p>
                                  )}
                                  <ContactSearchPicker
                                    contacts={contacts || []}
                                    onSelect={(contactId) => {
                                      const contact = contacts?.find(c => c.id === contactId);
                                      const updated = [...people];
                                      updated[i] = {
                                        ...updated[i],
                                        contactId,
                                        name: contact?.name || updated[i].name,
                                      };
                                      setPeople(updated);
                                      if (contact) {
                                        toast({ title: "Linked", description: `Linked to ${contact.name}` });
                                      }
                                    }}
                                    testId={`search-link-contact-${i}`}
                                  />
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => setPeople(people.filter((_: any, j: number) => j !== i))}
                              data-testid={`button-remove-person-${i}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground shrink-0">Role:</Label>
                            <Select
                              value={person.role || "mentioned"}
                              onValueChange={(val) => {
                                const updated = [...people];
                                updated[i] = { ...updated[i], role: val };
                                setPeople(updated);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-auto" data-testid={`select-person-role-${i}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mentioned">Mentioned</SelectItem>
                                <SelectItem value="primary">Primary</SelectItem>
                                <SelectItem value="participant">Participant</SelectItem>
                                <SelectItem value="mentor">Mentor</SelectItem>
                                <SelectItem value="mentee">Mentee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3">Milestones</h3>
                {milestones.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm flex-1">{m}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}
                          data-testid={`button-remove-milestone-${i}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    placeholder="Add milestone..."
                    className="flex-1"
                    data-testid="input-new-milestone"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newMilestone.trim()) {
                        setMilestones([...milestones, newMilestone.trim()]);
                        setNewMilestone("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (newMilestone.trim()) {
                        setMilestones([...milestones, newMilestone.trim()]);
                        setNewMilestone("");
                      }
                    }}
                    data-testid="button-add-milestone"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3">Funder Tags</h3>
                {funderTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {funderTags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-funder-tag-${i}`}>
                        {tag}
                        <button
                          onClick={() => setFunderTags(funderTags.filter(t => t !== tag))}
                          className="ml-0.5 transition-colors"
                          type="button"
                          data-testid={`button-remove-funder-tag-${i}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={funderTagInput}
                    onChange={(e) => setFunderTagInput(e.target.value)}
                    placeholder="Add funder tag..."
                    className="flex-1"
                    data-testid="input-funder-tag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (funderTagInput.trim() && !funderTags.includes(funderTagInput.trim())) {
                          setFunderTags([...funderTags, funderTagInput.trim()]);
                          setFunderTagInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (funderTagInput.trim() && !funderTags.includes(funderTagInput.trim())) {
                        setFunderTags([...funderTags, funderTagInput.trim()]);
                        setFunderTagInput("");
                      }
                    }}
                    data-testid="button-add-funder-tag"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3">Action Items</h3>
                {actionItemsList.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {actionItemsList.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.owner && <span className="text-xs text-muted-foreground">{item.owner}</span>}
                            {item.priority && (
                              <Badge variant="secondary" className="text-xs">
                                {item.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setActionItemsList(actionItemsList.filter((_: any, j: number) => j !== i))}
                          data-testid={`button-remove-action-${i}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-border">
                  <Input
                    value={newAction.title}
                    onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                    placeholder="Action title..."
                    data-testid="input-new-action-title"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={newAction.owner}
                      onChange={(e) => setNewAction({ ...newAction, owner: e.target.value })}
                      placeholder="Owner"
                      className="flex-1"
                      data-testid="input-new-action-owner"
                    />
                    <select
                      value={newAction.priority}
                      onChange={(e) => setNewAction({ ...newAction, priority: e.target.value })}
                      className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      data-testid="select-new-action-priority"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (newAction.title.trim()) {
                        setActionItemsList([...actionItemsList, { ...newAction }]);
                        setNewAction({ title: "", owner: "", priority: "medium" });
                      }
                    }}
                    data-testid="button-add-action"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Action
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Community Actions
                </h3>
                <p className="text-xs text-muted-foreground mb-3">Follow-ups with people — introductions, resources, bookings</p>
                {communityActions.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {communityActions.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900" data-testid={`community-action-${i}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.task}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.contactMentioned && <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />{item.contactMentioned}</Badge>}
                            {item.priority && (
                              <Badge variant={item.priority === "high" ? "destructive" : "secondary"} className="text-xs capitalize">
                                {item.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setCommunityActions(communityActions.filter((_: any, j: number) => j !== i))} data-testid={`button-remove-community-action-${i}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {communityActions.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">No community actions extracted.</p>}
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-orange-500" />
                  Operational Actions
                </h3>
                <p className="text-xs text-muted-foreground mb-3">Internal hub tasks — processes, admin, marketing, capacity</p>
                {operationalActions.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {operationalActions.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900" data-testid={`operational-action-${i}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.task}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.category && (
                              <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
                            )}
                            {item.priority && (
                              <Badge variant={item.priority === "high" ? "destructive" : "secondary"} className="text-xs capitalize">
                                {item.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setOperationalActions(operationalActions.filter((_: any, j: number) => j !== i))} data-testid={`button-remove-operational-action-${i}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {operationalActions.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">No operational actions extracted.</p>}
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Operator Reflections
                </h3>
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3" data-testid="reflections-wins">
                    <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">Wins</h4>
                    {reflections.wins.length > 0 ? (
                      <ul className="space-y-1">
                        {reflections.wins.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-1">{w}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReflections({ ...reflections, wins: reflections.wins.filter((_, j) => j !== i) })} data-testid={`button-remove-win-${i}`}>
                              <X className="w-3 h-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground italic">No wins extracted.</p>}
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3" data-testid="reflections-concerns">
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Concerns</h4>
                    {reflections.concerns.length > 0 ? (
                      <ul className="space-y-1">
                        {reflections.concerns.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-1">{c}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReflections({ ...reflections, concerns: reflections.concerns.filter((_, j) => j !== i) })} data-testid={`button-remove-concern-${i}`}>
                              <X className="w-3 h-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground italic">No concerns extracted.</p>}
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3" data-testid="reflections-learnings">
                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">Learnings</h4>
                    {reflections.learnings.length > 0 ? (
                      <ul className="space-y-1">
                        {reflections.learnings.map((l, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-1">{l}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReflections({ ...reflections, learnings: reflections.learnings.filter((_, j) => j !== i) })} data-testid={`button-remove-learning-${i}`}>
                              <X className="w-3 h-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground italic">No learnings extracted.</p>}
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3">Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(METRIC_LABELS).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={metrics[key] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= 10) {
                            setMetrics({ ...metrics, [key]: val });
                          } else if (e.target.value === "") {
                            const updated = { ...metrics };
                            delete updated[key];
                            setMetrics(updated);
                          }
                        }}
                        placeholder="1-10"
                        data-testid={`input-metric-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={updateMutation.isPending}
              data-testid="button-save-draft"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSave("confirmed")}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-save"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm & Save
            </Button>
          </div>
        </div>

        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Debrief</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{impactLog.title}"? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete-detail">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-detail"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
  );
}

function ManualUpdateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: contacts } = useQuery<Contact[]>({ queryKey: ['/api/contacts'] });
  const [inputMode, setInputMode] = useState<"record" | "text">("text");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetState = () => {
    setTitle("");
    setNotes("");
    setSelectedContacts([]);
    setIsSaving(false);
    setInputMode("text");
    setAudioBlob(null);
    setAudioUrl(null);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    try {
      const res = await fetch("/api/impact-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audioBlob,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setNotes(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Voice recording has been converted to text." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Transcription failed", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Missing title", description: "Please give this update a title.", variant: "destructive" });
      return;
    }
    if (!notes.trim()) {
      toast({ title: "Missing notes", description: "Please describe what happened.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiRequest("POST", "/api/impact-logs", {
        title: title.trim(),
        type: "manual_update",
        transcript: notes.trim(),
        summary: notes.trim(),
        status: "draft",
      });
      const data = await res.json();

      for (const contactId of selectedContacts) {
        await apiRequest("POST", `/api/impact-logs/${data.id}/contacts`, {
          contactId,
          role: "participant",
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs'] });
      resetState();
      onOpenChange(false);
      setLocation(`/debriefs/${data.id}`);
      toast({ title: "Manual update created", description: "You can add more details or confirm it." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const removeContact = (id: number) => {
    setSelectedContacts(prev => prev.filter(c => c !== id));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-pink-500" />
            Manual Update
          </DialogTitle>
          <DialogDescription>
            Log an informal conversation or connection that created change in a community member.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="manual-update-title">Title</Label>
            <Input
              id="manual-update-title"
              data-testid="input-manual-update-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Catch-up with Rangi about next steps"
            />
          </div>

          <div className="space-y-2">
            <Label>Community members involved</Label>
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedContacts.map((cId) => {
                  const contact = contacts?.find(c => c.id === cId);
                  if (!contact) return null;
                  return (
                    <Badge key={cId} variant="secondary" className="flex items-center gap-1 pr-1" data-testid={`badge-contact-${cId}`}>
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {contact.name[0]}
                      </span>
                      {contact.name}
                      <button
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() => removeContact(cId)}
                        data-testid={`button-remove-contact-${cId}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            {contacts && contacts.length > 0 && (
              <ContactSearchPicker
                contacts={contacts.filter(c => !selectedContacts.includes(c.id))}
                onSelect={(id) => setSelectedContacts(prev => [...prev, id])}
                testId="search-manual-update-contacts"
              />
            )}
          </div>

          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "record" | "text")}>
            <TabsList className="w-full">
              <TabsTrigger value="record" className="flex-1" data-testid="tab-manual-record">
                <Mic className="w-3.5 h-3.5 mr-1" /> Record Audio
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1" data-testid="tab-manual-text">
                <FileText className="w-3.5 h-3.5 mr-1" /> Type Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="space-y-3 mt-3">
              {!audioBlob && !isRecording && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Button
                    onClick={startRecording}
                    className="rounded-full w-14 h-14 flex items-center justify-center"
                    data-testid="button-start-manual-recording"
                  >
                    <Mic className="w-6 h-6" />
                  </Button>
                  <p className="text-xs text-muted-foreground">Tap to record what happened</p>
                </div>
              )}
              {isRecording && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-14 h-14 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-destructive" />
                  </div>
                  <p className="text-lg font-mono font-bold">{fmtTime(recordingTime)}</p>
                  <Button variant="destructive" size="sm" onClick={stopRecording} data-testid="button-stop-manual-recording">
                    <Square className="w-3.5 h-3.5 mr-1" /> Stop Recording
                  </Button>
                </div>
              )}
              {audioBlob && !isRecording && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                    <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                    <audio controls src={audioUrl || undefined} className="flex-1 h-8" data-testid="audio-manual-playback" />
                    <Button variant="ghost" size="icon" onClick={() => { setAudioBlob(null); setAudioUrl(null); setNotes(""); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {!notes && (
                    <Button onClick={transcribeAudio} disabled={isTranscribing} className="w-full" data-testid="button-transcribe-manual">
                      {isTranscribing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transcribing...</> : <><FileText className="w-4 h-4 mr-2" /> Transcribe</>}
                    </Button>
                  )}
                  {notes && (
                    <div className="space-y-2">
                      <Label>Transcribed text</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[100px] resize-none"
                        data-testid="textarea-manual-transcript"
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label htmlFor="manual-update-notes">What happened?</Label>
                <Textarea
                  id="manual-update-notes"
                  data-testid="textarea-manual-update-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe the conversation, what shifted, and any outcomes or next steps..."
                  className="min-h-[150px] resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !notes.trim()}
            className="w-full"
            data-testid="button-save-manual-update"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <HeartHandshake className="w-4 h-4 mr-2" />
                Save Update
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactSearchPicker({
  contacts,
  onSelect,
  testId,
}: {
  contacts: Contact[];
  onSelect: (contactId: number) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleQuickCreate = async () => {
    if (!searchValue.trim()) return;
    setIsCreating(true);
    try {
      const res = await apiRequest("POST", "/api/contacts", {
        name: searchValue.trim(),
        role: "Community Member",
      });
      const newContact = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onSelect(newContact.id);
      setSearchValue("");
      setOpen(false);
    } catch (err: any) {}
    setIsCreating(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground font-normal"
          data-testid={testId}
        >
          <Search className="w-3.5 h-3.5 mr-2 shrink-0" />
          Search and link a community member...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Type a name to search..."
            data-testid={`${testId}-input`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-2 px-1">
                <p className="text-xs text-muted-foreground mb-2">No contacts found</p>
                {searchValue.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={handleQuickCreate}
                    disabled={isCreating}
                    data-testid={`${testId}-quick-add`}
                  >
                    {isCreating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <UserPlus className="w-3 h-3 mr-1" />
                    )}
                    Create "{searchValue.trim()}"
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                  data-testid={`${testId}-option-${c.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
