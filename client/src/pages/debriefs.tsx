import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useParams, useLocation } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
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

function ListView() {
  const { data: logs, isLoading } = useImpactLogs() as { data: ImpactLog[] | undefined; isLoading: boolean };
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImpactLog | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-debriefs-title">Debriefs</h1>
              <p className="text-muted-foreground mt-1">Record and review impact debriefs</p>
            </div>
            <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-new-debrief">
              <Plus className="w-4 h-4 mr-2" />
              New Debrief
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No debriefs yet</h3>
              <p className="text-muted-foreground mb-6">Record or paste a debrief to get started.</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline" data-testid="button-new-debrief-empty">
                New Debrief
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(logs as ImpactLog[]).map((log) => (
                <Card
                  key={log.id}
                  className="p-5 cursor-pointer hover-elevate transition-all duration-200"
                  onClick={() => setLocation(`/debriefs/${log.id}`)}
                  data-testid={`card-debrief-${log.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-bold text-lg font-display truncate flex-1" data-testid={`text-debrief-title-${log.id}`}>
                      {log.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(log); }}
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
          )}
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
    </div>
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
  const [actionItemsList, setActionItemsList] = useState<any[]>([]);
  const [newAction, setNewAction] = useState({ title: "", owner: "", priority: "medium" });
  const [impactTags, setImpactTags] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
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
    };

    try {
      await apiRequest('PATCH', `/api/impact-logs/${id}`, {
        status,
        summary,
        sentiment,
        milestones,
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
      <div className="flex min-h-screen bg-background/50">
        <Sidebar />
        <main className="flex-1 md:ml-72 flex items-center justify-center pt-14 md:pt-0 pb-20 md:pb-0">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!impactLog) {
    return (
      <div className="flex min-h-screen bg-background/50">
        <Sidebar />
        <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0">
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
      </div>
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
    skill: "Skill",
    confidence: "Confidence",
    confidenceScore: "Confidence Score",
    systemsInPlace: "Systems in Place",
    fundingReadiness: "Funding Readiness",
    networkStrength: "Network Strength",
  };

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/debriefs")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-display font-bold truncate" data-testid="text-review-title">{impactLog.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
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

        <div className="fixed bottom-0 left-0 right-0 md:left-72 bg-card border-t border-border p-4 z-40">
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
    </div>
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
          <CommandInput placeholder="Type a name to search..." data-testid={`${testId}-input`} />
          <CommandList>
            <CommandEmpty>No contacts found.</CommandEmpty>
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
