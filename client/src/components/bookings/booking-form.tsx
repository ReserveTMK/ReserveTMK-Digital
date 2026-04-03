import { getAgreementAllowanceUsage, getPeriodLabel } from "@/lib/utils";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useRegularBookers,
  useBookings,
} from "@/hooks/use-bookings";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useGroups, useCreateGroup } from "@/hooks/use-groups";
import { useMemberships, useMous } from "@/hooks/use-memberships";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  Search,
  Clock,
  X,
  Network,
  AlertCircle,
  MapPin,
  UserPlus,
  Link2,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { BOOKING_CLASSIFICATIONS, PRICING_TIERS, DURATION_TYPES, RATE_TYPES, COMMUNITY_DISCOUNT, type Booking, type Venue } from "@shared/schema";

const VENUE_HIRE_STATUSES = ["confirmed", "completed", "cancelled"] as const;

const TIME_SLOTS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00",
];

const PRICING_LABELS: Record<string, string> = {
  full_price: "Full Price",
  discounted: "Community",
  free_koha: "Free / Koha",
};

const DURATION_LABELS: Record<string, string> = {
  hourly: "Hourly",
  half_day: "Half Day",
  full_day: "Full Day",
};

const RATE_LABELS: Record<string, string> = {
  standard: "Standard",
  community: "Community (20% off)",
};

const STATUS_LABELS: Record<string, string> = {
  enquiry: "Enquiry",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export { VENUE_HIRE_STATUSES, TIME_SLOTS, PRICING_LABELS, DURATION_LABELS, RATE_LABELS };

function formatTimeSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function BookingFormDialog({
  open,
  onOpenChange,
  booking,
  venues,
  onSubmit,
  isPending,
  pricingDefaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: Booking;
  venues: Venue[];
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
  pricingDefaults?: { fullDayRate?: string | null; halfDayRate?: string | null };
}) {
  const { data: contacts } = useContacts();
  const createContact = useCreateContact();
  const { data: allGroups } = useGroups();
  const createGroup = useCreateGroup();

  const [selectedVenueIds, setSelectedVenueIds] = useState<number[]>(
    booking?.venueIds || (booking?.venueId ? [booking.venueId] : [])
  );
  const [classification, setClassification] = useState(booking?.classification || "");
  const [status, setStatus] = useState(booking?.status === "enquiry" ? "confirmed" : (booking?.status || "confirmed"));
  const [notes, setNotes] = useState(booking?.notes || "");

  const [isTBC, setIsTBC] = useState(!!(booking?.tbcMonth || booking?.tbcYear));
  const [isMultiDay, setIsMultiDay] = useState(booking?.isMultiDay || false);
  const [startDate, setStartDate] = useState(
    booking?.startDate ? format(new Date(booking.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    booking?.endDate ? format(new Date(booking.endDate), "yyyy-MM-dd") : ""
  );
  const [startTime, setStartTime] = useState(booking?.startTime || "");
  const [endTime, setEndTime] = useState(booking?.endTime || "");
  const [tbcMonth, setTbcMonth] = useState(booking?.tbcMonth || "");
  const [tbcYear, setTbcYear] = useState(booking?.tbcYear || new Date().getFullYear().toString());

  const [pricingTier, setPricingTier] = useState(booking?.pricingTier || "full_price");
  const [durationType, setDurationType] = useState(booking?.durationType || "hourly");
  const [rateType, setRateType] = useState(booking?.rateType || "standard");
  const [amount, setAmount] = useState(booking?.amount || "0");

  const applyDefaultRate = (newDuration: string, newRate: string) => {
    if (!pricingDefaults) return;
    let baseRate = "0";
    if (newDuration === "full_day") baseRate = pricingDefaults.fullDayRate || "0";
    else if (newDuration === "half_day") baseRate = pricingDefaults.halfDayRate || "0";
    else return;
    const base = parseFloat(baseRate);
    if (base <= 0) return;
    const finalAmount = newRate === "community" ? (base * (1 - 0.20)).toFixed(2) : base.toFixed(2);
    setAmount(finalAmount);
  };

  const [bookerId, setBookerId] = useState<number | null>(booking?.bookerId || null);
  const [bookerSearch, setBookerSearch] = useState("");
  const [showQuickAddBooker, setShowQuickAddBooker] = useState(false);
  const [quickBookerName, setQuickBookerName] = useState("");
  const [quickBookerEmail, setQuickBookerEmail] = useState("");
  const [groupId, setGroupId] = useState<number | null>(booking?.bookerGroupId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState("");
  const [membershipId, setMembershipId] = useState<number | null>(booking?.membershipId || null);
  const [mouId, setMouId] = useState<number | null>(booking?.mouId || null);
  const [agreementAutoPopulated, setAgreementAutoPopulated] = useState(false);
  const [agreementExpanded, setAgreementExpanded] = useState(false);
  const [conflictOverride, setConflictOverride] = useState(false);
  const [locationAccessOverride, setLocationAccessOverride] = useState<string[] | null>(
    (booking?.locationAccess as string[] | null) || null
  );
  const [groupAutoMatchOptions, setGroupAutoMatchOptions] = useState<any[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (startDate) {
      const d = new Date(startDate);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const [calendarDayView, setCalendarDayView] = useState<string | null>(null);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  const conflictQueryEnabled = !isTBC && selectedVenueIds.length > 0 && !!startDate && !!startTime && !!endTime;
  const { data: conflictData, isLoading: conflictLoading } = useQuery<{
    conflicts: { type: string; id: number; title: string; date: string; time: string }[];
    availableSlots: { startTime: string; endTime: string }[];
  }>({
    queryKey: ['/api/venue-conflicts', selectedVenueIds.join(","), startDate, startTime, endTime, booking?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        venueIds: selectedVenueIds.join(","),
        startDate,
        startTime,
        endTime,
        ...(booking?.id ? { excludeBookingId: booking.id.toString() } : {}),
      });
      const res = await fetch(`/api/venue-conflicts?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to check conflicts');
      return res.json();
    },
    enabled: conflictQueryEnabled,
  });

  const hasConflicts = (conflictData?.conflicts?.length ?? 0) > 0;

  useEffect(() => {
    setConflictOverride(false);
  }, [selectedVenueIds, startDate, startTime, endTime]);

  const { data: regularBookers } = useRegularBookers();
  const { data: allMemberships } = useMemberships();
  const { data: allMous } = useMous();
  const { data: allBookings } = useBookings();
  const activeMemberships = useMemo(() => (allMemberships || []).filter(m => m.status === "active"), [allMemberships]);
  const activeMous = useMemo(() => (allMous || []).filter(m => m.status === "active"), [allMous]);

  const handleBookerSelected = useCallback(async (contactId: number) => {
    setBookerId(contactId);
    setBookerSearch("");
    setAgreementAutoPopulated(false);
    const rb = regularBookers?.find(r => r.contactId === contactId);
    if (rb) {
      if (rb.membershipId) {
        setMembershipId(rb.membershipId);
        setMouId(null);
        setAgreementAutoPopulated(true);
      } else if (rb.mouId) {
        setMouId(rb.mouId);
        setMembershipId(null);
        setAgreementAutoPopulated(true);
      } else {
        setMembershipId(null);
        setMouId(null);
      }
    }

    try {
      const res = await fetch(`/api/contacts/${contactId}/groups`, { credentials: 'include' });
      if (res.ok) {
        const memberships = await res.json();
        if (memberships.length === 1) {
          setGroupId(memberships[0].groupId);
          setGroupAutoMatchOptions([]);
          setShowGroupPicker(false);
        } else if (memberships.length > 1) {
          setGroupAutoMatchOptions(memberships);
          setShowGroupPicker(true);
          setGroupId(null);
        } else {
          setGroupId(null);
          setGroupAutoMatchOptions([]);
          setShowGroupPicker(false);
        }
      } else {
        setGroupId(null);
        setGroupAutoMatchOptions([]);
        setShowGroupPicker(false);
      }
    } catch (err) {
      setGroupId(null);
      setGroupAutoMatchOptions([]);
      setShowGroupPicker(false);
    }
  }, [regularBookers]);

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 4 }, (_, i) => (currentYear - 1 + i).toString());

  const filteredBookerContacts = useMemo(() => {
    if (!contacts || !bookerSearch.trim()) return [];
    const term = bookerSearch.toLowerCase();
    return contacts
      .filter((c) => c.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [contacts, bookerSearch]);

  const filteredBookerGroups = useMemo(() => {
    if (!allGroups || !groupSearch.trim()) return [];
    const term = groupSearch.toLowerCase();
    return (allGroups as any[]).filter((g: any) => g.name.toLowerCase().includes(term)).slice(0, 8);
  }, [allGroups, groupSearch]);

  const handleQuickAddBooker = async () => {
    if (!quickBookerName.trim()) return;
    try {
      const newContact = await createContact.mutateAsync({
        name: quickBookerName.trim(),
        ...(quickBookerEmail.trim() ? { email: quickBookerEmail.trim() } : {}),
      });
      setBookerId(newContact.id);
      setQuickBookerName("");
      setQuickBookerEmail("");
      setShowQuickAddBooker(false);
      setBookerSearch("");
    } catch (err: any) {}
  };

  const handleQuickAddGroup = async () => {
    if (!quickGroupName.trim()) return;
    try {
      const newGroup = await createGroup.mutateAsync({ name: quickGroupName.trim(), type: "Business" });
      setGroupId(newGroup.id);
      setQuickGroupName("");
      setShowQuickAddGroup(false);
      setGroupSearch("");
    } catch (err: any) {}
  };

  const selectedVenueSpaceNames = useMemo(() => {
    const selected = venues.filter(v => selectedVenueIds.includes(v.id));
    return [...new Set(selected.map(v => v.spaceName).filter(Boolean))] as string[];
  }, [selectedVenueIds, venues]);

  const allSpaceNames = useMemo(() => {
    return [...new Set(venues.filter(v => v.active !== false).map(v => v.spaceName).filter(Boolean))] as string[];
  }, [venues]);

  const agreementAllowedLocations = useMemo(() => {
    if (membershipId) {
      const m = activeMemberships.find(ms => ms.id === membershipId);
      const locs = m?.allowedLocations;
      return locs && locs.length > 0 ? locs as string[] : null;
    }
    if (mouId) {
      const m = activeMous.find(ms => ms.id === mouId);
      const locs = m?.allowedLocations;
      return locs && locs.length > 0 ? locs as string[] : null;
    }
    return null;
  }, [membershipId, mouId, activeMemberships, activeMous]);

  const venuesByLocation = useMemo(() => {
    const activeVenues = venues.filter(v => v.active !== false);
    const grouped: Record<string, typeof activeVenues> = {};
    for (const v of activeVenues) {
      const loc = v.spaceName || "Other";
      if (agreementAllowedLocations && !agreementAllowedLocations.includes(loc)) continue;
      if (!grouped[loc]) grouped[loc] = [];
      grouped[loc].push(v);
    }
    return grouped;
  }, [venues, agreementAllowedLocations]);

  useEffect(() => {
    if (!agreementAllowedLocations || selectedVenueIds.length === 0) return;
    const allowedVenueIds = venues
      .filter(v => v.active !== false && agreementAllowedLocations.includes(v.spaceName || "Other"))
      .map(v => v.id);
    const filtered = selectedVenueIds.filter(id => allowedVenueIds.includes(id));
    if (filtered.length !== selectedVenueIds.length) {
      setSelectedVenueIds(filtered);
    }
  }, [agreementAllowedLocations]);

  const effectiveLocationAccess = locationAccessOverride ?? selectedVenueSpaceNames;

  const bookingsForCalendar = useMemo(() => {
    if (!allBookings) return [];
    return allBookings.filter(b => b.startDate && b.status !== "cancelled");
  }, [allBookings]);

  const getBookingsForDate = useCallback((dateStr: string) => {
    return bookingsForCalendar.filter(b => {
      if (!b.startDate) return false;
      const sd = new Date(b.startDate);
      const bDate = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`;
      let bEndDate = bDate;
      if (b.endDate) {
        const ed = new Date(b.endDate);
        bEndDate = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}-${String(ed.getDate()).padStart(2, "0")}`;
      }
      return dateStr >= bDate && dateStr <= bEndDate;
    });
  }, [bookingsForCalendar]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), inMonth: false });
      }
    }
    return days;
  }, [calendarMonth]);

  const handleSubmit = () => {
    if (!classification || selectedVenueIds.length === 0) return;
    const data: any = {
      venueId: selectedVenueIds[0],
      venueIds: selectedVenueIds,
      classification,
      status,
      startDate: !isTBC && startDate ? new Date(startDate).toISOString() : null,
      endDate: !isTBC && isMultiDay && endDate ? new Date(endDate).toISOString() : null,
      startTime: !isTBC && startTime ? startTime : null,
      endTime: !isTBC && endTime ? endTime : null,
      isMultiDay,
      tbcMonth: isTBC ? tbcMonth : null,
      tbcYear: isTBC ? tbcYear : null,
      pricingTier,
      durationType: pricingTier === "free_koha" ? "hourly" : durationType,
      rateType: pricingTier === "free_koha" ? "standard" : rateType,
      amount: amount || "0",
      bookerId: bookerId || null,
      bookerGroupId: groupId || null,
      membershipId: membershipId || null,
      mouId: mouId || null,
      notes: notes.trim() || undefined,
      locationAccess: effectiveLocationAccess.length > 0 ? effectiveLocationAccess : null,
      ...(conflictOverride ? { conflictOverride: true } : {}),
    };
    onSubmit(data);
  };

  const isFreeKoha = pricingTier === "free_koha";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-booking-dialog-title">
            {booking ? "Edit Venue Hire" : "New Venue Hire"}
          </DialogTitle>
          <DialogDescription>
            {booking ? "Update venue hire details and schedule." : "Create a new venue hire."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* STEP 1: Booker */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Booker (Person)</Label>
            {bookerId && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid="badge-selected-booker">
                  {contacts?.find((c) => c.id === bookerId)?.name || `Contact #${bookerId}`}
                  <button
                    onClick={() => { setBookerId(null); setGroupAutoMatchOptions([]); setShowGroupPicker(false); }}
                    className="ml-0.5 transition-colors"
                    type="button"
                    data-testid="button-remove-booker"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={bookerSearch}
                onChange={(e) => setBookerSearch(e.target.value)}
                placeholder="Search contacts..."
                className="h-8 text-xs pl-7"
                data-testid="input-search-booker"
              />
            </div>
            {bookerSearch.trim() && (
              <>
                {filteredBookerContacts.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                    {filteredBookerContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleBookerSelected(c.id)}
                        className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between"
                        type="button"
                        data-testid={`button-select-booker-${c.id}`}
                      >
                        <span>{c.name}</span>
                        <UserPlus className="w-3 h-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
            {showQuickAddBooker && (
              <div className="flex flex-col gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                <div className="flex items-center gap-2">
                  <Input
                    value={quickBookerName}
                    onChange={(e) => setQuickBookerName(e.target.value)}
                    placeholder="Name *"
                    className="h-7 text-xs flex-1"
                    data-testid="input-quick-add-booker-name"
                  />
                  <Input
                    value={quickBookerEmail}
                    onChange={(e) => setQuickBookerEmail(e.target.value)}
                    placeholder="Email (optional)"
                    type="email"
                    className="h-7 text-xs flex-1"
                    data-testid="input-quick-add-booker-email"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleQuickAddBooker}
                    disabled={!quickBookerName.trim() || createContact.isPending}
                    data-testid="button-save-quick-booker"
                  >
                    {createContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setShowQuickAddBooker(false); setQuickBookerName(""); setQuickBookerEmail(""); }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
              </>
            )}
          </div>

          {/* Group auto-match picker */}
          {showGroupPicker && groupAutoMatchOptions.length > 1 && (
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md p-2.5 space-y-2">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">This booker belongs to multiple groups. Select one:</p>
              <div className="space-y-1">
                {groupAutoMatchOptions.map((m: any) => (
                  <button
                    key={m.groupId}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    data-testid={`button-auto-match-group-${m.groupId}`}
                    onClick={() => { setGroupId(m.groupId); setShowGroupPicker(false); setGroupAutoMatchOptions([]); }}
                  >
                    <Network className="w-3 h-3 text-muted-foreground" />
                    <span>{m.groupName || `Group #${m.groupId}`}</span>
                    {m.groupType && <Badge variant="outline" className="text-[10px]">{m.groupType}</Badge>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Organisation / Group */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Organisation / Group</Label>
            {groupId && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid="badge-selected-booking-group">
                  <Network className="w-3 h-3 mr-0.5" />
                  {(allGroups as any[])?.find((g: any) => g.id === groupId)?.name || `Group #${groupId}`}
                  <button
                    onClick={() => setGroupId(null)}
                    className="ml-0.5 transition-colors"
                    type="button"
                    data-testid="button-remove-booking-group"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}
            <div className="relative">
              <Network className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search groups..."
                className="h-8 text-xs pl-7"
                data-testid="input-search-booking-group"
              />
            </div>
            {groupSearch.trim() && (
              <>
                {filteredBookerGroups.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                    {filteredBookerGroups.map((g: any) => (
                      <button
                        key={g.id}
                        onClick={() => { setGroupId(g.id); setGroupSearch(""); }}
                        className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between"
                        type="button"
                        data-testid={`button-select-booking-group-${g.id}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Network className="w-3 h-3 text-muted-foreground" />
                          {g.name}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{g.type}</Badge>
                      </button>
                    ))}
                  </div>
                )}
                {filteredBookerGroups.length === 0 && !showQuickAddGroup && (
                  <div className="text-xs text-muted-foreground flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <span>No groups found for "{groupSearch}"</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setQuickGroupName(groupSearch);
                        setShowQuickAddGroup(true);
                      }}
                      data-testid="button-quick-add-group"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Quick Add
                    </Button>
                  </div>
                )}
              </>
            )}
            {showQuickAddGroup && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                <Input
                  value={quickGroupName}
                  onChange={(e) => setQuickGroupName(e.target.value)}
                  placeholder="Organisation name"
                  className="h-7 text-xs flex-1"
                  data-testid="input-quick-add-group-name"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleQuickAddGroup}
                  disabled={!quickGroupName.trim() || createGroup.isPending}
                  data-testid="button-save-quick-group"
                >
                  {createGroup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowQuickAddGroup(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* STEP 3: Location-first venue selection */}
          <div>
            <Label>Venue(s) *</Label>
            <p className="text-xs text-muted-foreground mb-2">Select one or more spaces for this booking</p>
            {agreementAllowedLocations && (
              <div className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 rounded-md p-2 mb-2" data-testid="text-location-restriction-note">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Showing venues in allowed locations only: {agreementAllowedLocations.join(", ")}</span>
              </div>
            )}
            <div className="space-y-1">
              {Object.entries(venuesByLocation).map(([location, locationVenues]) => {
                const isExpanded = expandedLocations.has(location);
                const selectedCount = locationVenues.filter(v => selectedVenueIds.includes(v.id)).length;
                const allSelected = selectedCount === locationVenues.length;
                return (
                  <div key={location} className="border border-border/50 rounded-md" data-testid={`venue-location-${location}`}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 rounded-md"
                      onClick={() => {
                        setExpandedLocations(prev => {
                          const next = new Set(prev);
                          if (next.has(location)) next.delete(location);
                          else next.add(location);
                          return next;
                        });
                      }}
                      data-testid={`button-toggle-location-${location}`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{location}</span>
                        {selectedCount > 0 && (
                          <Badge variant="secondary" className="text-[10px]">{selectedCount} selected</Badge>
                        )}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 space-y-1.5">
                        {locationVenues.length > 1 && (
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground pl-1">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(checked) => {
                                setSelectedVenueIds(prev => {
                                  if (checked) {
                                    const ids = new Set([...prev, ...locationVenues.map(v => v.id)]);
                                    return [...ids];
                                  } else {
                                    return prev.filter(id => !locationVenues.some(v => v.id === id));
                                  }
                                });
                              }}
                            />
                            <span className="italic">Select all in {location}</span>
                          </label>
                        )}
                        {locationVenues.map(v => (
                          <label key={v.id} className="flex items-center gap-2 cursor-pointer pl-1" data-testid={`checkbox-venue-${v.id}`}>
                            <Checkbox
                              checked={selectedVenueIds.includes(v.id)}
                              onCheckedChange={(checked) => {
                                setSelectedVenueIds(prev =>
                                  checked
                                    ? [...prev, v.id]
                                    : prev.filter(id => id !== v.id)
                                );
                              }}
                            />
                            <span className="text-sm">{v.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {allSpaceNames.length > 1 && (
            <div>
              <Label>Location Access</Label>
              <p className="text-xs text-muted-foreground mb-2">Which locations can the booker access? Pre-selected from venues above.</p>
              <div className="space-y-2">
                {allSpaceNames.map((name) => (
                  <label key={name} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-location-access-${name}`}>
                    <Checkbox
                      checked={effectiveLocationAccess.includes(name)}
                      onCheckedChange={(checked) => {
                        const current = [...effectiveLocationAccess];
                        if (checked) {
                          setLocationAccessOverride([...current, name]);
                        } else {
                          setLocationAccessOverride(current.filter(n => n !== name));
                        }
                      }}
                    />
                    <span className="text-sm">{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Classification */}
          <div>
            <Label>Classification *</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger data-testid="select-booking-classification">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STEP 5: Status (Confirmed, Completed, Cancelled only) */}
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-booking-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENUE_HIRE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STEP 6: Date & Time with calendar view */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Date & Time</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="booking-multi-day-toggle">Multi-day</Label>
                  <Switch
                    id="booking-multi-day-toggle"
                    checked={isMultiDay}
                    onCheckedChange={setIsMultiDay}
                    data-testid="switch-booking-multi-day"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="booking-tbc-toggle">Date TBC</Label>
                  <Switch
                    id="booking-tbc-toggle"
                    checked={isTBC}
                    onCheckedChange={setIsTBC}
                    data-testid="switch-booking-tbc"
                  />
                </div>
              </div>
            </div>

            {isTBC ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Month</Label>
                  <Select value={tbcMonth} onValueChange={setTbcMonth}>
                    <SelectTrigger data-testid="select-booking-tbc-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Year</Label>
                  <Select value={tbcYear} onValueChange={setTbcYear}>
                    <SelectTrigger data-testid="select-booking-tbc-year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mini monthly calendar */}
                <div className="border border-border rounded-md p-2" data-testid="booking-calendar">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground p-1"
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      data-testid="button-calendar-prev-month"
                    >
                      <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                    </button>
                    <span className="text-xs font-medium">
                      {calendarMonth.toLocaleDateString("en-NZ", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground p-1"
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      data-testid="button-calendar-next-month"
                    >
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-0">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                      <div key={d} className="text-[10px] text-center text-muted-foreground font-medium py-0.5">{d}</div>
                    ))}
                    {calendarDays.map(({ date, inMonth }, i) => {
                      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      const dayBookings = getBookingsForDate(dateStr);
                      const isSelected = dateStr === startDate;
                      const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`text-[11px] py-1 rounded relative text-center ${
                            !inMonth ? "text-muted-foreground/30" : ""
                          } ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""} ${
                            isToday && !isSelected ? "ring-1 ring-primary/50" : ""
                          } hover:bg-muted/50`}
                          onClick={() => {
                            setStartDate(dateStr);
                            if (!isMultiDay) setEndDate(dateStr);
                            setCalendarDayView(dateStr);
                          }}
                          data-testid={`calendar-day-${dateStr}`}
                        >
                          {date.getDate()}
                          {dayBookings.length > 0 && (
                            <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5`}>
                              {dayBookings.length <= 3 ? dayBookings.map((_, idx) => (
                                <span key={idx} className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
                              )) : (
                                <span className={`w-1.5 h-1 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day view showing existing bookings */}
                {calendarDayView && (() => {
                  const dayBookingsList = getBookingsForDate(calendarDayView);
                  return dayBookingsList.length > 0 ? (
                    <div className="bg-muted/20 border border-border/50 rounded-md p-2 space-y-1" data-testid="calendar-day-view">
                      <p className="text-[10px] font-medium text-muted-foreground">
                        Existing bookings on {new Date(calendarDayView + "T00:00:00").toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}:
                      </p>
                      {dayBookingsList.map(b => (
                        <div key={b.id} className="flex items-center gap-2 text-[10px] text-muted-foreground" data-testid={`day-view-booking-${b.id}`}>
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span>{b.startTime ? formatTimeSlot(b.startTime) : "?"} – {b.endTime ? formatTimeSlot(b.endTime) : "?"}</span>
                          <span className="truncate">{b.title || b.classification}</span>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {isMultiDay && (
                  <div>
                    <Label className="text-xs text-muted-foreground">End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      data-testid="input-booking-end-date"
                    />
                  </div>
                )}

                {startDate && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {new Date(startDate + "T00:00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {isMultiDay && endDate && ` – ${new Date(endDate + "T00:00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger data-testid="select-booking-start-time">
                        <SelectValue placeholder="Select start" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {TIME_SLOTS.map((t) => (
                          <SelectItem key={t} value={t}>{formatTimeSlot(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <Select value={endTime} onValueChange={setEndTime}>
                      <SelectTrigger data-testid="select-booking-end-time">
                        <SelectValue placeholder="Select end" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {TIME_SLOTS.filter(t => !startTime || t > startTime).map((t) => (
                          <SelectItem key={t} value={t}>{formatTimeSlot(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {conflictQueryEnabled && hasConflicts && (
            <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 p-3 space-y-3" data-testid="conflict-warning">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300" data-testid="text-conflict-detected">Conflict Detected</span>
              </div>
              <div className="space-y-1.5 pl-6">
                {conflictData!.conflicts.map((c) => (
                  <div key={`${c.type}-${c.id}`} className="flex items-center gap-2 text-xs" data-testid={`conflict-item-${c.type}-${c.id}`}>
                    <Badge variant="secondary" className="text-[10px]">{c.type === "booking" ? "Venue Hire" : "Programme"}</Badge>
                    <span className="text-muted-foreground">{c.title || "Untitled"}</span>
                    <span className="text-muted-foreground">{c.time}</span>
                  </div>
                ))}
              </div>
              {conflictData!.availableSlots.length > 0 && (
                <div className="pl-6 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground" data-testid="text-available-times-label">Available times today:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {conflictData!.availableSlots.map((slot) => (
                      <Badge
                        key={`${slot.startTime}-${slot.endTime}`}
                        variant="outline"
                        className="text-[10px] cursor-pointer"
                        data-testid={`badge-available-slot-${slot.startTime}`}
                        onClick={() => {
                          setStartTime(slot.startTime);
                          setEndTime(slot.endTime);
                          setConflictOverride(false);
                        }}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimeSlot(slot.startTime)} - {formatTimeSlot(slot.endTime)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {!conflictOverride ? (
                <div className="pl-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                    onClick={() => setConflictOverride(true)}
                    data-testid="button-override-conflict"
                  >
                    Override & Book Anyway
                  </Button>
                </div>
              ) : (
                <div className="pl-6 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" data-testid="badge-override-active">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Override active
                  </Badge>
                </div>
              )}
            </Card>
          )}

          {conflictQueryEnabled && conflictLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1" data-testid="conflict-loading">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking for conflicts...
            </div>
          )}

          {/* STEP 7: Pricing (conditional fields for Free / Koha) */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Pricing (GST Exclusive)</Label>
            <div>
              <Label className="text-xs text-muted-foreground">Pricing Tier</Label>
              <Select value={pricingTier} onValueChange={setPricingTier}>
                <SelectTrigger data-testid="select-booking-pricing-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>{PRICING_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isFreeKoha && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <Select value={durationType} onValueChange={(v) => { setDurationType(v); applyDefaultRate(v, rateType); }}>
                    <SelectTrigger data-testid="select-booking-duration-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{DURATION_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rate</Label>
                  <Select value={rateType} onValueChange={(v) => { setRateType(v); applyDefaultRate(durationType, v); }}>
                    <SelectTrigger data-testid="select-booking-rate-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{RATE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">
                {isFreeKoha ? "Koha Amount (optional)" : "Amount (excl. GST)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-booking-amount"
                />
              </div>
              {!isFreeKoha && rateType === "community" && parseFloat(amount || "0") > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1" data-testid="text-community-rate-info">
                  Standard rate: ${(parseFloat(amount || "0") / (1 - COMMUNITY_DISCOUNT)).toFixed(2)} → Community rate (20% off): ${parseFloat(amount || "0").toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* STEP 8: Agreement (de-emphasised, collapsible) */}
          {(activeMemberships.length > 0 || activeMous.length > 0) && (
            <div>
              {(membershipId || mouId) ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-agreement-auto-populated">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>
                    {agreementAutoPopulated ? "Auto-linked:" : "Linked:"}{" "}
                    {(() => {
                      const m = membershipId ? activeMemberships.find(ms => ms.id === membershipId) : null;
                      const mou = mouId ? activeMous.find(ms => ms.id === mouId) : null;
                      return m ? m.name : (mou as any)?.title || "Agreement";
                    })()}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setAgreementExpanded(!agreementExpanded)}
                    data-testid="button-toggle-agreement"
                  >
                    {agreementExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAgreementExpanded(!agreementExpanded)}
                  data-testid="button-toggle-agreement"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Link agreement</span>
                  {agreementExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {agreementExpanded && (
                <div className="mt-2 space-y-2 pl-5 border-l-2 border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                    {activeMemberships.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Membership</Label>
                        <Select
                          value={membershipId?.toString() || "none"}
                          onValueChange={(v) => {
                            setMembershipId(v === "none" ? null : parseInt(v));
                            if (v !== "none") setMouId(null);
                            setAgreementAutoPopulated(false);
                          }}
                        >
                          <SelectTrigger data-testid="select-booking-membership">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {activeMemberships.map((m) => (
                              <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {activeMous.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">MOU</Label>
                        <Select
                          value={mouId?.toString() || "none"}
                          onValueChange={(v) => {
                            setMouId(v === "none" ? null : parseInt(v));
                            if (v !== "none") setMembershipId(null);
                            setAgreementAutoPopulated(false);
                          }}
                        >
                          <SelectTrigger data-testid="select-booking-mou">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {activeMous.map((m) => (
                              <SelectItem key={m.id} value={m.id.toString()}>{m.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {(membershipId || mouId) && (() => {
                    const m = membershipId ? activeMemberships.find(ms => ms.id === membershipId) : null;
                    const mou = mouId ? activeMous.find(ms => ms.id === mouId) : null;
                    const agreement = m || mou;
                    if (!agreement) return null;
                    const allowance = (agreement as any).bookingAllowance;
                    const period = (agreement as any).allowancePeriod || "quarterly";
                    const periodLabel = getPeriodLabel(period);
                    const type = membershipId ? "membership" as const : "mou" as const;
                    const id = (membershipId || mouId)!;
                    const used = getAgreementAllowanceUsage(allBookings, type, id, period);
                    const remaining = allowance ? Math.max(0, allowance - used) : null;
                    return allowance ? (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3 text-blue-500" />
                        <span>{used}/{allowance} used this {periodLabel}</span>
                        {remaining !== null && (
                          <Badge variant="secondary" className={`text-[10px] ${remaining === 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : ""}`}>
                            {remaining} remaining
                          </Badge>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* STEP 9: Notes (prominent with clear kaupapa labelling) */}
          <div>
            <Label className="text-sm font-semibold">Booking Notes / Kaupapa</Label>
            <p className="text-xs text-muted-foreground mb-1">Capture the purpose of this booking for reporting</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What is the kaupapa (purpose) for this booking? E.g., rehearsal for upcoming show, community workshop on..."
              rows={3}
              data-testid="input-booking-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-booking">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !classification || selectedVenueIds.length === 0 || (hasConflicts && !conflictOverride)}
            data-testid="button-save-booking"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {booking ? "Save Changes" : "Create Venue Hire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
