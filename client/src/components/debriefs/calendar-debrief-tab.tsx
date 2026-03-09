import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import {
  Loader2,
  Mic,
  Square,
  Play,
  Trash2,
  FileText,
  AlertTriangle,
  Clock,
  X,
  MapPin,
  Users,
  Calendar,
  Check,
  ClipboardCheck,
  Link2,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import type { QueueItem, DismissedQueueItem } from "./shared";

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

export function CalendarDebriefTab({ reconcileId }: { reconcileId: string | null }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dismissDialogEventId, setDismissDialogEventId] = useState<number | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [dismissCustomReason, setDismissCustomReason] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [reconcileEventId, setReconcileEventId] = useState<number | null>(null);

  const { data: queue, isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/events/needs-debrief"],
  });

  const { data: dismissedItems } = useQuery<DismissedQueueItem[]>({
    queryKey: ["/api/events/dismissed-debriefs"],
    enabled: showDismissed,
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

  const dismissMutation = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: number; reason: string }) => {
      await apiRequest("POST", `/api/events/${eventId}/skip-debrief`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/dismissed-debriefs"] });
      toast({ title: "Event dismissed", description: "Event removed from queue." });
      setDismissDialogEventId(null);
      setDismissReason("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const undismissMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}/skip-debrief`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/dismissed-debriefs"] });
      toast({ title: "Event restored", description: "Event has been returned to the queue." });
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
  const dismissedCt = dismissedItems?.length || 0;

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

          <Button
            variant={showDismissed ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDismissed(prev => !prev)}
            className={!showDismissed ? "text-muted-foreground" : ""}
            data-testid="filter-show-dismissed"
          >
            {showDismissed ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
            {showDismissed ? "Hide Dismissed" : "Show Dismissed"}
          </Button>
        </div>

        {filteredQueue.length === 0 && (!showDismissed || dismissedCt === 0) ? (
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
                        size="icon"
                        onClick={() => { setDismissDialogEventId(item.id); setDismissReason(""); }}
                        className="text-muted-foreground"
                        data-testid={`button-dismiss-${item.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      {item.existingDebriefId ? (
                        <Link href={`/debriefs/${item.existingDebriefId}`} data-testid={`button-continue-${item.id}`}>
                          <Button size="sm" variant="outline" className="gap-1">
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

            {showDismissed && dismissedItems && dismissedItems.length > 0 && (
              <div className="space-y-3 mt-6">
                <h4 className="text-sm font-medium text-muted-foreground" data-testid="heading-dismissed">
                  Dismissed ({dismissedItems.length})
                </h4>
                {dismissedItems.map((item) => (
                  <Card
                    key={item.id}
                    className="border-l-4 border-l-muted p-4 opacity-60"
                    data-testid={`dismissed-card-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs shrink-0" data-testid={`dismissed-badge-${item.id}`}>
                            Dismissed
                          </Badge>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.type}
                          </Badge>
                          {item.dismissReason && (
                            <span className="text-xs text-muted-foreground italic">
                              {item.dismissReason}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-base truncate" data-testid={`dismissed-name-${item.id}`}>
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
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => undismissMutation.mutate(item.id)}
                          disabled={undismissMutation.isPending}
                          data-testid={`button-undismiss-${item.id}`}
                        >
                          {undismissMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Un-dismiss
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={dismissDialogEventId !== null} onOpenChange={(open) => { if (!open) { setDismissDialogEventId(null); setDismissReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Provide a reason for dismissing this event. It will be removed from the queue but can be restored later.
          </p>
          <Select value={dismissReason} onValueChange={(val) => { setDismissReason(val); if (val !== "Other") setDismissCustomReason(""); }}>
            <SelectTrigger data-testid="select-dismiss-reason">
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
          {dismissReason === "Other" && (
            <Input
              value={dismissCustomReason}
              onChange={(e) => setDismissCustomReason(e.target.value)}
              placeholder="Please specify a reason..."
              data-testid="input-dismiss-custom-reason"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDismissDialogEventId(null); setDismissReason(""); setDismissCustomReason(""); }} data-testid="button-cancel-dismiss">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!dismissReason || (dismissReason === "Other" && !dismissCustomReason.trim()) || dismissMutation.isPending}
              onClick={() => dismissDialogEventId && dismissMutation.mutate({
                eventId: dismissDialogEventId,
                reason: dismissReason === "Other" ? dismissCustomReason.trim() : dismissReason,
              })}
              data-testid="button-confirm-dismiss"
            >
              {dismissMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <X className="w-4 h-4 mr-1" />}
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReconcileDialog
        event={reconcileEvent || null}
        open={reconcileEventId !== null}
        onClose={() => {
          setReconcileEventId(null);
          navigate("/debriefs?tab=queue", { replace: true });
        }}
      />
    </>
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
      const newId = data?.id;
      if (newId) {
        onClose();
        setLocation(`/debriefs/${newId}?from=queue`);
      } else {
        setCreatedId(null);
        setStep("done");
      }
      toast({ title: "Debrief created", description: "Navigating to review..." });
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
