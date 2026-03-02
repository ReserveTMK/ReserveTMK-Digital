import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Settings,
} from "lucide-react";
import type { MentoringOnboardingQuestion } from "@shared/schema";

const QUERY_KEY = ["/api/mentoring-onboarding-questions"];

const FIELD_TYPE_LABELS: Record<string, string> = {
  textarea: "Textarea",
  text: "Text",
  select: "Select",
  boolean: "Boolean",
};

function QuestionDialog({
  open,
  onOpenChange,
  editingQuestion,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingQuestion?: MentoringOnboardingQuestion | null;
}) {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [fieldType, setFieldType] = useState("textarea");
  const [optionsText, setOptionsText] = useState("");
  const [isRequired, setIsRequired] = useState(true);

  const isEditing = !!editingQuestion;

  useEffect(() => {
    if (editingQuestion) {
      setQuestion(editingQuestion.question);
      setFieldType(editingQuestion.fieldType || "textarea");
      setOptionsText(editingQuestion.options?.join(", ") || "");
      setIsRequired(editingQuestion.isRequired ?? true);
    } else {
      setQuestion("");
      setFieldType("textarea");
      setOptionsText("");
      setIsRequired(true);
    }
  }, [editingQuestion]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/mentoring-onboarding-questions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Question added" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/mentoring-onboarding-questions/${editingQuestion!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Question updated" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!question.trim()) return;
    const payload: Record<string, unknown> = {
      question: question.trim(),
      fieldType,
      isRequired,
      options: fieldType === "select" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [],
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Question" : "Add Question"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this onboarding question" : "Create a new onboarding question for mentees"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Question Text</Label>
            <Input
              placeholder="e.g., What are your goals?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              data-testid="input-question-text"
            />
          </div>
          <div className="space-y-2">
            <Label>Field Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger data-testid="select-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Textarea</SelectItem>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fieldType === "select" && (
            <div className="space-y-2">
              <Label>Options (comma-separated)</Label>
              <Input
                placeholder="Option 1, Option 2, Option 3"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                data-testid="input-options"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <Label>Required</Label>
            <Switch
              checked={isRequired}
              onCheckedChange={setIsRequired}
              data-testid="switch-required"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-question">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!question.trim() || isPending} data-testid="button-submit-question">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? "Save Changes" : "Add Question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MentoringOnboardingSetup() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<MentoringOnboardingQuestion | null>(null);

  const { data: questions, isLoading } = useQuery<MentoringOnboardingQuestion[]>({
    queryKey: QUERY_KEY,
  });

  const sortedQuestions = questions?.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/mentoring-onboarding-questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Question deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/mentoring-onboarding-questions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleReorder = (questionId: number, direction: "up" | "down") => {
    if (!sortedQuestions) return;
    const idx = sortedQuestions.findIndex((q) => q.id === questionId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedQuestions.length) return;

    const currentOrder = sortedQuestions[idx].sortOrder ?? 0;
    const swapOrder = sortedQuestions[swapIdx].sortOrder ?? 0;

    patchMutation.mutate({ id: sortedQuestions[idx].id, sortOrder: swapOrder });
    patchMutation.mutate({ id: sortedQuestions[swapIdx].id, sortOrder: currentOrder });
  };

  const handleEdit = (q: MentoringOnboardingQuestion) => {
    setEditingQuestion(q);
    setShowDialog(true);
  };

  const handleCloseDialog = (v: boolean) => {
    setShowDialog(v);
    if (!v) setEditingQuestion(null);
  };

  return (
    <div className="space-y-4" data-testid="mentoring-onboarding-setup">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">Onboarding Questions</h3>
          <p className="text-xs text-muted-foreground">Manage the questions new mentees see when onboarding</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingQuestion(null); setShowDialog(true); }}
          data-testid="button-add-question"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Question
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !sortedQuestions || sortedQuestions.length === 0 ? (
        <Card className="p-8 text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No onboarding questions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add questions that new mentees will answer</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => { setEditingQuestion(null); setShowDialog(true); }}
            data-testid="button-add-question-empty"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Question
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedQuestions.map((q, idx) => (
            <Card
              key={q.id}
              className="p-4 cursor-pointer"
              onClick={() => handleEdit(q)}
              data-testid={`question-card-${q.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`question-text-${q.id}`}>
                      {q.question}
                    </span>
                    <Badge variant="outline" className="text-[10px]" data-testid={`badge-field-type-${q.id}`}>
                      {FIELD_TYPE_LABELS[q.fieldType || "textarea"] || q.fieldType}
                    </Badge>
                    {q.isRequired && (
                      <Badge variant="secondary" className="text-[10px]">Required</Badge>
                    )}
                    {!q.isActive && (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Inactive</Badge>
                    )}
                  </div>
                  {q.fieldType === "select" && q.options && q.options.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Options: {q.options.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={() => handleReorder(q.id, "up")}
                      data-testid={`button-move-up-${q.id}`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={idx === sortedQuestions.length - 1}
                      onClick={() => handleReorder(q.id, "down")}
                      data-testid={`button-move-down-${q.id}`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Switch
                    checked={q.isRequired ?? true}
                    onCheckedChange={(checked) => patchMutation.mutate({ id: q.id, isRequired: checked })}
                    data-testid={`switch-required-${q.id}`}
                  />
                  <Switch
                    checked={q.isActive ?? true}
                    onCheckedChange={(checked) => patchMutation.mutate({ id: q.id, isActive: checked })}
                    data-testid={`switch-active-${q.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete question "${q.question}"?`)) {
                        deleteMutation.mutate(q.id);
                      }
                    }}
                    data-testid={`button-delete-question-${q.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showDialog && (
        <QuestionDialog
          open={showDialog}
          onOpenChange={handleCloseDialog}
          editingQuestion={editingQuestion}
        />
      )}
    </div>
  );
}
