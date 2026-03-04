import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useLocation } from "wouter";
import { useState, useRef } from "react";
import {
  Loader2,
  Mic,
  Square,
  Play,
  X,
  Trash2,
  FileText,
  HeartHandshake,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@shared/schema";
import { ContactSearchPicker } from "./shared";

export function ManualUpdateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
