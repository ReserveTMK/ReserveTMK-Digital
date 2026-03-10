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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImpactLog, useUpdateImpactLog } from "@/hooks/use-impact-logs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
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
  MessageCirclePlus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  HeartHandshake,
  Users,
  Link2,
  Unlink,
  UserPlus,
  Settings,
  Sparkles,
  Save,
  Check,
} from "lucide-react";
import type { ImpactLog, Contact } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  SENTIMENT_COLORS,
  SENTIMENTS,
  ContactSearchPicker,
} from "./shared";

export function ReviewView({ id }: { id: number }) {
  const { data: log, isLoading } = useImpactLog(id);
  const { data: contacts } = useQuery<Contact[]>({ queryKey: ['/api/contacts'] });
  const { data: taxonomyCategories } = useQuery<any[]>({ queryKey: ['/api/taxonomy'] });
  const { data: savedTags } = useQuery<any[]>({ queryKey: ['/api/impact-logs', id, 'tags'] });
  const updateMutation = useUpdateImpactLog();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const fromQueue = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "queue";
  const [autoAnalyzeTriggered, setAutoAnalyzeTriggered] = useState(false);

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
  const [suggestedActions, setSuggestedActions] = useState<any[]>([]);
  const [suggestedCommunityActions, setSuggestedCommunityActions] = useState<any[]>([]);
  const [suggestedOperationalActions, setSuggestedOperationalActions] = useState<any[]>([]);
  const [showSuggestedActions, setShowSuggestedActions] = useState(true);
  const [showSuggestedCommunity, setShowSuggestedCommunity] = useState(true);
  const [showSuggestedOperational, setShowSuggestedOperational] = useState(true);
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
  const [isSavingAudio, setIsSavingAudio] = useState(false);
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
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start(1000);
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
    if (!audioBlob || audioBlob.size < 100) {
      toast({ title: "Recording too short", description: "Please record a longer audio clip.", variant: "destructive" });
      return;
    }
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
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(followUpChunksRef.current, { type: mimeType });
        setFollowUpAudioBlob(blob);
        setFollowUpAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start(1000);
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
    if (!followUpAudioBlob || followUpAudioBlob.size < 100) {
      toast({ title: "Recording too short", description: "Please record a longer audio clip.", variant: "destructive" });
      return;
    }
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

  const saveAudioToLog = async () => {
    if (!audioBlob) return;
    setIsSavingAudio(true);
    try {
      const uploadRes = await fetch(`/api/impact-logs/${id}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audioBlob,
        credentials: "include",
      });
      if (!uploadRes.ok) throw new Error("Failed to upload audio");
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id] });
      toast({ title: "Audio saved", description: "Recording saved to this debrief." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save audio", variant: "destructive" });
    } finally {
      setIsSavingAudio(false);
    }
  };

  const hasTranscriptPlaceholder = impactLog?.transcript === "(Audio saved - transcription pending)";
  const needsRecording = impactLog && impactLog.status === "draft" && (!impactLog.transcript || hasTranscriptPlaceholder) && !extraction;

  useEffect(() => {
    if (fromQueue && impactLog && impactLog.status === "draft" && impactLog.transcript && !extraction && !autoAnalyzeTriggered && !isAnalyzing) {
      setAutoAnalyzeTriggered(true);
      (async () => {
        setIsAnalyzing(true);
        try {
          const res = await fetch("/api/impact-extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: impactLog.transcript, title: impactLog.title, existingLogId: id }),
            credentials: "include",
          });
          if (!res.ok) throw new Error("Analysis failed");
          queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id] });
          setInitialized(false);
          toast({ title: "Analysis complete", description: "Review the extracted impact data." });
        } catch (err: any) {
          toast({ title: "Error", description: err.message || "Auto-analysis failed", variant: "destructive" });
        } finally {
          setIsAnalyzing(false);
        }
      })();
    }
  }, [fromQueue, impactLog, extraction, autoAnalyzeTriggered, isAnalyzing]);

  useEffect(() => {
    if (impactLog && extraction && !initialized && savedTags !== undefined) {
      setSummary(extraction.summary || impactLog.summary || "");
      setSentiment(extraction.sentiment || impactLog.sentiment || "neutral");
      setMilestones(extraction.milestones || impactLog.milestones || []);
      if (savedTags && savedTags.length > 0) {
        setImpactTags(savedTags.map((tag: any) => ({
          ...tag,
          category: taxonomyCategories?.find((t: any) => t.id === tag.taxonomyId)?.name || tag.category || "",
          evidence: tag.evidence || tag.notes || "",
          dbId: tag.id,
        })));
      } else if (Array.isArray(savedTags) && savedTags.length === 0) {
        setImpactTags([]);
      } else {
        setImpactTags((extraction.impactTags || []).map((tag: any) => ({
          ...tag,
        })));
      }
      setPeople((extraction.people || []).map((p: any) => ({
        ...p,
        section: p.section || (["primary", "mentor", "mentee"].includes(p.role) ? "primary" : "secondary"),
      })));
      setMetrics(extraction.metrics || {});
      setReflections(extraction.reflections || { wins: [], concerns: [], learnings: [] });

      const isConfirmed = impactLog.status === "confirmed";
      if (isConfirmed) {
        setActionItemsList(extraction.actionItems || []);
        setCommunityActions(extraction.communityActions || []);
        setOperationalActions(extraction.operationalActions || []);
        setSuggestedActions([]);
        setSuggestedCommunityActions([]);
        setSuggestedOperationalActions([]);
      } else {
        const reviewed = impactLog.reviewedData as any;
        const hasReviewedActions = reviewed?.actionItems?.length > 0 || reviewed?.communityActions?.length > 0 || reviewed?.operationalActions?.length > 0;
        if (hasReviewedActions) {
          setActionItemsList(reviewed.actionItems || []);
          setCommunityActions(reviewed.communityActions || []);
          setOperationalActions(reviewed.operationalActions || []);
          setSuggestedActions([]);
          setSuggestedCommunityActions([]);
          setSuggestedOperationalActions([]);
        } else {
          setActionItemsList([]);
          setCommunityActions([]);
          setOperationalActions([]);
          setSuggestedActions(extraction.actionItems || []);
          setSuggestedCommunityActions(extraction.communityActions || []);
          setSuggestedOperationalActions(extraction.operationalActions || []);
          setShowSuggestedActions(true);
          setShowSuggestedCommunity(true);
          setShowSuggestedOperational(true);
        }
      }

      setInitialized(true);
    }
  }, [impactLog, extraction, initialized, savedTags, taxonomyCategories]);

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
            const role = person.section === "primary" || (!person.section && ["primary", "mentor", "mentee"].includes(person.role)) ? "primary" : "mentioned";
            try {
              await apiRequest('POST', `/api/impact-logs/${id}/contacts`, {
                impactLogId: id,
                contactId: person.contactId,
                role,
              });
            } catch {}
          }
        }

        for (const tag of impactTags) {
          if (tag.taxonomyId && !tag.dbId) {
            try {
              await apiRequest('POST', `/api/impact-logs/${id}/tags`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs', id, 'tags'] });

      toast({
        title: status === "confirmed" ? "Debrief Confirmed" : "Draft Saved",
        description: status === "confirmed" ? "Impact data has been confirmed and saved." : "Your draft has been saved.",
      });

      if (status === "confirmed") {
        setLocation(fromQueue ? "/debriefs?tab=queue" : "/debriefs?tab=archive");
      } else if (status === "draft" && fromQueue) {
        setLocation("/debriefs?tab=queue");
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
    <main className="flex-1 p-4 md:p-8 pb-36 md:pb-24 overflow-y-auto">
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

                  {impactLog.audioUrl && (
                    <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border space-y-2">
                      <Label className="text-sm font-medium">Saved Recording</Label>
                      <div className="flex items-center gap-3">
                        <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                        <audio controls src={impactLog.audioUrl} className="flex-1 h-10" data-testid="audio-saved-playback" />
                      </div>
                    </div>
                  )}

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
                            <div className="flex gap-2">
                              <Button
                                onClick={transcribeAudio}
                                disabled={isTranscribing || isSavingAudio}
                                className="flex-1"
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
                              <Button
                                variant="outline"
                                onClick={saveAudioToLog}
                                disabled={isSavingAudio || isTranscribing}
                                data-testid="button-save-audio-review"
                              >
                                {isSavingAudio ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Audio
                                  </>
                                )}
                              </Button>
                            </div>
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
                {impactLog?.audioUrl && (
                  <Card className="p-5">
                    <Label className="text-sm font-medium">Saved Recording</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                      <audio controls src={impactLog.audioUrl} className="flex-1 h-10" data-testid="audio-saved-playback-detail" />
                    </div>
                  </Card>
                )}
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
                <p className="text-xs text-muted-foreground mb-3">Auto-applied from AI analysis. Remove any that don't apply.</p>
                {impactTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags extracted</p>
                ) : (
                  <div className="space-y-3">
                    {impactTags.map((tag: any, i: number) => {
                      const matchedTaxonomy = tag.taxonomyId
                        ? taxonomyCategories?.find((t: any) => t.id === tag.taxonomyId)
                        : null;
                      return (
                        <div key={tag.dbId || i} className="space-y-1.5 p-3 rounded-lg border bg-muted/30 border-border" data-testid={`impact-tag-entry-${i}`}>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                              {tag.taxonomyId && matchedTaxonomy ? (
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {matchedTaxonomy.color && (
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: matchedTaxonomy.color }} />
                                  )}
                                  <span className="text-sm font-medium truncate">{matchedTaxonomy.name}</span>
                                  <Badge variant="secondary" className="text-[10px] shrink-0">Applied</Badge>
                                </div>
                              ) : (
                                <div className="flex-1 min-w-0">
                                  <Select
                                    value={tag.taxonomyId ? String(tag.taxonomyId) : ""}
                                    onValueChange={async (val) => {
                                      const selectedTax = taxonomyCategories?.find((t: any) => t.id === Number(val));
                                      try {
                                        const res = await apiRequest('POST', `/api/impact-logs/${id}/tags`, {
                                          taxonomyId: Number(val),
                                          confidence: tag.confidence || 50,
                                          notes: tag.evidence || "",
                                        });
                                        const newTag = await res.json();
                                        const updated = [...impactTags];
                                        updated[i] = {
                                          ...updated[i],
                                          taxonomyId: Number(val),
                                          category: selectedTax?.name || updated[i].category,
                                          dbId: newTag.id,
                                        };
                                        setImpactTags(updated);
                                        queryClient.invalidateQueries({ queryKey: ['/api/impact-logs', id, 'tags'] });
                                        toast({ title: "Tag saved" });
                                      } catch {
                                        toast({ title: "Error", description: "Failed to save tag", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="flex-1" data-testid={`select-tag-category-${i}`}>
                                      <SelectValue placeholder="Select taxonomy category..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(taxonomyCategories || []).filter((t: any) => t.active !== false).map((t: any) => (
                                        <SelectItem key={t.id} value={String(t.id)}>
                                          <div className="flex items-center gap-2">
                                            {t.color && (
                                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                            )}
                                            <span>{t.name}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {tag.category && tag.category !== "New Tag" && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                      AI suggested: "{tag.category}"
                                    </p>
                                  )}
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px]"
                                onClick={async () => {
                                  if (tag.dbId) {
                                    try {
                                      await apiRequest('DELETE', `/api/impact-tags/${tag.dbId}`);
                                      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs', id, 'tags'] });
                                    } catch {}
                                  }
                                  setImpactTags(impactTags.filter((_: any, j: number) => j !== i));
                                }}
                                data-testid={`button-remove-tag-${i}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
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
                      );
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setImpactTags([...impactTags, { category: "", confidence: 50, evidence: "", taxonomyId: null }])}
                  data-testid="button-add-tag"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Tag
                </Button>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-4">Linked Community Members</h3>
                <PeopleSection
                  label="Primary"
                  description="Main people involved"
                  people={people.filter((p: any) => p.section === "primary" || (!p.section && ["primary", "mentor", "mentee"].includes(p.role)))}
                  allPeople={people}
                  setPeople={setPeople}
                  contacts={contacts || []}
                  toast={toast}
                  section="primary"
                  testIdPrefix="primary"
                />
                <div className="my-4 border-t border-border" />
                <PeopleSection
                  label="Secondary"
                  description="Others mentioned"
                  people={people.filter((p: any) => p.section === "secondary" || (!p.section && !["primary", "mentor", "mentee"].includes(p.role)))}
                  allPeople={people}
                  setPeople={setPeople}
                  contacts={contacts || []}
                  toast={toast}
                  section="secondary"
                  testIdPrefix="secondary"
                />
              </Card>

              <Card className="p-5">
                <h3 className="font-bold font-display mb-3">Milestones</h3>
                {milestones.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm flex-1">{m}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}
                          data-testid={`button-remove-milestone-${i}`}
                        >
                          <X className="w-4 h-4" />
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
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => setActionItemsList(actionItemsList.filter((_: any, j: number) => j !== i))}
                          data-testid={`button-remove-action-${i}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {suggestedActions.length > 0 && (
                  <div className="mb-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                      onClick={() => setShowSuggestedActions(!showSuggestedActions)}
                      data-testid="button-toggle-suggested-actions"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Suggestions ({suggestedActions.length})
                      {showSuggestedActions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showSuggestedActions && (
                      <div className="space-y-2">
                        {suggestedActions.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900 cursor-pointer hover-elevate"
                            onClick={() => {
                              setActionItemsList([...actionItemsList, item]);
                              setSuggestedActions(suggestedActions.filter((_: any, j: number) => j !== i));
                            }}
                            data-testid={`suggested-action-${i}`}
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-500 shrink-0" />
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
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-purple-600 dark:text-purple-400"
                          onClick={() => {
                            setActionItemsList([...actionItemsList, ...suggestedActions]);
                            setSuggestedActions([]);
                          }}
                          data-testid="button-accept-all-actions"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Accept All
                        </Button>
                      </div>
                    )}
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
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setCommunityActions(communityActions.filter((_: any, j: number) => j !== i))} data-testid={`button-remove-community-action-${i}`}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {suggestedCommunityActions.length > 0 && (
                  <div className="mb-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                      onClick={() => setShowSuggestedCommunity(!showSuggestedCommunity)}
                      data-testid="button-toggle-suggested-community"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Suggestions ({suggestedCommunityActions.length})
                      {showSuggestedCommunity ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showSuggestedCommunity && (
                      <div className="space-y-2">
                        {suggestedCommunityActions.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900 cursor-pointer hover-elevate min-h-[48px]"
                            onClick={() => {
                              setCommunityActions([...communityActions, item]);
                              setSuggestedCommunityActions(suggestedCommunityActions.filter((_: any, j: number) => j !== i));
                            }}
                            data-testid={`suggested-community-action-${i}`}
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-500 shrink-0" />
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
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-purple-600 dark:text-purple-400"
                          onClick={() => {
                            setCommunityActions([...communityActions, ...suggestedCommunityActions]);
                            setSuggestedCommunityActions([]);
                          }}
                          data-testid="button-accept-all-community"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Accept All
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {communityActions.length === 0 && suggestedCommunityActions.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">No community actions extracted.</p>}
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
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setOperationalActions(operationalActions.filter((_: any, j: number) => j !== i))} data-testid={`button-remove-operational-action-${i}`}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {suggestedOperationalActions.length > 0 && (
                  <div className="mb-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                      onClick={() => setShowSuggestedOperational(!showSuggestedOperational)}
                      data-testid="button-toggle-suggested-operational"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Suggestions ({suggestedOperationalActions.length})
                      {showSuggestedOperational ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showSuggestedOperational && (
                      <div className="space-y-2">
                        {suggestedOperationalActions.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900 cursor-pointer hover-elevate min-h-[48px]"
                            onClick={() => {
                              setOperationalActions([...operationalActions, item]);
                              setSuggestedOperationalActions(suggestedOperationalActions.filter((_: any, j: number) => j !== i));
                            }}
                            data-testid={`suggested-operational-action-${i}`}
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-500 shrink-0" />
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
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-purple-600 dark:text-purple-400"
                          onClick={() => {
                            setOperationalActions([...operationalActions, ...suggestedOperationalActions]);
                            setSuggestedOperationalActions([]);
                          }}
                          data-testid="button-accept-all-operational"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Accept All
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {operationalActions.length === 0 && suggestedOperationalActions.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">No operational actions extracted.</p>}
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
                      <ul className="space-y-2">
                        {reflections.wins.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-1">{w}</span>
                            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0" onClick={() => setReflections({ ...reflections, wins: reflections.wins.filter((_, j) => j !== i) })} data-testid={`button-remove-win-${i}`}>
                              <X className="w-4 h-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground italic">No wins extracted.</p>}
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3" data-testid="reflections-concerns">
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Concerns</h4>
                    {reflections.concerns.length > 0 ? (
                      <ul className="space-y-2">
                        {reflections.concerns.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-1">{c}</span>
                            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0" onClick={() => setReflections({ ...reflections, concerns: reflections.concerns.filter((_, j) => j !== i) })} data-testid={`button-remove-concern-${i}`}>
                              <X className="w-4 h-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground italic">No concerns extracted.</p>}
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3" data-testid="reflections-learnings">
                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">Learnings</h4>
                    {reflections.learnings.length > 0 ? (
                      <ul className="space-y-2">
                        {reflections.learnings.map((l, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="flex-1">{l}</span>
                            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0" onClick={() => setReflections({ ...reflections, learnings: reflections.learnings.filter((_, j) => j !== i) })} data-testid={`button-remove-learning-${i}`}>
                              <X className="w-4 h-4" />
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

        <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-40 safe-area-bottom">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={updateMutation.isPending}
              className="min-h-[44px] w-full sm:w-auto"
              data-testid="button-save-draft"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSave("confirmed")}
              disabled={updateMutation.isPending}
              className="min-h-[44px] w-full sm:w-auto"
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

function PersonEntry({ person, onRemove, onUnlink, onLink, contacts, testIdPrefix, index }: {
  person: any;
  onRemove: () => void;
  onUnlink: () => void;
  onLink: (contactId: number, name: string) => void;
  contacts: Contact[];
  testIdPrefix: string;
  index: number;
}) {
  const linkedContact = person.contactId ? contacts.find((c) => c.id === person.contactId) : null;
  return (
    <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2" data-testid={`${testIdPrefix}-person-${index}`}>
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
                onClick={onUnlink}
                data-testid={`${testIdPrefix}-unlink-${index}`}
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
                contacts={contacts}
                onSelect={(contactId) => {
                  const contact = contacts.find(c => c.id === contactId);
                  onLink(contactId, contact?.name || person.name);
                }}
                testId={`${testIdPrefix}-search-${index}`}
              />
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onRemove}
          data-testid={`${testIdPrefix}-remove-${index}`}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PeopleSection({ label, description, people, allPeople, setPeople, contacts, toast, section, testIdPrefix }: {
  label: string;
  description: string;
  people: any[];
  allPeople: any[];
  setPeople: (p: any[]) => void;
  contacts: Contact[];
  toast: any;
  section: "primary" | "secondary";
  testIdPrefix: string;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const addPerson = () => {
    setPeople([...allPeople, { name: "", role: section === "primary" ? "primary" : "mentioned", section, contactId: null }]);
  };

  const handleQuickAddDone = (contactId: number, contactName: string) => {
    setPeople([...allPeople, { name: contactName, role: section === "primary" ? "primary" : "mentioned", section, contactId }]);
    toast({ title: "Person added", description: `${contactName} linked as ${label.toLowerCase()}.` });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            data-testid={`${testIdPrefix}-quick-add`}
          >
            <Plus className="w-3 h-3 mr-1" />
            Quick Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addPerson}
            data-testid={`${testIdPrefix}-add-person`}
          >
            <UserPlus className="w-3 h-3 mr-1" />
            Link Existing
          </Button>
        </div>
      </div>
      {people.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">No {label.toLowerCase()} people linked yet.</p>
      ) : (
        <div className="space-y-2">
          {people.map((person: any, localIdx: number) => {
            const globalIdx = allPeople.indexOf(person);
            return (
              <PersonEntry
                key={globalIdx}
                person={person}
                index={localIdx}
                contacts={contacts}
                testIdPrefix={testIdPrefix}
                onRemove={() => setPeople(allPeople.filter((_: any, j: number) => j !== globalIdx))}
                onUnlink={() => {
                  const updated = [...allPeople];
                  updated[globalIdx] = { ...updated[globalIdx], contactId: null };
                  setPeople(updated);
                }}
                onLink={(contactId, name) => {
                  const updated = [...allPeople];
                  updated[globalIdx] = { ...updated[globalIdx], contactId, name };
                  setPeople(updated);
                  toast({ title: "Linked", description: `Linked to ${name}` });
                }}
              />
            );
          })}
        </div>
      )}

      <QuickAddPersonDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onDone={handleQuickAddDone}
      />
    </div>
  );
}

function QuickAddPersonDialog({ open, onOpenChange, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (contactId: number, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contacts", {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role: "Other",
        isCommunityMember: true,
        stage: "kakano",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onDone(data.id, data.name);
      onOpenChange(false);
      setName("");
      setEmail("");
      setPhone("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create contact", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Add Person</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              data-testid="input-quick-add-name"
            />
          </div>
          <div>
            <Label className="text-sm">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              data-testid="input-quick-add-email"
            />
          </div>
          <div>
            <Label className="text-sm">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              data-testid="input-quick-add-phone"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-quick-add">
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-confirm-quick-add"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
