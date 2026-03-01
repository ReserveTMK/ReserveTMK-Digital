import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "lucide-react";

const FOCUS_OPTIONS = [
  "Venture Planning",
  "Brand & Identity",
  "Funding & Sustainability",
  "Digital & Content",
  "Skills & Capability",
  "Networking & Connections",
  "Goal Setting",
  "General Catch-up",
  "Other",
];

interface MeetingType {
  id: number;
  name: string;
  description: string | null;
  duration: number;
  focus: string | null;
  color: string | null;
  sortOrder: number | null;
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

type StepId = "type" | "date" | "details" | "confirmed";

function StepProgress({ currentStep, hasMeetingTypes }: { currentStep: StepId; hasMeetingTypes: boolean }) {
  const steps = hasMeetingTypes
    ? [
        { id: "type" as const, label: "What" },
        { id: "date" as const, label: "When" },
        { id: "details" as const, label: "Details" },
      ]
    : [
        { id: "date" as const, label: "When" },
        { id: "details" as const, label: "Details" },
      ];

  const stepOrder: StepId[] = steps.map((s) => s.id);
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4" data-testid="step-progress">
      {steps.map((s, i) => {
        const isCompleted = currentIndex > i;
        const isCurrent = stepOrder[i] === currentStep;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-6 sm:w-8 h-px ${isCompleted ? "bg-primary" : "bg-border"}`}
              />
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
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                }`}
              >
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

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<StepId>("type");
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | null>(null);

  const { data: mentorInfo, isError: mentorError, isLoading: mentorLoading } = useQuery({
    queryKey: ["/api/public/mentoring", userId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/info`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["/api/public/mentoring", userId, "availability"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/availability`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: meetingTypes, isLoading: meetingTypesLoading } = useQuery<MeetingType[]>({
    queryKey: ["/api/public/mentoring", userId, "meeting-types"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/meeting-types`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (meetingTypes && meetingTypes.length === 0 && step === "type") {
      setStep("date");
    }
  }, [meetingTypes, step]);

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["/api/public/mentoring", userId, "slots", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/slots?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId && !!selectedDate,
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/public/mentoring/${userId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Booking failed");
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

  const hasMeetingTypes = meetingTypes && meetingTypes.length > 0;

  const handleSelectMeetingType = (mt: MeetingType) => {
    setSelectedMeetingType(mt);
    setStep("date");
  };

  const handleBook = () => {
    if (!name.trim() || !selectedDate || !selectedSlot) return;
    bookMutation.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      date: selectedDate,
      time: selectedSlot,
      duration: slotDuration,
      focus: focus || undefined,
      notes: notes.trim() || undefined,
      meetingTypeId: selectedMeetingType?.id || undefined,
    });
  };

  const handleBookAnother = () => {
    setSelectedDate("");
    setSelectedSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setFocus("");
    setNotes("");
    setSelectedMeetingType(null);
    setBookingResult(null);
    setStep(hasMeetingTypes ? "type" : "date");
  };

  const mentorName = mentorInfo ? `${mentorInfo.firstName || ""} ${mentorInfo.lastName || ""}`.trim() : "";
  const orgName = mentorInfo?.orgName || "ReserveTMK";

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
            Your time with {mentorName || "them"} is confirmed
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left">
            {selectedMeetingType && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Session Type</span>
                <span className="font-medium" data-testid="text-meeting-type-name">{selectedMeetingType.name}</span>
              </div>
            )}
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedSlot}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{slotDuration} minutes</span>
            </div>
            {focus && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Focus</span>
                <span className="font-medium">{focus}</span>
              </div>
            )}
          </div>
          <div className="mt-5 p-3 bg-muted/30 rounded-lg text-left">
            <p className="text-xs font-semibold text-muted-foreground mb-1">What happens next</p>
            <p className="text-xs text-muted-foreground">
              {mentorName || "They"} will receive your booking and may reach out to confirm details. Keep an eye on your email or phone for any updates.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full mt-5"
            onClick={handleBookAnother}
            data-testid="button-book-another"
          >
            Book another time
          </Button>
        </Card>
      </div>
    );
  }

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
                {mentorName ? `Book a Time with ${mentorName}` : "Book a Time"}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-greeting">
            Nau mai, haere mai — let's book a time to connect
          </p>
          <p className="text-xs text-muted-foreground mt-1" data-testid="text-subtitle">
            Pick a time that works — whether it's a catch-up, a hui, or anything in between
          </p>
        </div>

        <StepProgress currentStep={step} hasMeetingTypes={!!hasMeetingTypes} />

        <div className="flex-1">
          {step === "type" && (
            <div className="p-5 sm:p-6 space-y-5 step-animate">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Select a Session Type
              </h3>
              {meetingTypesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {meetingTypes?.map((mt) => (
                    <button
                      key={mt.id}
                      onClick={() => handleSelectMeetingType(mt)}
                      className="flex items-stretch rounded-md border border-border text-left transition-colors hover-elevate min-h-[44px]"
                      data-testid={`card-meeting-type-${mt.id}`}
                    >
                      <div
                        className="w-1.5 shrink-0 rounded-l-md"
                        style={{ backgroundColor: mt.color || "#3b82f6" }}
                      />
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-sm" data-testid={`text-meeting-type-name-${mt.id}`}>
                            {mt.name}
                          </span>
                          <Badge variant="secondary" data-testid={`badge-duration-${mt.id}`}>
                            {mt.duration} min
                          </Badge>
                        </div>
                        {mt.description && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid={`text-meeting-type-desc-${mt.id}`}>
                            {mt.description}
                          </p>
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
              {hasMeetingTypes && (
                <button
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px]"
                  onClick={() => setStep("type")}
                  data-testid="button-back-to-type"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to session types
                </button>
              )}

              {selectedMeetingType && (
                <div className="bg-muted/50 rounded-md p-3 text-sm flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: selectedMeetingType.color || "#3b82f6" }}
                  />
                  <span className="font-medium">{selectedMeetingType.name}</span>
                  <span className="text-muted-foreground">· {selectedMeetingType.duration} min</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Select a Date
                  </h3>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setWeekStart(addDays(weekStart, -7))}
                      disabled={weekStart <= new Date()}
                      data-testid="button-prev-week"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setWeekStart(addDays(weekStart, 7))}
                      data-testid="button-next-week"
                    >
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
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setSelectedSlot("");
                        }}
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
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : !slotsData?.slots?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-times">
                      No times available right now
                    </p>
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
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {availabilityLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
              {!availabilityLoading && availability && (availability as any[]).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-availability">
                  No times available right now — get in touch directly
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
                    {" · "}
                  </div>
                )}
                <span className="font-medium">
                  {new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                {" at "}
                <span className="font-medium">{selectedSlot}</span>
                {" · "}
                <span className="text-muted-foreground">{slotDuration} min</span>
              </div>

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
                <div className="space-y-2">
                  <Label>What would you like to discuss?</Label>
                  <Select value={focus} onValueChange={setFocus}>
                    <SelectTrigger data-testid="select-book-focus">
                      <SelectValue placeholder="Select a topic..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FOCUS_OPTIONS.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Any additional notes?</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Tell us a bit about yourself or what you'd like help with..." data-testid="input-book-notes" />
                </div>
              </div>

              {bookMutation.isError && (
                <p className="text-sm text-red-500">{(bookMutation.error as any)?.message || "Something went wrong"}</p>
              )}
            </div>
          )}
        </div>

        {step === "date" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!selectedDate || !selectedSlot}
              onClick={() => setStep("details")}
              data-testid="button-continue"
            >
              Continue
            </Button>
          </div>
        )}

        {step === "details" && (
          <div className="sticky bottom-0 z-10 p-4 border-t bg-background sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-6 sm:pt-0">
            <Button
              className="w-full"
              disabled={!name.trim() || bookMutation.isPending}
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
