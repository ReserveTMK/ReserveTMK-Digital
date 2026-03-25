import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatTimeSlot } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  Info,
  Users,
} from "lucide-react";

const CLASSIFICATIONS = ["Meeting", "Workshop", "Rangatahi / Youth Workshop"];

const PRESET_SLOTS = [
  { label: "Morning (8am-12pm)", start: "08:00", end: "12:00" },
  { label: "Afternoon (1pm-5pm)", start: "13:00", end: "17:00" },
  { label: "Full Day (8am-5pm)", start: "08:00", end: "17:00" },
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

type Step = "contact" | "booking" | "confirmed";

export default function CasualHirePage() {
  const [step, setStep] = useState<Step>("contact");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [showInvoiceEmail, setShowInvoiceEmail] = useState(false);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedVenues, setSelectedVenues] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [presetSlot, setPresetSlot] = useState<string>("");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("12:00");
  const [classification, setClassification] = useState("");
  const [bookingSummary, setBookingSummary] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [bookingSummaryError, setBookingSummaryError] = useState(false);

  // Venue grouping state
  const [lockedSpaceType, setLockedSpaceType] = useState<string | null>(null);

  // Studio check step state
  type StudioStep = "idle" | "questions-new" | "questions-returning" | "done";
  const [studioStep, setStudioStep] = useState<StudioStep>("idle");

  // New-booker studio kaupapa questions
  const [studioPodName, setStudioPodName] = useState("");
  const [studioIG, setStudioIG] = useState("");
  const [studioYT, setStudioYT] = useState("");
  const [studioNewHost, setStudioNewHost] = useState("");
  const [studioAbout, setStudioAbout] = useState("");
  const [studioWhy, setStudioWhy] = useState("");
  const [studioGoals, setStudioGoals] = useState("");

  // Returning-booker studio check-in questions
  const [studioLastRating, setStudioLastRating] = useState<number>(3);
  const [studioEpisodeStatus, setStudioEpisodeStatus] = useState<string>("");
  const [studioThisSession, setStudioThisSession] = useState("");
  const [studioHost, setStudioHost] = useState("");
  const [studioGuest1, setStudioGuest1] = useState("");
  const [studioGuest2, setStudioGuest2] = useState("");
  const [studioEditor, setStudioEditor] = useState("");

  // Studio answers compiled into notes + isFirstBooking flag
  const [studioNotes, setStudioNotes] = useState("");
  const [studioIsFirstBooking, setStudioIsFirstBooking] = useState(false);

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

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const venueIds = useMemo(() => (venues || []).map((v: any) => v.id as number), [venues]);

  const { data: allVenueAvailability, isLoading: availLoading } = useQuery<Record<number, { dates: Record<string, { status: string; bookings: any[] }> }>>({
    queryKey: ["/api/public/casual-hire/availability", monthStr, venueIds],
    queryFn: async () => {
      const results: Record<number, { dates: Record<string, { status: string; bookings: any[] }> }> = {};
      await Promise.all(venueIds.map(async (vid) => {
        const res = await fetch(`/api/public/casual-hire/availability?venueId=${vid}&month=${monthStr}`);
        if (res.ok) {
          results[vid] = await res.json();
        }
      }));
      return results;
    },
    enabled: venueIds.length > 0 && step === "booking",
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

  const { getVenueStatusForDate, getVenueBookingsForDate } = useMemo(() => ({
    getVenueStatusForDate: (venueId: number, date: string) => {
      return allVenueAvailability?.[venueId]?.dates?.[date]?.status || "available";
    },
    getVenueBookingsForDate: (venueId: number, date: string) => {
      return allVenueAvailability?.[venueId]?.dates?.[date]?.bookings || [];
    },
  }), [allVenueAvailability]);

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/public/casual-hire/book", data);
      return res.json();
    },
    onSuccess: () => {
      setStep("confirmed");
    },
  });

  const allSelectedAreStudio = useMemo(
    () => selectedVenues.length > 0 && selectedVenues.every(id => venues?.find((v: any) => v.id === id)?.spaceName === "Podcast Studio"),
    [selectedVenues, venues]
  );

  const studioCheckUserId = useMemo(() => venues && venues.length > 0 ? String((venues[0] as any).userId || "") : "", [venues]);

  const { data: studioBookerCheck } = useQuery<{ isReturning: boolean; bookingCount: number }>({
    queryKey: ["/api/public/spaces/check-studio-booker", email, studioCheckUserId],
    queryFn: async () => {
      const params = new URLSearchParams({ email: email.trim(), userId: studioCheckUserId });
      const res = await fetch(`/api/public/spaces/check-studio-booker?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: allSelectedAreStudio && !!email.trim() && !!studioCheckUserId && studioStep === "idle",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!allSelectedAreStudio) {
      setStudioStep("idle");
      setStudioNotes("");
      setStudioIsFirstBooking(false);
      setStudioProduce("");
      setStudioUsedBefore(null);
      setStudioNeedsHelp(null);
      setStudioGear("");
      setStudioOther("");
      setStudioRecording("");
      setStudioSetupChanges(null);
      setStudioSetupDetails("");
      return;
    }
    if (!studioBookerCheck || studioStep !== "idle") return;
    if (studioBookerCheck.isReturning) {
      setStudioStep("questions-returning");
    } else {
      setStudioStep("questions-new");
    }
  }, [allSelectedAreStudio, studioBookerCheck]);

  const days = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth]);
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });

  const maxAdvanceMonths = 3;
  const maxBookingDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + maxAdvanceMonths);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
    setSelectedDate(null);
    setSelectedVenues([]);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
    setSelectedDate(null);
    setSelectedVenues([]);
  };

  const startTime = presetSlot ? PRESET_SLOTS.find(s => s.label === presetSlot)?.start || customStart : customStart;
  const endTime = presetSlot ? PRESET_SLOTS.find(s => s.label === presetSlot)?.end || customEnd : customEnd;

  const toggleVenue = (venueId: number) => {
    const venue = venues?.find((v: any) => v.id === venueId);
    const venueSN = venue?.spaceName || null;
    setSelectedVenues(prev => {
      if (prev.includes(venueId)) {
        const next = prev.filter(id => id !== venueId);
        if (next.length === 0) setLockedSpaceType(null);
        else {
          const types = new Set(next.map(id => venues?.find((v: any) => v.id === id)?.spaceName).filter(Boolean));
          setLockedSpaceType(types.size === 1 ? [...types][0] as string : null);
        }
        return next;
      } else {
        if (lockedSpaceType && venueSN && venueSN !== lockedSpaceType) return prev;
        const next = [...prev, venueId];
        if (!lockedSpaceType && venueSN) setLockedSpaceType(venueSN);
        return next;
      }
    });
  };

  const getDateColorClass = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "booked": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "partial": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default: return "";
    }
  };

  const getVenueStatusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">Available</Badge>;
      case "booked": return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs">Fully Booked</Badge>;
      case "partial": return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs">Partial</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Available</Badge>;
    }
  };

  const handleContactNext = () => {
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    setStep("booking");
  };

  const handleSubmitBooking = () => {
    if (!selectedDate || selectedVenues.length === 0 || !classification) return;
    if (!bookingSummary.trim()) {
      setBookingSummaryError(true);
      return;
    }
    setBookingSummaryError(false);
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
      classification,
      bookingSummary: bookingSummary.trim(),
      attendeeCount: attendeeCount ? parseInt(attendeeCount) : undefined,
      invoiceEmail: showInvoiceEmail && invoiceEmail.trim() ? invoiceEmail.trim() : undefined,
      notes: studioNotes || undefined,
      isFirstBooking: studioIsFirstBooking,
    });
  };

  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const durationHours = (endMin - startMin) / 60;

  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-casual-confirmed">Venue Hire Enquiry Submitted</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-casual-confirmed">
            Thanks {name.split(" ")[0]}! Your venue hire enquiry has been submitted. The {orgInfo?.name || "ReserveTMK"} team will review your request and get back to you at {email}.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left mb-4">
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{selectedDate ? new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" }) : ""}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{formatTimeSlot(startTime)} - {formatTimeSlot(endTime)}</span>
            </div>
            {selectedVenues.length > 0 && venues && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Venue{selectedVenues.length > 1 ? "s" : ""}</span>
                <span className="font-medium">{selectedVenues.map(id => venues.find((v: any) => v.id === id)?.name).filter(Boolean).join(", ")}</span>
              </div>
            )}
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{classification}</span>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setStep("contact");
              setName("");
              setEmail("");
              setPhone("");
              setOrganisation("");
              setSelectedDate(null);
              setSelectedVenues([]);
              setPresetSlot("");
              setClassification("");
              setBookingSummary("");
              setAttendeeCount("");
              setStudioStep("idle");
              setStudioNotes("");
              setStudioIsFirstBooking(false);
              setLockedSpaceType(null);
            }}
            data-testid="button-new-enquiry"
          >
            Submit Another Enquiry
          </Button>
        </Card>
      </div>
    );
  }

  if (step === "contact") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
          <div className="text-center space-y-2 pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" data-testid="text-casual-brand">
              {orgInfo?.name || "ReserveTMK Digital"}
            </p>
            <h1 className="text-2xl font-bold" data-testid="heading-casual-hire">Venue Hire Enquiry</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-casual-subtitle">
              Looking to hire a space? Fill in your details and check availability.
            </p>
          </div>

          <Card className="p-5 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="casual-name" className="text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Your Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="casual-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                data-testid="input-casual-name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="casual-email" className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="casual-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                data-testid="input-casual-email"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setShowInvoiceEmail(!showInvoiceEmail); if (!showInvoiceEmail) setInvoiceEmail(""); }}
                data-testid="button-toggle-invoice-email"
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${showInvoiceEmail ? "bg-primary border-primary" : "border-border"}`}>
                  {showInvoiceEmail && <span className="text-primary-foreground text-[9px] font-bold">✓</span>}
                </span>
                Send invoice to a different email?
              </button>
              {showInvoiceEmail && (
                <div className="space-y-1">
                  <Label htmlFor="casual-invoice-email" className="text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Invoice email
                  </Label>
                  <Input
                    id="casual-invoice-email"
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="invoices@yourorg.com"
                    data-testid="input-casual-invoice-email"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="casual-phone" className="text-sm flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="casual-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="021 123 4567"
                data-testid="input-casual-phone"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="casual-org" className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Organisation <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="casual-org"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="Company or group name"
                data-testid="input-casual-org"
              />
            </div>

            <Button
              className="w-full"
              disabled={!name.trim() || !email.trim() || !phone.trim()}
              onClick={handleContactNext}
              data-testid="button-casual-next"
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Check Availability
            </Button>
          </Card>

          {orgInfo?.location && (
            <Card className="p-4 border-primary/10">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" data-testid="text-casual-location">{orgInfo.location}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setStep("contact")} data-testid="button-casual-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" data-testid="text-casual-brand-booking">
              {orgInfo?.name || "ReserveTMK Digital"}
            </p>
            <h1 className="text-xl font-bold" data-testid="heading-casual-booking">Select Date & Venue</h1>
          </div>
        </div>

        <Card className="p-3 mb-4 border-primary/10 bg-primary/5">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <User className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium" data-testid="text-casual-booker-info">{name}</span>
            <span className="text-muted-foreground">{email}</span>
            <Button variant="ghost" size="sm" onClick={() => setStep("contact")} className="text-xs ml-auto" data-testid="button-edit-contact">
              Edit
            </Button>
          </div>
        </Card>

        <div className="flex flex-col lg:flex-row gap-4">
          <Card className="flex-1 p-4">
            <div className="flex items-center justify-between gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-casual-prev-month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-semibold" data-testid="text-casual-month">{monthName}</h2>
              <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-casual-next-month">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {(availLoading || venuesLoading) ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
                      onClick={() => isClickable ? (() => { setSelectedDate(cell.date); setSelectedVenues([]); })() : undefined}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded-md transition-colors
                        ${!cell.inMonth ? "text-muted-foreground/30" : ""}
                        ${(isPast || isBeyondMax) && cell.inMonth ? "text-muted-foreground/40" : ""}
                        ${cell.inMonth && !isPast && !isBeyondMax ? getDateColorClass(status) : ""}
                        ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                        ${isClickable ? "cursor-pointer" : "cursor-default"}
                      `}
                      data-testid={`casual-day-${cell.date}`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4 flex-wrap text-xs">
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
          </Card>

          <Card className="w-full lg:w-80 p-4 space-y-4" data-testid="panel-casual-booking-form">
            {!selectedDate ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Select a date on the calendar to get started</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm" data-testid="heading-casual-selected-date">
                    {new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Pacific/Auckland" })}
                  </h3>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Select Venue{(venues?.length || 0) > 1 ? "s" : ""}</Label>
                  <div className="space-y-1">
                    {(() => {
                      const officeVenues = (venues || []).filter((v: any) => v.spaceName === "ReserveTMK Office");
                      const studioVenues = (venues || []).filter((v: any) => v.spaceName === "Podcast Studio");
                      const otherVenues = (venues || []).filter((v: any) => v.spaceName !== "ReserveTMK Office" && v.spaceName !== "Podcast Studio");

                      const renderVenueBtn = (v: any) => {
                        const venueStatus = getVenueStatusForDate(v.id, selectedDate!);
                        const isBooked = venueStatus === "booked";
                        const isChecked = selectedVenues.includes(v.id);
                        const isGroupLocked = !isChecked && !!lockedSpaceType && v.spaceName !== lockedSpaceType;
                        const venueBookings = getVenueBookingsForDate(v.id, selectedDate!);
                        return (
                          <button
                            key={v.id}
                            disabled={isBooked || isGroupLocked}
                            onClick={() => !isBooked && !isGroupLocked && toggleVenue(v.id)}
                            className={`w-full text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                              isChecked
                                ? "border-primary bg-primary/5"
                                : isBooked || isGroupLocked
                                  ? "border-border opacity-40 cursor-not-allowed"
                                  : "border-border hover:border-primary/50"
                            }`}
                            data-testid={`casual-venue-${v.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isBooked || isGroupLocked}
                                  className="pointer-events-none"
                                  data-testid={`casual-checkbox-venue-${v.id}`}
                                />
                                <div>
                                  <span className={(isBooked || isGroupLocked) ? "text-muted-foreground" : ""}>{v.name}</span>
                                  {v.capacity && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      <Users className="w-3 h-3 inline mr-0.5" />
                                      {v.capacity}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {getVenueStatusBadge(venueStatus)}
                            </div>
                            {venueBookings.length > 0 && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {venueBookings.map((b: any, idx: number) => (
                                  <div key={idx} className="text-xs text-muted-foreground">
                                    {b.startTime && b.endTime ? `${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}` : "All day"}: Booked
                                  </div>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      };

                      return (
                        <>
                          {officeVenues.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-muted-foreground px-1 pt-1">🏢 Office Spaces</p>
                              {officeVenues.map(renderVenueBtn)}
                            </>
                          )}
                          {studioVenues.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-muted-foreground px-1 pt-2">🎙 Podcast Studio</p>
                              {studioVenues.map(renderVenueBtn)}
                            </>
                          )}
                          {otherVenues.length > 0 && otherVenues.map(renderVenueBtn)}
                          {lockedSpaceType && selectedVenues.length > 0 && (
                            <p className="text-xs text-muted-foreground px-1 pt-1 italic">Locations cannot be mixed in one booking</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {selectedVenues.length > 0 && (
                  <>
                    {/* Studio check-in step */}
                    {allSelectedAreStudio && studioStep === "idle" && !!studioCheckUserId && (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking studio history...
                      </div>
                    )}

                    {allSelectedAreStudio && studioStep === "questions-new" && (
                      <div className="space-y-3 border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎙</span>
                          <p className="text-sm font-medium">Tell us about your podcast</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Does your podcast have a name? <span className="text-muted-foreground">(optional)</span></Label>
                          <Input
                            value={studioPodName}
                            onChange={(e) => setStudioPodName(e.target.value)}
                            placeholder="Podcast name"
                            data-testid="input-studio-pod-name"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Socials <span className="text-muted-foreground">(optional)</span></Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={studioIG}
                              onChange={(e) => setStudioIG(e.target.value)}
                              placeholder="Instagram @handle"
                              data-testid="input-studio-ig"
                            />
                            <Input
                              value={studioYT}
                              onChange={(e) => setStudioYT(e.target.value)}
                              placeholder="YouTube channel"
                              data-testid="input-studio-yt"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Name of host <span className="text-red-500">*</span></Label>
                          <Input
                            value={studioNewHost}
                            onChange={(e) => setStudioNewHost(e.target.value)}
                            placeholder="Your name"
                            data-testid="input-studio-new-host"
                          />
                        </div>

                        <div className="border-t border-border pt-3 space-y-1">
                          <Label className="text-xs font-medium">Your kaupapa</Label>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">What's your podcast about? <span className="text-red-500">*</span></Label>
                          <Textarea
                            value={studioAbout}
                            onChange={(e) => setStudioAbout(e.target.value)}
                            rows={2}
                            placeholder="Topic, theme, what you're exploring..."
                            data-testid="input-studio-about"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Why do you want to do this? <span className="text-red-500">*</span></Label>
                          <Textarea
                            value={studioWhy}
                            onChange={(e) => setStudioWhy(e.target.value)}
                            rows={2}
                            placeholder="What's driving you to create this?"
                            data-testid="input-studio-why"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Where do you want to take it? <span className="text-red-500">*</span></Label>
                          <Textarea
                            value={studioGoals}
                            onChange={(e) => setStudioGoals(e.target.value)}
                            rows={2}
                            placeholder="Goals, vision, who's the audience..."
                            data-testid="input-studio-goals"
                          />
                        </div>

                        <Button
                          className="w-full"
                          size="sm"
                          disabled={!studioNewHost.trim() || !studioAbout.trim() || !studioWhy.trim() || !studioGoals.trim()}
                          onClick={() => {
                            const lines = [
                              "[Studio Session — New Booker Kaupapa]",
                              studioPodName.trim() ? `Podcast name: ${studioPodName.trim()}` : null,
                              studioIG.trim() ? `Instagram: ${studioIG.trim()}` : null,
                              studioYT.trim() ? `YouTube: ${studioYT.trim()}` : null,
                              `Host: ${studioNewHost.trim()}`,
                              `What it's about: ${studioAbout.trim()}`,
                              `Why: ${studioWhy.trim()}`,
                              `Where they want to take it: ${studioGoals.trim()}`,
                            ].filter(Boolean).join("\n");
                            setStudioNotes(lines);
                            setStudioIsFirstBooking(true);
                            setStudioStep("done");
                          }}
                          data-testid="button-studio-new-continue"
                        >
                          Continue to Date &amp; Time
                        </Button>
                      </div>
                    )}

                    {allSelectedAreStudio && studioStep === "questions-returning" && (
                      <div className="space-y-3 border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎙</span>
                          <p className="text-sm font-medium">Welcome back — quick check-in</p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">How did your last booking go? <span className="text-red-500">*</span></Label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={1}
                              max={5}
                              value={studioLastRating}
                              onChange={(e) => setStudioLastRating(parseInt(e.target.value))}
                              className="flex-1 accent-primary"
                              data-testid="input-studio-last-rating"
                            />
                            <span className="text-sm font-medium w-16 text-center">
                              {["", "Rough", "OK", "Good", "Great", "Amazing"][studioLastRating]}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Where did you get with last episode? <span className="text-red-500">*</span></Label>
                          <div className="flex gap-2 flex-wrap">
                            {["N/A", "Recorded", "Editing", "Posted"].map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setStudioEpisodeStatus(opt)}
                                className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${studioEpisodeStatus === opt ? "border-primary bg-primary/5" : "border-border"}`}
                                data-testid={`button-episode-status-${opt.toLowerCase()}`}
                              >{opt}</button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-border pt-3 space-y-1">
                          <Label className="text-xs">What's the plan for this session? <span className="text-red-500">*</span></Label>
                          <Textarea
                            value={studioThisSession}
                            onChange={(e) => setStudioThisSession(e.target.value)}
                            rows={2}
                            placeholder="What you're recording or working on today..."
                            data-testid="input-studio-this-session"
                          />
                        </div>

                        <div className="border-t border-border pt-3 space-y-2">
                          <Label className="text-xs font-medium">Who's in the studio this session?</Label>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Host <span className="text-red-500">*</span></Label>
                            <Input
                              value={studioHost}
                              onChange={(e) => setStudioHost(e.target.value)}
                              placeholder="Host name"
                              data-testid="input-studio-host"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Guest 1 <span className="text-muted-foreground">(optional)</span></Label>
                              <Input
                                value={studioGuest1}
                                onChange={(e) => setStudioGuest1(e.target.value)}
                                placeholder="Guest name"
                                data-testid="input-studio-guest1"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Guest 2 <span className="text-muted-foreground">(optional)</span></Label>
                              <Input
                                value={studioGuest2}
                                onChange={(e) => setStudioGuest2(e.target.value)}
                                placeholder="Guest name"
                                data-testid="input-studio-guest2"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Live editor <span className="text-muted-foreground">(if applicable)</span></Label>
                            <Input
                              value={studioEditor}
                              onChange={(e) => setStudioEditor(e.target.value)}
                              placeholder="Editor name"
                              data-testid="input-studio-editor"
                            />
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          size="sm"
                          disabled={!studioEpisodeStatus || !studioThisSession.trim() || !studioHost.trim()}
                          onClick={() => {
                            const people = [
                              `Host: ${studioHost.trim()}`,
                              studioGuest1.trim() ? `Guest 1: ${studioGuest1.trim()}` : null,
                              studioGuest2.trim() ? `Guest 2: ${studioGuest2.trim()}` : null,
                              studioEditor.trim() ? `Live editor: ${studioEditor.trim()}` : null,
                            ].filter(Boolean).join(", ");
                            const lines = [
                              "[Studio Session — Returning Booker]",
                              `Last booking: ${["", "Rough", "OK", "Good", "Great", "Amazing"][studioLastRating]} (${studioLastRating}/5)`,
                              `Last episode: ${studioEpisodeStatus}`,
                              `This session: ${studioThisSession.trim()}`,
                              `People in studio: ${people}`,
                            ].join("\n");
                            setStudioNotes(lines);
                            setStudioIsFirstBooking(false);
                            setStudioStep("done");
                          }}
                          data-testid="button-studio-returning-continue"
                        >
                          Continue to Date &amp; Time
                        </Button>
                      </div>
                    )}

                    {(!allSelectedAreStudio || studioStep === "done") && (<>
                    <div className="space-y-2">
                      <Label className="text-xs">Quick Select</Label>
                      <div className="space-y-1">
                        {PRESET_SLOTS.map(slot => (
                          <button
                            key={slot.label}
                            onClick={() => setPresetSlot(presetSlot === slot.label ? "" : slot.label)}
                            className={`w-full text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                              presetSlot === slot.label
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            }`}
                            data-testid={`casual-slot-${slot.start}-${slot.end}`}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              {slot.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {!presetSlot && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Start Time</Label>
                          <Input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-testid="input-casual-start" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End Time</Label>
                          <Input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-testid="input-casual-end" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">What's the event? <span className="text-red-500">*</span></Label>
                      <Select value={classification} onValueChange={setClassification}>
                        <SelectTrigger data-testid="select-casual-classification">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSIFICATIONS.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">How many people? <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        type="number"
                        min="1"
                        value={attendeeCount}
                        onChange={(e) => setAttendeeCount(e.target.value)}
                        placeholder="Expected attendees"
                        data-testid="input-casual-attendees"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Tell us about your booking <span className="text-red-500">*</span></Label>
                      <Textarea
                        value={bookingSummary}
                        onChange={(e) => setBookingSummary(e.target.value)}
                        rows={3}
                        placeholder="What's the event, any special requirements, setup needs..."
                        data-testid="input-casual-summary"
                        required
                      />
                      {bookingSummary.trim() === "" && bookingSummaryError && (
                        <p className="text-xs text-red-500" data-testid="text-casual-summary-required">This field is required</p>
                      )}
                    </div>

                    {durationHours > 0 && (
                      <Card className="p-3 bg-muted/30">
                        <div className="flex items-center gap-2 text-sm">
                          <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground" data-testid="text-casual-pricing-note">
                            Pricing will be confirmed by our team after review
                          </span>
                        </div>
                      </Card>
                    )}

                    <Button
                      className="w-full"
                      disabled={!classification || !bookingSummary.trim() || bookMutation.isPending}
                      onClick={handleSubmitBooking}
                      data-testid="button-casual-submit"
                    >
                      {bookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarDays className="w-4 h-4 mr-2" />}
                      Submit Enquiry
                    </Button>

                    {bookMutation.isError && (
                      <p className="text-xs text-red-500" data-testid="text-casual-booking-error">
                        {(bookMutation.error as Error)?.message || "Failed to submit enquiry"}
                      </p>
                    )}
                    </>)}
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
