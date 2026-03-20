import { useState, useMemo, useRef, useCallback } from "react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Plus,
  Search,
  Loader2,
  Rocket,
  ArrowUpDown,
  Mic,
  Square,
  Play,
  FileText,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Wrench,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useCreateProjectTask, useExtractTasks } from "@/hooks/use-project-tasks";
import { useContacts } from "@/hooks/use-contacts";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@shared/schema";
import type { Project } from "@shared/schema";

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  active: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const typeLabels: Record<string, string> = {
  operational: "Operational",
  delivery: "Delivery",
};

const typeColors: Record<string, string> = {
  operational: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  delivery: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
};

type SortKey = "name" | "status" | "endDate" | "updatedAt";

type ExtractedTask = {
  title: string;
  description?: string;
  priority: string;
  group: string;
  included: boolean;
};

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const createProject = useCreateProject();
  const createTask = useCreateProjectTask();
  const extractTasks = useExtractTasks();

  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<"operational" | "delivery">("operational");

  const [inputTab, setInputTab] = useState("text");
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [suggestedDescription, setSuggestedDescription] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskGroup, setNewTaskGroup] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const resetState = useCallback(() => {
    setStep(1);
    setProjectName("");
    setProjectType("operational");
    setInputTab("text");
    setTextInput("");
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsTranscribing(false);
    setTranscript("");
    setTasks([]);
    setIsExtracting(false);
    setSuggestedDescription("");
    setNewTaskTitle("");
    setNewTaskGroup("");
    setIsSaving(false);
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
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
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Transcription failed. Please try again.");
      }
      const data = await res.json();
      const t = data.transcript || data.text || "";
      setTranscript(t);
      setTextInput(t);
      toast({ title: "Transcribed", description: "Audio transcription complete." });
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleExtractTasks = async () => {
    const text = textInput.trim() || transcript.trim();
    if (!text) {
      toast({ title: "No input", description: "Please provide text or record audio first.", variant: "destructive" });
      return;
    }
    setIsExtracting(true);
    try {
      const result = await extractTasks.mutateAsync({ text, projectName: projectName || undefined });
      const extracted = (result.tasks || []).map((t: any) => ({
        title: t.title,
        description: t.description || "",
        priority: t.priority || "medium",
        group: t.group || "Other",
        included: true,
      }));
      setTasks(extracted);
      if (result.suggestedDescription) {
        setSuggestedDescription(result.suggestedDescription);
      }
      setStep(3);
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message || "Could not extract tasks", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleTask = (index: number) => {
    setTasks((prev) => prev.map((t, i) => i === index ? { ...t, included: !t.included } : t));
  };

  const updateTaskTitle = (index: number, title: string) => {
    setTasks((prev) => prev.map((t, i) => i === index ? { ...t, title } : t));
  };

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    tasks.forEach((t) => { if (t.group) groups.add(t.group); });
    return Array.from(groups).sort();
  }, [tasks]);

  const addManualTask = () => {
    if (!newTaskTitle.trim()) return;
    setTasks((prev) => [...prev, { title: newTaskTitle.trim(), description: "", priority: "medium", group: newTaskGroup || "Other", included: true }]);
    setNewTaskTitle("");
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      toast({ title: "Missing name", description: "Please enter a project name.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const projectRes = await createProject.mutateAsync({
        name: projectName.trim(),
        projectType,
        description: suggestedDescription || "",
        status: "planning",
      } as any);

      const projectId = (projectRes as any).id;
      const includedTasks = tasks.filter((t) => t.included && t.title.trim());

      for (let i = 0; i < includedTasks.length; i++) {
        await createTask.mutateAsync({
          projectId,
          title: includedTasks[i].title,
          description: includedTasks[i].description,
          sortOrder: i,
          taskGroup: includedTasks[i].group || undefined,
        });
      }

      toast({ title: "Project created", description: `"${projectName}" created with ${includedTasks.length} tasks.` });
      resetState();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create project", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const canGoToStep2 = projectName.trim().length > 0;
  const hasInput = (textInput.trim() || transcript.trim()).length > 0;
  const includedCount = tasks.filter((t) => t.included).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto" data-testid="dialog-create-project">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {step === 1 && "New Project"}
            {step === 2 && "Describe Your Project"}
            {step === 3 && "Review Tasks"}
            {step === 4 && "Create Project"}
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new project</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
              data-testid={`step-indicator-${s}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Community Garden Setup"
                data-testid="input-project-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Project Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProjectType("operational")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-md border transition-colors ${
                    projectType === "operational"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid="button-type-operational"
                >
                  <Wrench className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium text-sm">Operational</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Internal tasks, admin, processes
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType("delivery")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-md border transition-colors ${
                    projectType === "delivery"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid="button-type-delivery"
                >
                  <Package className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="font-medium text-sm">Delivery</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Programmes, events, community work
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe what needs doing. Record a voice note or type your thoughts — AI will extract tasks for you.
            </p>

            <Tabs value={inputTab} onValueChange={setInputTab}>
              <TabsList className="w-full">
                <TabsTrigger value="voice" className="flex-1" data-testid="tab-voice">
                  <Mic className="w-4 h-4 mr-2" />
                  Voice
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1" data-testid="tab-text">
                  <FileText className="w-4 h-4 mr-2" />
                  Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="voice" className="space-y-4 mt-4">
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
                    <div className="w-20 h-20 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-destructive" />
                    </div>
                    <p className="text-lg font-mono font-bold" data-testid="text-recording-timer">
                      {formatTime(recordingTime)}
                    </p>
                    <Button variant="destructive" onClick={stopRecording} data-testid="button-stop-recording">
                      <Square className="w-4 h-4 mr-2" />
                      Stop Recording
                    </Button>
                  </div>
                )}

                {audioBlob && !isRecording && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-md border border-border">
                      <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                      <audio controls src={audioUrl || undefined} className="flex-1 h-10" data-testid="audio-playback" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setAudioBlob(null); setAudioUrl(null); setTranscript(""); }}
                        data-testid="button-discard-recording"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {!transcript && (
                      <Button onClick={transcribeAudio} disabled={isTranscribing} className="w-full" data-testid="button-transcribe">
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
                          onChange={(e) => { setTranscript(e.target.value); setTextInput(e.target.value); }}
                          className="min-h-[120px] resize-none"
                          data-testid="textarea-transcript-result"
                        />
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="text" className="space-y-4 mt-4">
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Describe what needs to happen... paste meeting notes, brain dump ideas, or list out tasks"
                  className="min-h-[200px] resize-none"
                  data-testid="textarea-project-input"
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground text-sm">No tasks were extracted. Add tasks manually below.</p>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {(() => {
                  const grouped = new Map<string, { task: ExtractedTask; index: number }[]>();
                  tasks.forEach((task, index) => {
                    const g = task.group || "Other";
                    if (!grouped.has(g)) grouped.set(g, []);
                    grouped.get(g)!.push({ task, index });
                  });
                  return Array.from(grouped.entries()).map(([groupName, groupTasks]) => (
                    <div key={groupName} className="space-y-1.5" data-testid={`task-group-${groupName}`}>
                      <div className="flex items-center gap-2 px-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`text-group-name-${groupName}`}>
                          {groupName}
                        </h4>
                        <Badge variant="secondary" className="text-[10px]" data-testid={`badge-group-count-${groupName}`}>
                          {groupTasks.length}
                        </Badge>
                      </div>
                      {groupTasks.map(({ task, index }) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-md border border-border ${
                            task.included ? "bg-background" : "bg-muted/50 opacity-60"
                          }`}
                          data-testid={`task-row-${index}`}
                        >
                          <Checkbox
                            checked={task.included}
                            onCheckedChange={() => toggleTask(index)}
                            className="mt-0.5"
                            data-testid={`checkbox-task-${index}`}
                          />
                          <div className="flex-1 min-w-0">
                            <Input
                              value={task.title}
                              onChange={(e) => updateTaskTitle(index, e.target.value)}
                              className="border-0 bg-transparent focus-visible:ring-0 font-medium text-sm"
                              data-testid={`input-task-title-${index}`}
                            />
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 px-3">{task.description}</p>
                            )}
                          </div>
                          <Badge variant="secondary" className={`text-[10px] shrink-0 ${
                            task.priority === "high" ? "bg-red-500/15 text-red-700 dark:text-red-300" :
                            task.priority === "low" ? "bg-gray-500/15 text-gray-600 dark:text-gray-400" :
                            "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}>
                            {task.priority}
                          </Badge>
                          <Button variant="ghost" size="icon" onClick={() => removeTask(index)} data-testid={`button-remove-task-${index}`}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a task manually..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualTask(); } }}
                className="flex-1"
                data-testid="input-add-task"
              />
              <Select value={newTaskGroup} onValueChange={setNewTaskGroup}>
                <SelectTrigger className="w-[140px]" data-testid="select-task-group">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  {existingGroups.filter((g) => g !== "Other").map((g) => (
                    <SelectItem key={g} value={g} data-testid={`select-group-option-${g}`}>{g}</SelectItem>
                  ))}
                  <SelectItem value="Other" data-testid="select-group-option-other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={addManualTask} disabled={!newTaskTitle.trim()} data-testid="button-add-task">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {includedCount} of {tasks.length} tasks selected
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold" data-testid="text-review-name">{projectName}</h3>
                <Badge variant="secondary" className={typeColors[projectType]}>
                  {typeLabels[projectType]}
                </Badge>
              </div>
              {suggestedDescription && (
                <p className="text-sm text-muted-foreground" data-testid="text-review-description">{suggestedDescription}</p>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Tasks: </span>
                <span className="font-medium" data-testid="text-review-task-count">{includedCount}</span>
              </div>
              {includedCount > 0 && (
                <div className="space-y-2">
                  {(() => {
                    const included = tasks.filter((t) => t.included);
                    const grouped = new Map<string, ExtractedTask[]>();
                    included.forEach((t) => {
                      const g = t.group || "Other";
                      if (!grouped.has(g)) grouped.set(g, []);
                      grouped.get(g)!.push(t);
                    });
                    return Array.from(grouped.entries()).map(([groupName, groupTasks]) => (
                      <div key={groupName}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1" data-testid={`text-review-group-${groupName}`}>
                          {groupName} ({groupTasks.length})
                        </p>
                        <ul className="space-y-1">
                          {groupTasks.map((t, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                              <span data-testid={`text-review-task-${groupName}-${i}`}>{t.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 mt-4">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} data-testid="button-back">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }} data-testid="button-cancel-project">
              Cancel
            </Button>

            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!canGoToStep2} data-testid="button-next-step">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {step === 2 && (
              <>
                <Button onClick={() => { setTasks([]); setStep(3); }} variant="outline" data-testid="button-skip-extract">
                  Skip
                </Button>
                <Button onClick={handleExtractTasks} disabled={!hasInput || isExtracting} data-testid="button-extract-tasks">
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Extract Tasks
                    </>
                  )}
                </Button>
              </>
            )}

            {step === 3 && (
              <Button onClick={() => setStep(4)} data-testid="button-review-project">
                Review
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {step === 4 && (
              <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-project">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const { data: contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [dialogOpen, setDialogOpen] = useState(false);

  const contactMap = useMemo(() => {
    const map = new Map<number, string>();
    (contacts ?? []).forEach((c: any) => map.set(c.id, c.name));
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = projects ?? [];

    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }

    if (typeFilter !== "all") {
      list = list.filter((p) => (p as any).projectType === typeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "status":
          return (a.status ?? "").localeCompare(b.status ?? "");
        case "endDate": {
          const aDate = a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const bDate = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return aDate - bDate;
        }
        case "updatedAt":
        default: {
          const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bDate - aDate;
        }
      }
    });

    return list;
  }, [projects, statusFilter, typeFilter, search, sortBy]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Projects</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap" data-testid="tabs-status-filter">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            {PROJECT_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} data-testid={`tab-${s}`}>
                {statusLabels[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList data-testid="tabs-type-filter">
            <TabsTrigger value="all" data-testid="tab-type-all">All Types</TabsTrigger>
            <TabsTrigger value="operational" data-testid="tab-type-operational">Operational</TabsTrigger>
            <TabsTrigger value="delivery" data-testid="tab-type-delivery">Delivery</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort">
            <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Last Updated</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="endDate">Due Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3 flex items-center gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state">
          <Rocket className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {search || statusFilter !== "all" || typeFilter !== "all"
              ? "No projects match your filters."
              : "No projects yet. Create your first project to get started!"}
          </p>
          {!search && statusFilter === "all" && typeFilter === "all" && (
            <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)} data-testid="button-empty-create">
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          )}
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div
                className="flex items-center gap-3 p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid={`card-project-${project.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate" data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] shrink-0 ${typeColors[(project as any).projectType || "operational"]}`}
                      data-testid={`badge-type-${project.id}`}
                    >
                      {typeLabels[(project as any).projectType || "operational"]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] shrink-0 ${statusColors[project.status ?? "planning"]}`}
                      data-testid={`badge-status-${project.id}`}
                    >
                      {statusLabels[project.status ?? "planning"]}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {project.description}
                    </p>
                  )}
                </div>

                {project.ownerId && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden md:block" data-testid={`text-owner-${project.id}`}>
                    {contactMap.get(project.ownerId) ?? "Unknown"}
                  </span>
                )}

                {project.endDate && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                    Due {format(new Date(project.endDate), "d MMM")}
                  </span>
                )}

                {project.updatedAt && (
                  <span className="text-[11px] text-muted-foreground/70 shrink-0 hidden sm:block" data-testid={`text-updated-${project.id}`}>
                    {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                  </span>
                )}

                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </div>
            </Link>
          ))}
        </Card>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
