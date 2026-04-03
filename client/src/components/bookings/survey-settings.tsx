import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Loader2, Trash2, RefreshCw } from "lucide-react";

const DEFAULT_SURVEY_QUESTIONS = [
  { id: 1, type: "rating", question: "How would you rate your overall experience?", scale: 5, required: true },
  { id: 2, type: "rating", question: "How clean and well-maintained was the space?", scale: 5, required: true },
  { id: 3, type: "yes_no", question: "Did you have everything you needed?", required: true },
  { id: 4, type: "text", question: "What could we improve?", required: false },
  { id: 5, type: "yes_no", question: "Would you book with us again?", required: true },
  { id: 6, type: "text", question: "Any other feedback?", required: false },
  { id: 7, type: "testimonial", question: "Would you like to share a testimonial? (optional)", required: false, consent: true, subtext: "By submitting, you give us permission to share publicly." },
];

export { DEFAULT_SURVEY_QUESTIONS };

const QUESTION_TYPES = [
  { value: "rating", label: "Rating (1-5)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Free Text" },
  { value: "testimonial", label: "Testimonial" },
];

export type SurveyQuestion = {
  id: number;
  type: string;
  question: string;
  scale?: number;
  required: boolean;
  consent?: boolean;
  subtext?: string;
};

export function SurveySettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<{
    questions: SurveyQuestion[] | null;
    googleReviewUrl: string | null;
    emailSubject: string | null;
    emailIntro: string | null;
    emailSignoff: string | null;
  }>({
    queryKey: ['/api/survey-settings'],
  });

  const [questions, setQuestions] = useState<SurveyQuestion[]>(DEFAULT_SURVEY_QUESTIONS);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailIntro, setEmailIntro] = useState("");
  const [emailSignoff, setEmailSignoff] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings) {
      setQuestions(settings.questions && settings.questions.length > 0 ? settings.questions : DEFAULT_SURVEY_QUESTIONS);
      setGoogleReviewUrl(settings.googleReviewUrl || "");
      setEmailSubject(settings.emailSubject || "");
      setEmailIntro(settings.emailIntro || "");
      setEmailSignoff(settings.emailSignoff || "");
      setInitialized(true);
    }
  }, [settings, initialized]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('PUT', '/api/survey-settings', {
        questions,
        googleReviewUrl: googleReviewUrl.trim() || null,
        emailSubject: emailSubject.trim() || null,
        emailIntro: emailIntro.trim() || null,
        emailSignoff: emailSignoff.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/survey-settings'] });
      toast({ title: "Saved", description: "Survey settings updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleResetDefaults = () => {
    setQuestions(DEFAULT_SURVEY_QUESTIONS);
    setGoogleReviewUrl("");
    setEmailSubject("");
    setEmailIntro("");
    setEmailSignoff("");
  };

  const updateQuestion = (id: number, field: string, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (id: number) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addQuestion = () => {
    const maxId = questions.reduce((max, q) => Math.max(max, q.id), 0);
    setQuestions(prev => [
      ...prev,
      { id: maxId + 1, type: "text", question: "", required: false },
    ]);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-1">Google Review Link</h3>
        <p className="text-xs text-muted-foreground mb-2">
          When set, the testimonial question on the public survey page will show a link to leave a Google review.
        </p>
        <Input
          value={googleReviewUrl}
          onChange={(e) => setGoogleReviewUrl(e.target.value)}
          placeholder="https://g.page/r/your-business/review"
          data-testid="input-google-review-url"
        />
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-1">Email Customisation</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customise the survey email sent to bookers after their venue hire is completed.
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Subject line</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="How was your experience at ReserveTMK Digital?"
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <Label className="text-xs">Intro text</Label>
            <Textarea
              value={emailIntro}
              onChange={(e) => setEmailIntro(e.target.value)}
              placeholder="Thank you for booking with us! We'd love to hear your feedback..."
              className="resize-none min-h-[60px]"
              data-testid="input-email-intro"
            />
          </div>
          <div>
            <Label className="text-xs">Sign-off text</Label>
            <Input
              value={emailSignoff}
              onChange={(e) => setEmailSignoff(e.target.value)}
              placeholder="Nga mihi, The ReserveTMK Digital Team"
              data-testid="input-email-signoff"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Survey Questions</h3>
            <p className="text-xs text-muted-foreground">Edit, add, or remove questions from the post-booking survey.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addQuestion} data-testid="button-add-question">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="border rounded-md p-3 space-y-2" data-testid={`survey-question-${q.id}`}>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-mono mt-2 w-5 shrink-0">{idx + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                    placeholder="Question text"
                    className="text-sm"
                    data-testid={`input-question-text-${q.id}`}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, "type", v)}>
                      <SelectTrigger className="w-[140px]" data-testid={`select-question-type-${q.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={q.required}
                        onCheckedChange={(v) => updateQuestion(q.id, "required", v)}
                        data-testid={`switch-required-${q.id}`}
                      />
                      <span className="text-xs text-muted-foreground">Required</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeQuestion(q.id)}
                  data-testid={`button-remove-question-${q.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-survey-settings"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
        <Button
          variant="outline"
          onClick={handleResetDefaults}
          data-testid="button-reset-survey-defaults"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
