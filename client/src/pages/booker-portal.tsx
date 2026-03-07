import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatTimeSlot, getAgreementAllowanceUsage, getPeriodLabel } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Mail,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Package,
  FileText,
  X,
  DollarSign,
  Tag,
  Info,
  Users,
} from "lucide-react";

type PortalView = "login" | "dashboard" | "calendar";

const CLASSIFICATIONS = [
  "Community Group",
  "Business Meeting",
  "Workshop",
  "Training",
  "Private Event",
  "Cultural Event",
  "Youth Programme",
  "Health & Wellbeing",
  "Other",
];

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

function LoginView({ onSent }: { onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (loginEmail: string) => {
      await apiRequest("POST", "/api/booker/login", { email: loginEmail });
    },
    onSuccess: () => {
      setSent(true);
      onSent();
    },
  });

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Mail className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-check-email">Check your email</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-login-sent">
            If an account exists for that email, we've sent a login link. The link is valid for 24 hours.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold" data-testid="heading-booker-login">Reserve Tamaki</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-login-subtitle">Booking Portal</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email Address</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) loginMutation.mutate(email.trim()); }}
              data-testid="input-booker-email"
            />
          </div>
          <Button
            className="w-full"
            disabled={!email.trim() || loginMutation.isPending}
            onClick={() => loginMutation.mutate(email.trim())}
            data-testid="button-send-login-link"
          >
            {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            <span className="ml-2">Send Login Link</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function DashboardView({
  authData,
  token,
  onBookSpace,
}: {
  authData: any;
  token: string;
  onBookSpace: () => void;
}) {
  const booker = authData.booker;
  const contact = authData.contact;
  const isGroupLink = authData.isGroupLink === true;

  const { data: myBookings, isLoading: bookingsLoading } = useQuery<any[]>({
    queryKey: ["/api/booker/bookings", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/bookings/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const packageRemaining = booker.hasBookingPackage
    ? (booker.packageTotalBookings || 0) - (booker.packageUsedBookings || 0)
    : 0;
  const packageProgress = booker.hasBookingPackage && booker.packageTotalBookings > 0
    ? ((booker.packageUsedBookings || 0) / booker.packageTotalBookings) * 100
    : 0;

  const packageExpiryText = booker.packageExpiresAt
    ? (() => {
        const exp = new Date(booker.packageExpiresAt);
        const now = new Date();
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return "Expired";
        if (diffDays <= 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} left`;
        if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks left`;
        return exp.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
      })()
    : null;

  const agreementUsage = useMemo(() => {
    if (!myBookings) return 0;
    if (authData.membership) {
      return getAgreementAllowanceUsage(myBookings, "membership", authData.membership.id, authData.membership.allowancePeriod);
    }
    if (authData.mou) {
      return getAgreementAllowanceUsage(myBookings, "mou", authData.mou.id, authData.mou.allowancePeriod);
    }
    return 0;
  }, [myBookings, authData]);

  const recentBookings = useMemo(() => {
    if (!myBookings) return [];
    return [...myBookings]
      .sort((a, b) => new Date(b.startDate || b.createdAt).getTime() - new Date(a.startDate || a.createdAt).getTime())
      .slice(0, 5);
  }, [myBookings]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" data-testid="text-portal-brand">
            Reserve Tamaki
          </p>
          <h1 className="text-2xl font-bold mt-1" data-testid="heading-welcome">
            Welcome{isGroupLink ? `, ${authData.linkedGroupName || booker.organizationName || "Team"}` : `, ${contact?.name || booker.organizationName || "there"}`}
          </h1>
          {isGroupLink && (
            <div className="flex items-center gap-2 mt-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground" data-testid="text-group-portal">
                Group Portal
              </p>
            </div>
          )}
          {!isGroupLink && (booker.organizationName || authData.linkedGroupName) && (
            <p className="text-sm text-muted-foreground" data-testid="text-org-name">
              {booker.organizationName || authData.linkedGroupName}
            </p>
          )}
        </div>

        {booker.hasBookingPackage && (
          <Card className="p-5" data-testid="card-package">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Booking Package</h3>
              {packageExpiryText && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-package-expiry">
                  {packageExpiryText}
                </Badge>
              )}
            </div>
            <Progress value={packageProgress} className="h-2 mb-2" data-testid="progress-package" />
            <div className="flex justify-between gap-2 flex-wrap text-sm">
              <span className="text-muted-foreground" data-testid="text-package-used">
                {booker.packageUsedBookings || 0} used
              </span>
              <span className="font-medium" data-testid="text-package-remaining">
                {packageRemaining} remaining of {booker.packageTotalBookings || 0}
              </span>
            </div>
          </Card>
        )}

        {authData.membership && (
          <Card className="p-5" data-testid="card-membership">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Membership</h3>
              <Badge variant="secondary" className="text-xs">{authData.membership.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2" data-testid="text-membership-name">
              {authData.membership.name}
            </p>
            {authData.membership.bookingAllowance > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {agreementUsage} of {authData.membership.bookingAllowance} bookings used this {getPeriodLabel(authData.membership.allowancePeriod)}
                </span>
              </div>
            )}
          </Card>
        )}

        {authData.mou && !authData.membership && (
          <Card className="p-5" data-testid="card-mou">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">MOU Agreement</h3>
              <Badge variant="secondary" className="text-xs">{authData.mou.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2" data-testid="text-mou-name">
              {authData.mou.title}
            </p>
            {authData.mou.bookingAllowance > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {agreementUsage} of {authData.mou.bookingAllowance} bookings used this {getPeriodLabel(authData.mou.allowancePeriod)}
                </span>
              </div>
            )}
          </Card>
        )}

        <Button className="w-full" onClick={onBookSpace} data-testid="button-book-space">
          <CalendarDays className="w-4 h-4" />
          <span className="ml-2">Book a Space</span>
        </Button>

        <div>
          <h3 className="font-semibold mb-3" data-testid="heading-recent-bookings">{isGroupLink ? "Group Bookings" : "Recent Bookings"}</h3>
          {bookingsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-bookings">No bookings yet</p>
          ) : (
            <div className="space-y-2">
              {recentBookings.map((b: any) => (
                <Card key={b.id} className="p-3" data-testid={`card-booking-${b.id}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{b.title || b.classification}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.startDate ? new Date(b.startDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" }) : "TBC"}
                        {b.startTime && b.endTime ? ` | ${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}` : ""}
                      </p>
                      {isGroupLink && b.bookerName && (
                        <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-booked-by-${b.id}`}>
                          Booked by {b.bookerName}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{b.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

type PricingInfo = {
  fullDayRate: number;
  halfDayRate: number;
  hourlyRate: number;
  baseFullDayRate: number;
  baseHalfDayRate: number;
  baseHourlyRate: number;
  pricingTier: string;
  discountPercentage: number;
  coveredByAgreement: boolean;
  hasPackageCredits: boolean;
  packageRemaining: number;
};

function calculateBookingPrice(
  pricing: PricingInfo | undefined,
  startTime: string,
  endTime: string,
  usePackageCredit: boolean
): { basePrice: number; finalPrice: number; discount: number; label: string; isPackage: boolean; isCovered: boolean } {
  if (!pricing) return { basePrice: 0, finalPrice: 0, discount: 0, label: "", isPackage: false, isCovered: false };

  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const durationHours = (endMin - startMin) / 60;

  if (durationHours <= 0) return { basePrice: 0, finalPrice: 0, discount: 0, label: "", isPackage: false, isCovered: false };

  if (pricing.coveredByAgreement) {
    let basePrice: number;
    if (durationHours >= 8) basePrice = pricing.baseFullDayRate;
    else if (durationHours >= 4) basePrice = pricing.baseHalfDayRate;
    else basePrice = Math.round(pricing.baseHourlyRate * durationHours * 100) / 100;
    return { basePrice, finalPrice: 0, discount: basePrice, label: "Covered by agreement", isPackage: false, isCovered: true };
  }

  if (usePackageCredit && pricing.hasPackageCredits) {
    let basePrice: number;
    if (durationHours >= 8) basePrice = pricing.baseFullDayRate;
    else if (durationHours >= 4) basePrice = pricing.baseHalfDayRate;
    else basePrice = Math.round(pricing.baseHourlyRate * durationHours * 100) / 100;
    return { basePrice, finalPrice: 0, discount: basePrice, label: `Package credit (${pricing.packageRemaining} remaining)`, isPackage: true, isCovered: false };
  }

  let basePrice: number;
  let finalPrice: number;
  if (durationHours >= 8) {
    basePrice = pricing.baseFullDayRate;
    finalPrice = pricing.fullDayRate;
  } else if (durationHours >= 4) {
    basePrice = pricing.baseHalfDayRate;
    finalPrice = pricing.halfDayRate;
  } else {
    basePrice = Math.round(pricing.baseHourlyRate * durationHours * 100) / 100;
    finalPrice = Math.round(pricing.hourlyRate * durationHours * 100) / 100;
  }

  const discount = Math.round((basePrice - finalPrice) * 100) / 100;
  let label = "";
  if (discount > 0) label = `${pricing.discountPercentage}% discount applied`;

  return { basePrice, finalPrice, discount, label, isPackage: false, isCovered: false };
}


function PricingBreakdown({ pricing, startTime, endTime, usePackageCredit }: { pricing: PricingInfo | undefined; startTime: string; endTime: string; usePackageCredit: boolean }) {
  if (!pricing) return null;

  const result = calculateBookingPrice(pricing, startTime, endTime, usePackageCredit);
  if (result.basePrice === 0 && !result.isCovered && !result.isPackage) return null;

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  if (result.isCovered) {
    return (
      <Card className="p-3 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" data-testid="card-pricing-breakdown">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300" data-testid="text-pricing-covered">Covered by agreement</span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span data-testid="text-pricing-value-saved">Value: {formatCurrency(result.basePrice)} — no charge</span>
        </div>
      </Card>
    );
  }

  if (result.isPackage) {
    return (
      <Card className="p-3 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" data-testid="card-pricing-breakdown">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300" data-testid="text-pricing-package">Included in package</span>
        </div>
        <div className="text-xs text-muted-foreground" data-testid="text-pricing-package-remaining">
          {result.label}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3" data-testid="card-pricing-breakdown">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <DollarSign className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium" data-testid="text-pricing-heading">Estimated Cost</span>
      </div>
      <div className="space-y-1 text-sm">
        {result.discount > 0 && (
          <>
            <div className="flex justify-between gap-2 flex-wrap text-muted-foreground">
              <span>Base rate</span>
              <span className="line-through" data-testid="text-pricing-base">{formatCurrency(result.basePrice)}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap text-green-600 dark:text-green-400">
              <span className="flex items-center gap-1 flex-wrap"><Tag className="w-3 h-3" /> {result.label}</span>
              <span data-testid="text-pricing-discount">-{formatCurrency(result.discount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between gap-2 flex-wrap font-medium pt-1 border-t border-border">
          <span>{result.discount > 0 ? "Total" : "Estimated total"}</span>
          <span data-testid="text-pricing-total">{formatCurrency(result.finalPrice)}</span>
        </div>
      </div>
    </Card>
  );
}

function CalendarView({
  authData,
  token,
  onBack,
}: {
  authData: any;
  token: string;
  onBack: () => void;
}) {
  const booker = authData.booker;
  const isGroupLink = authData.isGroupLink === true;
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [presetSlot, setPresetSlot] = useState<string>("");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("12:00");
  const [classification, setClassification] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [bookerName, setBookerName] = useState("");
  const [usePackageCredit, setUsePackageCredit] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const { data: venues, isLoading: venuesLoading } = useQuery<any[]>({
    queryKey: ["/api/booker/venues", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/venues/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: pricingData } = useQuery<PricingInfo>({
    queryKey: ["/api/booker/pricing", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/pricing/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const { data: availabilityData, isLoading: availLoading } = useQuery<{ dates: Record<string, { status: string; bookings: any[] }> }>({
    queryKey: ["/api/booker/availability", token, selectedVenue, monthStr],
    queryFn: async () => {
      const res = await fetch(`/api/booker/availability/${token}?venueId=${selectedVenue}&month=${monthStr}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedVenue,
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/booker/book/${token}`, data);
      return res.json();
    },
    onSuccess: () => {
      setBookingConfirmed(true);
    },
  });

  const days = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth]);
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });

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

  const startTime = presetSlot ? PRESET_SLOTS.find(s => s.label === presetSlot)?.start || customStart : customStart;
  const endTime = presetSlot ? PRESET_SLOTS.find(s => s.label === presetSlot)?.end || customEnd : customEnd;

  const handleBook = () => {
    if (!selectedDate || !selectedVenue || !classification) return;
    bookMutation.mutate({
      venueId: parseInt(selectedVenue),
      startDate: selectedDate,
      startTime,
      endTime,
      classification,
      specialRequests: specialRequests.trim() || undefined,
      usePackageCredit,
      bookerName: isGroupLink && bookerName.trim() ? bookerName.trim() : undefined,
    });
  };

  const getDateColorClass = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "booked": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "yours": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "partial": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default: return "";
    }
  };

  const selectedDateInfo = selectedDate && availabilityData?.dates?.[selectedDate];

  if (bookingConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-booking-confirmed">Booking Request Submitted</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-booking-confirmed">
            Your booking request has been submitted as an enquiry. The Reserve Tamaki team will review and confirm it shortly.
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
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{classification}</span>
            </div>
            {pricingData && (() => {
              const priceResult = calculateBookingPrice(pricingData, startTime, endTime, usePackageCredit);
              if (priceResult.isCovered) {
                return (
                  <div className="flex justify-between gap-2 flex-wrap" data-testid="text-confirmed-pricing">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium text-green-600 dark:text-green-400">Covered by agreement</span>
                  </div>
                );
              }
              if (priceResult.isPackage) {
                return (
                  <div className="flex justify-between gap-2 flex-wrap" data-testid="text-confirmed-pricing">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">Package credit used</span>
                  </div>
                );
              }
              if (priceResult.finalPrice > 0) {
                return (
                  <div className="flex justify-between gap-2 flex-wrap" data-testid="text-confirmed-pricing">
                    <span className="text-muted-foreground">Estimated cost</span>
                    <span className="font-medium">${priceResult.finalPrice.toFixed(2)}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setBookingConfirmed(false); setSelectedDate(null); setPresetSlot(""); setClassification(""); setSpecialRequests(""); setBookerName(""); }} data-testid="button-book-another">
              Book Another
            </Button>
            <Button className="flex-1" onClick={onBack} data-testid="button-back-to-dashboard">
              Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-dashboard">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold" data-testid="heading-book-space">Book a Space</h1>
        </div>

        {pricingData && (pricingData.coveredByAgreement || pricingData.hasPackageCredits) && (
          <Card className="p-4 border-primary/20 bg-primary/5" data-testid="card-agreement-balance">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {pricingData.coveredByAgreement ? <FileText className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                {pricingData.coveredByAgreement && (
                  <>
                    <p className="text-sm font-medium" data-testid="text-agreement-status">
                      Bookings covered by your {authData.membership ? "membership" : "MOU"} agreement
                    </p>
                    {authData.membership?.bookingAllowance > 0 && (
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-agreement-allowance">
                        {(() => {
                          const used = authData._agreementUsage ?? 0;
                          const total = authData.membership.bookingAllowance;
                          const remaining = Math.max(0, total - used);
                          const period = getPeriodLabel(authData.membership.allowancePeriod);
                          return `${remaining} of ${total} bookings remaining this ${period}`;
                        })()}
                      </p>
                    )}
                    {authData.mou?.bookingAllowance > 0 && !authData.membership && (
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-mou-allowance">
                        {(() => {
                          const used = authData._agreementUsage ?? 0;
                          const total = authData.mou.bookingAllowance;
                          const remaining = Math.max(0, total - used);
                          const period = getPeriodLabel(authData.mou.allowancePeriod);
                          return `${remaining} of ${total} bookings remaining this ${period}`;
                        })()}
                      </p>
                    )}
                  </>
                )}
                {pricingData.hasPackageCredits && !pricingData.coveredByAgreement && (
                  <>
                    <p className="text-sm font-medium" data-testid="text-package-status">
                      {pricingData.packageRemaining} package credit{pricingData.packageRemaining !== 1 ? "s" : ""} remaining
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Toggle "Use package credit" when booking to apply
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        <div className="mb-4">
          <Label>Select Venue</Label>
          {venuesLoading ? (
            <Skeleton className="h-9 w-full mt-1" />
          ) : (
            <Select value={selectedVenue} onValueChange={(v) => { setSelectedVenue(v); setSelectedDate(null); }}>
              <SelectTrigger data-testid="select-venue">
                <SelectValue placeholder="Choose a venue..." />
              </SelectTrigger>
              <SelectContent>
                {venues?.map((v: any) => (
                  <SelectItem key={v.id} value={String(v.id)} data-testid={`venue-option-${v.id}`}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedVenue && pricingData && !pricingData.coveredByAgreement && (
            <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-muted-foreground" data-testid="text-venue-rates">
              <Info className="w-3 h-3 shrink-0" />
              <span>Rates: Half day ${pricingData.halfDayRate.toFixed(0)} | Full day ${pricingData.fullDayRate.toFixed(0)}{pricingData.hourlyRate > 0 ? ` | Hourly $${pricingData.hourlyRate.toFixed(0)}/hr` : ""}</span>
              {pricingData.discountPercentage > 0 && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-discount-tier">
                  {pricingData.discountPercentage}% discount
                </Badge>
              )}
            </div>
          )}
        </div>

        {selectedVenue && (
          <div className="flex flex-col lg:flex-row gap-4">
            <Card className="flex-1 p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="font-semibold" data-testid="text-current-month">{monthName}</h2>
                <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {availLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {days.map((cell, i) => {
                    const status = cell.inMonth ? availabilityData?.dates?.[cell.date]?.status || "available" : "";
                    const isPast = cell.inMonth && new Date(cell.date + "T23:59:59") < new Date();
                    const isClickable = cell.inMonth && !isPast && status !== "booked";
                    const isSelected = cell.date === selectedDate;

                    return (
                      <button
                        key={i}
                        disabled={!isClickable}
                        onClick={() => isClickable ? setSelectedDate(cell.date) : undefined}
                        className={`
                          aspect-square flex items-center justify-center text-sm rounded-md transition-colors
                          ${!cell.inMonth ? "text-muted-foreground/30" : ""}
                          ${isPast && cell.inMonth ? "text-muted-foreground/40" : ""}
                          ${cell.inMonth && !isPast ? getDateColorClass(status) : ""}
                          ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                          ${isClickable ? "cursor-pointer" : "cursor-default"}
                        `}
                        data-testid={`calendar-day-${cell.date}`}
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
                  <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-900/50" />
                  <span className="text-muted-foreground">Yours</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/50" />
                  <span className="text-muted-foreground">Booked</span>
                </div>
              </div>
            </Card>

            {selectedDate && (
              <Card className="w-full lg:w-80 p-4 space-y-4" data-testid="panel-booking-form">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm" data-testid="heading-selected-date">
                    {new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Pacific/Auckland" })}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)} data-testid="button-close-panel">
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {selectedDateInfo && (selectedDateInfo as any).bookings?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Existing bookings:</p>
                    {(selectedDateInfo as any).bookings.map((b: any, idx: number) => (
                      <div key={idx} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        {b.startTime && b.endTime ? `${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}` : "All day"}: {b.title || "Booked"}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">Quick Select</Label>
                  <div className="space-y-1">
                    {PRESET_SLOTS.map(slot => {
                      const slotPrice = pricingData ? calculateBookingPrice(pricingData, slot.start, slot.end, false) : null;
                      return (
                        <button
                          key={slot.label}
                          onClick={() => setPresetSlot(presetSlot === slot.label ? "" : slot.label)}
                          className={`w-full text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                            presetSlot === slot.label
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                          data-testid={`slot-${slot.start}-${slot.end}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              {slot.label}
                            </div>
                            {slotPrice && slotPrice.basePrice > 0 && (
                              <span className="text-xs text-muted-foreground" data-testid={`text-slot-price-${slot.start}`}>
                                {slotPrice.isCovered ? "Included" : slotPrice.discount > 0 ? `$${slotPrice.finalPrice.toFixed(0)}` : `$${slotPrice.basePrice.toFixed(0)}`}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!presetSlot && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Time</Label>
                      <Input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-testid="input-custom-start" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Time</Label>
                      <Input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-testid="input-custom-end" />
                    </div>
                  </div>
                )}

                {isGroupLink && (
                  <div className="space-y-1">
                    <Label className="text-xs">Your Name (optional)</Label>
                    <Input
                      value={bookerName}
                      onChange={(e) => setBookerName(e.target.value)}
                      placeholder="Who is making this booking?"
                      data-testid="input-booker-name"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Classification</Label>
                  <Select value={classification} onValueChange={setClassification}>
                    <SelectTrigger data-testid="select-classification">
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
                  <Label className="text-xs">Special Requests</Label>
                  <Textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={2}
                    placeholder="Any setup needs, AV requirements..."
                    data-testid="input-special-requests"
                  />
                </div>

                {booker.hasBookingPackage && (booker.packageTotalBookings || 0) - (booker.packageUsedBookings || 0) > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Use package credit</Label>
                    <button
                      onClick={() => setUsePackageCredit(!usePackageCredit)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${usePackageCredit ? "bg-primary" : "bg-muted"}`}
                      data-testid="toggle-package-credit"
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${usePackageCredit ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                )}

                <PricingBreakdown
                  pricing={pricingData}
                  startTime={startTime}
                  endTime={endTime}
                  usePackageCredit={usePackageCredit}
                />

                <Button
                  className="w-full"
                  disabled={!classification || bookMutation.isPending}
                  onClick={handleBook}
                  data-testid="button-submit-booking"
                >
                  {bookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span className="ml-1">Submit Booking Request</span>
                </Button>

                {bookMutation.isError && (
                  <p className="text-xs text-red-500" data-testid="text-booking-error">
                    {(bookMutation.error as Error)?.message || "Failed to submit booking"}
                  </p>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookerPortalPage() {
  const [, loginParams] = useRoute("/booker/login");
  const [, portalParams] = useRoute("/booker/portal/:token");
  const initialToken = portalParams?.token;

  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [view, setView] = useState<PortalView>(initialToken ? "dashboard" : "login");

  const { data: authData, isLoading: authLoading, isError: authError } = useQuery({
    queryKey: ["/api/booker/auth", initialToken],
    queryFn: async () => {
      const res = await fetch(`/api/booker/auth/${initialToken}`);
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      if (data.booker?.loginToken) {
        setActiveToken(data.booker.loginToken);
      }
      return data;
    },
    enabled: !!initialToken,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const token = activeToken || initialToken;

  if (!initialToken) {
    return <LoginView onSent={() => {}} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authError || !authData || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h2 className="text-xl font-bold mb-2" data-testid="heading-invalid-token">Session Expired</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-invalid-token">
            This login link has expired or is invalid. Please request a new one.
          </p>
          <Button onClick={() => window.location.href = "/booker/login"} data-testid="button-request-new-link">
            Request New Link
          </Button>
        </Card>
      </div>
    );
  }

  if (view === "calendar") {
    return <CalendarView authData={authData} token={token} onBack={() => setView("dashboard")} />;
  }

  return <DashboardView authData={authData} token={token} onBookSpace={() => setView("calendar")} />;
}
