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

type SurveyWithFlag = Survey & { alreadyCompleted?: boolean; googleReviewUrl?: string | null };

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
  googleReviewUrl,
}: {
  question: SurveyQuestion;
  response: string | number | boolean | null;
  onResponseChange: (val: string | number | boolean) => void;
  googleReviewUrl?: string | null;
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
          {googleReviewUrl && googleReviewUrl.startsWith("https://") && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">Had a great experience? We'd love a Google review too!</p>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                data-testid="link-google-review"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Leave a Google Review
              </a>
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
          {survey?.googleReviewUrl && survey.googleReviewUrl.startsWith("https://") && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">Enjoyed your experience? A Google review helps others find us!</p>
              <a
                href={survey.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                data-testid="link-google-review-thankyou"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity="0.8"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity="0.6"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity="0.7"/>
                </svg>
                Leave a Google Review
              </a>
            </div>
          )}
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
                    googleReviewUrl={question.type === "testimonial" ? survey?.googleReviewUrl : undefined}
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
