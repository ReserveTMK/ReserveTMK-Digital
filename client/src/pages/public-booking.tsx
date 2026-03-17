import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTimeSlot } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import {
  Loader2,
  Calendar,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Globe,
  Users,
  Coffee,
  Sprout,
  Lightbulb,
  Plus,
  X,
  Mail,
  MapPin,
  Navigation,
} from "lucide-react";

const GOAL_STAGE_OPTIONS = [
  { value: "just_an_idea", label: "Just an idea" },
  { value: "getting_started", label: "Getting started" },
  { value: "already_running", label: "Already running" },
];

const HELP_AREAS = [
  "Getting clear on my idea",
  "Business planning",
  "Marketing & branding",
  "Funding & sustainability",
  "Digital & online",
  "Confidence & leadership",
  "General support",
];

interface MeetingType {
  id: number;
  name: string;
  description: string | null;
  duration: number;
  focus: string | null;
  color: string | null;
  sortOrder: number | null;
  category?: string | null;
}

interface OnboardingQuestion {
  id: number;
  question: string;
  fieldType: string | null;
  options: string[] | null;
  isRequired: boolean | null;
  sortOrder: number | null;
}

type Pathway = "mentoring" | "meeting";
type StepId = "pathway" | "name" | "contact" | "goals" | "info" | "onboarding" | "mentor" | "type" | "date" | "details" | "confirmed";

interface MentorOption {
  id: number;
  name: string;
  mentorBookingId: string;
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getInitials(first?: string, last?: string) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "?";
}

function StepProgress({ currentStep, steps }: { currentStep: StepId; steps: { id: StepId; label: string }[] }) {
  const stepOrder = steps.map((s) => s.id);
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4" data-testid="step-progress">
      {steps.map((s, i) => {
        const isCompleted = currentIndex > i;
        const isCurrent = stepOrder[i] === currentStep;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-6 sm:w-8 h-px ${isCompleted ? "bg-primary" : "bg-border"}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${s.id}`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PublicBookingPage() {
  const [, params] = useRoute("/book/:userId");
  const userId = params?.userId || "";

  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [step, setStep] = useState<StepId>("pathway");
  const [isReturningMentee, setIsReturningMentee] = useState(false);
  const [menteeChecked, setMenteeChecked] = useState(false);
  const [nameChecked, setNameChecked] = useState(false);
  const [nameFound, setNameFound] = useState(false);
  const [emailMatchName, setEmailMatchName] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, any>>({});

  const [ventureDescription, setVentureDescription] = useState("");
  const [ventureStage, setVentureStage] = useState("");
  const [helpArea, setHelpArea] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [extraEmail, setExtraEmail] = useState("");
  const [selectedMentor, setSelectedMentor] = useState<MentorOption | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });
  const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | null>(null);
  const [bookingResult, setBookingResult] = useState<any>(null);

  const { data: mentorInfo, isError: mentorError, isLoading: mentorLoading } = useQuery({
    queryKey: ["/api/public/mentoring", userId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/info`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: mentorOptions } = useQuery<MentorOption[]>({
    queryKey: ["/api/public/mentoring", userId, "mentors"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/mentors`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const activeMentorId = selectedMentor?.mentorBookingId || userId;

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["/api/public/mentoring", activeMentorId, "availability", pathway],
    queryFn: async () => {
      const categoryParam = pathway ? `?category=${pathway}` : "";
      const res = await fetch(`/api/public/mentoring/${activeMentorId}/availability${categoryParam}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeMentorId && !!pathway,
  });

  const { data: meetingTypes, isLoading: meetingTypesLoading } = useQuery<MeetingType[]>({
    queryKey: ["/api/public/mentoring", activeMentorId, "meeting-types", pathway],
    queryFn: async () => {
      const categoryParam = pathway ? `?category=${pathway}` : "";
      const res = await fetch(`/api/public/mentoring/${activeMentorId}/meeting-types${categoryParam}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeMentorId && !!pathway,
  });

  const { data: onboardingQuestions } = useQuery<OnboardingQuestion[]>({
    queryKey: ["/api/public/mentoring", userId, "onboarding-questions"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/onboarding-questions`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId && pathway === "mentoring",
  });

  const [returningConfirmed, setReturningConfirmed] = useState(false);

  const checkByNameMutation = useMutation({
    mutationFn: async (checkName: string) => {
      const res = await fetch(`/api/public/mentoring/${userId}/check-mentee?name=${encodeURIComponent(checkName)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data: { isReturning: boolean; nameFound?: boolean; contactName?: string }) => {
      setNameChecked(true);
      if (data.isReturning) {
        setIsReturningMentee(true);
        setNameFound(true);
        if (data.contactName) setName(data.contactName);
      } else if (data.nameFound) {
        setNameFound(true);
        setStep("contact");
      } else {
        setNameFound(false);
        setStep("contact");
      }
    },
  });

  const checkByEmailMutation = useMutation({
    mutationFn: async (checkEmail: string) => {
      const res = await fetch(`/api/public/mentoring/${userId}/check-mentee?email=${encodeURIComponent(checkEmail)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data: { isReturning: boolean; contactName?: string; matchedByEmail?: boolean }) => {
      setMenteeChecked(true);
      if (data.matchedByEmail && data.contactName) {
        setEmailMatchName(data.contactName);
        if (data.isReturning) {
          setIsReturningMentee(true);
          setName(data.contactName);
          setStep(getReturningNextStep());
        }
      } else {
        setEmailMatchName(null);
      }
    },
  });

  const checkMenteeMutation = useMutation({
    mutationFn: async (checkEmail: string) => {
      const res = await fetch(`/api/public/mentoring/${userId}/check-mentee?email=${encodeURIComponent(checkEmail)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data: { isReturning: boolean; contactName?: string }) => {
      setIsReturningMentee(data.isReturning);
      setMenteeChecked(true);
      if (data.isReturning) {
        if (data.contactName) setName(data.contactName);
        setStep(getReturningNextStep());
      } else {
        if (onboardingQuestions && onboardingQuestions.length > 0) {
          setStep("onboarding");
        } else {
          const hasMeetingTypes = meetingTypes && meetingTypes.length > 0;
          setStep(hasMeetingTypes ? "type" : "date");
        }
      }
    },
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["/api/public/mentoring", activeMentorId, "slots", selectedDate, pathway, selectedMeetingType?.duration],
    queryFn: async () => {
      const categoryParam = pathway ? `&category=${pathway}` : "";
      const durationParam = selectedMeetingType?.duration ? `&duration=${selectedMeetingType.duration}` : "";
      const res = await fetch(`/api/public/mentoring/${activeMentorId}/slots?date=${selectedDate}${categoryParam}${durationParam}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId && !!selectedDate,
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/public/mentoring/${activeMentorId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Session booking failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setBookingResult(data);
      setStep("confirmed");
    },
  });

  const availableDays = useMemo(() => {
    if (!availability) return new Set<number>();
    return new Set((availability as any[]).map((a: any) => a.dayOfWeek));
  }, [availability]);

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(weekStart, i));
    }
    return dates;
  }, [weekStart]);

  const slotDuration = useMemo(() => {
    if (selectedMeetingType) return selectedMeetingType.duration;
    if (!availability || (availability as any[]).length === 0) return 30;
    return (availability as any[])[0].slotDuration || 30;
  }, [availability, selectedMeetingType]);

  const hasRealMeetingTypes = meetingTypes && meetingTypes.length > 0;
  const hasMeetingTypes = hasRealMeetingTypes || (pathway === "mentoring" && nameChecked);
  const hasMultipleMentors = mentorOptions && mentorOptions.length > 1;

  const isDiscoverySession = pathway === "mentoring" && !isReturningMentee && nameChecked;

  const discoveryMeetingType: MeetingType = {
    id: -1,
    name: "Discovery Session",
    description: "A get-to-know-you session to explore your idea and see how we can help",
    duration: 60,
    focus: null,
    color: "#22c55e",
    sortOrder: -1,
    category: "mentoring",
  };

  const returningQuickSession: MeetingType = {
    id: -2,
    name: "Quick Session",
    description: "A focused 30-minute check-in",
    duration: 30,
    focus: null,
    color: "#3b82f6",
    sortOrder: 0,
    category: "mentoring",
  };

  const returningStandardSession: MeetingType = {
    id: -3,
    name: "Standard Session",
    description: "A full 60-minute mentoring session",
    duration: 60,
    focus: null,
    color: "#8b5cf6",
    sortOrder: 1,
    category: "mentoring",
  };

  const displayMeetingTypes = useMemo(() => {
    if (pathway === "mentoring") {
      if (isDiscoverySession) {
        return [discoveryMeetingType];
      }
      if (isReturningMentee) {
        return [returningQuickSession, returningStandardSession];
      }
    }
    if (meetingTypes) {
      return [...meetingTypes];
    }
    return [];
  }, [meetingTypes, isDiscoverySession, isReturningMentee, pathway]);

  const currentSteps = useMemo((): { id: StepId; label: string }[] => {
    if (!pathway) return [];
    if (pathway === "mentoring") {
      const steps: { id: StepId; label: string }[] = [{ id: "name", label: "You" }];
      if (nameChecked && !isReturningMentee) {
        steps.push({ id: "contact", label: "Details" });
        steps.push({ id: "goals", label: "Goals" });
      }
      if (isReturningMentee && hasMultipleMentors) {
        steps.push({ id: "mentor", label: "Mentor" });
      }
      if (hasMeetingTypes) {
        steps.push({ id: "type", label: "Session" });
      }
      steps.push({ id: "date", label: "When" });
      return steps;
    }
    return [
      { id: "info", label: "You" },
      ...(hasMeetingTypes ? [{ id: "type" as StepId, label: "Session" }] : []),
      { id: "date", label: "When" },
    ];
  }, [pathway, isReturningMentee, nameChecked, hasMeetingTypes, hasMultipleMentors]);

  const getReturningNextStep = (): StepId => {
    if (hasMultipleMentors) return "mentor";
    if (hasMeetingTypes) return "type";
    return "date";
  };

  const handleSelectMentor = (mentor: MentorOption) => {
    setSelectedMentor(mentor);
    setSelectedDate("");
    setSelectedSlot("");
    setSelectedMeetingType(null);
    setStep(hasMeetingTypes ? "type" : "date");
  };

  const handleSelectPathway = (p: Pathway) => {
    setPathway(p);
    setSelectedMentor(null);
    setExtras([]);
    setExtraEmail("");
    setSelectedDate("");
    setSelectedSlot("");
    setSelectedMeetingType(null);
    setStep(p === "mentoring" ? "name" : "info");
  };

  const handleNameContinue = () => {
    if (!name.trim()) return;
    checkByNameMutation.mutate(name.trim());
  };

  const handleContactContinue = () => {
    if (email.trim() && !menteeChecked) {
      checkByEmailMutation.mutate(email.trim());
      return;
    }
    if (emailMatchName && !isReturningMentee) {
      setName(emailMatchName);
    }
    setStep("goals");
  };

  const handleGoalsContinue = () => {
    setStep("type");
  };

  const handleInfoContinue = () => {
    if (!name.trim()) return;
    if (pathway === "mentoring" && email.trim()) {
      checkMenteeMutation.mutate(email.trim());
    } else {
      if (pathway === "mentoring" && onboardingQuestions && onboardingQuestions.length > 0) {
        setStep("onboarding");
      } else {
        setStep(hasMeetingTypes ? "type" : "date");
      }
    }
  };

  const handleOnboardingContinue = () => {
    setStep(hasMeetingTypes ? "type" : "date");
  };

  const handleSelectMeetingType = (mt: MeetingType) => {
    setSelectedMeetingType(mt);
    setStep("date");
  };

  const handleBook = () => {
    if (!name.trim() || !selectedDate || !selectedSlot) return;
    const bookData: any = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      date: selectedDate,
      time: selectedSlot,
      duration: slotDuration,
      notes: notes.trim() || undefined,
      meetingTypeId: selectedMeetingType && selectedMeetingType.id > 0 ? selectedMeetingType.id : undefined,
      pathway: pathway,
      extras: extras.length > 0 ? extras : undefined,
    };
    if (pathway === "mentoring" && !isReturningMentee && onboardingAnswers && Object.keys(onboardingAnswers).length > 0) {
      bookData.onboardingAnswers = onboardingAnswers;
    }
    if (pathway === "mentoring" && !isReturningMentee && (ventureDescription || ventureStage || helpArea)) {
      bookData.discoveryGoals = {
        ventureDescription: ventureDescription.trim() || undefined,
        currentStage: ventureStage || undefined,
        whatNeedHelpWith: helpArea || undefined,
      };
    }
    bookMutation.mutate(bookData);
  };

  const handleBookAnother = () => {
    setSelectedDate("");
    setSelectedSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setSelectedMeetingType(null);
    setBookingResult(null);
    setPathway(null);
    setIsReturningMentee(false);
    setMenteeChecked(false);
    setNameChecked(false);
    setNameFound(false);
    setEmailMatchName(null);
    setReturningConfirmed(false);
    setOnboardingAnswers({});
    setVentureDescription("");
    setVentureStage("");
    setHelpArea("");
    setExtras([]);
    setExtraEmail("");
    setSelectedMentor(null);
    setStep("pathway");
  };

  const baseMentorName = mentorInfo ? `${mentorInfo.firstName || ""} ${mentorInfo.lastName || ""}`.trim() : "";
  const mentorName = selectedMentor ? selectedMentor.name : baseMentorName;
  const orgName = mentorInfo?.orgName || "ReserveTMK Digital";

  if (mentorError && !mentorLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="heading-not-found">We couldn't find that person</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-not-found">
            The booking link may be incorrect or no longer active. Please check with the person who shared it.
          </p>
        </Card>
      </div>
    );
  }

  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
              style={{ animation: "checkmarkPop 0.5s ease-out" }}
              data-testid="icon-confirmed-check"
            >
              <Check className="w-8 h-8 text-white" style={{ animation: "checkmarkDraw 0.4s ease-out 0.2s both" }} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1" data-testid="heading-confirmed">You're booked in!</h2>
          <p className="text-muted-foreground mb-6" data-testid="text-confirmed-subtitle">
            {isDiscoverySession
              ? `Your discovery session with ${mentorName || "them"} is confirmed`
              : `Your time with ${mentorName || "them"} is confirmed`
            }
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left">
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">
                {isDiscoverySession ? "Discovery Session" : pathway === "mentoring" ? "Mentoring" : "Meeting / Hui"}
              </span>
            </div>
            {selectedMeetingType && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Session</span>
                <span className="font-medium" data-testid="text-meeting-type-name">{selectedMeetingType.name}</span>
              </div>
            )}
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedSlot ? formatTimeSlot(selectedSlot) : ""}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{slotDuration} minutes</span>
            </div>
          </div>
          {mentorInfo?.location && (
            <div className="mt-5 p-3 bg-muted/30 rounded-lg text-left space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Where to find us
              </p>
              <p className="text-sm font-medium">{mentorInfo.location}</p>
              {mentorInfo?.venueDirections && Object.entries(mentorInfo.venueDirections).some(([_, v]) => v) && (
                <div className="space-y-1.5 pt-1 border-t border-border/50">
                  {Object.entries(mentorInfo.venueDirections as Record<string, string>)
                    .filter(([_, v]) => v)
                    .map(([key, value]) => (
                      <div key={key} className="flex items-start gap-1.5">
                        <Navigation className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{key}:</span> {value}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 p-3 bg-muted/30 rounded-lg text-left">
            <p className="text-xs font-semibold text-muted-foreground mb-1">What happens next</p>
            <p className="text-xs text-muted-foreground">
              {isDiscoverySession
                ? `This is a get-to-know-you session. ${mentorName || "Your mentor"} will learn about your goals and ideas, and together you'll map out how mentoring can support your journey.`
                : `${mentorName || "They"} will receive your booking and may reach out to confirm details. Keep an eye on your email or phone for any updates.`
              }
              {email ? " You'll receive a calendar invite shortly." : ""}
            </p>
          </div>
          <Button variant="outline" className="w-full mt-5" onClick={handleBookAnother} data-testid="button-book-another">
            Book another time
          </Button>
        </Card>
      </div>
    );
  }

  const headerTitle = () => {
    if (step === "pathway") return mentorName ? `Book a Time with ${mentorName}` : "Book a Time";
    if (pathway === "mentoring") {
      if (isDiscoverySession) return "Discovery Session";
      return "Mentoring Session";
    }
    return "Meeting / Hui";
  };

  const headerSubtitle = () => {
    if (step === "pathway") return "Nau mai, haere mai \u2014 how would you like to connect?";
    if (pathway === "mentoring") {
      if (isDiscoverySession) return "A get-to-know-you session to explore your goals";
      return "Work 1:1 with a mentor on your venture";
    }
    return "Book a catch-up or general meeting";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4">
      <style>{`
        @keyframes checkmarkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkmarkDraw {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .step-animate {
          animation: fadeSlideIn 0.25s ease-out;
        }
      `}</style>
      <Card className="w-full sm:max-w-lg sm:rounded-lg rounded-none border-0 sm:border min-h-screen sm:min-h-0 flex flex-col">
        <div className="p-5 sm:p-6 border-b">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" data-testid="text-org-name">
              {orgName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {mentorName && (
              <div
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0"
                data-testid="avatar-mentor"
              >
                {getInitials(mentorInfo?.firstName, mentorInfo?.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate" data-testid="heading-booking">
                {headerTitle()}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-greeting">
            {headerSubtitle()}
          </p>
        </div>

        {step !== "pathway" && (step as string) !== "confirmed" && currentSteps.length > 0 && (
          <StepProgress currentStep={step} steps={currentSteps} />
        )}

        <div className="flex-1">
          {step === "pathway" && (
            <div className="p-5 sm:p-6 step-animate">
              <h3 className="font-semibold text-sm mb-4" data-testid="heading-pathway-choice">What are you looking for?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSelectPathway("mentoring")}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center min-h-[140px]"
                  data-testid="button-pathway-mentoring"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Mentoring</h4>
                    <p className="text-xs text-muted-foreground mt-1">Work 1:1 with a mentor on your venture or goals</p>
                  </div>
                </button>
                <button
                  onClick={() => handleSelectPathway("meeting")}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center min-h-[140px]"
                  data-testid="button-pathway-meeting"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Coffee className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Meeting / Hui</h4>
                    <p className="text-xs text-muted-foreground mt-1">Book a catch-up, hui, or general meeting</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === "name" && pathway === "mentoring" && (
            <div className="p-5 sm:p-6 space-y-4 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => { setPathway(null); setStep("pathway"); setNameChecked(false); setNameFound(false); setIsReturningMentee(false); setReturningConfirmed(false); }}
                data-testid="button-back-to-pathway"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div>
                <h3 className="font-semibold text-sm" data-testid="heading-name">Kia ora! What's your name?</h3>
                <p className="text-xs text-muted-foreground mt-1">We'll check if you're already in our whanau</p>
              </div>
              <div className="space-y-2">
                <Label>Your Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameChecked(false); setNameFound(false); setIsReturningMentee(false); setReturningConfirmed(false); }}
                  placeholder="Full name"
                  data-testid="input-book-name"
                  autoFocus
                />
              </div>
              {nameChecked && isReturningMentee && !returningConfirmed && (
                <div className="bg-green-500/10 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3 step-animate">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">Welcome back, {name}!</p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">You're already one of our mentees. Book your next session below.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setReturningConfirmed(true);
                        setStep(getReturningNextStep());
                      }}
                      data-testid="button-confirm-returning"
                    >
                      That's me - book a session
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setIsReturningMentee(false);
                        setNameFound(true);
                        setStep("contact");
                      }}
                      data-testid="button-not-me"
                    >
                      That's not me
                    </Button>
                  </div>
                </div>
              )}
              {checkByNameMutation.isError && (
                <p className="text-sm text-red-500">Something went wrong. Please try again.</p>
              )}
            </div>
          )}

          {step === "contact" && pathway === "mentoring" && (
            <div className="p-5 sm:p-6 space-y-4 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => { setStep("name"); setNameChecked(false); setMenteeChecked(false); setEmailMatchName(null); }}
                data-testid="button-back-to-name"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              {nameFound && !isReturningMentee && (
                <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    We found someone with that name but they don't have an active mentoring relationship yet. Please add your contact details so we can set you up.
                  </p>
                </div>
              )}

              {!nameFound && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
                  <Sprout className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Welcome! Looks like you're new here</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add your details below and we'll book you a discovery session to get started</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setMenteeChecked(false); setEmailMatchName(null); }}
                    placeholder="your@email.com"
                    data-testid="input-book-email"
                  />
                  {emailMatchName && !isReturningMentee && (
                    <div className="bg-green-500/10 border border-green-200 dark:border-green-800 rounded-lg p-2.5 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-xs text-green-800 dark:text-green-300">
                        Found you! Is this you: <span className="font-semibold">{emailMatchName}</span>?
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+64..."
                    data-testid="input-book-phone"
                  />
                </div>
              </div>
              {checkByEmailMutation.isError && (
                <p className="text-sm text-red-500">Something went wrong checking your details.</p>
              )}
            </div>
          )}

          {step === "goals" && pathway === "mentoring" && (
            <div className="p-5 sm:p-6 space-y-4 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => setStep("contact")}
                data-testid="button-back-to-contact"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2" data-testid="heading-goals">
                  <Lightbulb className="w-4 h-4" /> Tell us about your goals
                </h3>
                <p className="text-xs text-muted-foreground mt-1">This helps us prepare for your discovery session</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tell us briefly about your idea or venture</Label>
                  <Textarea
                    value={ventureDescription}
                    onChange={(e) => setVentureDescription(e.target.value)}
                    rows={3}
                    placeholder="What are you working on or thinking about?"
                    data-testid="input-venture-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>What stage are you at?</Label>
                  <div className="flex gap-2">
                    {GOAL_STAGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`flex-1 px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                          ventureStage === opt.value
                            ? "bg-primary/10 text-primary border-primary"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                        onClick={() => setVentureStage(opt.value)}
                        data-testid={`stage-option-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>What would you most like help with?</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {HELP_AREAS.map(area => (
                      <button
                        key={area}
                        type="button"
                        className={`px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                          helpArea === area
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                        onClick={() => setHelpArea(helpArea === area ? "" : area)}
                        data-testid={`help-area-${area.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "info" && (
            <div className="p-5 sm:p-6 space-y-4 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => { setPathway(null); setStep("pathway"); }}
                data-testid="button-back-to-pathway"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <h3 className="font-semibold text-sm" data-testid="heading-info">Tell us about yourself</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Your Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" data-testid="input-book-name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" data-testid="input-book-email" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+64..." data-testid="input-book-phone" />
                </div>
                {pathway === "meeting" && (
                  <div className="space-y-2">
                    <Label>What's this about?</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Brief description of what you'd like to discuss..." data-testid="input-book-notes" />
                  </div>
                )}
              </div>
              {checkMenteeMutation.isError && (
                <p className="text-sm text-red-500">Something went wrong checking your details. Please try again.</p>
              )}
            </div>
          )}

          {step === "onboarding" && (
            <div className="p-5 sm:p-6 space-y-4 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => setStep("info")}
                data-testid="button-back-to-info"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div>
                <h3 className="font-semibold text-sm" data-testid="heading-onboarding">A few things before we start</h3>
                <p className="text-xs text-muted-foreground mt-1">This helps us match you with the right mentor and prepare for your first session</p>
              </div>
              <div className="space-y-4">
                {onboardingQuestions?.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label>{q.question} {q.isRequired ? "*" : ""}</Label>
                    {q.fieldType === "textarea" && (
                      <Textarea
                        value={onboardingAnswers[String(q.id)] || ""}
                        onChange={(e) => setOnboardingAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))}
                        rows={2}
                        data-testid={`input-onboarding-${q.id}`}
                      />
                    )}
                    {q.fieldType === "text" && (
                      <Input
                        value={onboardingAnswers[String(q.id)] || ""}
                        onChange={(e) => setOnboardingAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))}
                        data-testid={`input-onboarding-${q.id}`}
                      />
                    )}
                    {q.fieldType === "select" && q.options && (
                      <Select
                        value={onboardingAnswers[String(q.id)] || ""}
                        onValueChange={(v) => setOnboardingAnswers(prev => ({ ...prev, [String(q.id)]: v }))}
                      >
                        <SelectTrigger data-testid={`select-onboarding-${q.id}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {q.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {q.fieldType === "boolean" && (
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={onboardingAnswers[String(q.id)] === true}
                          onCheckedChange={(v) => setOnboardingAnswers(prev => ({ ...prev, [String(q.id)]: v }))}
                          data-testid={`switch-onboarding-${q.id}`}
                        />
                        <span className="text-sm text-muted-foreground">{onboardingAnswers[String(q.id)] ? "Yes" : "No"}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "mentor" && (
            <div className="p-5 sm:p-6 space-y-5 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => { setStep("name"); setNameChecked(false); }}
                data-testid="button-back-from-mentor"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Choose Your Mentor
              </h3>
              <div className="grid gap-3">
                {mentorOptions?.map((mentor) => (
                  <button
                    key={mentor.id}
                    onClick={() => handleSelectMentor(mentor)}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted min-h-[44px] ${
                      selectedMentor?.id === mentor.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    data-testid={`card-mentor-${mentor.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-sm" data-testid={`text-mentor-name-${mentor.id}`}>{mentor.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "type" && (
            <div className="p-5 sm:p-6 space-y-5 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => {
                  if (pathway === "mentoring" && isDiscoverySession) {
                    setStep("goals");
                  } else if (pathway === "mentoring" && isReturningMentee && hasMultipleMentors) {
                    setStep("mentor");
                  } else if (pathway === "mentoring" && isReturningMentee) {
                    setStep("name");
                    setNameChecked(false);
                  } else if (pathway === "mentoring" && !isReturningMentee && onboardingQuestions && onboardingQuestions.length > 0) {
                    setStep("onboarding");
                  } else {
                    setStep("info");
                  }
                }}
                data-testid="button-back-to-prev"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Select a Session Type
              </h3>
              {meetingTypesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {displayMeetingTypes.map((mt) => (
                    <button
                      key={mt.id}
                      onClick={() => handleSelectMeetingType(mt)}
                      className={`flex items-stretch rounded-md border text-left transition-colors hover:bg-muted min-h-[44px] ${mt.id === -1 ? "border-primary/30 bg-primary/5" : "border-border"}`}
                      data-testid={`card-meeting-type-${mt.id}`}
                    >
                      <div className="w-1.5 shrink-0 rounded-l-md" style={{ backgroundColor: mt.color || "#3b82f6" }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-sm flex items-center gap-1.5" data-testid={`text-meeting-type-name-${mt.id}`}>
                            {mt.id === -1 && <Sprout className="w-4 h-4 text-primary" />}
                            {mt.name}
                          </span>
                          <Badge variant="secondary" data-testid={`badge-duration-${mt.id}`}>{mt.duration} min</Badge>
                        </div>
                        {mt.description && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid={`text-meeting-type-desc-${mt.id}`}>{mt.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "date" && (
            <div className="p-5 sm:p-6 space-y-5 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => {
                  if (hasMeetingTypes) {
                    setStep("type");
                  } else if (pathway === "mentoring" && isReturningMentee && hasMultipleMentors) {
                    setStep("mentor");
                  } else if (pathway === "mentoring" && isReturningMentee) {
                    setStep("name");
                    setNameChecked(false);
                  } else if (pathway === "mentoring" && !isReturningMentee && onboardingQuestions && onboardingQuestions.length > 0) {
                    setStep("onboarding");
                  } else {
                    setStep("info");
                  }
                }}
                data-testid="button-back"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              {isDiscoverySession && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
                  <Sprout className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Choose a time for your discovery session. This is a relaxed get-to-know-you conversation (about {slotDuration} minutes).
                  </p>
                </div>
              )}

              {selectedMeetingType && !isDiscoverySession && (
                <div className="bg-muted/50 rounded-md p-3 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedMeetingType.color || "#3b82f6" }} />
                  <span className="font-medium">{selectedMeetingType.name}</span>
                  <span className="text-muted-foreground">{"\u00b7"} {selectedMeetingType.duration} min</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Select a Date
                  </h3>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} disabled={weekStart <= new Date()} data-testid="button-prev-week">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="button-next-week">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDates.map((d, i) => {
                    const dateStr = formatDate(d);
                    const jsDay = d.getDay();
                    const dow = jsDay === 0 ? 6 : jsDay - 1;
                    const isAvailable = availableDays.has(dow) && d >= new Date(new Date().toDateString());
                    const isSelected = selectedDate === dateStr;
                    return (
                      <button
                        key={i}
                        disabled={!isAvailable}
                        onClick={() => { setSelectedDate(dateStr); setSelectedSlot(""); }}
                        className={`flex flex-col items-center p-2 rounded-md text-sm transition-colors min-h-[44px] ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : isAvailable
                            ? "hover:bg-muted cursor-pointer"
                            : "opacity-30 cursor-not-allowed"
                        }`}
                        data-testid={`date-${dateStr}`}
                      >
                        <span className="text-[10px] font-medium">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow]}</span>
                        <span className="text-lg font-bold">{d.getDate()}</span>
                        <span className="text-[10px]">{d.toLocaleDateString("en-NZ", { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                  <Globe className="w-3 h-3" />
                  <span className="text-[11px]" data-testid="text-timezone">Times shown in NZ time</span>
                </div>
              </div>

              {selectedDate && (
                <div className="step-animate">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" /> Available Times
                  </h3>
                  {slotsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : !slotsData?.slots?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-times">No times available right now</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {(slotsData.slots as any[]).map((slot: any) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`p-2 rounded-md text-sm font-medium transition-colors border min-h-[44px] ${
                            selectedSlot === slot.time
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-muted border-border"
                          }`}
                          data-testid={`slot-${slot.time}`}
                        >
                          {formatTimeSlot(slot.time)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {availabilityLoading && (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
              )}
              {!availabilityLoading && availability && (availability as any[]).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-availability">
                  No times available right now {"\u2014"} get in touch directly
                </p>
              )}
            </div>
          )}

          {step === "details" && (
            <div className="p-5 sm:p-6 space-y-4 step-animate">
              <button
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                onClick={() => setStep("date")}
                data-testid="button-back"
              >
                <ChevronLeft className="w-4 h-4" /> Back to date selection
              </button>

              <div className="bg-muted/50 rounded-md p-3 text-sm">
                {selectedMeetingType && (
                  <div className="mb-1">
                    <span className="font-medium">{selectedMeetingType.name}</span>
                    {" \u00b7 "}
                  </div>
                )}
                <span className="font-medium">
                  {new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                {" at "}
                <span className="font-medium">{selectedSlot ? formatTimeSlot(selectedSlot) : ""}</span>
                {" \u00b7 "}
                <span className="text-muted-foreground">{slotDuration} min</span>
              </div>

              {pathway === "meeting" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Anything you'd like to discuss?</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any specific topics or questions..." data-testid="input-book-notes" />
                  </div>
                </div>
              )}

              {pathway === "mentoring" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>What would you like to work on? <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Tell us what you'd like to focus on in this session..."
                      data-testid="input-book-notes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Invite Others
                    </Label>
                    <p className="text-xs text-muted-foreground">Add email addresses for anyone else you'd like to join this session.</p>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={extraEmail}
                        onChange={(e) => setExtraEmail(e.target.value)}
                        placeholder="Email address"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = extraEmail.trim();
                            if (trimmed && trimmed.includes("@") && !extras.includes(trimmed)) {
                              setExtras([...extras, trimmed]);
                              setExtraEmail("");
                            }
                          }
                        }}
                        data-testid="input-extra-email"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        type="button"
                        disabled={!extraEmail.trim() || !extraEmail.includes("@")}
                        onClick={() => {
                          const trimmed = extraEmail.trim();
                          if (trimmed && trimmed.includes("@") && !extras.includes(trimmed)) {
                            setExtras([...extras, trimmed]);
                            setExtraEmail("");
                          }
                        }}
                        data-testid="button-add-extra"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {extras.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {extras.map((e, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 bg-muted/50 rounded-md px-3 py-1.5 text-sm">
                            <span className="truncate" data-testid={`text-extra-email-${i}`}>{e}</span>
                            <button
                              type="button"
                              onClick={() => setExtras(extras.filter((_, idx) => idx !== i))}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              data-testid={`button-remove-extra-${i}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bookMutation.isError && (
                <p className="text-sm text-red-500">{(bookMutation.error as any)?.message || "Something went wrong"}</p>
              )}
            </div>
          )}
        </div>

        {step === "name" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!name.trim() || checkByNameMutation.isPending}
              onClick={handleNameContinue}
              data-testid="button-continue-name"
            >
              {checkByNameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </div>
        )}

        {step === "contact" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!email.trim() || checkByEmailMutation.isPending}
              onClick={handleContactContinue}
              data-testid="button-continue-contact"
            >
              {checkByEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </div>
        )}

        {step === "goals" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              onClick={handleGoalsContinue}
              data-testid="button-continue-goals"
            >
              Find a Time
            </Button>
          </div>
        )}

        {step === "info" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!name.trim() || checkMenteeMutation.isPending}
              onClick={handleInfoContinue}
              data-testid="button-continue-info"
            >
              {checkMenteeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </div>
        )}

        {step === "onboarding" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              onClick={handleOnboardingContinue}
              data-testid="button-continue-onboarding"
            >
              Continue
            </Button>
          </div>
        )}

        {step === "date" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!selectedDate || !selectedSlot}
              onClick={() => {
                if (isDiscoverySession) {
                  handleBook();
                } else {
                  setStep("details");
                }
              }}
              data-testid="button-continue"
            >
              {isDiscoverySession ? (
                bookMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Booking...</> : "Book Discovery Session"
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        )}

        {step === "details" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!name.trim() || bookMutation.isPending || (pathway === "mentoring" && !notes.trim())}
              onClick={handleBook}
              data-testid="button-confirm-booking"
            >
              {bookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Booking
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
