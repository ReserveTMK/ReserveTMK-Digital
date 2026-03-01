import { useRoute, Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { useProject, useProjectUpdates, useUpdateProject, useDeleteProject, useCreateProjectUpdate } from "@/hooks/use-projects";
import { useProjectTasks, useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask, useExtractTasks } from "@/hooks/use-project-tasks";
import { useContacts } from "@/hooks/use-contacts";
import { useGroups } from "@/hooks/use-groups";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Trash2, Plus, Calendar, Users, Target, FileText, Clock, AlertCircle, CheckCircle2, Loader2, Mic, Square, Play, X, ListTodo, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { PROJECT_STATUSES, PROJECT_UPDATE_TYPES } from "@shared/schema";
import type { Project, ProjectTask } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const UPDATE_TYPE_LABELS: Record<string, string> = {
  status_change: "Status Change",
  milestone: "Milestone",
  note: "Note",
  blocker: "Blocker",
  completed_task: "Completed Task",
};

const UPDATE_TYPE_COLORS: Record<string, string> = {
  status_change: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  milestone: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  note: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  blocker: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed_task: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

function resolveContactName(contacts: any[] | undefined, id: number | null | undefined): string {
  if (!id || !contacts) return "Unknown";
  const c = contacts.find((c: any) => c.id === id);
  return c ? c.name : "Unknown";
}

function resolveContactNames(contacts: any[] | undefined, ids: number[] | null | undefined): string[] {
  if (!ids || !contacts) return [];
  return ids.map(id => {
    const c = contacts.find((c: any) => c.id === id);
    return c ? c.name : `Contact #${id}`;
  });
}

function EditProjectDialog({
  project,
  open,
  onOpenChange,
  contacts,
  groups,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[] | undefined;
  groups: any[] | undefined;
}) {
  const { toast } = useToast();
  const updateProject = useUpdateProject();
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    status: project.status,
    startDate: project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
    endDate: project.endDate ? format(new Date(project.endDate), "yyyy-MM-dd") : "",
    ownerId: project.ownerId?.toString() || "",
    goals: project.goals || "",
    deliverables: project.deliverables || "",
    notes: project.notes || "",
    relatedGroupId: project.relatedGroupId?.toString() || "",
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      toast({ title: "Error", description: "End date must be on or after start date", variant: "destructive" });
      return;
    }

    updateProject.mutate(
      {
        id: project.id,
        name: formData.name.trim(),
        description: formData.description || null,
        status: formData.status,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        ownerId: formData.ownerId ? parseInt(formData.ownerId) : null,
        goals: formData.goals || null,
        deliverables: formData.deliverables || null,
        notes: formData.notes || null,
        relatedGroupId: formData.relatedGroupId ? parseInt(formData.relatedGroupId) : null,
      } as any,
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Project updated" });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to update project", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              data-testid="input-project-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={200}
            />
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger data-testid="select-project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              data-testid="input-project-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                data-testid="input-project-start-date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                data-testid="input-project-end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={formData.ownerId} onValueChange={(v) => setFormData({ ...formData, ownerId: v })}>
              <SelectTrigger data-testid="select-project-owner">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {(contacts || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Related Group</Label>
            <Select value={formData.relatedGroupId} onValueChange={(v) => setFormData({ ...formData, relatedGroupId: v })}>
              <SelectTrigger data-testid="select-project-group">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {(groups || []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Goals</Label>
            <Textarea
              data-testid="input-project-goals"
              value={formData.goals}
              onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Deliverables</Label>
            <Textarea
              data-testid="input-project-deliverables"
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              data-testid="input-project-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateProject.isPending} data-testid="button-save-project">
            {updateProject.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUpdateDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const createUpdate = useCreateProjectUpdate();
  const [updateType, setUpdateType] = useState("note");
  const [updateText, setUpdateText] = useState("");

  const handleSubmit = () => {
    if (!updateText.trim()) {
      toast({ title: "Error", description: "Update text is required", variant: "destructive" });
      return;
    }
    createUpdate.mutate(
      { projectId, updateType, updateText: updateText.trim() },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Update added" });
          setUpdateType("note");
          setUpdateText("");
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to add update", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={updateType} onValueChange={setUpdateType}>
              <SelectTrigger data-testid="select-update-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_UPDATE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{UPDATE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Details</Label>
            <Textarea
              data-testid="input-update-text"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="What's the update?"
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-update">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createUpdate.isPending} data-testid="button-submit-update">
            {createUpdate.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDebriefDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: number;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const createTask = useCreateProjectTask();
  const extractTasks = useExtractTasks();

  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [extractedTasks, setExtractedTasks] = useState<Array<{ title: string; description?: string; priority: string; included: boolean }>>([]);
  const [step, setStep] = useState<"input" | "review" | "saving">("input");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setStep("input");
      setInputMode("text");
      setTextInput("");
      setTranscript("");
      setAudioBlob(null);
      setAudioUrl(null);
      setExtractedTasks([]);
    }
  }, [open]);

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
      setTranscript(data.transcript || data.text || "");
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

  const handleExtract = () => {
    const sourceText = inputMode === "voice" ? transcript : textInput;
    if (!sourceText.trim()) {
      toast({ title: "Error", description: "Please provide some text to extract tasks from.", variant: "destructive" });
      return;
    }
    extractTasks.mutate(
      { text: sourceText, projectName },
      {
        onSuccess: (data) => {
          setExtractedTasks(
            (data.tasks || []).map((t) => ({ ...t, included: true }))
          );
          setStep("review");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to extract tasks", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveTasks = async () => {
    const tasksToCreate = extractedTasks.filter((t) => t.included);
    if (tasksToCreate.length === 0) {
      toast({ title: "No tasks", description: "Select at least one task to add.", variant: "destructive" });
      return;
    }
    setStep("saving");
    try {
      for (const task of tasksToCreate) {
        await createTask.mutateAsync({
          projectId,
          title: task.title,
          description: task.description || undefined,
        });
      }
      toast({ title: "Success", description: `${tasksToCreate.length} task(s) added to project.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save tasks", variant: "destructive" });
      setStep("review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary" />
            Add Tasks via Debrief
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "voice" | "text")}>
              <TabsList className="w-full">
                <TabsTrigger value="voice" className="flex-1" data-testid="tab-debrief-voice">
                  <Mic className="w-3.5 h-3.5 mr-1" /> Voice
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1" data-testid="tab-debrief-text">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="voice" className="space-y-3 mt-3">
                {!audioBlob && !isRecording && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Button
                      onClick={startRecording}
                      className="rounded-full w-16 h-16 flex items-center justify-center"
                      data-testid="button-start-debrief-recording"
                    >
                      <Mic className="w-7 h-7" />
                    </Button>
                    <p className="text-sm text-muted-foreground">Tap to start recording</p>
                  </div>
                )}
                {isRecording && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="w-16 h-16 rounded-full bg-destructive/20 animate-pulse flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-destructive" />
                    </div>
                    <p className="text-lg font-mono font-bold">{fmtTime(recordingTime)}</p>
                    <Button variant="destructive" onClick={stopRecording} data-testid="button-stop-debrief-recording">
                      <Square className="w-4 h-4 mr-2" /> Stop Recording
                    </Button>
                  </div>
                )}
                {audioBlob && !isRecording && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border border-border">
                      <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                      <audio controls src={audioUrl || undefined} className="flex-1 h-8" data-testid="audio-debrief-playback" />
                      <Button variant="ghost" size="icon" onClick={() => { setAudioBlob(null); setAudioUrl(null); setTranscript(""); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {!transcript && (
                      <Button onClick={transcribeAudio} disabled={isTranscribing} className="w-full" data-testid="button-transcribe-debrief">
                        {isTranscribing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transcribing...</> : <><FileText className="w-4 h-4 mr-2" /> Transcribe</>}
                      </Button>
                    )}
                    {transcript && (
                      <div className="space-y-2">
                        <Label>Transcript</Label>
                        <Textarea
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                          className="min-h-[100px] resize-none"
                          data-testid="textarea-debrief-transcript"
                        />
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="text" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label>Notes / Description</Label>
                  <Textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Describe what needs to be done, paste meeting notes, or brain dump your ideas..."
                    className="min-h-[150px] resize-none"
                    data-testid="textarea-debrief-text"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {extractedTasks.length} task(s) extracted. Select which to add:
            </p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {extractedTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-md border border-border"
                  data-testid={`card-extracted-task-${i}`}
                >
                  <Checkbox
                    checked={task.included}
                    onCheckedChange={(checked) => {
                      const updated = [...extractedTasks];
                      updated[i] = { ...updated[i], included: !!checked };
                      setExtractedTasks(updated);
                    }}
                    data-testid={`checkbox-extracted-task-${i}`}
                  />
                  <div className="flex-1 min-w-0">
                    <Input
                      value={task.title}
                      onChange={(e) => {
                        const updated = [...extractedTasks];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setExtractedTasks(updated);
                      }}
                      className="font-medium"
                      data-testid={`input-extracted-task-title-${i}`}
                    />
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{task.priority}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "saving" && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Saving tasks...</p>
          </div>
        )}

        <DialogFooter>
          {step === "input" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-debrief">
                Cancel
              </Button>
              <Button
                onClick={handleExtract}
                disabled={extractTasks.isPending || (inputMode === "voice" ? !transcript.trim() : !textInput.trim())}
                data-testid="button-extract-tasks"
              >
                {extractTasks.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Extract Tasks
              </Button>
            </>
          )}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("input")} data-testid="button-back-to-input">
                Back
              </Button>
              <Button onClick={handleSaveTasks} data-testid="button-save-extracted-tasks">
                Add {extractedTasks.filter((t) => t.included).length} Task(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({
  task,
  projectId,
  contacts,
}: {
  task: ProjectTask;
  projectId: number;
  contacts: any[] | undefined;
}) {
  const { toast } = useToast();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const isCompleted = task.status === "completed";

  const toggleComplete = () => {
    updateTask.mutate({
      taskId: task.id,
      projectId,
      status: isCompleted ? "pending" : "completed",
    });
  };

  const handleAssigneeChange = (contactId: string) => {
    updateTask.mutate({
      taskId: task.id,
      projectId,
      assigneeId: contactId === "unassign" ? null : parseInt(contactId),
    });
    setAssigneeOpen(false);
  };

  const handleDeadlineChange = (date: Date | undefined) => {
    updateTask.mutate({
      taskId: task.id,
      projectId,
      deadline: date ? date.toISOString() : null,
    });
    setDeadlineOpen(false);
  };

  const handleDelete = () => {
    deleteTask.mutate(
      { taskId: task.id, projectId },
      {
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to delete task", variant: "destructive" });
        },
      }
    );
  };

  const assigneeName = task.assigneeId
    ? contacts?.find((c: any) => c.id === task.assigneeId)?.name || "Unknown"
    : null;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-md border border-border ${isCompleted ? "opacity-60" : ""}`}
      data-testid={`row-task-${task.id}`}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={toggleComplete}
        data-testid={`checkbox-task-${task.id}`}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`} data-testid={`text-task-title-${task.id}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-assignee-${task.id}`}>
              <User className="w-3 h-3 mr-1" />
              {assigneeName || "Assign"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {task.assigneeId && (
                <button
                  className="w-full text-left text-xs px-2 py-1.5 rounded-md hover-elevate text-destructive"
                  onClick={() => handleAssigneeChange("unassign")}
                  data-testid={`button-unassign-${task.id}`}
                >
                  Remove assignee
                </button>
              )}
              {(contacts || []).map((c: any) => (
                <button
                  key={c.id}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover-elevate ${c.id === task.assigneeId ? "bg-accent" : ""}`}
                  onClick={() => handleAssigneeChange(c.id.toString())}
                  data-testid={`button-assign-contact-${c.id}-task-${task.id}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-deadline-${task.id}`}>
              <Calendar className="w-3 h-3 mr-1" />
              {task.deadline ? format(new Date(task.deadline), "d MMM") : "Deadline"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={task.deadline ? new Date(task.deadline) : undefined}
              onSelect={handleDeadlineChange}
              data-testid={`calendar-deadline-${task.id}`}
            />
            {task.deadline && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-destructive"
                  onClick={() => handleDeadlineChange(undefined)}
                  data-testid={`button-clear-deadline-${task.id}`}
                >
                  Clear deadline
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleteTask.isPending}
          data-testid={`button-delete-task-${task.id}`}
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function TaskSection({
  projectId,
  projectName,
  contacts,
}: {
  projectId: number;
  projectName: string;
  contacts: any[] | undefined;
}) {
  const { toast } = useToast();
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const createTask = useCreateProjectTask();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    createTask.mutate(
      { projectId, title: newTaskTitle.trim() },
      {
        onSuccess: () => {
          setNewTaskTitle("");
          setShowAddForm(false);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to add task", variant: "destructive" });
        },
      }
    );
  };

  const incompleteTasks = (tasks || [])
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return a.sortOrder - b.sortOrder;
    });

  const completedTasks = (tasks || []).filter((t) => t.status === "completed");
  const totalTasks = (tasks || []).length;
  const completedCount = completedTasks.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Tasks
          </h2>
          {totalTasks > 0 && (
            <Badge variant="secondary" data-testid="badge-task-count">
              {completedCount} of {totalTasks} complete
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setDebriefOpen(true)} data-testid="button-add-debrief">
            <Mic className="w-4 h-4 mr-1" />
            Add Debrief
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)} data-testid="button-add-task">
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%` }}
            data-testid="progress-tasks"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {incompleteTasks.map((task) => (
            <TaskRow key={task.id} task={task} projectId={projectId} contacts={contacts} />
          ))}

          {showAddForm && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-border" data-testid="form-add-task">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title..."
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); if (e.key === "Escape") { setShowAddForm(false); setNewTaskTitle(""); } }}
                autoFocus
                data-testid="input-new-task-title"
              />
              <Button size="sm" onClick={handleAddTask} disabled={createTask.isPending || !newTaskTitle.trim()} data-testid="button-save-new-task">
                {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewTaskTitle(""); }} data-testid="button-cancel-new-task">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {!showAddForm && incompleteTasks.length === 0 && completedTasks.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground" data-testid="text-no-tasks">
                No tasks yet. Add tasks manually or use voice/text debrief.
              </p>
            </Card>
          )}

          {completedTasks.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              {completedTasks.map((task) => (
                <TaskRow key={task.id} task={task} projectId={projectId} contacts={contacts} />
              ))}
            </div>
          )}
        </div>
      )}

      <AddDebriefDialog
        projectId={projectId}
        projectName={projectName}
        open={debriefOpen}
        onOpenChange={setDebriefOpen}
      />
    </div>
  );
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0");
  const { data: project, isLoading } = useProject(id || undefined);
  const { data: updates, isLoading: updatesLoading } = useProjectUpdates(id || undefined);
  const { data: contacts } = useContacts();
  const { data: groups } = useGroups();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold" data-testid="text-project-not-found">Project not found</h2>
        <Link href="/projects">
          <Button variant="outline" data-testid="link-back-to-projects">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const ownerName = resolveContactName(contacts, project.ownerId);
  const teamMemberNames = resolveContactNames(contacts, project.teamMembers as number[] | null);
  const relatedContactNames = resolveContactNames(contacts, project.relatedContactIds as number[] | null);
  const relatedGroup = groups?.find((g: any) => g.id === project.relatedGroupId);

  const handleDelete = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Project has been deleted" });
        setLocation("/projects");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to delete project", variant: "destructive" });
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/projects">
          <Button variant="ghost" size="icon" data-testid="button-back-to-projects">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate" data-testid="text-project-name">{project.name}</h1>
        </div>
        <Badge className={STATUS_COLORS[project.status] || ""} data-testid="badge-project-status">
          {STATUS_LABELS[project.status] || project.status}
        </Badge>
        {(project as any).projectType && (
          <Badge variant="outline" data-testid="badge-project-type">
            {(project as any).projectType === "delivery" ? "Delivery" : "Operational"}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)} data-testid="button-delete-project" className="text-destructive">
          <Trash2 className="w-4 h-4 mr-1" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="w-4 h-4" />
            Owner
          </div>
          <p className="text-sm" data-testid="text-project-owner">{ownerName}</p>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="w-4 h-4" />
            Timeline
          </div>
          <div className="text-sm space-y-1">
            <p data-testid="text-project-start-date">
              Start: {project.startDate ? format(new Date(project.startDate), "d MMM yyyy") : "Not set"}
            </p>
            <p data-testid="text-project-end-date">
              End: {project.endDate ? format(new Date(project.endDate), "d MMM yyyy") : "Not set"}
            </p>
          </div>
        </Card>
      </div>

      {project.description && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="w-4 h-4" />
            Description
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-description">{project.description}</p>
        </Card>
      )}

      <TaskSection projectId={project.id} projectName={project.name} contacts={contacts} />

      {project.goals && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Target className="w-4 h-4" />
            Goals
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-goals">{project.goals}</p>
        </Card>
      )}

      {project.deliverables && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CheckCircle2 className="w-4 h-4" />
            Deliverables
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-deliverables">{project.deliverables}</p>
        </Card>
      )}

      {teamMemberNames.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="w-4 h-4" />
            Team Members
          </div>
          <div className="flex flex-wrap gap-2">
            {teamMemberNames.map((name, i) => (
              <Badge key={i} variant="secondary" data-testid={`badge-team-member-${i}`}>
                {name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {(relatedGroup || relatedContactNames.length > 0) && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Related</div>
          {relatedGroup && (
            <div className="text-sm">
              <span className="text-muted-foreground">Group: </span>
              <span data-testid="text-related-group">{relatedGroup.name}</span>
            </div>
          )}
          {relatedContactNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {relatedContactNames.map((name, i) => (
                <Badge key={i} variant="outline" data-testid={`badge-related-contact-${i}`}>
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      {project.notes && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Notes</div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-notes">{project.notes}</p>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Updates & Activity</h2>
          <Button size="sm" onClick={() => setAddUpdateOpen(true)} data-testid="button-add-update">
            <Plus className="w-4 h-4 mr-1" />
            Add Update
          </Button>
        </div>

        {updatesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !updates || updates.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground" data-testid="text-no-updates">No updates yet. Add the first one!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {updates.map((update) => (
              <Card key={update.id} className="p-4" data-testid={`card-update-${update.id}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={UPDATE_TYPE_COLORS[update.updateType] || ""} data-testid={`badge-update-type-${update.id}`}>
                      {UPDATE_TYPE_LABELS[update.updateType] || update.updateType}
                    </Badge>
                    {update.createdBy && (
                      <span className="text-xs text-muted-foreground" data-testid={`text-update-author-${update.id}`}>
                        by {update.createdBy}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-update-date-${update.id}`}>
                    <Clock className="w-3 h-3" />
                    {update.createdAt
                      ? formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })
                      : "Unknown"}
                  </span>
                </div>
                {update.updateText && (
                  <p className="text-sm mt-2 whitespace-pre-wrap" data-testid={`text-update-content-${update.id}`}>
                    {update.updateText}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        contacts={contacts}
        groups={groups}
      />

      <AddUpdateDialog
        projectId={project.id}
        open={addUpdateOpen}
        onOpenChange={setAddUpdateOpen}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be undone and will remove all associated updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteProject.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}