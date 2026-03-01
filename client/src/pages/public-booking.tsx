import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import {
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
  const [step, setStep] = useState<"date" | "details" | "confirmed">("date");
  const [bookingResult, setBookingResult] = useState<any>(null);

  const { data: mentorInfo } = useQuery({
    queryKey: ["/api/public/mentoring", userId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/info`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: availability } = useQuery({
    queryKey: ["/api/public/mentoring", userId, "availability"],
    queryFn: async () => {
      const res = await fetch(`/api/public/mentoring/${userId}/availability`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
  });

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
    if (!availability || (availability as any[]).length === 0) return 30;
    return (availability as any[])[0].slotDuration || 30;
  }, [availability]);

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
    });
  };

  const mentorName = mentorInfo ? `${mentorInfo.firstName || ""} ${mentorInfo.lastName || ""}`.trim() : "Mentor";

  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold mb-2" data-testid="heading-confirmed">Session Booked!</h2>
          <p className="text-muted-foreground mb-6">Your mentoring session with {mentorName} has been scheduled.</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedSlot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{slotDuration} minutes</span>
            </div>
            {focus && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Focus</span>
                <span className="font-medium">{focus}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">You'll receive confirmation from {mentorName} shortly.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold" data-testid="heading-booking">Book a Session</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule a mentoring session with {mentorName}
          </p>
        </div>

        {step === "date" && (
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Select a Date
                </h3>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setWeekStart(addDays(weekStart, -7))}
                    disabled={weekStart <= new Date()}
                    data-testid="button-prev-week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
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
                      className={`flex flex-col items-center p-2 rounded-lg text-sm transition-colors ${
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
            </div>

            {selectedDate && (
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4" /> Available Times
                </h3>
                {slotsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : !slotsData?.slots?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No available slots for this date</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {(slotsData.slots as any[]).map((slot: any) => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`p-2 rounded-lg text-sm font-medium transition-colors border ${
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
          <div className="p-6 space-y-4">
            <button
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setStep("date")}
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4" /> Back to date selection
            </button>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
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
