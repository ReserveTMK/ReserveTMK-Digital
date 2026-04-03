import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useImpactLog, useUpdateImpactLog } from "@/hooks/use-impact-logs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useRef, useEffect, type ReactNode } from "react";
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
  ChevronRight,
  RefreshCw,
  HeartHandshake,
  Users,
  Link2,
  Unlink,
  User,
  UserPlus,
  Settings,
  Sparkles,
  Save,
  Check,
  Search,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Quote,
  Trophy,
  MapPin,
  Pencil,
  Type,
  Building2,
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

function fuzzyMatch(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (!al || !bl || al.length < 2 || bl.length < 2) return 0;
  if (al === bl) return 100;
  if (al.length >= 3 && bl.length >= 3 && (al.includes(bl) || bl.includes(al))) return 85;
  const aWords = al.split(/\s+/);
  const bWords = bl.split(/\s+/);
  const commonWords = aWords.filter(w => w.length >= 2 && bWords.some(bw => bw === w || (w.length > 3 && bw.startsWith(w)) || (bw.length > 3 && w.startsWith(bw))));
  if (commonWords.length > 0 && (commonWords.length / Math.max(aWords.length, bWords.length)) >= 0.5) {
    return Math.round(60 + (commonWords.length / Math.max(aWords.length, bWords.length)) * 25);
  }
  let matches = 0;
  const len = Math.min(al.length, bl.length);
  for (let i = 0; i < len; i++) {
    if (al[i] === bl[i]) matches++;
  }
  const similarity = (matches * 2) / (al.length + bl.length);
  return similarity >= 0.6 ? Math.round(similarity * 70) : 0;
}

function findBestGroupMatch(name: string, groups: any[]): { group: any; confidence: number } | null {
  let best: { group: any; confidence: number } | null = null;
  for (const g of groups) {
    const score = fuzzyMatch(name, g.name);
    if (score >= 60 && (!best || score > best.confidence)) {
      best = { group: g, confidence: score };
    }
  }
  return best;
}

function CollapsibleSection({
  title,
  count,
  icon,
  defaultOpen = false,
  children,
  testId,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 p-4 md:p-5 text-left min-h-[44px] hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        {icon}
        <h3 className="font-bold font-display flex-1 text-sm md:text-base">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 text-muted-foreground font-normal text-xs md:text-sm">({count})</span>
          )}
        </h3>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? "rotate-90" : ""}`} />
      </button>
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-4 pb-4 md:px-5 md:pb-5 pt-0">
          {children}
        </div>
      </div>
    </Card>
  );
}

function MiniTrendDots({ current, history }: { current: number | undefined; history: number[] }) {
  if (current === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const allValues = [...history.slice().reverse(), current];
  if (allValues.length < 2) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{current}</span>
        <span className="text-xs text-muted-foreground">/10</span>
      </div>
    );
  }

  const previousValue = allValues[allValues.length - 2];
  const trend = current - allValues[0];
  const regression = current < previousValue;
  const trendColor = trend > 0 ? "text-green-600 dark:text-green-400" : trend < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  const maxVal = Math.max(...allValues, 10);
  const minVal = Math.min(...allValues, 1);
  const range = maxVal - minVal || 1;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{current}</span>
      <svg width={allValues.length * 14 + 4} height="16" className="shrink-0">
        {allValues.map((val, i) => {
          const x = i * 14 + 7;
          const y = 14 - ((val - minVal) / range) * 10;
          const nextVal = allValues[i + 1];
          return (
            <g key={i}>
              {nextVal !== undefined && (
                <line
                  x1={x}
                  y1={y}
                  x2={(i + 1) * 14 + 7}
                  y2={14 - ((nextVal - minVal) / range) * 10}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={trendColor}
                  strokeOpacity={0.5}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={i === allValues.length - 1 ? 3 : 2}
                fill="currentColor"
                className={i === allValues.length - 1 ? trendColor : "text-muted-foreground"}
              />
            </g>
          );
        })}
      </svg>
      <TrendIcon className={`w-3 h-3 ${trendColor}`} />
      {regression && (
        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded shrink-0" title={`Dropped from ${previousValue} → ${current}. Check if this is accurate.`}>
          ↓{previousValue - current} check
        </span>
      )}
    </div>
  );
}

export function ReviewView({ id }: { id: number }) {
  const { data: log, isLoading } = useImpactLog(id);
  const { data: contacts } = useQuery<Contact[]>({ queryKey: ['/api/contacts'] });
  const { data: allGroups } = useQuery<any[]>({ queryKey: ['/api/groups'] });
  const { data: linkedGroups, refetch: refetchLinkedGroups } = useQuery<any[]>({
    queryKey: ['/api/impact-logs', id, 'groups'],
    enabled: !!id,
  });
  const { data: linkedContacts, refetch: refetchLinkedContacts } = useQuery<any[]>({
    queryKey: ['/api/impact-logs', id, 'contacts'],
    enabled: !!id,
  });
  const { data: taxonomyCategories } = useQuery<any[]>({ queryKey: ['/api/taxonomy'] });
  const { data: savedTags } = useQuery<any[]>({ queryKey: ['/api/impact-logs', id, 'tags'] });
  const { data: metricTrends } = useQuery<{ trends: Record<string, number[]> }>({
    queryKey: ['/api/impact-logs', id, 'metric-trends'],
    enabled: !!id,
  });
  const updateMutation = useUpdateImpactLog();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const fromSource = searchParams.get("from");
  const fromQueue = fromSource === "queue";
  const fromCalendar = fromSource === "calendar";
  const fromBoard = fromSource === "board";
  const calendarDate = searchParams.get("date");
  const [autoAnalyzeTriggered, setAutoAnalyzeTriggered] = useState(false);

  const impactLog = log as ImpactLog | undefined;
  const extraction = impactLog?.status === "confirmed"
    ? (impactLog.reviewedData as any)
    : (impactLog?.rawExtraction as any);

  const [summary, setSummary] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [milestones, setMilestones] = useState<string[]>([]);
  const [newMilestone, setNewMilestone] = useState("");
  const [funderTags, setFunderTags] = useState<string[]>([]);
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
  const [savedAudioDuration, setSavedAudioDuration] = useState<number | null>(null);
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
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showSummaryEditor, setShowSummaryEditor] = useState(false);
  const [showEntityEditor, setShowEntityEditor] = useState(false);
  const [entityEdits, setEntityEdits] = useState<{ original: string; corrected: string; type: "person" | "place" | "organisation" }[]>([]);
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  const [checkedCommunityActions, setCheckedCommunityActions] = useState<Record<string, boolean>>({});
  const [checkedOperationalActions, setCheckedOperationalActions] = useState<Record<string, boolean>>({});
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
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Transcription failed. Please try again.");
      }
      const data = await res.json();
      setRecordingTranscript(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Audio transcription complete." });
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id, "tags"] });
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
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Transcription failed. Please try again.");
      }
      const data = await res.json();
      setFollowUpText(data.transcript || data.text || "");
      toast({ title: "Transcribed", description: "Follow-up audio transcribed." });
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id, "groups"] });
      setInitialized(false);
      toast({ title: "Re-analysis complete", description: "Tags and insights updated from the full transcript." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Re-analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openEntityEditor = () => {
    const entities: { original: string; corrected: string; type: "person" | "place" | "organisation" }[] = [];
    const seen = new Set<string>();
    if (extraction?.peopleIdentified || extraction?.people) {
      for (const p of (extraction.peopleIdentified || extraction.people || [])) {
        const name = p.name?.trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          entities.push({ original: name, corrected: name, type: "person" });
        }
      }
    }
    if (extraction?.organisationsIdentified) {
      for (const o of extraction.organisationsIdentified) {
        const name = o.name?.trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          entities.push({ original: name, corrected: name, type: "organisation" });
        }
      }
    }
    if (extraction?.placesIdentified) {
      for (const p of extraction.placesIdentified) {
        const name = p.name?.trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          entities.push({ original: name, corrected: name, type: "place" });
        }
      }
    }
    setEntityEdits(entities);
    setShowEntityEditor(true);
    setShowFullTranscript(true);
  };

  const handleApplyEntityEdits = async () => {
    if (!impactLog?.transcript) return;
    const editsToApply = entityEdits.filter(e => e.corrected.trim() !== e.original);
    if (editsToApply.length === 0) {
      setShowEntityEditor(false);
      toast({ title: "No changes", description: "No corrections were made." });
      return;
    }
    setIsApplyingEdits(true);
    try {
      let updatedTranscript = impactLog.transcript;
      for (const edit of editsToApply) {
        const escaped = edit.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
        const fallback = new RegExp(escaped, "gi");
        const result = updatedTranscript.replace(pattern, edit.corrected);
        updatedTranscript = result !== updatedTranscript ? result : updatedTranscript.replace(fallback, edit.corrected);
      }

      const nameEdits = new Map(editsToApply.filter(e => e.type === "person").map(e => [e.original.toLowerCase(), e.corrected]));
      const placeEdits = new Map(editsToApply.filter(e => e.type === "place").map(e => [e.original.toLowerCase(), e.corrected]));
      const orgEdits = new Map(editsToApply.filter(e => e.type === "organisation").map(e => [e.original.toLowerCase(), e.corrected]));

      const findContactMatch = (name: string) => {
        const exact = (contacts || []).find(c => c.name?.toLowerCase() === name.toLowerCase());
        if (exact) return exact;
        // Fuzzy: "Adhi" matches "Adhi Sharma"
        let best: any = null, bestScore = 0;
        for (const c of (contacts || [])) {
          const score = fuzzyMatch(name, c.name || "");
          if (score > bestScore && score >= 60) { best = c; bestScore = score; }
        }
        return best;
      };

      const updatedPeopleIdentified = (extraction?.peopleIdentified || extraction?.people || []).map((p: any) => {
        const corrected = nameEdits.get(p.name?.toLowerCase());
        if (!corrected) return p;
        const match = findContactMatch(corrected);
        return { ...p, name: corrected, matchedContactId: match?.id || p.matchedContactId, confidence: match ? 95 : p.confidence };
      });

      const updatedPlaces = (extraction?.placesIdentified || []).map((p: any) => {
        const corrected = placeEdits.get(p.name?.toLowerCase());
        return corrected ? { ...p, name: corrected } : p;
      });

      const updatedOrgs = (extraction?.organisationsIdentified || []).map((o: any) => {
        const corrected = orgEdits.get(o.name?.toLowerCase());
        if (!corrected) return o;
        const match = (allGroups || []).find((g: any) => g.name?.toLowerCase() === corrected.toLowerCase());
        return { ...o, name: corrected, matchedGroupId: match?.id || o.matchedGroupId, confidence: match ? 95 : o.confidence };
      });

      const updatedPeople = people.map((p: any) => {
        const corrected = nameEdits.get(p.name?.toLowerCase());
        if (!corrected) return p;
        const match = findContactMatch(corrected);
        return { ...p, name: corrected, contactId: match?.id || p.contactId };
      });

      const updatedExtraction = {
        ...(impactLog.rawExtraction as any || {}),
        peopleIdentified: updatedPeopleIdentified,
        placesIdentified: updatedPlaces,
        organisationsIdentified: updatedOrgs,
        people: updatedPeopleIdentified,
      };

      const matchedOrgIds = updatedOrgs.filter((o: any) => o.matchedGroupId).map((o: any) => o.matchedGroupId);

      await apiRequest("PATCH", `/api/impact-logs/${id}`, {
        transcript: updatedTranscript,
        rawExtraction: updatedExtraction,
      });

      // Auto-link matched contacts to the server
      let contactsLinked = 0;
      for (const p of updatedPeople) {
        if (p.contactId && nameEdits.has((people.find((pp: any) => pp.contactId === p.contactId)?.name || p.name || "").toLowerCase())) {
          try {
            const derivedRole = p.section === "primary" ? "primary" : "mentioned";
            await apiRequest("POST", `/api/impact-logs/${id}/contacts`, { impactLogId: id, contactId: p.contactId, role: derivedRole });
            contactsLinked++;
          } catch { /* already linked */ }
        }
      }
      if (contactsLinked > 0) {
        refetchLinkedContacts();
      }

      let groupsLinked = 0;
      for (const gId of matchedOrgIds) {
        try {
          await apiRequest("POST", `/api/impact-logs/${id}/groups`, { groupId: gId });
          groupsLinked++;
        } catch { /* already linked or error — skip */ }
      }
      if (groupsLinked > 0) {
        refetchLinkedGroups();
      }

      setPeople(updatedPeople);
      setShowEntityEditor(false);
      setInitialized(false);
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });

      const editCount = editsToApply.length;
      const personMatches = updatedPeople.filter((p: any, i: number) => p.contactId && nameEdits.has((people[i]?.name || "").toLowerCase())).length;
      const parts: string[] = [];
      if (personMatches > 0) parts.push(`${personMatches} name${personMatches > 1 ? "s" : ""} matched to contacts`);
      if (contactsLinked > 0) parts.push(`${contactsLinked} contact${contactsLinked > 1 ? "s" : ""} auto-linked`);
      if (groupsLinked > 0) parts.push(`${groupsLinked} group${groupsLinked > 1 ? "s" : ""} auto-linked`);
      toast({
        title: `${editCount} correction${editCount > 1 ? "s" : ""} applied`,
        description: parts.length > 0
          ? `Transcript updated. ${parts.join(", ")}.`
          : "Transcript and mentions updated.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to apply edits", variant: "destructive" });
    } finally {
      setIsApplyingEdits(false);
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
  const isManualUpdate = impactLog?.type === "manual_update";
  const needsRecording = impactLog && impactLog.status === "draft" && (!impactLog.transcript || hasTranscriptPlaceholder) && !extraction && !isManualUpdate;

  useEffect(() => {
    if (impactLog && impactLog.status === "draft" && impactLog.transcript && !hasTranscriptPlaceholder && !extraction && !autoAnalyzeTriggered && !isAnalyzing) {
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
          queryClient.invalidateQueries({ queryKey: ["/api/impact-logs", id, "tags"] });
          setInitialized(false);
          toast({ title: "Analysis complete", description: "Review the extracted impact data." });
        } catch (err: any) {
          toast({ title: "Error", description: err.message || "Auto-analysis failed", variant: "destructive" });
        } finally {
          setIsAnalyzing(false);
        }
      })();
    }
  }, [impactLog, hasTranscriptPlaceholder, extraction, autoAnalyzeTriggered, isAnalyzing]);

  useEffect(() => {
    if (impactLog && !extraction && isManualUpdate && !initialized && savedTags !== undefined) {
      setSummary(impactLog.summary || impactLog.transcript || "");
      setSentiment(impactLog.sentiment || "neutral");
      setMilestones(impactLog.milestones || []);
      setImpactTags([]);
      setPeople([]);
      setMetrics({});
      setReflections({ wins: [], concerns: [], learnings: [] });
      setActionItemsList([]);
      setCommunityActions([]);
      setOperationalActions([]);
      setFunderTags(impactLog.funderTags || []);
      setInitialized(true);
    }
  }, [impactLog, extraction, isManualUpdate, initialized, savedTags]);

  useEffect(() => {
    if (impactLog && extraction && !initialized && savedTags !== undefined && linkedContacts !== undefined) {
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
      const extractedPeople = (extraction.peopleIdentified || extraction.people || []).map((p: any) => ({
        ...p,
        // Auto-link high confidence matches
        contactId: p.contactId || (p.matchedContactId && (p.confidence || 0) >= 80 ? p.matchedContactId : undefined),
        section: p.section || (["primary", "mentor", "mentee", "subject"].includes(p.role) ? "primary" : "secondary"),
      }));
      // Auto-fill primary from primaryEntity if no one is tagged as subject
      if (extraction.primaryEntity && !extractedPeople.some((p: any) => p.section === "primary")) {
        const pe = extraction.primaryEntity;
        if (pe.type === "person" && pe.matchedId) {
          const existing = extractedPeople.find((p: any) => p.contactId === pe.matchedId || p.matchedContactId === pe.matchedId);
          if (existing) { existing.section = "primary"; existing.role = "subject"; }
          else { extractedPeople.unshift({ name: pe.name, contactId: pe.matchedId, role: "subject", section: "primary" }); }
        } else if (pe.type === "person") {
          const match = extractedPeople.find((p: any) => p.name?.toLowerCase() === pe.name?.toLowerCase());
          if (match) { match.section = "primary"; match.role = "subject"; }
          else { extractedPeople.unshift({ name: pe.name, role: "subject", section: "primary" }); }
        }
      }
      if (linkedContacts && linkedContacts.length > 0) {
        const contactMap = new Map((contacts || []).map((c: any) => [c.id, c]));
        const usedContactIds = new Set<number>();
        const relinked = extractedPeople.map((p: any) => {
          if (p.contactId && !usedContactIds.has(p.contactId)) {
            usedContactIds.add(p.contactId);
            return p;
          }
          let bestLink: any = null;
          let bestScore = 0;
          for (const lc of linkedContacts) {
            if (usedContactIds.has(lc.contactId)) continue;
            const c = contactMap.get(lc.contactId);
            if (!c) continue;
            const score = fuzzyMatch(p.name || "", c.name || "");
            if (score >= 60 && score > bestScore) {
              bestLink = lc;
              bestScore = score;
            }
          }
          if (bestLink) {
            usedContactIds.add(bestLink.contactId);
            return { ...p, contactId: bestLink.contactId };
          }
          return p;
        });
        const extraLinked = linkedContacts
          .filter((lc: any) => !usedContactIds.has(lc.contactId))
          .map((lc: any) => {
            const c = contactMap.get(lc.contactId);
            return c ? { name: c.name, contactId: lc.contactId, role: lc.role || "mentioned", section: lc.role === "primary" ? "primary" : "secondary" } : null;
          })
          .filter(Boolean);
        setPeople([...relinked, ...extraLinked]);
      } else {
        setPeople(extractedPeople);
      }
      setMetrics(extraction.metrics || {});
      setReflections(extraction.reflections || { wins: [], concerns: [], learnings: [] });

      const isConfirmed = impactLog.status === "confirmed";
      if (isConfirmed) {
        setActionItemsList(extraction.actionItems || []);
        const ca = extraction.communityActions || [];
        setCommunityActions(ca);
        const oa = extraction.operationalActions || [];
        setOperationalActions(oa);
        const caChecked: Record<string, boolean> = {};
        ca.forEach((item: any) => { if (item.checked) caChecked[item.task || ""] = true; });
        setCheckedCommunityActions(caChecked);
        const oaChecked: Record<string, boolean> = {};
        oa.forEach((item: any) => { if (item.checked) oaChecked[item.task || ""] = true; });
        setCheckedOperationalActions(oaChecked);
        setSuggestedActions([]);
        setSuggestedCommunityActions([]);
        setSuggestedOperationalActions([]);
      } else {
        const reviewed = impactLog.reviewedData as any;
        const hasReviewedActions = reviewed?.actionItems?.length > 0 || reviewed?.communityActions?.length > 0 || reviewed?.operationalActions?.length > 0;
        if (hasReviewedActions) {
          setActionItemsList(reviewed.actionItems || []);
          const rca = reviewed.communityActions || [];
          setCommunityActions(rca);
          const roa = reviewed.operationalActions || [];
          setOperationalActions(roa);
          const rcaChecked: Record<string, boolean> = {};
          rca.forEach((item: any) => { if (item.checked) rcaChecked[item.task || ""] = true; });
          setCheckedCommunityActions(rcaChecked);
          const roaChecked: Record<string, boolean> = {};
          roa.forEach((item: any) => { if (item.checked) roaChecked[item.task || ""] = true; });
          setCheckedOperationalActions(roaChecked);
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

      setFunderTags(impactLog.funderTags || []);
      setInitialized(true);
    }
  }, [impactLog, extraction, initialized, savedTags, taxonomyCategories, linkedContacts, contacts]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (followUpTimerRef.current) clearInterval(followUpTimerRef.current);
      if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      if (followUpAudioUrl && followUpAudioUrl.startsWith('blob:')) URL.revokeObjectURL(followUpAudioUrl);
    };
  }, [audioUrl, followUpAudioUrl]);

  useEffect(() => {
    if (impactLog?.audioUrl) {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setSavedAudioDuration(Math.round(audio.duration));
        }
      };
      audio.src = impactLog.audioUrl;
    }
  }, [impactLog?.audioUrl]);

  const handleSave = async (status: string) => {
    const reviewedData = {
      summary,
      sentiment,
      milestones,
      actionItems: actionItemsList,
      impactTags,
      people,
      peopleIdentified: extraction?.peopleIdentified || extraction?.people || [],
      organisationsIdentified: extraction?.organisationsIdentified || [],
      placesIdentified: extraction?.placesIdentified || [],
      metrics,
      communityActions: communityActions.map((item: any) => ({
        ...item,
        checked: !!checkedCommunityActions[item.task || ""],
      })),
      operationalActions: operationalActions.map((item: any) => ({
        ...item,
        checked: !!checkedOperationalActions[item.task || ""],
      })),
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
        const linkErrors: string[] = [];
        for (const person of people) {
          if (person.contactId) {
            const role = person.section === "primary" || (!person.section && ["primary", "mentor", "mentee", "subject"].includes(person.role)) ? "primary" : "mentioned";
            try {
              await apiRequest('POST', `/api/impact-logs/${id}/contacts`, {
                impactLogId: id,
                contactId: person.contactId,
                role,
              });
            } catch (e: any) {
              linkErrors.push(`Contact ${person.name || person.contactId}: ${e.message || 'failed'}`);
            }
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
            } catch (e: any) {
              linkErrors.push(`Tag ${tag.category || tag.taxonomyId}: ${e.message || 'failed'}`);
            }
          }
        }

        if (linkErrors.length > 0) {
          toast({
            title: "Some links couldn't be saved",
            description: `${linkErrors.length} contact/tag link(s) failed. The debrief was confirmed but some associations may be missing.`,
            variant: "destructive",
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/impact-logs', id, 'tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/needs-debrief'] });

      const wasAlreadyConfirmed = impactLog.status === "confirmed";
      toast({
        title: status === "confirmed"
          ? (wasAlreadyConfirmed ? "Changes Saved" : "Debrief Confirmed")
          : "Draft Saved",
        description: status === "confirmed"
          ? (wasAlreadyConfirmed ? "Your updates have been saved." : "Impact data has been confirmed and saved.")
          : "Your draft has been saved.",
      });

      if (status === "confirmed") {
        if (fromBoard) {
          setLocation("/debriefs?tab=queue");
        } else if (fromCalendar) {
          setLocation(calendarDate ? `/calendar?date=${calendarDate}` : "/calendar");
        } else {
          setLocation(fromQueue ? "/debriefs?tab=queue" : "/debriefs?tab=archive");
        }
      } else if (status === "draft" && (fromQueue || fromCalendar || fromBoard)) {
        if (fromBoard) {
          setLocation("/debriefs?tab=queue");
        } else if (fromCalendar) {
          setLocation(calendarDate ? `/calendar?date=${calendarDate}` : "/calendar");
        } else {
          setLocation("/debriefs?tab=queue");
        }
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
              <Button variant="outline" onClick={() => setLocation(fromBoard ? "/debriefs?tab=queue" : fromCalendar ? (calendarDate ? `/calendar?date=${calendarDate}` : "/calendar") : "/debriefs")} data-testid="button-back-to-list">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {fromCalendar ? "Back to Calendar" : "Back to Debriefs"}
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
    skill: "Skill",
    confidence: "Confidence",
    businessReadiness: "Business Readiness",
    networkStrength: "Network Strength",
    resilience: "Resilience",
  };

  return (
    <main className="flex-1 p-4 md:p-8 pb-36 md:pb-24 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setLocation(fromBoard ? "/debriefs?tab=queue" : fromCalendar ? (calendarDate ? `/calendar?date=${calendarDate}` : "/calendar") : "/debriefs")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {impactLog.type === "manual_update" && <HeartHandshake className="w-5 h-5 text-pink-500 shrink-0" />}
                <h1 className="text-2xl font-display font-bold truncate" data-testid="text-review-title">{(impactLog.title || "").replace(/^Tentative:\s*/i, "").trim()}</h1>
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
                <Badge
                  variant="secondary"
                  className={`text-xs cursor-pointer ${SENTIMENT_COLORS[sentiment] || ""}`}
                  onClick={cycleSentiment}
                  data-testid="badge-sentiment-title"
                >
                  {sentiment}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* LEFT COLUMN: contents on mobile (flat for ordering), block on desktop (independent column) */}
            <div className="contents lg:block lg:space-y-4">
            {/* TRANSCRIPT - mobile:1 desktop:left */}
            <div className="order-1 lg:order-none">
              {needsRecording ? (
                <Card className="p-4 md:p-5">
                  <h2 className="font-bold text-lg font-display mb-3" data-testid="text-record-heading">Record Your Debrief</h2>
                  <p className="text-sm text-muted-foreground mb-4">Record audio or paste text to capture your debrief, then analyse it for impact data.</p>

                  {impactLog.audioUrl && (
                    <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border space-y-2">
                      <Label className="text-sm font-medium">Saved Recording</Label>
                      <div className="flex items-center gap-3">
                        <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                        <audio controls src={impactLog.audioUrl} className="flex-1 h-10" data-testid="audio-saved-playback" />
                      </div>
                      {!recordingTranscript && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          disabled={isTranscribing}
                          onClick={async () => {
                            setIsTranscribing(true);
                            try {
                              const audioRes = await fetch(impactLog.audioUrl!);
                              const audioBuffer = await audioRes.arrayBuffer();
                              const res = await fetch("/api/impact-transcribe", {
                                method: "POST",
                                headers: { "Content-Type": "audio/webm" },
                                body: audioBuffer,
                                credentials: "include",
                              });
                              if (!res.ok) {
                                const err = await res.json();
                                throw new Error(err.message);
                              }
                              const data = await res.json();
                              setRecordingTranscript(data.transcript);
                              toast({ title: "Transcribed", description: "Saved audio transcribed successfully." });
                            } catch (err: any) {
                              toast({ title: "Transcription failed", description: err.message, variant: "destructive" });
                            }
                            setIsTranscribing(false);
                          }}
                          data-testid="button-transcribe-saved-audio"
                        >
                          {isTranscribing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mic className="w-3 h-3 mr-1" />}
                          Transcribe saved recording
                        </Button>
                      )}
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
                              onClick={() => { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioBlob(null); setAudioUrl(null); }}
                              data-testid="button-discard-recording-review"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {!recordingTranscript && (
                            <div className="flex flex-col sm:flex-row gap-2">
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
                    className="w-full mt-4 min-h-[44px]"
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
                <Card className="p-4 md:p-5">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <h2 className="font-bold text-lg font-display" data-testid="text-transcript-heading">Impact Highlights</h2>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      {impactLog.createdAt && (
                        <span className="flex items-center gap-1" data-testid="text-transcript-timestamp">
                          <Clock className="w-3 h-3" />
                          {new Date(impactLog.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>

                  {(summary || showSummaryEditor) ? (
                    <div className="mb-3">
                      <Textarea
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        className="min-h-[60px] resize-none text-sm bg-muted/20"
                        placeholder="Summary..."
                        data-testid="textarea-summary"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground mb-3 underline min-h-[44px]"
                      onClick={() => setShowSummaryEditor(true)}
                      data-testid="button-add-summary"
                    >
                      + Add summary
                    </button>
                  )}

                  {keyQuotes.length > 0 && (
                    <div className="space-y-2 mb-4" data-testid="pull-quotes-section">
                      {keyQuotes.slice(0, 3).map((quote: string, i: number) => (
                        <blockquote
                          key={i}
                          className="border-l-4 border-primary/40 pl-3 py-1 text-sm italic text-foreground/80 bg-primary/5 rounded-r-lg"
                          data-testid={`pull-quote-${i}`}
                        >
                          <Quote className="w-3.5 h-3.5 text-primary/40 mb-0.5 inline-block mr-1" />
                          {quote}
                        </blockquote>
                      ))}
                    </div>
                  )}

                  {showFullTranscript && (
                    <>
                      <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap max-h-[60vh] overflow-y-auto mb-3" data-testid="text-transcript-content">
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
                      {impactLog?.audioUrl && (
                        <div className="mb-3 p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                            <audio controls src={impactLog.audioUrl} className="flex-1 h-8" data-testid="audio-saved-playback-detail" />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => setShowFullTranscript(!showFullTranscript)}
                      data-testid="button-view-transcript"
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      {showFullTranscript ? "Hide Transcript" : "View Transcript"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => setShowFollowUp(!showFollowUp)}
                      data-testid="button-toggle-followup"
                    >
                      <MessageCirclePlus className="w-4 h-4 mr-1.5" />
                      Follow-up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-h-[44px]"
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
                </Card>

                {showFollowUp && (
                  <Card className="p-4 md:p-5">
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
                                onClick={() => { if (followUpAudioUrl) URL.revokeObjectURL(followUpAudioUrl); setFollowUpAudioBlob(null); setFollowUpAudioUrl(null); setFollowUpText(""); }}
                                data-testid="button-followup-discard"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {!followUpText && (
                              <Button
                                onClick={transcribeFollowUpAudio}
                                disabled={isFollowUpTranscribing}
                                className="w-full min-h-[44px]"
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
                        className="flex-1 min-h-[44px]"
                        onClick={() => { setShowFollowUp(false); setFollowUpText(""); if (followUpAudioUrl) URL.revokeObjectURL(followUpAudioUrl); setFollowUpAudioBlob(null); setFollowUpAudioUrl(null); }}
                        data-testid="button-followup-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 min-h-[44px]"
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

            {/* SENTIMENT - MOVED TO TITLE BADGE */}
            {false && <div className="order-2 lg:order-none">
              <CollapsibleSection title="Sentiment" count={sentiment ? 1 : 0} testId="sentiment">
                <Badge
                  variant="secondary"
                  className={`text-sm cursor-pointer min-h-[44px] px-4 ${SENTIMENT_COLORS[sentiment] || ""}`}
                  onClick={cycleSentiment}
                  data-testid="badge-sentiment-toggle"
                >
                  {sentiment}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">Tap to change</p>
              </CollapsibleSection>
            </div>}

            {/* COMMUNITY ACTIONS - REMOVED: dead extraction, never used */}

            {false && <div className="order-6 lg:order-none">
              <CollapsibleSection
                title="Community Actions"
                count={communityActions.length + suggestedCommunityActions.length}
                icon={<Users className="w-4 h-4 text-blue-500 shrink-0" />}
                testId="community-actions"
              >
                <p className="text-xs text-muted-foreground mb-3">Follow-ups with people — introductions, resources, bookings</p>
                {communityActions.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {communityActions.map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900" data-testid={`community-action-${i}`}>
                        <Checkbox
                          checked={!!checkedCommunityActions[item.task || ""]}
                          onCheckedChange={(checked) => {
                            setCheckedCommunityActions({ ...checkedCommunityActions, [item.task || ""]: !!checked });
                          }}
                          className="mt-1 h-5 w-5 cursor-pointer"
                          data-testid={`checkbox-community-action-${i}`}
                        />
                        <div className={`flex-1 min-w-0 ${checkedCommunityActions[item.task || ""] ? "opacity-50 line-through" : ""}`}>
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
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0" onClick={() => setCommunityActions(communityActions.filter((_: any, j: number) => j !== i))} data-testid={`button-remove-community-action-${i}`}>
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
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 mb-2 min-h-[44px]"
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
                          className="w-full text-xs text-purple-600 dark:text-purple-400 min-h-[44px]"
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

                {communityActions.length === 0 && suggestedCommunityActions.length === 0 && <p className="text-xs text-muted-foreground italic">No community actions extracted.</p>}
              </CollapsibleSection>
            </div>}

            {/* OPERATIONAL ACTIONS - REMOVED: dead extraction, never used */}

            {false && <div className="order-7 lg:order-none">
              <CollapsibleSection
                title="Operational Actions"
                count={operationalActions.length + suggestedOperationalActions.length}
                icon={<Settings className="w-4 h-4 text-orange-500 shrink-0" />}
                testId="operational-actions"
              >
                <p className="text-xs text-muted-foreground mb-3">Internal hub tasks — processes, admin, marketing, capacity</p>
                {operationalActions.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {operationalActions.map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900" data-testid={`operational-action-${i}`}>
                        <Checkbox
                          checked={!!checkedOperationalActions[item.task || ""]}
                          onCheckedChange={(checked) => {
                            setCheckedOperationalActions({ ...checkedOperationalActions, [item.task || ""]: !!checked });
                          }}
                          className="mt-1 h-5 w-5 cursor-pointer"
                          data-testid={`checkbox-operational-action-${i}`}
                        />
                        <div className={`flex-1 min-w-0 ${checkedOperationalActions[item.task || ""] ? "opacity-50 line-through" : ""}`}>
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
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0" onClick={() => setOperationalActions(operationalActions.filter((_: any, j: number) => j !== i))} data-testid={`button-remove-operational-action-${i}`}>
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
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 mb-2 min-h-[44px]"
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
                          className="w-full text-xs text-purple-600 dark:text-purple-400 min-h-[44px]"
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

                {operationalActions.length === 0 && suggestedOperationalActions.length === 0 && <p className="text-xs text-muted-foreground italic">No operational actions extracted.</p>}
              </CollapsibleSection>
            </div>}

            {/* OPERATOR REFLECTIONS - mobile:9 desktop:left */}
            <div className="order-9 lg:order-none">
              <CollapsibleSection
                title="Operator Reflections"
                count={reflections.wins.length + reflections.concerns.length + reflections.learnings.length}
                icon={<Sparkles className="w-4 h-4 text-purple-500 shrink-0" />}
                testId="reflections"
              >
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
              </CollapsibleSection>
            </div>
            </div>

            {/* RIGHT COLUMN: contents on mobile (flat for ordering), block on desktop (independent column) */}
            <div className="contents lg:block lg:space-y-4">
            {/* LINKED COMMUNITY - mobile:3 desktop:right */}
            <div className="order-3 lg:order-none">
              <CollapsibleSection title="Linked Community" count={people.length + (linkedGroups?.length || 0)} defaultOpen testId="linked-community">
                {extraction && (extraction.peopleIdentified?.length > 0 || extraction.people?.length > 0 || extraction.placesIdentified?.length > 0 || extraction.organisationsIdentified?.length > 0) && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          Detected in Transcript
                        </h4>
                        <p className="text-xs text-muted-foreground">Correct names, orgs or places then confirm to update</p>
                      </div>
                      {!showEntityEditor && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[36px]"
                          onClick={openEntityEditor}
                          data-testid="button-edit-entities"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {showEntityEditor && (
                      <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-border mb-3" data-testid="entity-editor">
                        {[
                          { type: "person" as const, label: "People", icon: <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> },
                          { type: "organisation" as const, label: "Organisations", icon: <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> },
                          { type: "place" as const, label: "Places", icon: <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> },
                        ].map(({ type, label, icon }) => {
                          const items = entityEdits.filter(e => e.type === type);
                          if (items.length === 0) return null;
                          return (
                            <div key={type} className={type !== "person" ? "mt-2" : ""}>
                              <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                              {entityEdits.map((entity, i) => entity.type === type ? (
                                <div key={i} className="flex items-center gap-2 mb-1.5">
                                  {icon}
                                  <Input
                                    value={entity.corrected}
                                    onChange={(e) => {
                                      const updated = [...entityEdits];
                                      updated[i] = { ...updated[i], corrected: e.target.value };
                                      setEntityEdits(updated);
                                    }}
                                    className={`h-8 text-sm ${entity.corrected !== entity.original ? "border-primary bg-primary/5" : ""}`}
                                    data-testid={`input-entity-${type}-${i}`}
                                  />
                                  {entity.corrected !== entity.original && (
                                    <Badge variant="secondary" className="text-[10px] shrink-0">edited</Badge>
                                  )}
                                </div>
                              ) : null)}
                            </div>
                          );
                        })}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="min-h-[36px]"
                            onClick={handleApplyEntityEdits}
                            disabled={isApplyingEdits || entityEdits.every(e => e.corrected === e.original)}
                            data-testid="button-apply-entity-edits"
                          >
                            {isApplyingEdits ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {isApplyingEdits ? "Applying..." : "Confirm Corrections"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[36px]"
                            onClick={() => setShowEntityEditor(false)}
                            data-testid="button-cancel-entity-edits"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {!showEntityEditor && (
                      <div className="space-y-1.5 mb-3" data-testid="entity-chips">
                        {(extraction.peopleIdentified || extraction.people || []).map((p: any, i: number) => {
                          const matchedPerson = people.find((pp: any) => pp.contactId && (
                            pp.contactId === p.matchedContactId ||
                            pp.name?.toLowerCase() === p.name?.toLowerCase() ||
                            fuzzyMatch(pp.name || "", p.name || "") >= 60
                          ));
                          const isLinked = !!matchedPerson;
                          const contact = isLinked ? (contacts || []).find((c: any) => c.id === matchedPerson?.contactId) : null;
                          return (
                            <div key={`p-${i}`} className="flex items-center gap-1.5 group" data-testid={`entity-person-${i}`}>
                              <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className={`text-sm flex-1 min-w-0 truncate ${isLinked ? "text-primary font-medium" : ""}`}>
                                {p.name}
                                {isLinked && contact && <Check className="w-3 h-3 inline ml-1 text-green-600" />}
                              </span>
                              {!isLinked && (
                                <ContactSearchPicker
                                  contacts={contacts || []}
                                  onSelect={async (contactId) => {
                                    const c = (contacts || []).find((ct: any) => ct.id === contactId);
                                    const existing = people.find((pp: any) =>
                                      pp.name?.toLowerCase() === p.name?.toLowerCase() ||
                                      fuzzyMatch(pp.name || "", p.name || "") >= 60
                                    );
                                    const derivedSection = existing?.section || p.section || (["primary", "mentor", "mentee", "subject"].includes(p.role || existing?.role) ? "primary" : "secondary");
                                    const derivedRole = derivedSection === "primary" ? "primary" : "mentioned";
                                    if (existing) {
                                      const idx = people.indexOf(existing);
                                      const updated = [...people];
                                      updated[idx] = { ...updated[idx], contactId, name: c?.name || p.name };
                                      setPeople(updated);
                                    } else {
                                      setPeople([...people, { name: c?.name || p.name, role: derivedRole, section: derivedSection, contactId }]);
                                    }
                                    try {
                                      await apiRequest("POST", `/api/impact-logs/${id}/contacts`, { impactLogId: id, contactId, role: derivedRole });
                                      refetchLinkedContacts();
                                    } catch (err) {
                                      toast({ title: "Warning", description: "Link saved locally but server sync failed. It will be saved when you confirm.", variant: "default" });
                                    }
                                    toast({ title: "Linked", description: `${p.name} linked to ${c?.name || "contact"}` });
                                  }}
                                  testId={`entity-link-person-${i}`}
                                  compact
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                onClick={() => {
                                  const idx = people.findIndex((pp: any) => pp.name?.toLowerCase() === p.name?.toLowerCase());
                                  if (idx >= 0) {
                                    setPeople(people.filter((_: any, j: number) => j !== idx));
                                  }
                                }}
                                data-testid={`entity-dismiss-person-${i}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {(extraction.organisationsIdentified || []).filter((o: any) => !/reserve\s*t[aā]maki|reservetmk/i.test(o.name || "")).map((o: any, i: number) => {
                          const linkedGroupIds = new Set((linkedGroups || []).map((lg: any) => lg.groupId));
                          const linkedGroupObjs = (linkedGroups || []).map((lg: any) => (allGroups || []).find((gg: any) => gg.id === lg.groupId)).filter(Boolean);
                          const isLinked = o.matchedGroupId ? linkedGroupIds.has(o.matchedGroupId) : linkedGroupObjs.some((g: any) => fuzzyMatch(g.name || "", o.name || "") >= 60);
                          const bestMatch = !isLinked ? findBestGroupMatch(o.name, (allGroups || []).filter((g: any) => !linkedGroupIds.has(g.id))) : null;
                          return (
                            <div key={`o-${i}`} className="flex items-center gap-1.5 group" data-testid={`entity-org-${i}`}>
                              <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                              <span className={`text-sm flex-1 min-w-0 truncate ${isLinked ? "text-primary font-medium" : ""}`}>
                                {o.name}
                                {isLinked && <Check className="w-3 h-3 inline ml-1 text-green-600" />}
                              </span>
                              {!isLinked && bestMatch && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
                                  onClick={async () => {
                                    try {
                                      await apiRequest("POST", `/api/impact-logs/${id}/groups`, { groupId: bestMatch.group.id });
                                      refetchLinkedGroups();
                                      toast({ title: "Linked", description: `${bestMatch.group.name} linked to debrief` });
                                    } catch {}
                                  }}
                                  data-testid={`entity-link-org-${i}`}
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  {bestMatch.group.name}
                                  <span className="ml-1 opacity-60">{bestMatch.confidence}%</span>
                                </Button>
                              )}
                              {!isLinked && !bestMatch && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground"
                                  onClick={async () => {
                                    try {
                                      const res = await apiRequest("POST", "/api/groups", { name: o.name });
                                      const newGroup = await res.json();
                                      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
                                      await apiRequest("POST", `/api/impact-logs/${id}/groups`, { groupId: newGroup.id });
                                      refetchLinkedGroups();
                                      toast({ title: "Created & linked", description: `Group "${o.name}" created and linked to debrief.` });
                                    } catch (err: any) {
                                      toast({ title: "Error", description: err.message || "Failed to create group", variant: "destructive" });
                                    }
                                  }}
                                  data-testid={`entity-link-org-${i}`}
                                >
                                  <Building2 className="w-3 h-3 mr-1" />
                                  Create group
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                data-testid={`entity-dismiss-org-${i}`}
                                onClick={() => {}}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {(extraction.placesIdentified || []).map((p: any, i: number) => {
                          const linkedGroupIds = new Set((linkedGroups || []).map((lg: any) => lg.groupId));
                          const linkedGroupObjs = (linkedGroups || []).map((lg: any) => (allGroups || []).find((gg: any) => gg.id === lg.groupId)).filter(Boolean);
                          const isLinked = p.matchedGroupId ? linkedGroupIds.has(p.matchedGroupId) : linkedGroupObjs.some((g: any) => fuzzyMatch(g.name || "", p.name || "") >= 60);
                          const bestMatch = !isLinked ? findBestGroupMatch(p.name, (allGroups || []).filter((g: any) => !linkedGroupIds.has(g.id))) : null;
                          return (
                            <div key={`l-${i}`} className="flex items-center gap-1.5 group" data-testid={`entity-place-${i}`}>
                              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className={`text-sm flex-1 min-w-0 truncate ${isLinked ? "text-primary font-medium" : ""}`}>
                                {p.name}
                                {isLinked && <Check className="w-3 h-3 inline ml-1 text-green-600" />}
                              </span>
                              {!isLinked && bestMatch && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
                                  onClick={async () => {
                                    try {
                                      await apiRequest("POST", `/api/impact-logs/${id}/groups`, { groupId: bestMatch.group.id });
                                      refetchLinkedGroups();
                                      toast({ title: "Linked", description: `${bestMatch.group.name} linked to debrief` });
                                    } catch {}
                                  }}
                                  data-testid={`entity-link-place-${i}`}
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  {bestMatch.group.name}
                                  <span className="ml-1 opacity-60">{bestMatch.confidence}%</span>
                                </Button>
                              )}
                              {!isLinked && !bestMatch && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground"
                                  onClick={async () => {
                                    try {
                                      const res = await apiRequest("POST", "/api/groups", { name: p.name });
                                      const newGroup = await res.json();
                                      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
                                      await apiRequest("POST", `/api/impact-logs/${id}/groups`, { groupId: newGroup.id });
                                      refetchLinkedGroups();
                                      toast({ title: "Created & linked", description: `Group "${p.name}" created and linked to debrief.` });
                                    } catch (err: any) {
                                      toast({ title: "Error", description: err.message || "Failed to create group", variant: "destructive" });
                                    }
                                  }}
                                  data-testid={`entity-create-place-${i}`}
                                >
                                  <Building2 className="w-3 h-3 mr-1" />
                                  Create group
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                data-testid={`entity-dismiss-place-${i}`}
                                onClick={() => {}}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <PeopleSection
                  label="Primary"
                  description="Main people involved"
                  people={people.filter((p: any) => p.section === "primary" || (!p.section && ["primary", "mentor", "mentee", "subject"].includes(p.role)))}
                  allPeople={people}
                  setPeople={setPeople}
                  contacts={contacts || []}
                  toast={toast}
                  section="primary"
                  testIdPrefix="primary"
                  onPersistLink={async (contactId, role) => {
                    try {
                      await apiRequest("POST", `/api/impact-logs/${id}/contacts`, { impactLogId: id, contactId, role });
                      refetchLinkedContacts();
                    } catch {
                      toast({ title: "Warning", description: "Link saved locally but server sync failed. It will be saved when you confirm.", variant: "default" });
                    }
                  }}
                />
                <div className="my-4 border-t border-border" />
                <PeopleSection
                  label="Mentioned"
                  description="Others referenced in the debrief"
                  people={people.filter((p: any) => p.section === "secondary" || (!p.section && !["primary", "mentor", "mentee", "subject"].includes(p.role)))}
                  allPeople={people}
                  setPeople={setPeople}
                  contacts={contacts || []}
                  toast={toast}
                  section="secondary"
                  testIdPrefix="secondary"
                  onPersistLink={async (contactId, role) => {
                    try {
                      await apiRequest("POST", `/api/impact-logs/${id}/contacts`, { impactLogId: id, contactId, role });
                      refetchLinkedContacts();
                    } catch {
                      toast({ title: "Warning", description: "Link saved locally but server sync failed. It will be saved when you confirm.", variant: "default" });
                    }
                  }}
                />
                <div className="my-4 border-t border-border" />
                <LinkedGroupsSection
                  impactLogId={id}
                  linkedGroups={linkedGroups || []}
                  allGroups={allGroups || []}
                  placesIdentified={extraction?.placesIdentified || []}
                  refetch={refetchLinkedGroups}
                  toast={toast}
                />

                {/* Quick save buttons after linked communities */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  {impactLog.status !== "confirmed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSave("draft")}
                      disabled={updateMutation.isPending}
                      className="flex-1"
                    >
                      {updateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Save Draft
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSave("confirmed")}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    {impactLog.status === "confirmed" ? "Save Changes" : "Confirm & Save"}
                  </Button>
                </div>
              </CollapsibleSection>
            </div>

            {/* METRICS - mobile:4 desktop:right */}
            <div className="order-4 lg:order-none">
              <CollapsibleSection
                title={`Metrics (${Object.values(metrics).filter(v => typeof v === 'number' && v > 0).length} scored)`}
                count={Object.keys(METRIC_LABELS).length}
                testId="metrics"
              >
                <div className="space-y-3">
                  {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const trendHistory = metricTrends?.trends?.[key] || [];
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground w-28 md:w-36 shrink-0">{label}</Label>
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
                          className="w-16 text-center"
                          data-testid={`input-metric-${key}`}
                        />
                        <div className="flex-1 min-w-0">
                          <MiniTrendDots current={metrics[key]} history={trendHistory} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </div>

            {/* IMPACT TAGS - mobile:5 desktop:right */}
            <div className="order-5 lg:order-none">
              <CollapsibleSection
                title="Impact Tags"
                count={impactTags.length}
                testId="impact-tags"
              >
                <p className="text-xs text-muted-foreground mb-3">Auto-applied from AI analysis. Remove any that don't apply.</p>
                {impactTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No impact areas identified from this transcript</p>
                ) : (
                  <div className="space-y-3">
                    {impactTags.map((tag: any, i: number) => {
                      const matchedTaxonomy = tag.taxonomyId
                        ? taxonomyCategories?.find((t: any) => t.id === tag.taxonomyId)
                        : null;
                      const conf = tag.confidence || 0;
                      const confDotColor = conf >= 70 ? "bg-green-500" : conf >= 40 ? "bg-amber-500" : "bg-red-500";
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
                                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${confDotColor}`} title={`${conf}% confidence`} data-testid={`confidence-dot-${i}`} />
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
                  className="mt-3 w-full min-h-[44px]"
                  onClick={() => setImpactTags([...impactTags, { category: "", confidence: 50, evidence: "", taxonomyId: null }])}
                  data-testid="button-add-tag"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Tag
                </Button>
              </CollapsibleSection>
            </div>

            {/* MILESTONES - mobile:8 desktop:right */}
            <div className="order-8 lg:order-none">
              <CollapsibleSection
                title="Milestones"
                count={milestones.length}
                icon={<Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
                testId="milestones"
              >
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
                    className="min-h-[44px] min-w-[44px]"
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
              </CollapsibleSection>
            </div>

            {/* FUNDER TAGS - REMOVED: dead field, 0 across all 64 debriefs */}

            {false && <div className="order-10 lg:order-none">
              <CollapsibleSection
                title="Funder Tags"
                count={funderTags.length}
                testId="funder-tags"
              >
                {funderTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {funderTags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-funder-tag-${i}`}>
                        {tag}
                        <button
                          onClick={() => setFunderTags(funderTags.filter(t => t !== tag))}
                          className="ml-0.5 transition-colors min-h-[20px] min-w-[20px] flex items-center justify-center"
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
                    className="min-h-[44px] min-w-[44px]"
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
              </CollapsibleSection>
            </div>}
            </div>
          </div>
        </div>

        <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-40 safe-area-bottom">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            {impactLog.status !== "confirmed" && (
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
            )}
            <Button
              onClick={() => handleSave("confirmed")}
              disabled={updateMutation.isPending}
              className="min-h-[44px] w-full sm:w-auto"
              data-testid="button-confirm-save"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {impactLog.status === "confirmed" ? "Save Changes" : "Confirm & Save"}
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

function LinkedGroupsSection({ impactLogId, linkedGroups, allGroups, placesIdentified, refetch, toast }: {
  impactLogId: number;
  linkedGroups: any[];
  allGroups: any[];
  placesIdentified: any[];
  refetch: () => void;
  toast: any;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const linkedGroupIds = new Set(linkedGroups.map((lg: any) => lg.groupId));
  const availableGroups = allGroups.filter(g => !linkedGroupIds.has(g.id));

  const suggestedGroups = placesIdentified.length > 0
    ? availableGroups.filter(g =>
        placesIdentified.some((p: any) =>
          g.name?.toLowerCase().includes(p.name?.toLowerCase()) ||
          p.name?.toLowerCase().includes(g.name?.toLowerCase())
        )
      )
    : [];

  const handleLinkGroup = async (groupId: number) => {
    try {
      await apiRequest("POST", `/api/impact-logs/${impactLogId}/groups`, { groupId });
      refetch();
      const group = allGroups.find(g => g.id === groupId);
      toast({ title: "Group linked", description: `${group?.name || "Group"} linked to debrief.` });
      setSearchOpen(false);
      setSearchValue("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to link group", variant: "destructive" });
    }
  };

  const handleUnlinkGroup = async (linkId: number) => {
    try {
      await apiRequest("DELETE", `/api/impact-logs/${impactLogId}/groups/${linkId}`);
      refetch();
      toast({ title: "Unlinked", description: "Group removed from debrief." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to unlink group", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold">Groups</h4>
          <p className="text-xs text-muted-foreground">Organisations and places linked to this debrief</p>
        </div>
      </div>

      {linkedGroups.length > 0 && (
        <div className="space-y-2 mb-3">
          {linkedGroups.map((lg: any) => {
            const group = allGroups.find(g => g.id === lg.groupId);
            return (
              <div key={lg.id} className="p-3 bg-muted/30 rounded-lg border border-border flex items-center justify-between gap-2" data-testid={`linked-group-${lg.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium text-primary truncate">{group?.name || `Group #${lg.groupId}`}</span>
                  {group?.type && <Badge variant="secondary" className="text-xs shrink-0">{group.type}</Badge>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleUnlinkGroup(lg.id)} data-testid={`unlink-group-${lg.id}`}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {suggestedGroups.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Suggested from transcript
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedGroups.map(g => (
              <Button
                key={g.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleLinkGroup(g.id)}
                data-testid={`suggest-group-${g.id}`}
              >
                <Plus className="w-3 h-3 mr-1" />
                {g.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full min-h-[44px] justify-start text-muted-foreground" data-testid="button-search-group">
            <Search className="w-4 h-4 mr-2" />
            Search or add a group...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
          <Command>
            <CommandInput
              placeholder="Search groups..."
              value={searchValue}
              onValueChange={setSearchValue}
              data-testid="input-search-group"
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 px-1">
                  <p className="text-xs text-muted-foreground mb-2">No groups found</p>
                  {searchValue.trim() && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={async () => {
                        if (!searchValue.trim()) return;
                        setIsCreatingGroup(true);
                        try {
                          const res = await apiRequest("POST", "/api/groups", { name: searchValue.trim() });
                          const newGroup = await res.json();
                          queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
                          await apiRequest("POST", `/api/impact-logs/${impactLogId}/groups`, { groupId: newGroup.id });
                          refetch();
                          toast({ title: "Created & linked", description: `Group "${searchValue.trim()}" created and linked to debrief.` });
                          setSearchValue("");
                          setSearchOpen(false);
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message || "Failed to create group", variant: "destructive" });
                        }
                        setIsCreatingGroup(false);
                      }}
                      disabled={isCreatingGroup}
                      data-testid="button-quick-create-group"
                    >
                      {isCreatingGroup ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Building2 className="w-3 h-3 mr-1" />
                      )}
                      Create group "{searchValue.trim()}"
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup>
                {availableGroups
                  .filter(g => g.name?.toLowerCase().includes(searchValue.toLowerCase()))
                  .slice(0, 10)
                  .map((g: any) => (
                    <CommandItem
                      key={g.id}
                      onSelect={() => handleLinkGroup(g.id)}
                      className="cursor-pointer"
                      data-testid={`group-option-${g.id}`}
                    >
                      <MapPin className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                      <span>{g.name}</span>
                      {g.type && <Badge variant="secondary" className="ml-auto text-xs">{g.type}</Badge>}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
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

function PeopleSection({ label, description, people, allPeople, setPeople, contacts, toast, section, testIdPrefix, onPersistLink }: {
  label: string;
  description: string;
  people: any[];
  allPeople: any[];
  setPeople: (p: any[]) => void;
  contacts: Contact[];
  toast: any;
  section: "primary" | "secondary";
  testIdPrefix: string;
  onPersistLink?: (contactId: number, role: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const linkedContactIds = new Set(allPeople.filter((p: any) => p.contactId).map((p: any) => p.contactId));

  const availableContacts = (contacts || []).filter(c => !linkedContactIds.has(c.id));

  const handleSelectContact = (contact: Contact) => {
    const role = section === "primary" ? "primary" : "mentioned";
    setPeople([...allPeople, { name: contact.name, role, section, contactId: contact.id }]);
    if (onPersistLink) onPersistLink(contact.id, role);
    toast({ title: "Person linked", description: `${contact.name} linked as ${label.toLowerCase()}.` });
    setSearchValue("");
    setSearchOpen(false);
  };

  const handleQuickCreate = async () => {
    if (!searchValue.trim()) return;
    setIsCreating(true);
    try {
      const res = await apiRequest("POST", "/api/contacts", {
        name: searchValue.trim(),
      });
      const newContact = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      const role = section === "primary" ? "primary" : "mentioned";
      setPeople([...allPeople, { name: newContact.name, role, section, contactId: newContact.id }]);
      if (onPersistLink) onPersistLink(newContact.id, role);
      toast({ title: "Person added", description: `${newContact.name} created and linked as ${label.toLowerCase()}.` });
      setSearchValue("");
      setSearchOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create contact", variant: "destructive" });
    }
    setIsCreating(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {people.length > 0 && (
        <div className="space-y-2 mb-3">
          {people.map((person: any, localIdx: number) => {
            // Find global index by matching section + name + contactId reliably
            const globalIdx = allPeople.findIndex((p, i) => p === person || (p.name === person.name && p.section === person.section && p.contactId === person.contactId && allPeople.indexOf(p) === i));
            const safeGlobalIdx = globalIdx >= 0 ? globalIdx : allPeople.findIndex(p => p.name === person.name && p.section === person.section);
            return (
              <PersonEntry
                key={`${person.name}-${person.contactId}-${localIdx}`}
                person={person}
                index={localIdx}
                contacts={contacts}
                testIdPrefix={testIdPrefix}
                onRemove={() => {
                  const idx = allPeople.findIndex(p => p === person);
                  if (idx >= 0) setPeople(allPeople.filter((_: any, j: number) => j !== idx));
                  else setPeople(allPeople.filter((_: any, j: number) => j !== safeGlobalIdx));
                }}
                onUnlink={() => {
                  const idx = allPeople.findIndex(p => p === person);
                  const updated = [...allPeople];
                  updated[idx >= 0 ? idx : safeGlobalIdx] = { ...person, contactId: null };
                  setPeople(updated);
                }}
                onLink={(contactId, name) => {
                  const idx = allPeople.findIndex(p => p === person);
                  const updated = [...allPeople];
                  updated[idx >= 0 ? idx : safeGlobalIdx] = { ...person, contactId, name };
                  setPeople(updated);
                  const role = person.section === "primary" || (!person.section && ["primary", "mentor", "mentee", "subject"].includes(person.role)) ? "primary" : "mentioned";
                  if (onPersistLink) onPersistLink(contactId, role);
                  toast({ title: "Linked", description: `Linked to ${name}` });
                }}
              />
            );
          })}
        </div>
      )}
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground font-normal h-9 text-sm"
            data-testid={`${testIdPrefix}-search-link`}
          >
            <Search className="w-3.5 h-3.5 mr-2 shrink-0" />
            Search or add a person...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Type a name..."
              data-testid={`${testIdPrefix}-search-input`}
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
                      data-testid={`${testIdPrefix}-quick-create`}
                    >
                      {isCreating ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <User className="w-3 h-3 mr-1" />
                      )}
                      Create contact "{searchValue.trim()}"
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup>
                {availableContacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => handleSelectContact(c)}
                    data-testid={`${testIdPrefix}-search-option-${c.id}`}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.businessName && (
                      <span className="text-xs text-muted-foreground ml-1 truncate">({c.businessName})</span>
                    )}
                  </CommandItem>
                ))}
                {searchValue.trim() && availableContacts.length > 0 && (
                  <CommandItem
                    value={`__create__${searchValue.trim()}`}
                    onSelect={handleQuickCreate}
                    data-testid={`${testIdPrefix}-quick-create-inline`}
                  >
                    <User className="w-3 h-3 mr-1 shrink-0" />
                    <span className="text-muted-foreground">Create new: "{searchValue.trim()}"</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

