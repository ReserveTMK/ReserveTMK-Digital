import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/beautiful-button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Star, Check, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import type { Survey } from "@shared/schema";

type SurveyWithFlag = Survey & { alreadyCompleted?: boolean };

interface SurveyQuestion {
  id: number;
  type: string;
  question: string;
  scale?: number;
  required: boolean;
  consent?: boolean;
  subtext?: string;
}

function RatingInput({
  value,
  onChange,
  scale = 5,
  questionId,
}: {
  value: number | null;
  onChange: (val: number) => void;
  scale?: number;
  questionId: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1" data-testid={`rating-input-${questionId}`}>
      {Array.from({ length: scale }, (_, i) => i + 1).map((star) => {
        const filled = hovered !== null ? star <= hovered : value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            className="p-0.5 transition-transform"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(star)}
            data-testid={`star-${questionId}-${star}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        );
      })}
      {value !== null && (
        <span className="ml-2 text-sm text-muted-foreground" data-testid={`rating-value-${questionId}`}>
          {value}/{scale}
        </span>
      )}
    </div>
  );
}

function YesNoInput({
  value,
  onChange,
  questionId,
}: {
  value: boolean | null;
  onChange: (val: boolean) => void;
  questionId: number;
}) {
  return (
    <div className="flex items-center gap-3" data-testid={`yesno-input-${questionId}`}>
      <Button
        type="button"
        variant={value === true ? "default" : "outline"}
        onClick={() => onChange(true)}
        data-testid={`yesno-yes-${questionId}`}
      >
        <ThumbsUp className="w-4 h-4 mr-1.5" />
        Yes
      </Button>
      <Button
        type="button"
        variant={value === false ? "default" : "outline"}
        onClick={() => onChange(false)}
        data-testid={`yesno-no-${questionId}`}
      >
        <ThumbsDown className="w-4 h-4 mr-1.5" />
        No
      </Button>
    </div>
  );
}

function QuestionRenderer({
  question,
  response,
  onResponseChange,
}: {
  question: SurveyQuestion;
  response: string | number | boolean | null;
  onResponseChange: (val: string | number | boolean) => void;
}) {
  switch (question.type) {
    case "rating":
      return (
        <RatingInput
          value={typeof response === "number" ? response : null}
          onChange={(val) => onResponseChange(val)}
          scale={question.scale || 5}
          questionId={question.id}
        />
      );

    case "yes_no":
      return (
        <YesNoInput
          value={typeof response === "boolean" ? response : null}
          onChange={(val) => onResponseChange(val)}
          questionId={question.id}
        />
      );

    case "text":
      return (
        <Textarea
          value={typeof response === "string" ? response : ""}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Type your answer here..."
          className="resize-none"
          rows={3}
          data-testid={`text-input-${question.id}`}
        />
      );

    case "testimonial":
      return (
        <div className="space-y-3">
          <Textarea
            value={typeof response === "string" ? response : ""}
            onChange={(e) => onResponseChange(e.target.value)}
            placeholder="Share your experience..."
            className="resize-none"
            rows={4}
            data-testid={`testimonial-input-${question.id}`}
          />
          {question.consent && (
            <div className="flex items-start gap-2">
              <Checkbox
                id={`consent-${question.id}`}
                data-testid={`consent-checkbox-${question.id}`}
              />
              <Label
                htmlFor={`consent-${question.id}`}
                className="text-sm text-muted-foreground leading-snug cursor-pointer"
              >
                I consent to Reserve Tamaki using this testimonial in promotional materials
              </Label>
            </div>
          )}
        </div>
      );

    default:
      return (
        <Textarea
          value={typeof response === "string" ? response : ""}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Type your answer here..."
          className="resize-none"
          rows={3}
          data-testid={`default-input-${question.id}`}
        />
      );
  }
}

export default function PublicSurveyPage() {
  const [, params] = useRoute("/survey/:token");
  const token = params?.token || "";

  const [responses, setResponses] = useState<Record<number, string | number | boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: survey, isLoading, isError, error } = useQuery<SurveyWithFlag>({
    queryKey: ["/api/public/survey", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/survey/${token}`);
      if (res.status === 410) {
        return { expired: true } as any;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Survey not found" }));
        throw new Error(err.message || "Survey not found");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { responses: Array<{ questionId: number; answer: string | number | boolean }> }) => {
      const res = await fetch(`/api/public/survey/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Submission failed" }));
        throw new Error(err.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleResponseChange = (questionId: number, value: string | number | boolean) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (!survey?.questions) return;

    const formattedResponses = Object.entries(responses).map(([qId, answer]) => ({
      questionId: parseInt(qId),
      answer,
    }));

    submitMutation.mutate({ responses: formattedResponses });
  };

  const questions: SurveyQuestion[] = (survey?.questions as SurveyQuestion[]) || [];

  const requiredQuestions = questions.filter((q) => q.required);
  const allRequiredAnswered = requiredQuestions.every((q) => {
    const r = responses[q.id];
    if (r === undefined || r === null) return false;
    if (typeof r === "string" && r.trim() === "") return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  if (isError || !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="heading-error">Survey Not Found</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-error">
            {(error as Error)?.message || "This survey link may be incorrect or no longer active."}
          </p>
        </Card>
      </div>
    );
  }

  if ((survey as any).expired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="heading-expired">Survey Expired</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-expired">
            This survey has expired and is no longer accepting responses. Thank you for your interest.
          </p>
        </Card>
      </div>
    );
  }

  if (survey.alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-already-completed">Already Completed</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-already-completed">
            You've already submitted your feedback for this survey. Thank you!
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-thank-you">Thank You!</h2>
          <p className="text-sm text-muted-foreground mb-1" data-testid="text-thank-you">
            Your feedback has been submitted successfully.
          </p>
          <p className="text-sm text-muted-foreground" data-testid="text-thank-you-detail">
            We appreciate you taking the time to share your experience with Reserve Tamaki.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-survey-title">
            Venue Hire Feedback
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-survey-subtitle">
            Reserve Tamaki
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm text-muted-foreground" data-testid="text-survey-intro">
              We'd love to hear about your experience. Your feedback helps us improve our venue and services for the community.
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-2" data-testid={`question-block-${question.id}`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground shrink-0 mt-0.5">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground" data-testid={`question-text-${question.id}`}>
                      {question.question}
                      {question.required && <span className="text-destructive ml-0.5">*</span>}
                    </p>
                    {question.subtext && (
                      <p className="text-xs text-muted-foreground mt-0.5" data-testid={`question-subtext-${question.id}`}>
                        {question.subtext}
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-5">
                  <QuestionRenderer
                    question={question}
                    response={responses[question.id] ?? null}
                    onResponseChange={(val) => handleResponseChange(question.id, val)}
                  />
                </div>
              </div>
            ))}
          </div>

          {questions.length > 0 && (
            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!allRequiredAnswered || submitMutation.isPending}
                data-testid="button-submit-survey"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </div>
          )}

          {submitMutation.isError && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-submit-error">
              {(submitMutation.error as Error)?.message || "Failed to submit survey. Please try again."}
            </div>
          )}

          {questions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-questions">
              No questions have been configured for this survey.
            </div>
          )}
        </Card>

        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground" data-testid="text-footer">
            Reserve Tamaki - Community Venue
          </p>
        </div>
      </div>
    </div>
  );
}
