import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation, useSearch } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Mic,
  FileText,
  SkipForward,
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  Check,
  Loader2,
  Link2,
} from "lucide-react";
import { useState, useEffect } from "react";

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

const STATUS_CONFIG = {
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

export default function DebriefQueuePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const reconcileId = params.get("reconcile");
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
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-queue-title">
              Debrief Queue
            </h1>
            <p className="text-muted-foreground text-sm">
              Events that need a debrief recorded before they can be reconciled.
            </p>
          </div>
        </div>

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
              const config = STATUS_CONFIG[item.queueStatus];
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
          navigate("/debrief-queue", { replace: true });
        }}
      />
    </main>
  );
}

function ReconcileDialog({ event, open, onClose }: { event: QueueItem | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"input" | "creating" | "done">("input");
  const [debriefTitle, setDebriefTitle] = useState("");
  const [debriefTranscript, setDebriefTranscript] = useState("");

  useEffect(() => {
    if (event) {
      setDebriefTitle(event.name + " - Debrief");
      setDebriefTranscript("");
      setStep("input");
    }
  }, [event]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      setStep("done");
      toast({
        title: "Debrief created",
        description: "Your debrief has been linked to the event.",
      });
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
              <label className="text-sm font-medium">Debrief Title</label>
              <Input
                value={debriefTitle}
                onChange={(e) => setDebriefTitle(e.target.value)}
                placeholder="Title for this debrief..."
                data-testid="input-debrief-title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Transcript / Notes</label>
              <Textarea
                value={debriefTranscript}
                onChange={(e) => setDebriefTranscript(e.target.value)}
                placeholder="Paste your transcript or type notes about the event..."
                rows={6}
                data-testid="input-debrief-transcript"
              />
              <p className="text-xs text-muted-foreground">
                You can also record a voice debrief later from the Debriefs section.
              </p>
            </div>
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
              The debrief has been linked to "{event.name}". You can continue editing and analyzing it from the Debriefs section.
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
            <Button onClick={onClose} data-testid="button-close-reconcile">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
