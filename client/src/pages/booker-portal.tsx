import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Mail,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Clock,
  Package,
  FileText,
  X,
  DollarSign,
  Tag,
  Info,
  Users,
  Monitor,
  Wrench,
  AlertTriangle,
  Pencil,
  Settings,
} from "lucide-react";

type PortalView = "login" | "dashboard" | "calendar" | "desk-booking" | "gear-booking";

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
          <h1 className="text-2xl font-bold" data-testid="heading-booker-login">ReserveTMK Digital</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-login-subtitle">Venue Hire Portal</p>
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
  onBookDesk,
  onBookGear,
}: {
  authData: any;
  token: string;
  onBookSpace: () => void;
  onBookDesk: () => void;
  onBookGear: () => void;
}) {
  const { toast } = useToast();
  const booker = authData.booker;
  const contact = authData.contact;
  const isGroupLink = authData.isGroupLink === true;

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{ categories: string[]; agreement: any }>({
    queryKey: ["/api/booker/categories", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/categories/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: allBookingsData, isLoading: bookingsLoading } = useQuery<{ venue: any[]; desk: any[]; gear: any[] }>({
    queryKey: ["/api/booker/all-bookings", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/all-bookings/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const categories = categoriesData?.categories || ["venue_hire"];
  const agreement = categoriesData?.agreement;

  const cancelDeskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/booker/desk-bookings/${token}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booker/all-bookings", token] });
    },
  });

  const cancelGearMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/booker/gear-bookings/${token}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booker/all-bookings", token] });
    },
  });

  const cancelVenueMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/booker/bookings/${token}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booker/all-bookings", token] });
      setCancelDialogBooking(null);
      toast({ title: "Cancelled", description: "Venue booking has been cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to cancel booking", variant: "destructive" });
    },
  });

  const changeRequestMutation = useMutation({
    mutationFn: async ({ bookingId, data }: { bookingId: number; data: any }) => {
      await apiRequest("POST", `/api/booker/bookings/${token}/${bookingId}/change-request`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booker/all-bookings", token] });
      setChangeRequestBooking(null);
      setChangeRequestReason("");
      setChangeRequestDate("");
      setChangeRequestStartTime("");
      setChangeRequestEndTime("");
      setChangeRequestVenueIds([]);
      toast({ title: "Submitted", description: "Your change request has been submitted for review" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to submit change request", variant: "destructive" });
    },
  });

  const [cancelDialogBooking, setCancelDialogBooking] = useState<any>(null);
  const [changeRequestBooking, setChangeRequestBooking] = useState<any>(null);
  const [changeRequestReason, setChangeRequestReason] = useState("");
  const [changeRequestDate, setChangeRequestDate] = useState("");
  const [changeRequestStartTime, setChangeRequestStartTime] = useState("");
  const [changeRequestEndTime, setChangeRequestEndTime] = useState("");
  const [changeRequestVenueIds, setChangeRequestVenueIds] = useState<number[]>([]);

  // Determine if this booker is a paid booker (not free/koha agreement)
  const isPaidBooker = booker.pricingTier !== "free_koha" && !authData.membership && !authData.mou;

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Notification settings state — start in saved mode if email already on record
  const [notifEmail, setNotifEmail] = useState<string>("");
  const [notifEmailSaved, setNotifEmailSaved] = useState(!!booker.notificationsEmail);
  const [invoiceEmail, setInvoiceEmail] = useState<string>("");
  const [invoiceEmailSaved, setInvoiceEmailSaved] = useState(false);

  const updateNotifEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("PATCH", `/api/booker/${token}/notifications-email`, { notificationsEmail: email });
      return res.json();
    },
    onSuccess: () => {
      setNotifEmailSaved(true);
      toast({ title: "Saved", description: "Confirmation email address updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save email address", variant: "destructive" });
    },
  });

  const updateInvoiceEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("PATCH", `/api/booker/${token}/invoice-email`, { invoiceEmail: email });
      return res.json();
    },
    onSuccess: () => {
      setInvoiceEmailSaved(true);
      toast({ title: "Saved", description: "Invoice email address updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save invoice email", variant: "destructive" });
    },
  });

  const { data: venuesList } = useQuery<any[]>({
    queryKey: ["/api/booker/venues", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/venues/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: categories.includes("venue_hire"),
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

  const venueBookings = allBookingsData?.venue || [];
  const agreementUsage = useMemo(() => {
    if (!venueBookings.length) return 0;
    if (authData.membership) {
      return getAgreementAllowanceUsage(venueBookings, "membership", authData.membership.id, authData.membership.allowancePeriod);
    }
    if (authData.mou) {
      return getAgreementAllowanceUsage(venueBookings, "mou", authData.mou.id, authData.mou.allowancePeriod);
    }
    return 0;
  }, [venueBookings, authData]);

  const allBookingsList = useMemo(() => {
    if (!allBookingsData) return [];
    const combined: any[] = [];
    for (const b of allBookingsData.venue) {
      combined.push({ ...b, _type: "venue_hire", _sortDate: b.startDate || b.createdAt });
    }
    for (const b of allBookingsData.desk) {
      combined.push({ ...b, _type: "hot_desking", _sortDate: b.date || b.createdAt });
    }
    for (const b of allBookingsData.gear) {
      combined.push({ ...b, _type: "gear", _sortDate: b.date || b.createdAt });
    }
    return combined
      .sort((a, c) => new Date(c._sortDate).getTime() - new Date(a._sortDate).getTime())
      .slice(0, 10);
  }, [allBookingsData]);

  const agreementEndDate = agreement?.endDate
    ? new Date(agreement.endDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const hasNotifEmail = !!booker.notificationsEmail || notifEmailSaved;
  const hasInvoiceEmail = !isPaidBooker || invoiceEmailSaved;
  const canBook = hasNotifEmail && hasInvoiceEmail;
  const settingsHasAlert = !hasNotifEmail || (isPaidBooker && !invoiceEmailSaved);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" data-testid="text-portal-brand">
              ReserveTMK Digital
            </p>
            <h1 className="text-2xl font-bold mt-1" data-testid="heading-welcome">
              Kia ora{isGroupLink ? `, ${authData.linkedGroupName || booker.organizationName || "Team"}` : `, ${contact?.name || booker.organizationName || "there"}`}
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

          {!isGroupLink && (
            <div className="relative shrink-0 mt-1" data-testid="settings-dropdown-container">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen((v) => !v)}
                className="relative h-8 px-3 text-xs gap-1.5"
                data-testid="button-settings"
              >
                {settingsHasAlert && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" aria-label="Settings required" />
                )}
                <Settings className="w-3.5 h-3.5" />
                Settings
                <ChevronDown className={`w-3 h-3 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </Button>

              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-background border rounded-lg shadow-lg p-4 space-y-4" data-testid="settings-panel">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notification Settings</p>

                  {/* Notification email */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      Confirmation email{" "}
                      {!hasNotifEmail && <span className="text-amber-500">*</span>}
                    </Label>
                    {notifEmailSaved ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate text-foreground" data-testid="text-saved-notif-email">
                          {notifEmail || booker.notificationsEmail}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 shrink-0 text-xs"
                          onClick={() => {
                            setNotifEmail(notifEmail || booker.notificationsEmail || "");
                            setNotifEmailSaved(false);
                          }}
                          data-testid="button-edit-notif-email"
                        >
                          <Pencil className="w-3 h-3 mr-1" />Edit
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id="notif-email"
                          type="email"
                          placeholder="your@email.com"
                          value={notifEmail}
                          onChange={(e) => setNotifEmail(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          data-testid="input-notif-email"
                        />
                        <Button
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={!notifEmail.trim() || !notifEmail.includes("@") || updateNotifEmailMutation.isPending}
                          onClick={() => updateNotifEmailMutation.mutate(notifEmail.trim())}
                          data-testid="button-save-notif-email"
                        >
                          {updateNotifEmailMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Invoice email (paid bookers only) */}
                  {isPaidBooker && (
                    <div className="space-y-1.5 pt-3 border-t">
                      <Label className="text-sm">
                        Invoice email{" "}
                        {!hasInvoiceEmail && <span className="text-amber-500">*</span>}
                      </Label>
                      {invoiceEmailSaved ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm flex-1 truncate text-foreground" data-testid="text-saved-invoice-email">
                            {invoiceEmail}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 shrink-0 text-xs"
                            onClick={() => setInvoiceEmailSaved(false)}
                            data-testid="button-edit-invoice-email"
                          >
                            <Pencil className="w-3 h-3 mr-1" />Edit
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id="invoice-email"
                            type="email"
                            placeholder="invoices@yourorg.com"
                            value={invoiceEmail}
                            onChange={(e) => setInvoiceEmail(e.target.value)}
                            className="flex-1 h-8 text-sm"
                            data-testid="input-invoice-email"
                          />
                          <Button
                            size="sm"
                            className="h-8 shrink-0"
                            disabled={!invoiceEmail.trim() || !invoiceEmail.includes("@") || updateInvoiceEmailMutation.isPending}
                            onClick={() => updateInvoiceEmailMutation.mutate(invoiceEmail.trim())}
                            data-testid="button-save-invoice-email"
                          >
                            {updateInvoiceEmailMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {booker.hasBookingPackage && (
          <Card className="p-5" data-testid="card-package">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Venue Hire Package</h3>
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

        {categoriesLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            {categories.includes("venue_hire") && (
              <Card className="p-4" data-testid="card-category-venue">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" data-testid="text-venue-category-label">Venue Hire</p>
                      {agreement && agreement.bookingAllowance > 0 ? (
                        <p className="text-xs text-muted-foreground" data-testid="text-venue-status">
                          {agreementUsage} of {agreement.bookingAllowance} venue hires used this {getPeriodLabel(agreement.allowancePeriod)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Book meeting rooms and venues</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={canBook ? onBookSpace : undefined}
                    disabled={!canBook}
                    title={!canBook ? "Add required emails in Settings ⚙️ to book" : undefined}
                    data-testid="button-book-venue"
                  >
                    Book
                  </Button>
                  {!canBook && (
                    <p className="text-[10px] text-amber-600 mt-1 w-full" data-testid="text-book-venue-gate">
                      {!hasNotifEmail
                        ? "Add your notification email in Settings ⚙️ to book"
                        : "Add your invoice email in Settings ⚙️ to book"}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {categories.includes("hot_desking") && (
              <Card className="p-4" data-testid="card-category-desk">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" data-testid="text-desk-category-label">Hot Desking</p>
                      <p className="text-xs text-muted-foreground" data-testid="text-desk-status">
                        Active (unlimited access{agreementEndDate ? `, expires ${agreementEndDate}` : ""})
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={onBookDesk} data-testid="button-book-desk">
                    Book
                  </Button>
                </div>
              </Card>
            )}

            {categories.includes("gear") && (
              <Card className="p-4" data-testid="card-category-gear">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Wrench className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" data-testid="text-gear-category-label">Gear Booking</p>
                      <p className="text-xs text-muted-foreground" data-testid="text-gear-status">
                        Active (unlimited access{agreementEndDate ? `, expires ${agreementEndDate}` : ""})
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={onBookGear} data-testid="button-book-gear">
                    Book
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-3" data-testid="heading-recent-bookings">{isGroupLink ? "Group Bookings" : "My Bookings & Hires"}</h3>
          {bookingsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : allBookingsList.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-bookings">No bookings or hires yet</p>
          ) : (
            <div className="space-y-2">
              {allBookingsList.map((b: any) => {
                const isVenue = b._type === "venue_hire";
                const isDesk = b._type === "hot_desking";
                const isGear = b._type === "gear";
                const bookingDate = isVenue
                  ? (b.startDate ? new Date(b.startDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" }) : "TBC")
                  : (b.date ? new Date(b.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" }) : "TBC");
                const canCancelDeskGear = (isDesk || isGear) && b.status === "booked";
                const isUpcoming = b.startDate ? new Date(b.startDate) > new Date() : (b.date ? new Date(b.date) > new Date() : false);
                const canCancelVenue = isVenue && b.status !== "cancelled" && b.status !== "completed" && isUpcoming;
                const hasPendingChangeRequest = isVenue && b.changeRequests?.some((cr: any) => cr.status === "pending");
                const canRequestChange = canCancelVenue && !hasPendingChangeRequest;

                return (
                  <Card key={`${b._type}-${b.id}`} className="p-3" data-testid={`card-booking-${b._type}-${b.id}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            {isVenue && (b.title || b.classification)}
                            {isDesk && (b.resourceName || "Desk Booking")}
                            {isGear && (b.resourceName || "Gear Booking")}
                          </p>
                          <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-type-${b._type}-${b.id}`}>
                            {isVenue && "Venue"}
                            {isDesk && "Desk"}
                            {isGear && "Gear"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {bookingDate}
                          {isVenue && b.startTime && b.endTime ? ` | ${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}` : ""}
                          {isDesk && b.startTime && b.endTime ? ` | ${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}` : ""}
                        </p>
                        {isVenue && b.venueNames && b.venueNames.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">{b.venueNames.join(", ")}</p>
                        )}
                        {isGroupLink && b.bookerName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Booked by {b.bookerName}
                          </p>
                        )}
                        {isGear && b.requiresApproval && !b.approved && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Pending approval
                          </p>
                        )}
                        {hasPendingChangeRequest && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Change request pending
                          </p>
                        )}
                        {isVenue && b.changeRequests?.some((cr: any) => cr.status === "approved") && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Change request approved
                          </p>
                        )}
                        {isVenue && b.changeRequests?.some((cr: any) => cr.status === "declined") && !hasPendingChangeRequest && !b.changeRequests?.some((cr: any) => cr.status === "approved") && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1">
                            <X className="w-3 h-3" /> Change request declined
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">{b.status}</Badge>
                        {canRequestChange && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setChangeRequestBooking(b);
                              setChangeRequestDate(b.startDate ? new Date(b.startDate).toISOString().split("T")[0] : "");
                              setChangeRequestStartTime(b.startTime || "");
                              setChangeRequestEndTime(b.endTime || "");
                              setChangeRequestVenueIds(b.venueIds || (b.venueId ? [b.venueId] : []));
                            }}
                            title="Request change"
                            data-testid={`button-change-request-${b.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canCancelVenue && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCancelDialogBooking(b)}
                            title="Cancel booking"
                            data-testid={`button-cancel-venue-${b.id}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {canCancelDeskGear && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (isDesk) cancelDeskMutation.mutate(b.id);
                              if (isGear) cancelGearMutation.mutate(b.id);
                            }}
                            disabled={cancelDeskMutation.isPending || cancelGearMutation.isPending}
                            data-testid={`button-cancel-${b._type}-${b.id}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <Dialog open={!!cancelDialogBooking} onOpenChange={(open) => !open && setCancelDialogBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Venue Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking?
              {cancelDialogBooking && (
                <span className="block mt-2 font-medium text-foreground">
                  {cancelDialogBooking.title || cancelDialogBooking.classification} -{" "}
                  {cancelDialogBooking.startDate
                    ? new Date(cancelDialogBooking.startDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" })
                    : "TBC"}
                  {cancelDialogBooking.startTime && cancelDialogBooking.endTime
                    ? ` | ${formatTimeSlot(cancelDialogBooking.startTime)} - ${formatTimeSlot(cancelDialogBooking.endTime)}`
                    : ""}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogBooking(null)} data-testid="button-cancel-dialog-dismiss">
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelDialogBooking && cancelVenueMutation.mutate(cancelDialogBooking.id)}
              disabled={cancelVenueMutation.isPending}
              data-testid="button-cancel-dialog-confirm"
            >
              {cancelVenueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Yes, Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!changeRequestBooking} onOpenChange={(open) => !open && setChangeRequestBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Booking Change</DialogTitle>
            <DialogDescription>
              Submit a change request for this booking. The admin will review and approve or decline your request.
            </DialogDescription>
          </DialogHeader>
          <ChangeRequestFormFields
            token={token}
            changeRequestDate={changeRequestDate}
            setChangeRequestDate={setChangeRequestDate}
            changeRequestStartTime={changeRequestStartTime}
            setChangeRequestStartTime={setChangeRequestStartTime}
            changeRequestEndTime={changeRequestEndTime}
            setChangeRequestEndTime={setChangeRequestEndTime}
            changeRequestVenueIds={changeRequestVenueIds}
            setChangeRequestVenueIds={setChangeRequestVenueIds}
            changeRequestReason={changeRequestReason}
            setChangeRequestReason={setChangeRequestReason}
            venuesList={venuesList || []}
            booking={changeRequestBooking}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChangeRequestBooking(null)} data-testid="button-change-request-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!changeRequestBooking) return;
                const origVenueIds = changeRequestBooking.venueIds || (changeRequestBooking.venueId ? [changeRequestBooking.venueId] : []);
                const origDate = changeRequestBooking.startDate ? new Date(changeRequestBooking.startDate).toISOString().split("T")[0] : "";
                const dateChanged = changeRequestDate && changeRequestDate !== origDate;
                const startChanged = changeRequestStartTime && changeRequestStartTime !== changeRequestBooking.startTime;
                const endChanged = changeRequestEndTime && changeRequestEndTime !== changeRequestBooking.endTime;
                const venueChanged = JSON.stringify(changeRequestVenueIds.sort()) !== JSON.stringify([...origVenueIds].sort());
                if (!dateChanged && !startChanged && !endChanged && !venueChanged) {
                  toast({ title: "No changes", description: "Please modify at least the date, time, or venue", variant: "destructive" });
                  return;
                }
                changeRequestMutation.mutate({
                  bookingId: changeRequestBooking.id,
                  data: {
                    requestedDate: dateChanged ? changeRequestDate : undefined,
                    requestedStartTime: startChanged ? changeRequestStartTime : undefined,
                    requestedEndTime: endChanged ? changeRequestEndTime : undefined,
                    requestedVenueIds: venueChanged ? changeRequestVenueIds : undefined,
                    reason: changeRequestReason || undefined,
                  },
                });
              }}
              disabled={changeRequestMutation.isPending}
              data-testid="button-change-request-submit"
            >
              {changeRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  maxAdvanceMonths?: number;
};

function ChangeRequestFormFields({
  token,
  changeRequestDate,
  setChangeRequestDate,
  changeRequestStartTime,
  setChangeRequestStartTime,
  changeRequestEndTime,
  setChangeRequestEndTime,
  changeRequestVenueIds,
  setChangeRequestVenueIds,
  changeRequestReason,
  setChangeRequestReason,
  venuesList,
  booking,
}: {
  token: string;
  changeRequestDate: string;
  setChangeRequestDate: (v: string) => void;
  changeRequestStartTime: string;
  setChangeRequestStartTime: (v: string) => void;
  changeRequestEndTime: string;
  setChangeRequestEndTime: (v: string) => void;
  changeRequestVenueIds: number[];
  setChangeRequestVenueIds: (v: number[] | ((prev: number[]) => number[])) => void;
  changeRequestReason: string;
  setChangeRequestReason: (v: string) => void;
  venuesList: any[];
  booking: any;
}) {
  const effectiveDate = changeRequestDate || (booking?.startDate ? new Date(booking.startDate).toISOString().split("T")[0] : "");
  const effectiveStartTime = changeRequestStartTime || booking?.startTime || "";
  const effectiveEndTime = changeRequestEndTime || booking?.endTime || "";
  const effectiveVenueIds = changeRequestVenueIds.length > 0 ? changeRequestVenueIds : (booking?.venueIds || (booking?.venueId ? [booking.venueId] : []));

  const canCheckAvailability = effectiveDate && effectiveStartTime && effectiveEndTime && effectiveVenueIds.length > 0;

  const { data: availabilityCheck, isLoading: checkingAvailability } = useQuery<{ available: boolean; conflicts: string[] }>({
    queryKey: ["/api/booker/check-change-availability", token, effectiveDate, effectiveStartTime, effectiveEndTime, effectiveVenueIds, booking?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: effectiveDate,
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        venueIds: effectiveVenueIds.join(","),
        excludeBookingId: String(booking?.id || 0),
      });
      const res = await fetch(`/api/booker/check-change-availability/${token}?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!canCheckAvailability && !!booking,
  });

  return (
    <div className="space-y-4 py-2">
      <div>
        <label className="text-sm font-medium">New Date</label>
        <Input
          type="date"
          value={changeRequestDate}
          onChange={(e) => setChangeRequestDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          data-testid="input-change-request-date"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">Start Time</label>
          <Input
            type="time"
            value={changeRequestStartTime}
            onChange={(e) => setChangeRequestStartTime(e.target.value)}
            data-testid="input-change-request-start-time"
          />
        </div>
        <div>
          <label className="text-sm font-medium">End Time</label>
          <Input
            type="time"
            value={changeRequestEndTime}
            onChange={(e) => setChangeRequestEndTime(e.target.value)}
            data-testid="input-change-request-end-time"
          />
        </div>
      </div>
      {venuesList.length > 0 && (
        <div>
          <label className="text-sm font-medium">Venue(s)</label>
          <div className="space-y-1 mt-1 max-h-32 overflow-y-auto border rounded-md p-2">
            {venuesList.map((v: any) => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-venue-${v.id}`}>
                <Checkbox
                  checked={changeRequestVenueIds.includes(v.id)}
                  onCheckedChange={(checked) => {
                    setChangeRequestVenueIds((prev: number[]) =>
                      checked ? [...prev, v.id] : prev.filter((id: number) => id !== v.id)
                    );
                  }}
                />
                <span className="text-sm">{v.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {canCheckAvailability && (
        <div data-testid="availability-check-result">
          {checkingAvailability ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
            </p>
          ) : availabilityCheck?.available ? (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Time slot is available
            </p>
          ) : (
            <div>
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <X className="w-3 h-3" /> Time slot has conflicts
              </p>
              {availabilityCheck?.conflicts?.map((c: string, i: number) => (
                <p key={i} className="text-xs text-red-500 ml-4">{c}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <label className="text-sm font-medium">Reason for Change</label>
        <Textarea
          value={changeRequestReason}
          onChange={(e) => setChangeRequestReason(e.target.value)}
          placeholder="Please describe why you need this change..."
          rows={3}
          data-testid="input-change-request-reason"
        />
      </div>
    </div>
  );
}

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
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300" data-testid="text-pricing-covered">Covered by agreement</span>
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

function DeskBookingView({
  authData,
  token,
  onBack,
}: {
  authData: any;
  token: string;
  onBack: () => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("15:00");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState<{ date: string; resourceName: string; startTime: string; endTime: string } | null>(null);

  const { data: availabilityData, isLoading: availLoading } = useQuery<{ date: string; availability: any[] }>({
    queryKey: ["/api/booker/desk-availability", token, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/booker/desk-availability/${token}/${selectedDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/booker/desk-bookings/${token}`, data);
      return res.json();
    },
    onSuccess: () => {
      const resource = availabilityData?.availability?.find(a => a.resourceId === selectedResource);
      setConfirmedDetails({
        date: selectedDate,
        resourceName: resource?.resourceName || "Desk",
        startTime,
        endTime,
      });
      setBookingConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ["/api/booker/desk-availability", token, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/booker/all-bookings", token] });
    },
  });

  const handleBook = () => {
    if (!selectedResource) return;
    bookMutation.mutate({
      resourceId: selectedResource,
      date: selectedDate,
      startTime,
      endTime,
    });
  };

  if (bookingConfirmed && confirmedDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-desk-confirmed">Desk Booked</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-desk-confirmed">
            Your desk booking has been confirmed.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left mb-4">
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Desk</span>
              <span className="font-medium">{confirmedDetails.resourceName}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date(confirmedDetails.date + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{formatTimeSlot(confirmedDetails.startTime)} - {formatTimeSlot(confirmedDetails.endTime)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setBookingConfirmed(false); setSelectedResource(null); }} data-testid="button-book-another-desk">
              Book Another
            </Button>
            <Button className="flex-1" onClick={onBack} data-testid="button-desk-back-dashboard">
              Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-desk-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold" data-testid="heading-book-desk">Book a Desk</h1>
        </div>

        <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300" data-testid="text-desk-info">
              Hot desking is available Monday-Friday, 9am-3pm. First-come-first-served.
            </p>
          </div>
        </Card>

        <div className="space-y-2">
          <Label>Select Date</Label>
          <Input
            type="date"
            value={selectedDate}
            min={todayStr}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedResource(null); }}
            data-testid="input-desk-date"
          />
          {(() => {
            const d = new Date(selectedDate + "T12:00:00");
            const day = d.getDay();
            if (day === 0 || day === 6) {
              return <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-desk-weekend-warning">Desks are not available on weekends. Please select a weekday.</p>;
            }
            return null;
          })()}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Start Time</Label>
            <Input type="time" value={startTime} min="09:00" max="15:00" onChange={(e) => setStartTime(e.target.value)} data-testid="input-desk-start-time" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End Time</Label>
            <Input type="time" value={endTime} min="09:00" max="15:00" onChange={(e) => setEndTime(e.target.value)} data-testid="input-desk-end-time" />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Available Desks</Label>
          {availLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : availabilityData?.availability?.[0]?.closedToday ? (
            <p className="text-sm text-muted-foreground" data-testid="text-desks-closed-portal">Desks are closed on this day. Available Monday-Friday, 9am-3pm.</p>
          ) : !availabilityData?.availability?.length ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-desks">No desks available for this date</p>
          ) : (
            <div className="space-y-2">
              {availabilityData.availability.map((desk: any) => {
                const isSelected = selectedResource === desk.resourceId;
                const hasConflict = desk.slots?.some((s: any) => {
                  if (!s.startTime || !s.endTime) return true;
                  const a0 = parseTimeToMinutes(startTime);
                  const a1 = parseTimeToMinutes(endTime);
                  const b0 = parseTimeToMinutes(s.startTime);
                  const b1 = parseTimeToMinutes(s.endTime);
                  return a0 < b1 && b0 < a1;
                });
                const isAvailable = !desk.closedToday && (desk.isAvailable || !hasConflict);

                return (
                  <button
                    key={desk.resourceId}
                    disabled={!isAvailable}
                    onClick={() => setSelectedResource(isSelected ? null : desk.resourceId)}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isAvailable
                          ? "border-border"
                          : "border-border opacity-50"
                    }`}
                    data-testid={`desk-option-${desk.resourceId}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">{desk.resourceName}</p>
                        {desk.description && <p className="text-xs text-muted-foreground">{desk.description}</p>}
                      </div>
                      {isAvailable ? (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Available</Badge>
                      ) : desk.slots?.some((s: any) => s.isYours) ? (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Your Booking</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Occupied</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button
          className="w-full"
          disabled={!selectedResource || bookMutation.isPending || (() => { const d = new Date(selectedDate + "T12:00:00"); return d.getDay() === 0 || d.getDay() === 6; })()}
          onClick={handleBook}
          data-testid="button-submit-desk-booking"
        >
          {bookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
          <span className="ml-2">Book Desk</span>
        </Button>

        {bookMutation.isError && (
          <p className="text-xs text-red-500" data-testid="text-desk-booking-error">
            {(bookMutation.error as Error)?.message || "Failed to book desk"}
          </p>
        )}
      </div>
    </div>
  );
}

function GearBookingView({
  authData,
  token,
  onBack,
}: {
  authData: any;
  token: string;
  onBack: () => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState<{ date: string; items: string[]; requiresApproval: boolean } | null>(null);

  const { data: availabilityData, isLoading: availLoading } = useQuery<{ date: string; availability: any[] }>({
    queryKey: ["/api/booker/gear-availability", token, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/booker/gear-availability/${token}/${selectedDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const bookMutation = useMutation({
    mutationFn: async (resourceId: number) => {
      const res = await apiRequest("POST", `/api/booker/gear-bookings/${token}`, {
        resourceId,
        date: selectedDate,
      });
      return res.json();
    },
  });

  const handleBookAll = async () => {
    if (selectedItems.length === 0) return;
    const results: { name: string; requiresApproval: boolean }[] = [];
    for (const resourceId of selectedItems) {
      try {
        const result = await bookMutation.mutateAsync(resourceId);
        const item = availabilityData?.availability?.find(a => a.resourceId === resourceId);
        results.push({
          name: item?.resourceName || "Unknown",
          requiresApproval: result.requiresApproval || false,
        });
      } catch {
        // continue with other items
      }
    }
    if (results.length > 0) {
      setConfirmedDetails({
        date: selectedDate,
        items: results.map(r => r.name),
        requiresApproval: results.some(r => r.requiresApproval),
      });
      setBookingConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ["/api/booker/gear-availability", token, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/booker/all-bookings", token] });
    }
  };

  const toggleItem = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (bookingConfirmed && confirmedDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="heading-gear-confirmed">
            {confirmedDetails.requiresApproval ? "Gear Booking Submitted" : "Gear Booked"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-gear-confirmed">
            {confirmedDetails.requiresApproval
              ? "Some items require approval before pickup. You will be notified once approved."
              : "Your gear booking has been confirmed. Please return items by end of day."}
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-left mb-4">
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date(confirmedDetails.date + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Items:</span>
              <ul className="mt-1 space-y-1">
                {confirmedDetails.items.map((name, i) => (
                  <li key={i} className="font-medium">{name}</li>
                ))}
              </ul>
            </div>
          </div>
          {confirmedDetails.requiresApproval && (
            <Card className="p-3 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Some items require training/approval before use
                </p>
              </div>
            </Card>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setBookingConfirmed(false); setSelectedItems([]); }} data-testid="button-book-another-gear">
              Book More
            </Button>
            <Button className="flex-1" onClick={onBack} data-testid="button-gear-back-dashboard">
              Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-gear-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold" data-testid="heading-book-gear">Book Gear</h1>
        </div>

        <Card className="p-4 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700 dark:text-orange-300" data-testid="text-gear-info">
              Equipment must be returned same day. Items marked with a warning require training approval before use.
            </p>
          </div>
        </Card>

        <div className="space-y-2">
          <Label>Select Date</Label>
          <Input
            type="date"
            value={selectedDate}
            min={todayStr}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedItems([]); }}
            data-testid="input-gear-date"
          />
        </div>

        <div>
          <Label className="mb-2 block">Available Gear</Label>
          {availLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !availabilityData?.availability?.length ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-gear">No gear items available</p>
          ) : (
            <div className="space-y-2">
              {availabilityData.availability.map((item: any) => {
                const isSelected = selectedItems.includes(item.resourceId);
                return (
                  <button
                    key={item.resourceId}
                    disabled={!item.isAvailable && !item.isYours}
                    onClick={() => item.isAvailable && toggleItem(item.resourceId)}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : item.isAvailable
                          ? "border-border"
                          : "border-border opacity-50"
                    }`}
                    data-testid={`gear-option-${item.resourceId}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={!item.isAvailable}
                          className="pointer-events-none"
                          data-testid={`checkbox-gear-${item.resourceId}`}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{item.resourceName}</p>
                            {item.requiresApproval && (
                              <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Approval needed
                              </Badge>
                            )}
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </div>
                      </div>
                      {item.isAvailable ? (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Available</Badge>
                      ) : item.isYours ? (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Your Booking</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Booked</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button
          className="w-full"
          disabled={selectedItems.length === 0 || bookMutation.isPending}
          onClick={handleBookAll}
          data-testid="button-submit-gear-booking"
        >
          {bookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          <span className="ml-2">Book {selectedItems.length > 0 ? `${selectedItems.length} Item${selectedItems.length !== 1 ? "s" : ""}` : "Gear"}</span>
        </Button>

        {bookMutation.isError && (
          <p className="text-xs text-red-500" data-testid="text-gear-booking-error">
            {(bookMutation.error as Error)?.message || "Failed to book gear"}
          </p>
        )}
      </div>
    </div>
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
  const [selectedVenues, setSelectedVenues] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [presetSlot, setPresetSlot] = useState<string>("");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("12:00");
  const [classification, setClassification] = useState("");
  const [bookingSummary, setBookingSummary] = useState("");
  const [bookerName, setBookerName] = useState("");
  const [usePackageCredit, setUsePackageCredit] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [allowanceWarning, setAllowanceWarning] = useState<string | null>(null);
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [isOverAllowance, setIsOverAllowance] = useState(false);
  const [showOverAllowanceDialog, setShowOverAllowanceDialog] = useState(false);

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

  const { data: calViewBookingsData } = useQuery<{ venue: any[]; desk: any[]; gear: any[] }>({
    queryKey: ["/api/booker/all-bookings", token],
    queryFn: async () => {
      const res = await fetch(`/api/booker/all-bookings/${token}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const calViewVenueBookings = calViewBookingsData?.venue || [];

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const venueIds = useMemo(() => (venues || []).map((v: any) => v.id as number), [venues]);

  const { data: allVenueAvailability, isLoading: availLoading } = useQuery<Record<number, { dates: Record<string, { status: string; bookings: any[] }> }>>({
    queryKey: ["/api/booker/availability-all", token, monthStr, venueIds],
    queryFn: async () => {
      const results: Record<number, { dates: Record<string, { status: string; bookings: any[] }> }> = {};
      await Promise.all(venueIds.map(async (vid) => {
        const res = await fetch(`/api/booker/availability/${token}?venueId=${vid}&month=${monthStr}`);
        if (res.ok) {
          results[vid] = await res.json();
        }
      }));
      return results;
    },
    enabled: venueIds.length > 0,
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
          if (info.status === "yours" || current === "yours") {
            merged[dateStr].status = "yours";
          } else if (info.status === "available" || current === "available") {
            merged[dateStr].status = "available";
          } else if (info.status === "partial" || current === "partial") {
            merged[dateStr].status = "partial";
          }
        }
      }
    }
    return merged;
  }, [allVenueAvailability]);

  const getVenueStatusForDate = (venueId: number, date: string) => {
    return allVenueAvailability?.[venueId]?.dates?.[date]?.status || "available";
  };

  const getVenueBookingsForDate = (venueId: number, date: string) => {
    return allVenueAvailability?.[venueId]?.dates?.[date]?.bookings || [];
  };

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/booker/book/${token}`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setBookingConfirmed(true);
      setAllowanceWarning(data?.allowanceWarning ?? null);
      setAutoConfirmed(data?.autoConfirmed ?? false);
      setIsOverAllowance(data?.isOverAllowance ?? false);
    },
  });

  const bookerEmail = (authData.contact?.email || (authData.booker as any)?.email || "") as string;
  const bookerUserId = (authData.userId || "") as string;

  const allSelectedAreStudio = useMemo(
    () => selectedVenues.length > 0 && selectedVenues.every(id => venues?.find((v: any) => v.id === id)?.spaceName === "Studio"),
    [selectedVenues, venues]
  );

  const { data: studioBookerCheck } = useQuery<{ isReturning: boolean; bookingCount: number }>({
    queryKey: ["/api/public/spaces/check-studio-booker", bookerEmail, bookerUserId],
    queryFn: async () => {
      const params = new URLSearchParams({ email: bookerEmail, userId: bookerUserId });
      const res = await fetch(`/api/public/spaces/check-studio-booker?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: allSelectedAreStudio && !!bookerEmail && !!bookerUserId && studioStep === "idle",
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

  const maxAdvanceMonths = pricingData?.maxAdvanceMonths ?? 3;
  const maxBookingDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + maxAdvanceMonths);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [maxAdvanceMonths]);

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

  const [bookingSummaryError, setBookingSummaryError] = useState(false);

  // Venue grouping
  const [lockedSpaceType, setLockedSpaceType] = useState<string | null>(null);

  // Studio step
  type CalStudioStep = "idle" | "questions-new" | "questions-returning" | "done";
  const [studioStep, setStudioStep] = useState<CalStudioStep>("idle");
  const [studioProduce, setStudioProduce] = useState("");
  const [studioUsedBefore, setStudioUsedBefore] = useState<boolean | null>(null);
  const [studioNeedsHelp, setStudioNeedsHelp] = useState<boolean | null>(null);
  const [studioGear, setStudioGear] = useState("");
  const [studioOther, setStudioOther] = useState("");
  const [studioRecording, setStudioRecording] = useState("");
  const [studioSetupChanges, setStudioSetupChanges] = useState<boolean | null>(null);
  const [studioSetupDetails, setStudioSetupDetails] = useState("");
  const [studioNotes, setStudioNotes] = useState("");
  const [studioIsFirstBooking, setStudioIsFirstBooking] = useState(false);

  const pendingBookingPayload = {
    venueId: selectedVenues[0],
    venueIds: selectedVenues,
    startDate: selectedDate,
    startTime,
    endTime,
    classification,
    bookingSummary: bookingSummary.trim() || undefined,
    usePackageCredit,
    bookerName: isGroupLink && bookerName.trim() ? bookerName.trim() : undefined,
    notes: studioNotes || undefined,
    isFirstBooking: studioIsFirstBooking,
  };

  const checkOverAllowance = (): boolean => {
    const agreement = authData?.mou || authData?.membership;
    if (!agreement || !agreement.bookingAllowance) return false;
    const period = agreement.allowancePeriod || "quarterly";
    const type = authData?.membership ? "membership" : "mou";
    const used = getAgreementAllowanceUsage(calViewVenueBookings, type, agreement.id, period);
    return used >= agreement.bookingAllowance;
  };

  const submitBooking = () => {
    bookMutation.mutate(pendingBookingPayload);
  };

  const handleBook = () => {
    if (!selectedDate || selectedVenues.length === 0 || !classification) return;
    if (!bookingSummary.trim()) {
      setBookingSummaryError(true);
      return;
    }
    setBookingSummaryError(false);

    // Check for over-allowance before submitting
    if (pricingData?.coveredByAgreement && checkOverAllowance()) {
      setShowOverAllowanceDialog(true);
      return;
    }

    submitBooking();
  };

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
      case "yours": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "partial": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default: return "";
    }
  };

  const getVenueStatusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">Available</Badge>;
      case "booked": return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs">Fully Booked</Badge>;
      case "yours": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">Your Booking</Badge>;
      case "partial": return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs">Partial</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Available</Badge>;
    }
  };

  if (bookingConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-14 h-14 rounded-full ${autoConfirmed ? "bg-green-500/10" : "bg-blue-500/10"} flex items-center justify-center`}>
              <Check className={`w-7 h-7 ${autoConfirmed ? "text-green-600" : "text-blue-600"}`} />
            </div>
          </div>
          {autoConfirmed ? (
            <>
              <h2 className="text-xl font-bold mb-2" data-testid="heading-booking-confirmed">Booking Confirmed!</h2>
              {isOverAllowance ? (
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-booking-confirmed">
                  Your booking has been confirmed. This booking exceeds your agreement allowance - a community rate (20% discount) has been applied.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-booking-confirmed">
                  Your booking has been automatically confirmed and is covered by your agreement. No payment is required.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2" data-testid="heading-booking-confirmed">Venue Hire Request Submitted</h2>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-booking-confirmed">
                Your venue hire request has been submitted as an enquiry. The ReserveTMK Digital team will review and confirm it shortly.
              </p>
            </>
          )}
          {autoConfirmed && !isOverAllowance && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-4 flex items-center gap-2" data-testid="badge-covered-by-agreement">
              <span className="text-green-700 dark:text-green-300 text-sm font-medium">✓ Covered by agreement</span>
            </div>
          )}
          {isOverAllowance && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4 text-sm text-amber-800 dark:text-amber-200" data-testid="badge-community-rate">
              Community rate applied - 20% discount
            </div>
          )}
          {allowanceWarning && !isOverAllowance && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4 text-sm text-amber-800 dark:text-amber-200" data-testid="text-allowance-warning">
              {allowanceWarning}
            </div>
          )}
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
            <Button variant="outline" className="flex-1" onClick={() => { setBookingConfirmed(false); setSelectedDate(null); setSelectedVenues([]); setPresetSlot(""); setClassification(""); setBookingSummary(""); setBookerName(""); setStudioStep("idle"); setStudioNotes(""); setStudioIsFirstBooking(false); setLockedSpaceType(null); }} data-testid="button-book-another">
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
          <Card className="p-4 mb-4 border-primary/20 bg-primary/5" data-testid="card-agreement-balance">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {pricingData.coveredByAgreement ? <FileText className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                {pricingData.coveredByAgreement && (
                  <>
                    <p className="text-sm font-medium" data-testid="text-agreement-status">
                      Venue hires covered by your {authData.membership ? "membership" : "MOU"} agreement
                    </p>
                    {authData.membership?.bookingAllowance > 0 && (
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-agreement-allowance">
                        {(() => {
                          const used = authData._agreementUsage ?? 0;
                          const total = authData.membership.bookingAllowance;
                          const remaining = Math.max(0, total - used);
                          const period = getPeriodLabel(authData.membership.allowancePeriod);
                          return `${remaining} of ${total} venue hires remaining this ${period}`;
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
                          return `${remaining} of ${total} venue hires remaining this ${period}`;
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
                      Toggle "Use package credit" when hiring a venue to apply
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {pricingData && !pricingData.coveredByAgreement && (
          <div className="mb-4 flex items-center gap-3 flex-wrap text-xs text-muted-foreground" data-testid="text-venue-rates">
            <Info className="w-3 h-3 shrink-0" />
            <span>Rates: Half day ${pricingData.halfDayRate.toFixed(0)} | Full day ${pricingData.fullDayRate.toFixed(0)}{pricingData.hourlyRate > 0 ? ` | Hourly $${pricingData.hourlyRate.toFixed(0)}/hr` : ""}</span>
            {pricingData.discountPercentage > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-discount-tier">
                {pricingData.discountPercentage}% discount
              </Badge>
            )}
          </div>
        )}

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

          <Card className="w-full lg:w-80 p-4 space-y-4" data-testid="panel-booking-form">
            {!selectedDate ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Select a date to see available venues</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm" data-testid="heading-selected-date">
                    {new Date(selectedDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Pacific/Auckland" })}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedDate(null); setSelectedVenues([]); }} data-testid="button-close-panel">
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {!selectedDate && (
                  <p className="text-sm text-muted-foreground text-center py-4">Select a date above to see available spaces</p>
                )}
                {selectedDate && (
                <div className="space-y-2">
                  <Label className="text-xs">Select Venue{(venues?.length || 0) > 1 ? "s" : ""}</Label>
                  <div className="space-y-1">
                    {(() => {
                      const officeVenues = (venues || []).filter((v: any) => v.spaceName === "Office");
                      const studioVenues = (venues || []).filter((v: any) => v.spaceName === "Studio");
                      const otherVenues = (venues || []).filter((v: any) => v.spaceName !== "Office" && v.spaceName !== "Studio");

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
                            data-testid={`venue-checkbox-${v.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isBooked || isGroupLocked}
                                  onCheckedChange={() => !isBooked && !isGroupLocked && toggleVenue(v.id)}
                                  data-testid={`checkbox-venue-${v.id}`}
                                />
                                <span className={(isBooked || isGroupLocked) ? "text-muted-foreground" : ""}>{v.name}</span>
                              </div>
                              {getVenueStatusBadge(venueStatus)}
                            </div>
                            {venueBookings.length > 0 && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {venueBookings.map((b: any, idx: number) => (
                                  <div key={idx} className="text-xs text-muted-foreground">
                                    {b.startTime && b.endTime ? `${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}` : "All day"}: {b.title || "Booked"}
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
                )}

                {selectedVenues.length > 0 && (
                  <>
                    {/* Studio check-in step */}
                    {allSelectedAreStudio && studioStep === "idle" && !!bookerUserId && (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking studio history...
                      </div>
                    )}

                    {allSelectedAreStudio && studioStep === "questions-new" && (
                      <div className="space-y-3 border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎙</span>
                          <p className="text-sm font-medium">First time at the studio — tell us about your session</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">What do you plan to produce? <span className="text-red-500">*</span></Label>
                          <Textarea
                            value={studioProduce}
                            onChange={(e) => setStudioProduce(e.target.value)}
                            rows={2}
                            placeholder="e.g. podcast, music, voiceover..."
                            data-testid="portal-input-studio-produce"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Have you used a recording studio before? <span className="text-red-500">*</span></Label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setStudioUsedBefore(true)}
                              className={`flex-1 text-sm px-3 py-1.5 rounded-md border transition-colors ${studioUsedBefore === true ? "border-primary bg-primary/5" : "border-border"}`}
                              data-testid="portal-button-studio-used-before-yes"
                            >Yes</button>
                            <button
                              type="button"
                              onClick={() => setStudioUsedBefore(false)}
                              className={`flex-1 text-sm px-3 py-1.5 rounded-md border transition-colors ${studioUsedBefore === false ? "border-primary bg-primary/5" : "border-border"}`}
                              data-testid="portal-button-studio-used-before-no"
                            >No</button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Do you need help with setup on the day? <span className="text-red-500">*</span></Label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setStudioNeedsHelp(true)}
                              className={`flex-1 text-sm px-3 py-1.5 rounded-md border transition-colors ${studioNeedsHelp === true ? "border-primary bg-primary/5" : "border-border"}`}
                              data-testid="portal-button-studio-needs-help-yes"
                            >Yes</button>
                            <button
                              type="button"
                              onClick={() => setStudioNeedsHelp(false)}
                              className={`flex-1 text-sm px-3 py-1.5 rounded-md border transition-colors ${studioNeedsHelp === false ? "border-primary bg-primary/5" : "border-border"}`}
                              data-testid="portal-button-studio-needs-help-no"
                            >No</button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Any specific gear or software you need? <span className="text-muted-foreground">(optional)</span></Label>
                          <Input
                            value={studioGear}
                            onChange={(e) => setStudioGear(e.target.value)}
                            placeholder="Microphone type, DAW, etc."
                            data-testid="portal-input-studio-gear"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Anything else we should know? <span className="text-muted-foreground">(optional)</span></Label>
                          <Textarea
                            value={studioOther}
                            onChange={(e) => setStudioOther(e.target.value)}
                            rows={2}
                            placeholder="Any extra info for the team..."
                            data-testid="portal-input-studio-other"
                          />
                        </div>

                        <Button
                          className="w-full"
                          size="sm"
                          disabled={!studioProduce.trim() || studioUsedBefore === null || studioNeedsHelp === null}
                          onClick={() => {
                            const lines = [
                              "[Studio Session — New Booker]",
                              `What to produce: ${studioProduce.trim()}`,
                              `Used studio before: ${studioUsedBefore ? "Yes" : "No"}`,
                              `Needs setup help: ${studioNeedsHelp ? "Yes" : "No"}`,
                              studioGear.trim() ? `Gear/software: ${studioGear.trim()}` : null,
                              studioOther.trim() ? `Other notes: ${studioOther.trim()}` : null,
                            ].filter(Boolean).join("\n");
                            setStudioNotes(lines);
                            setStudioIsFirstBooking(true);
                            setStudioStep("done");
                          }}
                          data-testid="portal-button-studio-new-continue"
                        >
                          Continue to Date &amp; Time
                        </Button>
                      </div>
                    )}

                    {allSelectedAreStudio && studioStep === "questions-returning" && (
                      <div className="space-y-3 border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎙</span>
                          <p className="text-sm font-medium">Welcome back — quick check-in for this session</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">What are you recording this session? <span className="text-red-500">*</span></Label>
                          <Textarea
                            value={studioRecording}
                            onChange={(e) => setStudioRecording(e.target.value)}
                            rows={2}
                            placeholder="Describe what you're working on..."
                            data-testid="portal-input-studio-recording"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Any changes to your usual setup? <span className="text-red-500">*</span></Label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setStudioSetupChanges(true)}
                              className={`flex-1 text-sm px-3 py-1.5 rounded-md border transition-colors ${studioSetupChanges === true ? "border-primary bg-primary/5" : "border-border"}`}
                              data-testid="portal-button-studio-changes-yes"
                            >Yes</button>
                            <button
                              type="button"
                              onClick={() => setStudioSetupChanges(false)}
                              className={`flex-1 text-sm px-3 py-1.5 rounded-md border transition-colors ${studioSetupChanges === false ? "border-primary bg-primary/5" : "border-border"}`}
                              data-testid="portal-button-studio-changes-no"
                            >No</button>
                          </div>
                          {studioSetupChanges === true && (
                            <Textarea
                              value={studioSetupDetails}
                              onChange={(e) => setStudioSetupDetails(e.target.value)}
                              rows={2}
                              placeholder="What's changing?"
                              className="mt-1"
                              data-testid="portal-input-studio-setup-details"
                            />
                          )}
                        </div>

                        <Button
                          className="w-full"
                          size="sm"
                          disabled={!studioRecording.trim() || studioSetupChanges === null}
                          onClick={() => {
                            const lines = [
                              "[Studio Session — Returning Booker]",
                              `Recording: ${studioRecording.trim()}`,
                              studioSetupChanges
                                ? `Setup changes: ${studioSetupDetails.trim() || "Yes (details not provided)"}`
                                : "No changes to setup",
                            ].filter(Boolean).join("\n");
                            setStudioNotes(lines);
                            setStudioIsFirstBooking(false);
                            setStudioStep("done");
                          }}
                          data-testid="portal-button-studio-returning-continue"
                        >
                          Continue to Date &amp; Time
                        </Button>
                      </div>
                    )}

                    {(!allSelectedAreStudio || studioStep === "done") && (<>
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
                                    {slotPrice.isCovered ? "Covered" : slotPrice.discount > 0 ? `$${slotPrice.finalPrice.toFixed(0)}` : `$${slotPrice.basePrice.toFixed(0)}`}
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
                      <Label className="text-xs">Tell us about your booking <span className="text-red-500">*</span></Label>
                      <Textarea
                        value={bookingSummary}
                        onChange={(e) => setBookingSummary(e.target.value)}
                        rows={2}
                        placeholder="What's the event, how many people, any special needs..."
                        data-testid="input-booking-summary"
                        required
                      />
                      {bookingSummary.trim() === "" && bookingSummaryError && (
                        <p className="text-xs text-red-500" data-testid="text-booking-summary-required">This field is required</p>
                      )}
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
                    </>)}
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Over-allowance confirmation dialog */}
      {showOverAllowanceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <span className="text-red-600 text-lg">⚠</span>
              </div>
              <h3 className="font-semibold text-base" data-testid="heading-over-allowance">This booking exceeds your agreement allowance</h3>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-over-allowance-info">
              Confirm to proceed - community rate (20% discount) applies to this booking.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowOverAllowanceDialog(false)}
                data-testid="button-over-allowance-cancel"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => { setShowOverAllowanceDialog(false); submitBooking(); }}
                data-testid="button-over-allowance-confirm"
              >
                Confirm anyway
              </Button>
            </div>
          </Card>
        </div>
      )}
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

  if (view === "desk-booking") {
    return <DeskBookingView authData={authData} token={token} onBack={() => setView("dashboard")} />;
  }

  if (view === "gear-booking") {
    return <GearBookingView authData={authData} token={token} onBack={() => setView("dashboard")} />;
  }

  return (
    <DashboardView
      authData={authData}
      token={token}
      onBookSpace={() => setView("calendar")}
      onBookDesk={() => setView("desk-booking")}
      onBookGear={() => setView("gear-booking")}
    />
  );
}
