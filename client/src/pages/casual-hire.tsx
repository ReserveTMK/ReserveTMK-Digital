import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatTimeSlot } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  Building2,
  Users,
  DollarSign,
  ArrowRight,
} from "lucide-react";

const PRESET_SLOTS = [
  { label: "Morning", sublabel: "8am - 12pm", start: "08:00", end: "12:00", duration: "half_day" },
  { label: "Afternoon", sublabel: "1pm - 5pm", start: "13:00", end: "17:00", duration: "half_day" },
  { label: "Full Day", sublabel: "8am - 5pm", start: "08:00", end: "17:00", duration: "full_day" },
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - startDay + 1;
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    cells.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
  }
  return cells;
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

type Step = "space" | "datetime" | "details" | "review" | "confirmed";

export default function CasualHirePage() {
  const [step, setStep] = useState<Step>("space");

  // Space selection
  const [selectedVenues, setSelectedVenues] = useState<number[]>([]);
  const [spaceSelection, setSpaceSelection] = useState<"single" | "both">("single");

  // Date/time
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("12:00");

  // Contact details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [bookingPurpose, setBookingPurpose] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");

  // Queries
  const { data: venues, isLoading: venuesLoading } = useQuery<any[]>({
    queryKey: ["/api/public/casual-hire/venues"],
    queryFn: async () => {
      const res = await fetch("/api/public/casual-hire/venues");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: orgInfo } = useQuery<{ name: string; location: string | null }>({
    queryKey: ["/api/public/casual-hire/org-info"],
    queryFn: async () => {
      const res = await fetch("/api/public/casual-hire/org-info");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: pricing } = useQuery<{ hourlyRate: string; halfDayRate: string; fullDayRate: string; communityDiscount: number }>({
    queryKey: ["/api/public/casual-hire/pricing"],
    queryFn: async () => {
      const res = await fetch("/api/public/casual-hire/pricing");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const venueIds = useMemo(() => selectedVenues, [selectedVenues]);

  const { data: allVenueAvailability, isLoading: availLoading } = useQuery<Record<number, { dates: Record<string, { status: string; bookings: any[] }> }>>({
    queryKey: ["/api/public/casual-hire/availability", monthStr, venueIds],
    queryFn: async () => {
      const results: Record<number, { dates: Record<string, { status: string; bookings: any[] }> }> = {};
      await Promise.all(venueIds.map(async (vid) => {
        const res = await fetch(`/api/public/casual-hire/availability?venueId=${vid}&month=${monthStr}`);
        if (res.ok) results[vid] = await res.json();
      }));
      return results;
    },
    enabled: venueIds.length > 0 && step === "datetime",
  });

  const mergedAvailability = useMemo(() => {
    if (!allVenueAvailability) return undefined;
    const merged: Record<string, { status: string }> = {};
    for (const venueData of Object.values(allVenueAvailability)) {
      for (const [dateStr, info] of Object.entries(venueData.dates)) {
        if (!merged[dateStr]) {
          merged[dateStr] = { status: info.status };
        } else {
          const current = merged[dateStr].status;
          if (info.status === "available" || current === "available") {
            merged[dateStr].status = "available";
          } else if (info.status === "partial" || current === "partial") {
            merged[dateStr].status = "partial";
          }
        }
      }
    }
    return merged;
  }, [allVenueAvailability]);

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/public/casual-hire/book", data);
      return res.json();
    },
    onSuccess: () => setStep("confirmed"),
  });

  // Computed
  const days = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth]);
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const maxAdvanceMonths = 3;
  const maxBookingDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + maxAdvanceMonths);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const startTime = selectedSlot && selectedSlot !== "custom"
    ? PRESET_SLOTS.find(s => s.label === selectedSlot)?.start || customStart
    : customStart;
  const endTime = selectedSlot && selectedSlot !== "custom"
    ? PRESET_SLOTS.find(s => s.label === selectedSlot)?.end || customEnd
    : customEnd;

  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const durationHours = Math.max(0, (endMin - startMin) / 60);

  const getDurationType = () => {
    if (durationHours >= 8) return "full_day";
    if (durationHours >= 4) return "half_day";
    return "hourly";
  };

  const getPrice = () => {
    if (!pricing) return 0;
    const dt = getDurationType();
    if (dt === "full_day") return parseFloat(pricing.fullDayRate);
    if (dt === "half_day") return parseFloat(pricing.halfDayRate);
    return parseFloat(pricing.hourlyRate) * durationHours;
  };

  const estimatedPrice = getPrice();
  const gstAmount = estimatedPrice * 0.15;
  const totalInclGst = estimatedPrice + gstAmount;

  const selectedVenueNames = useMemo(() => {
    if (!venues) return [];
    return selectedVenues.map(id => venues.find((v: any) => v.id === id)?.name).filter(Boolean);
  }, [venues, selectedVenues]);

  const getDateColorClass = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "booked": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "partial": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default: return "";
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
    setSelectedDate(null);
  };

  const handleSpaceNext = () => {
    if (selectedVenues.length === 0) return;
    setStep("datetime");
  };

  const handleDateTimeNext = () => {
    if (!selectedDate || !selectedSlot) return;
    if (selectedSlot === "custom" && endMin <= startMin) return;
    setStep("details");
  };

  const handleDetailsNext = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !bookingPurpose.trim()) return;
    setStep("review");
  };

  const handleSubmit = () => {
    bookMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      organisation: organisation.trim() || undefined,
      venueId: selectedVenues[0],
      venueIds: selectedVenues,
      startDate: selectedDate,
      startTime,
      endTime,
      classification: "Venue Hire",
      bookingSummary: bookingPurpose.trim(),
      attendeeCount: attendeeCount ? parseInt(attendeeCount) : undefined,
      notes: specialRequirements.trim() || undefined,
    });
  };

  const resetForm = () => {
    setStep("space");
    setSelectedVenues([]);
    setSpaceSelection("single");
    setSelectedDate(null);
    setSelectedSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setOrganisation("");
    setBookingPurpose("");
    setSpecialRequirements("");
    setAttendeeCount("");
  };

  // Step indicator
  const steps: { key: Step; label: string }[] = [
    { key: "space", label: "Space" },
    { key: "datetime", label: "Date & Time" },
    { key: "details", label: "Details" },
    { key: "review", label: "Review" },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  // ─── CONFIRMED ───
  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Enquiry Submitted</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Thanks {name.split(" ")[0]}! We'll review your request and get back to you at {email} within 24 hours.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left mb-4">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Space</span>
              <span className="font-medium">{selectedVenueNames.join(" + ") || "Selected space"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {selectedDate ? new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" }) : ""}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{formatTimeSlot(startTime)} - {formatTimeSlot(endTime)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Estimated cost</span>
              <span className="font-medium">${totalInclGst.toFixed(2)} incl. GST</span>
            </div>
          </div>
          <Button className="w-full" onClick={resetForm}>Submit Another Enquiry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {orgInfo?.name || "Reserve Tamaki"}
          </p>
          <h1 className="text-2xl font-bold">Book a Space</h1>
          <p className="text-sm text-muted-foreground">
            Pick a space, pick a time, we'll sort the rest.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                i < stepIndex ? "bg-primary text-primary-foreground" :
                i === stepIndex ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ─── STEP 1: SPACE ─── */}
        {step === "space" && (
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Which space do you need?</h2>

            {venuesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !venues || venues.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No spaces are currently available for casual hire.</p>
            ) : (
              <>
                <RadioGroup
                  value={selectedVenues.length > 1 ? "both" : selectedVenues.length === 1 ? String(selectedVenues[0]) : ""}
                  onValueChange={(val) => {
                    if (val === "both") {
                      setSpaceSelection("both");
                      setSelectedVenues(venues!.map((v: any) => v.id));
                    } else {
                      setSpaceSelection("single");
                      setSelectedVenues([parseInt(val)]);
                    }
                  }}
                  className="space-y-3"
                >
                  {venues.map((v: any) => (
                    <label
                      key={v.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedVenues.length === 1 && selectedVenues[0] === v.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value={String(v.id)} className="mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{v.name}</p>
                        {v.capacity && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <Users className="w-3 h-3 inline mr-1" />Up to {v.capacity} people
                          </p>
                        )}
                        {v.description && (
                          <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                        )}
                      </div>
                    </label>
                  ))}

                  {venues.length > 1 && (
                    <label
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedVenues.length > 1
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="both" className="mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">Both spaces</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Same price as a single space</p>
                      </div>
                    </label>
                  )}
                </RadioGroup>

                {/* Pricing card */}
                {pricing && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Pricing (excl. GST)
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <p className="font-semibold">${pricing.hourlyRate}/hr</p>
                        <p className="text-xs text-muted-foreground">Hourly</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">${pricing.halfDayRate}</p>
                        <p className="text-xs text-muted-foreground">Half day (4hrs)</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">${pricing.fullDayRate}</p>
                        <p className="text-xs text-muted-foreground">Full day (8hrs)</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      Community discounts available for local groups and not-for-profits
                    </p>
                  </div>
                )}
              </>
            )}

            <Button
              className="w-full"
              disabled={selectedVenues.length === 0}
              onClick={handleSpaceNext}
            >
              Next: Pick a date
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* ─── STEP 2: DATE & TIME ─── */}
        {step === "datetime" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep("space")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div>
                <h2 className="font-semibold">When do you need it?</h2>
                <p className="text-xs text-muted-foreground">{selectedVenueNames.join(" + ")}</p>
              </div>
            </div>

            {/* Calendar */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-medium text-sm">{monthName}</h3>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {availLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {days.map((cell, i) => {
                    const status = cell.inMonth ? mergedAvailability?.[cell.date]?.status || "available" : "";
                    const isPast = cell.inMonth && new Date(cell.date + "T23:59:59") < new Date();
                    const isBeyondMax = cell.inMonth && new Date(cell.date + "T00:00:00") > maxBookingDate;
                    const isClickable = cell.inMonth && !isPast && !isBeyondMax && status !== "booked";
                    const isSelected = cell.date === selectedDate;

                    return (
                      <button
                        key={i}
                        disabled={!isClickable}
                        onClick={() => isClickable ? setSelectedDate(cell.date) : undefined}
                        className={`
                          aspect-square flex items-center justify-center text-sm rounded-md transition-colors
                          ${!cell.inMonth ? "text-muted-foreground/30" : ""}
                          ${(isPast || isBeyondMax) && cell.inMonth ? "text-muted-foreground/40" : ""}
                          ${cell.inMonth && !isPast && !isBeyondMax ? getDateColorClass(status) : ""}
                          ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                          ${isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}
                        `}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/50" />
                  <span className="text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-orange-200 dark:bg-orange-900/50" />
                  <span className="text-muted-foreground">Partial</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/50" />
                  <span className="text-muted-foreground">Booked</span>
                </div>
              </div>
            </div>

            {/* Time selection */}
            {selectedDate && (
              <div className="space-y-3 pt-2 border-t">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  {PRESET_SLOTS.map((slot) => (
                    <button
                      key={slot.label}
                      onClick={() => setSelectedSlot(slot.label)}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        selectedSlot === slot.label
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="text-sm font-medium">{slot.label}</p>
                      <p className="text-xs text-muted-foreground">{slot.sublabel}</p>
                      {pricing && (
                        <p className="text-xs font-semibold mt-1">
                          ${slot.duration === "full_day" ? pricing.fullDayRate : pricing.halfDayRate}
                        </p>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedSlot("custom")}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedSlot === "custom"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="text-sm font-medium">Custom time</p>
                  <p className="text-xs text-muted-foreground">Choose your own start and end time</p>
                </button>

                {selectedSlot === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Start time</Label>
                      <Input
                        type="time"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End time</Label>
                      <Input
                        type="time"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                      />
                    </div>
                    {durationHours > 0 && pricing && (
                      <div className="col-span-2 text-sm text-muted-foreground">
                        {durationHours} hours = <span className="font-medium text-foreground">${estimatedPrice.toFixed(0)} + GST</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selectedDate || !selectedSlot || (selectedSlot === "custom" && endMin <= startMin)}
              onClick={handleDateTimeNext}
            >
              Next: Your details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* ─── STEP 3: DETAILS ─── */}
        {step === "details" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep("datetime")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-semibold">Your details</h2>
            </div>

            {/* Booking summary bar */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{selectedVenueNames.join(" + ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {selectedDate ? new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" }) : ""}
                  {" "}{formatTimeSlot(startTime)} - {formatTimeSlot(endTime)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span>${estimatedPrice.toFixed(0)} + GST</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-name" className="text-sm">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-email" className="text-sm">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-phone" className="text-sm">
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="021 123 4567"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-org" className="text-sm">
                Organisation <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ch-org"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="Company or group name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-purpose" className="text-sm">
                What's the booking for? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="ch-purpose"
                value={bookingPurpose}
                onChange={(e) => setBookingPurpose(e.target.value)}
                placeholder="e.g. Team workshop, community meeting, training session"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-attendees" className="text-sm">
                Expected attendees <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ch-attendees"
                type="number"
                value={attendeeCount}
                onChange={(e) => setAttendeeCount(e.target.value)}
                placeholder="Number of people"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ch-requirements" className="text-sm">
                Anything else we should know? <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="ch-requirements"
                value={specialRequirements}
                onChange={(e) => setSpecialRequirements(e.target.value)}
                placeholder="Special requirements, access needs, setup requests"
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              disabled={!name.trim() || !email.trim() || !phone.trim() || !bookingPurpose.trim()}
              onClick={handleDetailsNext}
            >
              Review your booking
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* ─── STEP 4: REVIEW ─── */}
        {step === "review" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep("details")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-semibold">Review your enquiry</h2>
            </div>

            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <h3 className="font-medium">Booking</h3>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Space</span>
                    <span className="font-medium text-right">{selectedVenueNames.join(" + ")}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {selectedDate ? new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" }) : ""}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{formatTimeSlot(startTime)} - {formatTimeSlot(endTime)} ({durationHours}hrs)</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Purpose</span>
                    <span className="font-medium text-right max-w-[60%]">{bookingPurpose}</span>
                  </div>
                  {attendeeCount && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Attendees</span>
                      <span className="font-medium">{attendeeCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <h3 className="font-medium">Your details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{email}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{phone}</span>
                  </div>
                  {organisation && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Organisation</span>
                      <span className="font-medium">{organisation}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <h3 className="font-medium">Estimated cost</h3>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{getDurationType().replace("_", " ")} rate</span>
                  <span>${estimatedPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">GST (15%)</span>
                  <span>${gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t font-semibold">
                  <span>Total (incl. GST)</span>
                  <span>${totalInclGst.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Community discounts available. Let us know if you're a local community group or not-for-profit.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              This is an enquiry, not a confirmed booking. We'll review your request and confirm within 24 hours.
            </p>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={bookMutation.isPending}
            >
              {bookMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Enquiry"
              )}
            </Button>

            {bookMutation.isError && (
              <p className="text-sm text-red-600 text-center">
                {(bookMutation.error as any)?.message || "Something went wrong. Please try again."}
              </p>
            )}
          </Card>
        )}

        {/* Location info */}
        {orgInfo?.location && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>{orgInfo.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
