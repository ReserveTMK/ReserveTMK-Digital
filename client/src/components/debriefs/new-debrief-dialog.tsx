import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useRef, useCallback } from "react";
import {
  Loader2,
  Mic,
  Square,
  Play,
  Trash2,
  FileText,
} from "lucide-react";

export function NewDebriefDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
