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
  useVenues,
  useCreateVenue,
  useUpdateVenue,
  useDeleteVenue,
  useBookings,
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useBookingPricingDefaults,
  useUpdateBookingPricingDefaults,
  useRegularBookers,
  useVenueInstructions,
  useCreateVenueInstruction,
  useUpdateVenueInstruction,
  useDeleteVenueInstruction,
} from "@/hooks/use-bookings";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useGroups, useCreateGroup, useAllGroupAssociations } from "@/hooks/use-groups";
import { useMemberships, useMous } from "@/hooks/use-memberships";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
  MoreVertical,
  Clock,
  Users,
  X,
  Copy,
  Building,
  Building2,
  CheckCircle2,
  BarChart3,
  UserPlus,
  Network,
  LayoutList,
  Columns3,
  GripVertical,
  AlertCircle,
  Ban,
  CircleDashed,
  MapPin,
  FileText,
  Package,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Settings,
  Moon,
  Receipt,
  Link2,
  Unlink,
  Filter,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  ThumbsUp,
  ThumbsDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { BOOKING_CLASSIFICATIONS, BOOKING_STATUSES, PRICING_TIERS, DURATION_TYPES, RATE_TYPES, COMMUNITY_DISCOUNT, INSTRUCTION_TYPES, REGULAR_BOOKER_STATUSES, PAYMENT_TERMS, type Booking, type Venue, type Contact, type RegularBooker, type VenueInstruction, type Group } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/ui/metric-card";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Community Event": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "Private Hire": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Rehearsal": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Meeting": "bg-green-500/15 text-green-700 dark:text-green-300",
  "Pop-up": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "Other": "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

const STATUS_CARD_COLORS: Record<string, string> = {
  enquiry: "bg-yellow-50/50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
  confirmed: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  completed: "bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-900/20 opacity-70",
  cancelled: "bg-gray-100/30 dark:bg-gray-900/10 border-gray-100 dark:border-gray-900/20 opacity-70",
};

const STATUS_LABELS: Record<string, string> = {
  enquiry: "Enquiry",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  enquiry: CircleDashed,
  confirmed: CheckCircle2,
  completed: CheckCircle2,
  cancelled: Ban,
};

const STATUS_ICON_COLORS: Record<string, string> = {
  enquiry: "text-yellow-500",
  confirmed: "text-blue-500",
  completed: "text-green-500",
  cancelled: "text-gray-400",
};

interface RecurringTemplate {
  id: number;
  name: string;
  venue_id: number | null;
  classification: string | null;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  booker_name: string | null;
  notes: string | null;
  active: boolean;
}

const DAYS_OF_WEEK_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

const TIME_SLOTS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00",
];

function formatTimeSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function Bookings({ embedded }: { embedded?: boolean } = {}) {
  const { data: bookings, isLoading } = useBookings();
  const { data: venues } = useVenues();
  const { data: regularBookers } = useRegularBookers();
  const { data: contacts } = useContacts();
  const { data: allGroups } = useGroups();
  const { data: allAssociations } = useAllGroupAssociations();
  const { data: allMemberships } = useMemberships();
  const { data: allGroupMemberships } = useQuery<any[]>({
    queryKey: ["/api/group-memberships/all"],
  });
  const { data: allMous } = useMous();
  const { data: pricingDefaults } = useBookingPricingDefaults();

  const { data: allChangeRequests } = useQuery<any[]>({
    queryKey: ['/api/booking-change-requests'],
  });

  const { data: recurringTemplates } = useQuery<RecurringTemplate[]>({
    queryKey: ['/api/recurring-booking-templates'],
  });

  const pendingChangeRequestBookingIds = useMemo(() => {
    if (!allChangeRequests) return new Set<number>();
    return new Set(allChangeRequests.filter(cr => cr.status === "pending").map(cr => cr.bookingId));
  }, [allChangeRequests]);

  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking();
  const deleteMutation = useDeleteBooking();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "kanban">("calendar");
  const [calMonth, setCalMonth] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hirerPreviewOpen, setHirerPreviewOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionBooking, setCompletionBooking] = useState<Booking | null>(null);
  const [completionNeedsInvoice, setCompletionNeedsInvoice] = useState(false);
  const [completionInvoiceDone, setCompletionInvoiceDone] = useState(false);
  const [completionServedDone, setCompletionServedDone] = useState(false);
  const [completionInvoiceLoading, setCompletionInvoiceLoading] = useState(false);
  const [completionServedLoading, setCompletionServedLoading] = useState(false);
  const [swimlaneMode, setSwimlaneMode] = useState(false);
  const [calShowAll, setCalShowAll] = useState(false);
  const [recurringTemplateDetail, setRecurringTemplateDetail] = useState<RecurringTemplate | null>(null);
  const [showArchivedColumns, setShowArchivedColumns] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => {
      const bVIds = b.venueIds || (b.venueId ? [b.venueId] : []);
      const venueName = bVIds.map((id: number) => venues?.find((v) => v.id === id)?.name).filter(Boolean).join(" + ") || "";
      const matchesSearch =
        (b.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.description || "").toLowerCase().includes(search.toLowerCase()) ||
        venueName.toLowerCase().includes(search.toLowerCase());
      const matchesClass = classFilter === "all" || b.classification === classFilter;
      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [bookings, venues, search, classFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!bookings) return { total: 0, confirmed: 0, communityHours: 0, revenue: 0, inKind: 0, membershipBookings: 0, mouBookings: 0 };

    // In calendar view, scope stats to selected month (unless showing all)
    const useMonthFilter = viewMode === "calendar" && !calShowAll;
    const mStart = startOfMonth(calMonth);
    const mEnd = endOfMonth(calMonth);
    const scoped = useMonthFilter
      ? bookings.filter(b => {
          if (!b.startDate) return false;
          const d = new Date(b.startDate);
          return d >= mStart && d <= mEnd;
        })
      : bookings;

    const nonCancelled = scoped.filter((b) => b.status !== "cancelled");
    const confirmed = scoped.filter((b) => b.status === "confirmed").length;
    const completed = scoped.filter((b) => b.status === "completed");

    let communityHours = 0;
    completed.forEach((b) => {
      if (b.startTime && b.endTime) {
        const [sh, sm] = b.startTime.split(":").map(Number);
        const [eh, em] = b.endTime.split(":").map(Number);
        const diff = (eh * 60 + em - sh * 60 - sm) / 60;
        if (diff > 0) communityHours += diff;
      }
    });

    let revenue = 0;
    let inKind = 0;
    let membershipBookings = 0;
    let mouBookings = 0;
    const confirmedAndCompleted = scoped.filter((b) => b.status === "confirmed" || b.status === "completed");
    confirmedAndCompleted.forEach((b) => {
      const amt = parseFloat(b.amount || "0");
      if (b.pricingTier === "free_koha") {
        inKind += amt;
      } else {
        revenue += amt;
      }
    });
    nonCancelled.forEach((b) => {
      if (b.membershipId) membershipBookings++;
      if (b.mouId) mouBookings++;
    });

    return { total: nonCancelled.length, confirmed, communityHours, revenue, inKind, membershipBookings, mouBookings };
  }, [bookings, viewMode, calMonth, calShowAll]);

  const getVenueName = (venueId: number) => {
    return venues?.find((v) => v.id === venueId)?.name || "Unknown Venue";
  };

  const getVenueNames = (booking: any) => {
    const ids = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
    if (ids.length === 0) return "No Venue";
    return ids.map((id: number) => getVenueName(id)).join(" + ");
  };

  const getBookerName = (bookerId: number | null) => {
    if (!bookerId || !contacts) return null;
    return contacts.find((c) => c.id === bookerId)?.name || null;
  };

  const getBookerOrgName = (bookerId: number | null | undefined) => {
    if (!bookerId || !regularBookers) return null;
    const rb = (regularBookers as any[]).find((r: any) => r.contactId === bookerId);
    return rb?.organizationName || null;
  };

  const getBookingGroupName = (gId: number | null | undefined) => {
    if (!gId || !allGroups) return null;
    const groupName = (allGroups as any[]).find((g: any) => g.id === gId)?.name || null;
    if (!groupName) return null;
    if (allAssociations) {
      const parentAssoc = (allAssociations as any[]).find(
        (a: any) => a.associatedGroupId === gId && a.relationshipType === "parent"
      );
      if (parentAssoc) {
        const parentGroup = (allGroups as any[]).find((g: any) => g.id === parentAssoc.groupId);
        if (parentGroup) {
          return `${groupName} · ${parentGroup.name}`;
        }
      }
    }
    return groupName;
  };

  // Fallback: look up group name via contact's group membership when booking has no bookerGroupId
  const getBookerGroupViaContact = (bookerId: number | null | undefined) => {
    if (!bookerId || !allGroupMemberships || !allGroups) return null;
    const membership = (allGroupMemberships as any[]).find((m: any) => m.contactId === bookerId);
    if (!membership) return null;
    return getBookingGroupName(membership.groupId);
  };

  const formatDateTime = (b: Booking) => {
    if (b.tbcMonth && b.tbcYear) {
      return { date: `TBC - ${b.tbcMonth} ${b.tbcYear}`, time: null };
    }
    if (!b.startDate) return null;
    const dateStr = format(new Date(b.startDate), "d MMM yyyy");
    const hasEndDate = b.endDate && format(new Date(b.endDate), "yyyy-MM-dd") !== format(new Date(b.startDate), "yyyy-MM-dd");
    const timeStr = b.startTime
      ? b.endTime
        ? `${formatTimeSlot(b.startTime)} - ${formatTimeSlot(b.endTime)}`
        : formatTimeSlot(b.startTime)
      : null;

    if (hasEndDate) {
      const endDateStr = format(new Date(b.endDate!), "d MMM yyyy");
      return { date: `${dateStr} - ${endDateStr}`, time: timeStr };
    }
    return { date: dateStr, time: timeStr };
  };

  const getBookingDisplayName = (b: Booking) => {
    const venueName = getVenueNames(b);
    const dateTime = formatDateTime(b);
    if (dateTime) return `${venueName} — ${dateTime.date}`;
    return venueName;
  };

  const handleDuplicate = async (b: Booking) => {
    try {
      await createMutation.mutateAsync({
        venueId: b.venueId,
        venueIds: b.venueIds || (b.venueId ? [b.venueId] : []),
        title: b.title || undefined,
        description: b.description || undefined,
        classification: b.classification,
        status: "confirmed",
        startDate: b.startDate || undefined,
        endDate: b.endDate || undefined,
        startTime: b.startTime || undefined,
        endTime: b.endTime || undefined,
        isMultiDay: b.isMultiDay || false,
        tbcMonth: b.tbcMonth || undefined,
        tbcYear: b.tbcYear || undefined,
        pricingTier: b.pricingTier,
        durationType: b.durationType || "hourly",
        rateType: b.rateType || "standard",
        amount: b.amount || "0",
        bookerId: b.bookerId || undefined,
        bookerGroupId: b.bookerGroupId || undefined,
        notes: b.notes || undefined,
      });
      toast({ title: "Duplicated", description: `Venue hire has been duplicated` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to duplicate", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Venue hire removed successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  const openCompletionDialog = useCallback(async (booking: Booking) => {
    try {
      const res = await apiRequest('POST', `/api/bookings/${booking.id}/complete`);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      const updatedBooking = data.booking || booking;
      setCompletionBooking(updatedBooking);
      setCompletionNeedsInvoice(data.needsInvoice || false);
      setCompletionInvoiceDone(!!updatedBooking.xeroInvoiceId);
      setCompletionServedDone(!!updatedBooking.servedAt);
      setCompletionInvoiceLoading(false);
      setCompletionServedLoading(false);
      setCompletionDialogOpen(true);
      toast({ title: "Venue hire completed", description: data.surveyDecision || "Venue hire marked as completed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to complete venue hire", variant: "destructive" });
    }
  }, [toast]);

  const openCompletionDialogForExisting = useCallback((booking: Booking) => {
    setCompletionBooking(booking);
    setCompletionNeedsInvoice(!booking.xeroInvoiceId && parseFloat(booking.amount || "0") > 0);
    setCompletionInvoiceDone(!!booking.xeroInvoiceId);
    setCompletionServedDone(!!booking.servedAt);
    setCompletionInvoiceLoading(false);
    setCompletionServedLoading(false);
    setCompletionDialogOpen(true);
  }, []);

  const handleGenerateInvoice = useCallback(async () => {
    if (!completionBooking) return;
    setCompletionInvoiceLoading(true);
    try {
      await apiRequest('POST', `/api/bookings/${completionBooking.id}/generate-invoice`);
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setCompletionInvoiceDone(true);
      toast({ title: "Invoice generated", description: "Xero invoice has been created" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate invoice", variant: "destructive" });
    } finally {
      setCompletionInvoiceLoading(false);
    }
  }, [completionBooking, toast]);

  const handleMarkServed = useCallback(async () => {
    if (!completionBooking) return;
    setCompletionServedLoading(true);
    try {
      await apiRequest('POST', `/api/bookings/${completionBooking.id}/mark-served`);
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setCompletionServedDone(true);
      toast({ title: "Marked as served", description: "Venue hire has been marked as served" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to mark as served", variant: "destructive" });
    } finally {
      setCompletionServedLoading(false);
    }
  }, [completionBooking, toast]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const rawId = result.destination.droppableId;
    // Support swimlane droppableIds like "Podcast Studio|confirmed"
    const newStatus = rawId.includes("|") ? rawId.split("|").pop()! : rawId;
    if (!BOOKING_STATUSES.includes(newStatus as any)) return;
    const bookingId = parseInt(result.draggableId);
    const booking = bookings?.find(b => b.id === bookingId);
    if (!booking || booking.status === newStatus) return;

    if (newStatus === "completed") {
      await openCompletionDialog(booking);
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: bookingId, data: { status: newStatus } });
      toast({ title: "Status updated", description: `Venue hire moved to ${STATUS_LABELS[newStatus]}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    }
  }, [bookings, updateMutation, toast, openCompletionDialog]);

  const kanbanColumns = useMemo(() => {
    const columns: Record<string, Booking[]> = {
      enquiry: [],
      confirmed: [],
      completed: [],
      cancelled: [],
    };
    filtered?.forEach(b => {
      if (columns[b.status]) columns[b.status].push(b);
    });
    // Sort confirmed by startDate ascending (ITEM 4)
    columns.confirmed.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate as unknown as string).getTime() - new Date(b.startDate as unknown as string).getTime();
    });
    return columns;
  }, [filtered]);

  const activeRecurringTemplates = useMemo(() => {
    return (recurringTemplates || []).filter(t => t.active);
  }, [recurringTemplates]);

  // For swimlanes: group venues by spaceName
  const locationGroups = useMemo(() => {
    if (!venues) return [];
    const groups = new Map<string, number[]>();
    venues.forEach(v => {
      const key = v.spaceName || "Unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v.id);
    });
    // Add "Unassigned" for bookings with no venue
    if (!groups.has("Unassigned")) groups.set("Unassigned", []);
    return Array.from(groups.entries()).map(([name, venueIds]) => ({ name, venueIds }));
  }, [venues]);

  const isOldBooking = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return (booking: Booking) => {
      if (!booking.startDate) return false;
      return new Date(booking.startDate as unknown as string) < d;
    };
  }, []);

  const content = (
        <div className={`${viewMode === "kanban" ? "max-w-[1600px]" : "max-w-6xl"} mx-auto space-y-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {!embedded && (
              <div>
                <h1 className="text-3xl font-display font-bold" data-testid="text-bookings-title">Venue Hire</h1>
                <p className="text-muted-foreground mt-1">Manage venue hire and community space usage.</p>
              </div>
            )}
            <div className={`flex items-center gap-2 flex-wrap ${embedded ? "w-full justify-between" : ""}`}>
              <div className="flex items-center gap-2" data-testid="view-toggle">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "calendar" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("calendar")}
                    className="rounded-none gap-1.5 text-xs"
                    data-testid="button-calendar-view"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    Monthly
                  </Button>
                  <Button
                    variant={viewMode === "kanban" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                    className="rounded-none gap-1.5 text-xs"
                    data-testid="button-kanban-view"
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    Pipeline
                  </Button>
                </div>
                {viewMode === "kanban" && (
                  <Button
                    variant={swimlaneMode ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSwimlaneMode(s => !s)}
                    className="gap-1.5 text-xs"
                    data-testid="button-swimlane-view"
                    title="Group by location"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {swimlaneMode ? "Swimlanes" : "Swimlanes"}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSettingsOpen(true)}
                  data-testid="button-bookings-settings"
                >
                  <Settings className="w-5 h-5" />
                </Button>
                <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-create-booking">
                  <Plus className="w-4 h-4 mr-2" />
                  New Venue Hire
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title={viewMode === "calendar" && !calShowAll ? `Venue Hires — ${format(calMonth, "MMM yyyy")}` : "Total Venue Hires"}
              value={stats.total}
              icon={<Calendar className="w-4 h-4" />}
              color="primary"
              data-testid="stat-total-bookings"
            />
            <MetricCard
              title="Confirmed"
              value={stats.confirmed}
              icon={<CheckCircle2 className="w-4 h-4" />}
              color="blue"
              data-testid="stat-confirmed"
            />
            <MetricCard
              title="Community Hours"
              value={`${stats.communityHours.toFixed(1)}h`}
              icon={<Clock className="w-4 h-4" />}
              color="green"
              data-testid="stat-community-hours"
            />
            <MetricCard
              title="Revenue (excl. GST)"
              value={`$${stats.revenue.toFixed(2)}`}
              subtext={stats.inKind > 0 ? `+ $${stats.inKind.toFixed(2)} in-kind` : undefined}
              icon={<DollarSign className="w-4 h-4" />}
              color="accent"
              data-testid="stat-revenue"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search venue hires..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-bookings"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-classification-filter">
                <SelectValue placeholder="Classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {BOOKING_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {BOOKING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !bookings?.length ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-bookings">No venue hires yet</h3>
              <p className="text-muted-foreground mb-4">Create your first venue hire to get started.</p>
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-booking-empty">
                <Plus className="w-4 h-4 mr-2" />
                Create Venue Hire
              </Button>
            </Card>
          ) : viewMode === "calendar" ? (
            (() => {
              const calMonthStart = startOfMonth(calMonth);
              const calMonthEnd = endOfMonth(calMonth);

              const STATUS_DOT: Record<string, string> = {
                enquiry: "bg-yellow-500",
                confirmed: "bg-green-500",
                completed: "bg-blue-500",
                cancelled: "bg-red-300",
              };

              // Filter bookings by month (unless showing all)
              const calFiltered = (filtered || []).filter(b => {
                if (calShowAll) return true;
                if (!b.startDate) return false;
                const d = new Date(b.startDate);
                return d >= calMonthStart && d <= calMonthEnd;
              }).sort((a, b) => {
                if (!a.startDate || !b.startDate) return 0;
                return new Date(a.startDate as unknown as string).getTime() - new Date(b.startDate as unknown as string).getTime();
              });

              // Group by location (space_name columns)
              const getLocationForBooking = (booking: Booking): string => {
                const bVIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
                if (bVIds.length === 0) return "Unassigned";
                for (const lg of locationGroups) {
                  if (bVIds.some((id: number) => lg.venueIds.includes(id))) return lg.name;
                }
                return "Unassigned";
              };

              return (
                <div className="space-y-4">
                  {/* Month nav */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setCalShowAll(false); setCalMonth(m => subMonths(m, 1)); }} data-testid="button-cal-prev">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="text-lg font-semibold min-w-[160px] text-center" data-testid="text-cal-month">
                      {calShowAll ? "All Months" : format(calMonth, "MMMM yyyy")}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => { setCalShowAll(false); setCalMonth(m => addMonths(m, 1)); }} data-testid="button-cal-next">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={calShowAll ? "secondary" : "ghost"}
                      size="sm"
                      className="text-xs ml-1"
                      onClick={() => setCalShowAll(a => !a)}
                    >
                      All
                    </Button>
                    {!calShowAll && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setCalMonth(new Date())}
                      >
                        Today
                      </Button>
                    )}
                  </div>

                  {/* Status legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Enquiry</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Confirmed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Completed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300" /> Cancelled</span>
                    <span className="ml-auto text-muted-foreground">{calFiltered.length} booking{calFiltered.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Location columns */}
                  {calFiltered.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No venue hires {calShowAll ? "" : `in ${format(calMonth, "MMMM yyyy")}`}</p>
                    </Card>
                  ) : (
                    (() => {
                      const renderCard = (booking: Booking, faded?: boolean) => {
                        const dateTime = formatDateTime(booking);
                        const groupTitle = getBookerOrgName(booking.bookerId) || getBookingGroupName(booking.bookerGroupId) || getBookerGroupViaContact(booking.bookerId) || booking.bookerName || getBookerName(booking.bookerId) || "Unknown";
                        return (
                          <Card
                            key={booking.id}
                            className={`p-2.5 hover:bg-muted/30 cursor-pointer transition-colors ${faded ? "opacity-50" : ""}`}
                            onClick={() => setLocation(`/bookings/${booking.id}`)}
                            data-testid={`cal-card-${booking.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATUS_DOT[booking.status] || "bg-gray-400"}`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium truncate ${faded ? "line-through" : ""}`}>{groupTitle}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{getVenueNames(booking)}{booking.classification ? ` · ${booking.classification}` : ""}</p>
                                {dateTime && (
                                  <p className="text-[11px] text-muted-foreground">{dateTime.date}{dateTime.time ? ` · ${dateTime.time}` : ""}</p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      };

                      const getLocationForTemplate = (tmpl: RecurringTemplate): string => {
                        if (!tmpl.venue_id) return "Unassigned";
                        for (const lg of locationGroups) {
                          if (lg.venueIds.includes(tmpl.venue_id)) return lg.name;
                        }
                        return "Unassigned";
                      };

                      const renderRecurringCard = (tmpl: RecurringTemplate) => {
                        const tmplVenue = venues?.find(v => v.id === tmpl.venue_id);
                        const dayLabel = DAYS_OF_WEEK_LABELS[tmpl.day_of_week] || "Unknown";
                        const timeLabel = tmpl.start_time && tmpl.end_time
                          ? `${formatTimeSlot(tmpl.start_time)} – ${formatTimeSlot(tmpl.end_time)}`
                          : tmpl.start_time ? formatTimeSlot(tmpl.start_time) : null;
                        return (
                          <div
                            key={`recurring-${tmpl.id}`}
                            className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition-shadow"
                            onClick={() => setRecurringTemplateDetail(tmpl)}
                          >
                            <div className="flex items-start gap-2">
                              <RefreshCw className="w-3 h-3 text-blue-500 shrink-0 mt-1" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{tmpl.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {tmplVenue?.name}{tmpl.classification ? ` · ${tmpl.classification}` : ""}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Every {dayLabel}{timeLabel ? ` · ${timeLabel}` : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      };

                      const renderColumn = (locationName: string, allBookings: Booking[], locationTemplates: RecurringTemplate[]) => {
                        const active = allBookings.filter(b => b.status !== "cancelled");
                        const cancelled = allBookings.filter(b => b.status === "cancelled");
                        return (
                          <div key={locationName} className="flex flex-col">
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm font-semibold">{locationName}</span>
                              <Badge variant="secondary" className="text-[10px] ml-1">{active.length}</Badge>
                            </div>
                            {locationTemplates.length > 0 && (
                              <div className="space-y-2 mb-2">
                                {locationTemplates.map(t => renderRecurringCard(t))}
                              </div>
                            )}
                            <div className="space-y-2 flex-1">
                              {active.map(b => renderCard(b))}
                            </div>
                            {cancelled.length > 0 && (
                              <>
                                <div className="border-t border-dashed border-border my-3" />
                                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">Cancelled ({cancelled.length})</p>
                                <div className="space-y-2">
                                  {cancelled.map(b => renderCard(b, true))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      };

                      const realLocations = locationGroups.filter(lg => lg.name !== "Unassigned");
                      const hasUnassigned = calFiltered.some(b => getLocationForBooking(b) === "Unassigned");
                      const colCount = Math.min(realLocations.length + (hasUnassigned ? 1 : 0), 4);

                      return (
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                          {realLocations.map(({ name: locationName }) => {
                            const colBookings = calFiltered.filter(b => getLocationForBooking(b) === locationName);
                            const colTemplates = activeRecurringTemplates.filter(t => getLocationForTemplate(t) === locationName);
                            return renderColumn(locationName, colBookings, colTemplates);
                          })}
                          {hasUnassigned && renderColumn("Unassigned", calFiltered.filter(b => getLocationForBooking(b) === "Unassigned"), activeRecurringTemplates.filter(t => getLocationForTemplate(t) === "Unassigned"))}
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })()
          ) : viewMode === "kanban" ? (
            filtered?.length === 0 && activeRecurringTemplates.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No venue hires match your filters.</p>
              </Card>
            ) : swimlaneMode ? (
              // ── SWIMLANE MODE ──────────────────────────────────────────────
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="space-y-6" data-testid="kanban-swimlanes">
                  {locationGroups.map(({ name: locationName, venueIds: locationVenueIds }) => {
                    const getSwimlaneItems = (status: string) => {
                      return (filtered || []).filter(b => {
                        if (b.status !== status) return false;
                        const bookingVenueIds: number[] = b.venueIds || (b.venueId ? [b.venueId] : []);
                        if (bookingVenueIds.length === 0) return locationName === "Unassigned";
                        return bookingVenueIds.some(id => locationVenueIds.includes(id));
                      });
                    };
                    const locationRecurring = activeRecurringTemplates.filter(t => {
                      if (!t.venue_id) return locationName === "Unassigned";
                      return locationVenueIds.includes(t.venue_id);
                    });
                    const totalCount = BOOKING_STATUSES.reduce((acc, s) => acc + getSwimlaneItems(s).length, 0) + locationRecurring.length;
                    if (totalCount === 0) return null;
                    return (
                      <div key={locationName} className="border border-border rounded-xl overflow-hidden" data-testid={`swimlane-${locationName}`}>
                        <div className="bg-muted/40 px-4 py-2 flex items-center gap-2 border-b border-border">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{locationName}</span>
                          <Badge variant="secondary" className="text-[10px] ml-1">{totalCount}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-0 p-3 gap-3">
                          {BOOKING_STATUSES.map(status => {
                            const items = getSwimlaneItems(status);
                            const archivable = status === "completed" || status === "cancelled";
                            const colKey = `${locationName}__${status}`;
                            const showArchived = showArchivedColumns[colKey];
                            const visibleItems = archivable && !showArchived ? items.filter(b => !isOldBooking(b)) : items;
                            const archivedCount = items.length - visibleItems.length;
                            const StatusIcon = STATUS_ICONS[status] || CircleDashed;
                            return (
                              <div key={status} className="flex flex-col">
                                <div className="flex items-center gap-1.5 mb-2 px-1">
                                  <StatusIcon className={`w-3.5 h-3.5 ${STATUS_ICON_COLORS[status]}`} />
                                  <span className="text-xs font-semibold">{STATUS_LABELS[status]}</span>
                                  <Badge variant="secondary" className="text-[9px] ml-auto">{items.length}</Badge>
                                </div>
                                <Droppable droppableId={`${locationName}|${status}`}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`flex-1 min-h-[100px] rounded-lg p-1.5 space-y-1.5 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/20"}`}
                                    >
                                      {visibleItems.map((booking, index) => {
                                        const dateTime = formatDateTime(booking);
                                        return (
                                          <Draggable key={booking.id} draggableId={booking.id.toString()} index={index}>
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`bg-card rounded-md border p-2 transition-shadow text-xs ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : "shadow-sm"}`}
                                                data-testid={`swimlane-card-${booking.id}`}
                                              >
                                                <div className="flex items-start gap-1">
                                                  <div {...provided.dragHandleProps} className="cursor-grab mt-0.5">
                                                    <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <p className="font-medium truncate leading-tight">
                                                      {getBookerOrgName(booking.bookerId) || getBookingGroupName(booking.bookerGroupId) || getBookerGroupViaContact(booking.bookerId) || booking.bookerName || getBookerName(booking.bookerId) || getVenueNames(booking)}
                                                    </p>
                                                    {dateTime && (
                                                      <p className="text-[10px] text-muted-foreground truncate">{dateTime.date}{dateTime.time ? ` · ${dateTime.time}` : ""}</p>
                                                    )}
                                                  </div>
                                                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setEditBooking(booking)}>
                                                    <Pencil className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      })}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                                {status === "confirmed" && locationRecurring.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {visibleItems.length > 0 && <div className="border-t border-border/30 pt-2" />}
                                    {locationRecurring.map(tmpl => {
                                      const tmplVenue = venues?.find(v => v.id === tmpl.venue_id);
                                      const dayLabel = DAYS_OF_WEEK_LABELS[tmpl.day_of_week] || "Unknown";
                                      const timeLabel = tmpl.start_time && tmpl.end_time
                                        ? `${formatTimeSlot(tmpl.start_time)} – ${formatTimeSlot(tmpl.end_time)}`
                                        : tmpl.start_time ? formatTimeSlot(tmpl.start_time) : null;
                                      return (
                                        <div
                                          key={`swim-recurring-${tmpl.id}`}
                                          className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 cursor-pointer hover:shadow-sm transition-shadow text-xs"
                                          onClick={() => setRecurringTemplateDetail(tmpl)}
                                        >
                                          <div className="flex items-start gap-1">
                                            <RefreshCw className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                                            <div className="min-w-0 flex-1">
                                              <p className="font-medium truncate leading-tight">{tmpl.name}</p>
                                              <p className="text-[10px] text-muted-foreground truncate">
                                                Every {dayLabel}{timeLabel ? ` · ${timeLabel}` : ""}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {archivable && archivedCount > 0 && !showArchived && (
                                  <button
                                    className="mt-1 text-[10px] text-muted-foreground hover:text-foreground text-left px-1"
                                    onClick={() => setShowArchivedColumns(prev => ({ ...prev, [colKey]: true }))}
                                  >
                                    Show {archivedCount} archived
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DragDropContext>
            ) : (
              // ── STANDARD KANBAN ────────────────────────────────────────────
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-4 gap-4" data-testid="kanban-board">
                  {BOOKING_STATUSES.map(status => {
                    const items = kanbanColumns[status] || [];
                    const StatusIcon = STATUS_ICONS[status] || CircleDashed;
                    const archivable = status === "completed" || status === "cancelled";
                    const showArchived = showArchivedColumns[status];
                    const visibleItems = archivable && !showArchived ? items.filter(b => !isOldBooking(b)) : items;
                    const archivedCount = items.length - visibleItems.length;
                    return (
                      <div key={status} className="flex flex-col" data-testid={`kanban-column-${status}`}>
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <StatusIcon className={`w-4 h-4 ${STATUS_ICON_COLORS[status]}`} />
                          <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
                          <Badge variant="secondary" className="text-[10px] ml-auto" data-testid={`kanban-count-${status}`}>
                            {items.length}
                          </Badge>
                        </div>
                        <Droppable droppableId={status}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 min-h-[200px] rounded-xl p-2 space-y-2 transition-colors ${
                                snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
                              }`}
                            >
                              {visibleItems.map((booking, index) => {
                                const dateTime = formatDateTime(booking);
                                return (
                                  <Draggable key={booking.id} draggableId={booking.id.toString()} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`bg-card rounded-lg border p-3 transition-shadow ${
                                          snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : "shadow-sm"
                                        }`}
                                        data-testid={`kanban-card-${booking.id}`}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <div {...provided.dragHandleProps} className="cursor-grab" data-testid={`drag-handle-${booking.id}`}>
                                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm font-medium truncate" data-testid={`kanban-name-${booking.id}`}>
                                                {getBookerOrgName(booking.bookerId) || getBookingGroupName(booking.bookerGroupId) || getBookerGroupViaContact(booking.bookerId) || booking.bookerName || getBookerName(booking.bookerId) || getVenueNames(booking)}
                                              </p>
                                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                {(getBookerOrgName(booking.bookerId) || getBookingGroupName(booking.bookerGroupId) || getBookerGroupViaContact(booking.bookerId)) ? (booking.bookerName || getBookerName(booking.bookerId) || getVenueNames(booking)) : getVenueNames(booking)}
                                              </p>
                                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                <Badge className={`${CLASSIFICATION_COLORS[booking.classification] || ""} text-[10px]`}>
                                                  {booking.classification}
                                                </Badge>
                                                {booking.isAfterHours && (
                                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" data-testid={`badge-after-hours-${booking.id}`}>
                                                    <Moon className="w-2.5 h-2.5 mr-0.5" />
                                                    After Hours
                                                  </Badge>
                                                )}
                                                {pendingChangeRequestBookingIds.has(booking.id) && (
                                                  <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800" data-testid={`badge-change-request-kanban-${booking.id}`}>
                                                    <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                                    Change Request
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" data-testid={`kanban-menu-${booking.id}`}>
                                                <MoreVertical className="w-3.5 h-3.5" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem onClick={() => setLocation(`/bookings/${booking.id}`)} data-testid={`kanban-view-${booking.id}`}>
                                                <ExternalLink className="w-4 h-4 mr-2" /> View Details
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setEditBooking(booking)} data-testid={`kanban-edit-${booking.id}`}>
                                                <Pencil className="w-4 h-4 mr-2" /> Edit
                                              </DropdownMenuItem>
                                              {booking.startDate && (
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    const dateStr = typeof booking.startDate === "string" ? booking.startDate.slice(0, 10) : new Date(booking.startDate!).toISOString().slice(0, 10);
                                                    setLocation(`/spaces?date=${dateStr}&view=week`);
                                                  }}
                                                  data-testid={`kanban-calendar-${booking.id}`}
                                                >
                                                  <CalendarDays className="w-4 h-4 mr-2" /> View on Calendar
                                                </DropdownMenuItem>
                                              )}
                                              {booking.status === "completed" && (!booking.servedAt || !booking.xeroInvoiceId) && (
                                                <DropdownMenuItem onClick={() => openCompletionDialogForExisting(booking)} data-testid={`kanban-actions-${booking.id}`}>
                                                  <CheckCircle2 className="w-4 h-4 mr-2" /> Post-completion Actions
                                                </DropdownMenuItem>
                                              )}
                                              <DropdownMenuItem onClick={() => handleDuplicate(booking)} data-testid={`kanban-duplicate-${booking.id}`}>
                                                <Copy className="w-4 h-4 mr-2" /> Duplicate
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleDelete(booking.id)} className="text-destructive" data-testid={`kanban-delete-${booking.id}`}>
                                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>

                                        {dateTime && (
                                          <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                                            <div className="flex items-center gap-1">
                                              <Calendar className="w-3 h-3" />
                                              {dateTime.date}
                                            </div>
                                            {dateTime.time && (
                                              <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {dateTime.time}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {(() => {
                                          const amt = parseFloat(booking.amount || "0");
                                          const ps = (booking as any).paymentStatus || "unpaid";
                                          const isFree = booking.pricingTier === "free_koha" || booking.usePackageCredit || ps === "not_required";
                                          const hasInvoice = !!booking.xeroInvoiceId;
                                          const isPaid = ps === "paid" || booking.xeroInvoiceStatus === "paid";

                                          if (amt <= 0 && !isFree && !getBookerName(booking.bookerId)) return null;

                                          return (
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                                              <span className="text-[11px] flex items-center gap-1.5">
                                                {isPaid ? (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                                    <span className="text-green-700 dark:text-green-400 font-medium">Paid</span>
                                                  </>
                                                ) : hasInvoice ? (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                                    <span className="text-blue-700 dark:text-blue-400 font-medium">Invoiced</span>
                                                    <span className="text-muted-foreground">{booking.xeroInvoiceNumber}</span>
                                                  </>
                                                ) : isFree ? (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                                                    <span className="text-muted-foreground">Covered</span>
                                                  </>
                                                ) : amt > 0 ? (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                    <span className="text-amber-700 dark:text-amber-400 font-medium">${amt.toFixed(2)}</span>
                                                  </>
                                                ) : null}
                                              </span>
                                              {getBookerName(booking.bookerId) && getBookingGroupName(booking.bookerGroupId) && (
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                                                  <Users className="w-3 h-3" />
                                                  {getBookerName(booking.bookerId)}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                              {/* Recurring templates (non-draggable) shown only in confirmed column */}
                              {status === "confirmed" && activeRecurringTemplates.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {archivedCount === 0 && visibleItems.length > 0 && (
                                    <div className="border-t border-border/30 pt-2" />
                                  )}
                                  {activeRecurringTemplates.map(tmpl => {
                                    const tmplVenue = venues?.find(v => v.id === tmpl.venue_id);
                                    const dayLabel = DAYS_OF_WEEK_LABELS[tmpl.day_of_week] || "Unknown";
                                    const timeLabel = tmpl.start_time && tmpl.end_time
                                      ? `${formatTimeSlot(tmpl.start_time)} – ${formatTimeSlot(tmpl.end_time)}`
                                      : tmpl.start_time ? formatTimeSlot(tmpl.start_time) : null;
                                    return (
                                      <div
                                        key={`recurring-${tmpl.id}`}
                                        className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow"
                                        onClick={() => setRecurringTemplateDetail(tmpl)}
                                        data-testid={`kanban-recurring-${tmpl.id}`}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{tmpl.name}</p>
                                            {tmplVenue && (
                                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tmplVenue.name}</p>
                                            )}
                                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                              <Badge variant="outline" className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                                <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                                Recurring
                                              </Badge>
                                              {tmpl.classification && (
                                                <Badge className={`${CLASSIFICATION_COLORS[tmpl.classification] || "bg-gray-500/15 text-gray-700"} text-[10px]`}>
                                                  {tmpl.classification}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                                          <div className="flex items-center gap-1">
                                            <RefreshCw className="w-3 h-3" />
                                            Every {dayLabel}
                                            {timeLabel && ` · ${timeLabel}`}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                        {archivable && archivedCount > 0 && !showArchived && (
                          <button
                            className="mt-1 text-[11px] text-muted-foreground hover:text-foreground text-left px-1"
                            onClick={() => setShowArchivedColumns(prev => ({ ...prev, [status]: true }))}
                            data-testid={`button-show-archived-${status}`}
                          >
                            Show {archivedCount} archived
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </DragDropContext>
            )
          ) : (
            <div className="space-y-3">
              {!filtered?.length ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No venue hires match your filters.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((booking) => {
                    const dateTime = formatDateTime(booking);
                    const bookerName = getBookerName(booking.bookerId);
                    const bookingGroupName = getBookingGroupName(booking.bookerGroupId);
                    const bookerOrgName = getBookerOrgName(booking.bookerId);
                    const contactGroupName = !bookingGroupName ? getBookerGroupViaContact(booking.bookerId) : null;
                    const orgOrGroup = bookerOrgName || bookingGroupName || contactGroupName;
                    const cardTitle = orgOrGroup || booking.bookerName || bookerName || getVenueNames(booking);
                    const cardSubName = orgOrGroup ? (booking.bookerName || bookerName) : null;
                    const isCancelled = booking.status === "cancelled";
                    const venueSpaceName = venues?.find(v => (booking.venueIds as number[] | undefined)?.includes(v.id) || v.id === booking.venueId)?.spaceName;
                    const hasVenueAssigned = !!(booking.venueIds?.length || booking.venueId);

                    // Payment status dot
                    const paymentStatus = (booking as any).paymentStatus;
                    const paymentDot = paymentStatus === 'paid' ? '🟢'
                      : paymentStatus === 'invoiced' ? '🟡'
                      : paymentStatus === 'unpaid' ? '🔴'
                      : paymentStatus === 'not_required' ? null
                      : null;

                    return (
                      <Card
                        key={booking.id}
                        className={`p-4 hover-elevate transition-all ${STATUS_CARD_COLORS[booking.status] || ""}`}
                        data-testid={`card-booking-${booking.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className={`font-semibold text-base truncate ${isCancelled ? "line-through opacity-70" : ""}`} data-testid={`text-booking-title-${booking.id}`}>
                                {cardTitle}
                              </h3>
                              {paymentDot && (
                                <span className="text-sm shrink-0" title={paymentStatus}>{paymentDot}</span>
                              )}
                            </div>
                            {cardSubName && (
                              <p className="text-xs text-muted-foreground -mt-1 mb-1" data-testid={`text-booking-subname-${booking.id}`}>{cardSubName}</p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap mb-1" style={{display:"contents"}}>
                              <Badge className={CLASSIFICATION_COLORS[booking.classification] || ""} data-testid={`badge-classification-${booking.id}`}>
                                {booking.classification}
                              </Badge>
                              {booking.isAfterHours && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" data-testid={`badge-after-hours-list-${booking.id}`}>
                                  <Moon className="w-2.5 h-2.5 mr-0.5" />
                                  After Hours
                                </Badge>
                              )}
                              {booking.xeroInvoiceId && (
                                <Badge variant="outline" className={`text-[10px] ${booking.xeroInvoiceStatus === "paid" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"}`} data-testid={`badge-xero-invoice-list-${booking.id}`}>
                                  <Receipt className="w-2.5 h-2.5 mr-0.5" />
                                  {booking.xeroInvoiceStatus || "invoiced"}
                                </Badge>
                              )}
                              {pendingChangeRequestBookingIds.has(booking.id) && (
                                <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800" data-testid={`badge-change-request-pending-${booking.id}`}>
                                  <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                  Change Request
                                </Badge>
                              )}
                            </div>
                            {(bookerName || bookingGroupName || (isCancelled && !hasVenueAssigned && (bookerOrgName || booking.bookerName))) && (
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1 flex-wrap">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {!hasVenueAssigned && isCancelled
                                  ? <span className="italic text-muted-foreground/60">No venue</span>
                                  : getVenueNames(booking)}
                                {venueSpaceName && (
                                  <Badge variant="secondary" className="text-[9px] py-0 px-1 font-normal ml-0.5">{venueSpaceName}</Badge>
                                )}
                              </p>
                            )}

                            {booking.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{booking.description}</p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              {dateTime && (
                                <span className="flex items-center gap-1" data-testid={`text-date-${booking.id}`}>
                                  <Calendar className="w-3 h-3" />
                                  {dateTime.date}
                                </span>
                              )}
                              {dateTime?.time && (
                                <span className="flex items-center gap-1" data-testid={`text-time-${booking.id}`}>
                                  <Clock className="w-3 h-3" />
                                  {dateTime.time}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge
                                variant={booking.pricingTier === "full_price" ? "default" : booking.pricingTier === "discounted" ? "outline" : "secondary"}
                                className={booking.pricingTier === "free_koha" ? "bg-green-500/15 text-green-700 dark:text-green-300" : ""}
                                data-testid={`badge-pricing-${booking.id}`}
                              >
                                {PRICING_LABELS[booking.pricingTier] || booking.pricingTier}
                              </Badge>
                              {booking.durationType && (
                                <Badge variant="outline" className="text-xs" data-testid={`badge-duration-${booking.id}`}>
                                  {DURATION_LABELS[booking.durationType] || booking.durationType}
                                </Badge>
                              )}
                              {booking.rateType === "community" && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-300" data-testid={`badge-rate-${booking.id}`}>
                                  Community Rate
                                </Badge>
                              )}
                              <span className="text-sm font-medium" data-testid={`text-amount-${booking.id}`}>
                                <DollarSign className="w-3 h-3 inline" />
                                {parseFloat(booking.amount || "0").toFixed(2)}
                                <span className="text-[10px] text-muted-foreground ml-0.5">excl. GST</span>
                              </span>
                              {booking.membershipId && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-300" data-testid={`badge-membership-${booking.id}`}>
                                  {allMemberships?.find(m => m.id === booking.membershipId)?.name || "Membership"}
                                </Badge>
                              )}
                              {booking.mouId && (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300" data-testid={`badge-mou-${booking.id}`}>
                                  {allMous?.find(m => m.id === booking.mouId)?.title || "MOU"}
                                </Badge>
                              )}
                              {/* Payment status badge */}
                              {(() => {
                                const ps = (booking as any).paymentStatus || "unpaid";
                                if (ps === "paid") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" data-testid={`badge-payment-${booking.id}`}>Paid</span>;
                                if (ps === "invoiced") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" data-testid={`badge-payment-${booking.id}`}>Invoiced</span>;
                                if (ps === "not_required") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" data-testid={`badge-payment-${booking.id}`}>N/A</span>;
                                return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" data-testid={`badge-payment-${booking.id}`}>Unpaid</span>;
                              })()}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                              {bookerName && (
                                <span className="flex items-center gap-1" data-testid={`text-booker-${booking.id}`}>
                                  <Users className="w-3 h-3" />
                                  Booker: {bookerName}
                                </span>
                              )}
                            </div>

                            {booking.notes && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic" data-testid={`text-notes-${booking.id}`}>
                                {booking.notes}
                              </p>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-booking-menu-${booking.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLocation(`/bookings/${booking.id}`)} data-testid={`button-view-booking-${booking.id}`}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditBooking(booking)} data-testid={`button-edit-booking-${booking.id}`}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {booking.startDate && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    const dateStr = typeof booking.startDate === "string" ? booking.startDate.slice(0, 10) : new Date(booking.startDate!).toISOString().slice(0, 10);
                                    setLocation(`/spaces?date=${dateStr}&view=week`);
                                  }}
                                  data-testid={`button-calendar-booking-${booking.id}`}
                                >
                                  <CalendarDays className="w-4 h-4 mr-2" />
                                  View on Calendar
                                </DropdownMenuItem>
                              )}
                              {booking.status === "completed" && (!booking.servedAt || !booking.xeroInvoiceId) && (
                                <DropdownMenuItem onClick={() => openCompletionDialogForExisting(booking)} data-testid={`button-actions-booking-${booking.id}`}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Post-completion Actions
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDuplicate(booking)} data-testid={`button-duplicate-booking-${booking.id}`}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(booking.id)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-booking-${booking.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
  );

  return (
    <>
      {embedded ? content : (
        <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
          {content}
        </main>
      )}

      <BookingFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        venues={venues || []}
        onSubmit={async (data) => {
          try {
            const response = await createMutation.mutateAsync(data);
            const result = await response.json();
            setCreateOpen(false);
            toast({ title: "Created", description: "Venue hire created successfully" });
            if (result.allowanceWarning) {
              toast({ title: "Allowance Warning", description: result.allowanceWarning, variant: "destructive" });
            }
          } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to create", variant: "destructive" });
          }
        }}
        isPending={createMutation.isPending}
        pricingDefaults={pricingDefaults}
      />

      {editBooking && (
        <BookingFormDialog
          open={!!editBooking}
          onOpenChange={(open) => { if (!open) setEditBooking(null); }}
          booking={editBooking}
          venues={venues || []}
          onSubmit={async (data) => {
            try {
              await updateMutation.mutateAsync({ id: editBooking.id, data });
              setEditBooking(null);
              toast({ title: "Updated", description: "Venue hire updated successfully" });
            } catch (err: any) {
              toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
            }
          }}
          isPending={updateMutation.isPending}
          pricingDefaults={pricingDefaults}
        />
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Venue Hire Settings</DialogTitle>
                <DialogDescription>Configure venues and bookers</DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => { setSettingsOpen(false); setHirerPreviewOpen(true); }}
                data-testid="button-hirer-preview"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Preview
              </Button>
            </div>
          </DialogHeader>
          <Tabs defaultValue="reminders">
            <TabsList className="flex-wrap">
              <TabsTrigger value="reminders" data-testid="tab-booking-reminders">Reminders</TabsTrigger>
              <TabsTrigger value="survey" data-testid="tab-booking-survey">Survey</TabsTrigger>
              <TabsTrigger value="portal" data-testid="tab-booking-portal">Portal</TabsTrigger>
              <TabsTrigger value="xero" data-testid="tab-booking-xero">Xero</TabsTrigger>
            </TabsList>
            <TabsContent value="reminders" className="mt-4">
              <BookingRemindersSettingsTab />
            </TabsContent>
            <TabsContent value="survey" className="mt-4">
              <SurveySettingsTab />
            </TabsContent>
            <TabsContent value="portal" className="mt-4">
              <PortalSettingsTab />
            </TabsContent>
            <TabsContent value="xero" className="mt-4">
              <XeroSettingsTab />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>


      <HirerPreviewDialog
        open={hirerPreviewOpen}
        onOpenChange={setHirerPreviewOpen}
        venues={venues || []}
      />

      {/* Recurring template detail dialog */}
      <Dialog open={!!recurringTemplateDetail} onOpenChange={(open) => { if (!open) setRecurringTemplateDetail(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              {recurringTemplateDetail?.name}
            </DialogTitle>
            <DialogDescription>Recurring booking template details</DialogDescription>
          </DialogHeader>
          {recurringTemplateDetail && (() => {
            const tmplVenue = venues?.find(v => v.id === recurringTemplateDetail.venue_id);
            const dayLabel = DAYS_OF_WEEK_LABELS[recurringTemplateDetail.day_of_week] || "Unknown";
            const timeLabel = recurringTemplateDetail.start_time && recurringTemplateDetail.end_time
              ? `${formatTimeSlot(recurringTemplateDetail.start_time)} – ${formatTimeSlot(recurringTemplateDetail.end_time)}`
              : recurringTemplateDetail.start_time ? formatTimeSlot(recurringTemplateDetail.start_time) : null;
            return (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border p-3 space-y-2">
                  {tmplVenue && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>{tmplVenue.name}{tmplVenue.spaceName ? ` · ${tmplVenue.spaceName}` : ""}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>Every {dayLabel}{timeLabel ? ` · ${timeLabel}` : ""}</span>
                  </div>
                  {recurringTemplateDetail.classification && (
                    <div className="flex items-center gap-2">
                      <Badge className={CLASSIFICATION_COLORS[recurringTemplateDetail.classification] || "bg-gray-500/15 text-gray-700"}>
                        {recurringTemplateDetail.classification}
                      </Badge>
                    </div>
                  )}
                  {recurringTemplateDetail.booker_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4 shrink-0" />
                      <span>{recurringTemplateDetail.booker_name}</span>
                    </div>
                  )}
                  {recurringTemplateDetail.start_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>
                        From {format(new Date(recurringTemplateDetail.start_date), "d MMM yyyy")}
                        {recurringTemplateDetail.end_date ? ` – ${format(new Date(recurringTemplateDetail.end_date), "d MMM yyyy")}` : ""}
                      </span>
                    </div>
                  )}
                  {recurringTemplateDetail.notes && (
                    <div className="text-muted-foreground text-xs italic">{recurringTemplateDetail.notes}</div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRecurringTemplateDetail(null); setLocation("/spaces"); }}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Edit in Recurring tab
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRecurringTemplateDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-booking-completed">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-completion-title">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Venue Hire Completed
            </DialogTitle>
            <DialogDescription>
              Take follow-up actions for this completed venue hire.
            </DialogDescription>
          </DialogHeader>

          {completionBooking && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <div className="font-medium" data-testid="text-completion-booking-name">
                  {getBookingGroupName(completionBooking.bookerGroupId) || getBookerName(completionBooking.bookerId) || getVenueNames(completionBooking)}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {getVenueNames(completionBooking)}
                </div>
                {formatDateTime(completionBooking) && (
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDateTime(completionBooking)!.date}
                    {formatDateTime(completionBooking)!.time && (
                      <span className="ml-1">
                        <Clock className="w-3.5 h-3.5 inline mr-0.5" />
                        {formatDateTime(completionBooking)!.time}
                      </span>
                    )}
                  </div>
                )}
                {getBookingGroupName(completionBooking.bookerGroupId) && getBookerName(completionBooking.bookerId) && (
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {getBookerName(completionBooking.bookerId)}
                  </div>
                )}
                {parseFloat(completionBooking.amount || "0") > 0 && (
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    ${parseFloat(completionBooking.amount || "0").toFixed(2)} excl. GST
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full justify-between gap-2"
                  variant={completionServedDone ? "secondary" : "default"}
                  onClick={handleMarkServed}
                  disabled={completionServedDone || completionServedLoading}
                  data-testid="button-mark-served"
                >
                  <span className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {completionServedDone ? "Marked as Served" : "Mark as Served"}
                  </span>
                  {completionServedLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : completionServedDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : null}
                </Button>
                {completionNeedsInvoice && !completionInvoiceDone && (
                  <p className="text-xs text-muted-foreground text-center">Invoice from booking detail when ready</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompletionDialogOpen(false)}
              data-testid="button-completion-done"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


const DEFAULT_SURVEY_QUESTIONS = [
  { id: 1, type: "rating", question: "How would you rate your overall experience?", scale: 5, required: true },
  { id: 2, type: "rating", question: "How clean and well-maintained was the space?", scale: 5, required: true },
  { id: 3, type: "yes_no", question: "Did you have everything you needed?", required: true },
  { id: 4, type: "text", question: "What could we improve?", required: false },
  { id: 5, type: "yes_no", question: "Would you book with us again?", required: true },
  { id: 6, type: "text", question: "Any other feedback?", required: false },
  { id: 7, type: "testimonial", question: "Would you like to share a testimonial? (optional)", required: false, consent: true, subtext: "By submitting, you give us permission to share publicly." },
];

const QUESTION_TYPES = [
  { value: "rating", label: "Rating (1-5)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Free Text" },
  { value: "testimonial", label: "Testimonial" },
];

type SurveyQuestion = {
  id: number;
  type: string;
  question: string;
  scale?: number;
  required: boolean;
  consent?: boolean;
  subtext?: string;
};

function SurveySettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<{
    questions: SurveyQuestion[] | null;
    googleReviewUrl: string | null;
    emailSubject: string | null;
    emailIntro: string | null;
    emailSignoff: string | null;
  }>({
    queryKey: ['/api/survey-settings'],
  });

  const [questions, setQuestions] = useState<SurveyQuestion[]>(DEFAULT_SURVEY_QUESTIONS);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailIntro, setEmailIntro] = useState("");
  const [emailSignoff, setEmailSignoff] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings) {
      setQuestions(settings.questions && settings.questions.length > 0 ? settings.questions : DEFAULT_SURVEY_QUESTIONS);
      setGoogleReviewUrl(settings.googleReviewUrl || "");
      setEmailSubject(settings.emailSubject || "");
      setEmailIntro(settings.emailIntro || "");
      setEmailSignoff(settings.emailSignoff || "");
      setInitialized(true);
    }
  }, [settings, initialized]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('PUT', '/api/survey-settings', {
        questions,
        googleReviewUrl: googleReviewUrl.trim() || null,
        emailSubject: emailSubject.trim() || null,
        emailIntro: emailIntro.trim() || null,
        emailSignoff: emailSignoff.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/survey-settings'] });
      toast({ title: "Saved", description: "Survey settings updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleResetDefaults = () => {
    setQuestions(DEFAULT_SURVEY_QUESTIONS);
    setGoogleReviewUrl("");
    setEmailSubject("");
    setEmailIntro("");
    setEmailSignoff("");
  };

  const updateQuestion = (id: number, field: string, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (id: number) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addQuestion = () => {
    const maxId = questions.reduce((max, q) => Math.max(max, q.id), 0);
    setQuestions(prev => [
      ...prev,
      { id: maxId + 1, type: "text", question: "", required: false },
    ]);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-1">Google Review Link</h3>
        <p className="text-xs text-muted-foreground mb-2">
          When set, the testimonial question on the public survey page will show a link to leave a Google review.
        </p>
        <Input
          value={googleReviewUrl}
          onChange={(e) => setGoogleReviewUrl(e.target.value)}
          placeholder="https://g.page/r/your-business/review"
          data-testid="input-google-review-url"
        />
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-1">Email Customisation</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customise the survey email sent to bookers after their venue hire is completed.
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Subject line</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="How was your experience at ReserveTMK Digital?"
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <Label className="text-xs">Intro text</Label>
            <Textarea
              value={emailIntro}
              onChange={(e) => setEmailIntro(e.target.value)}
              placeholder="Thank you for booking with us! We'd love to hear your feedback..."
              className="resize-none min-h-[60px]"
              data-testid="input-email-intro"
            />
          </div>
          <div>
            <Label className="text-xs">Sign-off text</Label>
            <Input
              value={emailSignoff}
              onChange={(e) => setEmailSignoff(e.target.value)}
              placeholder="Nga mihi, The ReserveTMK Digital Team"
              data-testid="input-email-signoff"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Survey Questions</h3>
            <p className="text-xs text-muted-foreground">Edit, add, or remove questions from the post-booking survey.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addQuestion} data-testid="button-add-question">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="border rounded-md p-3 space-y-2" data-testid={`survey-question-${q.id}`}>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-mono mt-2 w-5 shrink-0">{idx + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                    placeholder="Question text"
                    className="text-sm"
                    data-testid={`input-question-text-${q.id}`}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, "type", v)}>
                      <SelectTrigger className="w-[140px]" data-testid={`select-question-type-${q.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={q.required}
                        onCheckedChange={(v) => updateQuestion(q.id, "required", v)}
                        data-testid={`switch-required-${q.id}`}
                      />
                      <span className="text-xs text-muted-foreground">Required</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeQuestion(q.id)}
                  data-testid={`button-remove-question-${q.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-survey-settings"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
        <Button
          variant="outline"
          onClick={handleResetDefaults}
          data-testid="button-reset-survey-defaults"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}


function PortalSettingsTab() {
  const { toast } = useToast();
  const { data: pricingDefaults } = useBookingPricingDefaults();
  const updateDefaults = useUpdateBookingPricingDefaults();
  const [maxMonths, setMaxMonths] = useState<number>(3);

  useEffect(() => {
    if (pricingDefaults?.maxAdvanceMonths != null) {
      setMaxMonths(pricingDefaults.maxAdvanceMonths);
    }
  }, [pricingDefaults?.maxAdvanceMonths]);

  const handleSave = () => {
    const val = Math.max(1, Math.min(12, maxMonths));
    updateDefaults.mutate({ maxAdvanceMonths: val }, {
      onSuccess: () => toast({ title: "Portal settings saved" }),
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure settings for the booker portal.</p>
      <div className="space-y-2">
        <Label htmlFor="max-advance-months" className="text-sm font-medium">Max Advance Booking</Label>
        <p className="text-xs text-muted-foreground">How far in advance bookers can make venue hire requests.</p>
        <div className="flex items-center gap-2">
          <Input
            id="max-advance-months"
            type="number"
            min={1}
            max={12}
            value={maxMonths}
            onChange={(e) => setMaxMonths(parseInt(e.target.value) || 1)}
            className="w-24"
            data-testid="input-max-advance-months"
          />
          <span className="text-sm text-muted-foreground">months</span>
        </div>
      </div>
      <Button
        onClick={handleSave}
        disabled={updateDefaults.isPending}
        data-testid="button-save-portal-settings"
      >
        {updateDefaults.isPending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}

function XeroSettingsTab() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accountCode, setAccountCode] = useState("200");
  const [taxType, setTaxType] = useState("OUTPUT2");

  const { data: xeroStatus, isLoading } = useQuery<{
    connected: boolean;
    hasCredentials: boolean;
    organisationName: string | null;
    connectedAt: string | null;
    tokenExpiresAt: string | null;
    accountCode: string;
    taxType: string;
  }>({
    queryKey: ['/api/xero/status'],
  });

  useEffect(() => {
    if (xeroStatus) {
      setAccountCode(xeroStatus.accountCode || "200");
      setTaxType(xeroStatus.taxType || "OUTPUT2");
    }
  }, [xeroStatus]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/save-credentials", {
        xeroClientId: clientId,
        xeroClientSecret: clientSecret,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/status'] });
      toast({ title: "Credentials saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const saveAccountSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/update-account-settings", {
        accountCode,
        taxType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/status'] });
      toast({ title: "Account settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save account settings", description: err.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!xeroStatus?.hasCredentials) {
        await apiRequest("POST", "/api/xero/save-credentials", {
          xeroClientId: clientId,
          xeroClientSecret: clientSecret,
        });
      }
      const res = await apiRequest("GET", "/api/xero/connect");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to connect", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/status'] });
      toast({ title: "Xero disconnected" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (xeroStatus?.connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <Link2 className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-800 dark:text-green-200" data-testid="text-xero-org-name">
              Connected to {xeroStatus.organisationName || "Xero"}
            </p>
            {xeroStatus.connectedAt && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Connected {new Date(xeroStatus.connectedAt).toLocaleDateString("en-NZ")}
              </p>
            )}
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200" data-testid="badge-xero-connected">Connected</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Invoices will be automatically generated in Xero when venue hires are accepted. Venue hires with koha, package credits, or zero amounts are skipped.
        </p>
        <div className="p-3 rounded-lg border bg-muted/50 space-y-3">
          <p className="text-sm font-medium">Invoice defaults</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Account Code</label>
              <Input
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                placeholder="200"
                data-testid="input-xero-account-code"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Tax Type</label>
              <Input
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                placeholder="OUTPUT2"
                data-testid="input-xero-tax-type"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => saveAccountSettingsMutation.mutate()}
            disabled={saveAccountSettingsMutation.isPending || (accountCode === (xeroStatus?.accountCode || "200") && taxType === (xeroStatus?.taxType || "OUTPUT2"))}
            data-testid="button-xero-save-account-settings"
          >
            {saveAccountSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Invoice Defaults
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
          data-testid="button-xero-disconnect"
        >
          {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
          Disconnect Xero
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect to Xero to automatically generate invoices when venue hires are confirmed. You'll need to create a Xero app first.
      </p>
      <div className="p-3 rounded-lg border bg-muted/50 text-sm space-y-2">
        <p className="font-medium">Setup instructions:</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Go to <a href="https://developer.xero.com/app/manage" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.xero.com</a> and create a new app</li>
          <li>Set the app type to "Web app"</li>
          <li>Add the redirect URI: <code className="text-xs bg-background px-1 py-0.5 rounded">{window.location.origin}/api/xero/callback</code></li>
          <li>Copy the Client ID and Client Secret below</li>
        </ol>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Client ID</label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter your Xero Client ID"
            data-testid="input-xero-client-id"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Client Secret</label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Enter your Xero Client Secret"
            data-testid="input-xero-client-secret"
          />
        </div>
      </div>
      <Button
        onClick={() => connectMutation.mutate()}
        disabled={(!clientId || !clientSecret) && !xeroStatus?.hasCredentials || connectMutation.isPending}
        data-testid="button-xero-connect"
      >
        {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
        Save & Connect to Xero
      </Button>
    </div>
  );
}

function BookingRemindersSettingsTab() {
  const { toast } = useToast();
  const { data: reminderData, isLoading } = useQuery<{ enabled: boolean; sendTimingHours: number }>({
    queryKey: ['/api/booking-reminder-settings'],
  });

  const [enabled, setEnabled] = useState(true);
  const [sendTimingHours, setSendTimingHours] = useState(4);

  useEffect(() => {
    if (reminderData) {
      setEnabled(reminderData.enabled ?? true);
      setSendTimingHours(reminderData.sendTimingHours ?? 4);
    }
  }, [reminderData]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => apiRequest('PUT', '/api/booking-reminder-settings', { enabled, sendTimingHours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-reminder-settings'] });
      toast({ title: "Saved", description: "Booking reminder settings updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Automatically send location instructions before venue hire bookings.</p>
      <div className="flex items-center gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          data-testid="switch-booking-reminders-settings"
        />
        <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
      </div>
      {enabled && (
        <div>
          <Label className="text-xs">Send reminder</Label>
          <Select value={String(sendTimingHours)} onValueChange={(v) => setSendTimingHours(Number(v))}>
            <SelectTrigger className="w-48 mt-1" data-testid="select-reminder-timing-settings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">1 day before</SelectItem>
              <SelectItem value="4">4 hours before</SelectItem>
              <SelectItem value="2">2 hours before</SelectItem>
              <SelectItem value="0">8am on day of venue hire</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        size="sm"
        onClick={() => saveSettingsMutation.mutate()}
        disabled={saveSettingsMutation.isPending}
        data-testid="button-save-booking-reminders-settings"
      >
        {saveSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Reminder Settings
      </Button>
    </div>
  );
}


const VENUE_HIRE_STATUSES = ["confirmed", "completed", "cancelled"] as const;

function BookingFormDialog({
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

function HirerPreviewDialog({ open, onOpenChange, venues }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
}) {
  const { data: instructions } = useVenueInstructions();
  const { data: surveySettings } = useQuery<{
    questions: SurveyQuestion[] | null;
    googleReviewUrl: string | null;
    emailSubject: string | null;
    emailIntro: string | null;
    emailSignoff: string | null;
  }>({ queryKey: ['/api/survey-settings'] });
  const { data: xeroStatus } = useQuery<{
    connected: boolean;
    organisationName: string | null;
  }>({ queryKey: ['/api/xero/status'] });

  const activeInstructions = useMemo(() => {
    if (!instructions) return {};
    const grouped: Record<string, VenueInstruction[]> = {};
    instructions
      .filter(i => i.isActive)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .forEach(inst => {
        if (!grouped[inst.instructionType]) grouped[inst.instructionType] = [];
        grouped[inst.instructionType].push(inst);
      });
    return grouped;
  }, [instructions]);

  const questions = surveySettings?.questions && surveySettings.questions.length > 0
    ? surveySettings.questions
    : DEFAULT_SURVEY_QUESTIONS;

  const sampleVenue = venues[0]?.name || "Main Space";
  const sampleDate = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "EEEE d MMMM yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Hirer Preview
          </DialogTitle>
          <DialogDescription>
            See what your hirers will experience — confirmation email, survey, and invoicing.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="confirmation-email">
          <TabsList className="flex-wrap">
            <TabsTrigger value="confirmation-email" data-testid="tab-preview-email">Confirmation Email</TabsTrigger>
            <TabsTrigger value="survey" data-testid="tab-preview-survey">Survey</TabsTrigger>
            <TabsTrigger value="invoice" data-testid="tab-preview-invoice">Invoice</TabsTrigger>
          </TabsList>

          <TabsContent value="confirmation-email" className="mt-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-[#1e40af] text-white text-center py-6 px-4">
                <h2 className="text-lg font-bold">Booking Confirmed!</h2>
                <p className="text-blue-200 text-sm mt-1">ReserveTMK Digital</p>
              </div>
              <div className="p-6 space-y-4 bg-white dark:bg-card">
                <div>
                  <p className="text-base text-foreground">Hi <span className="font-medium">[Hirer Name]</span>,</p>
                  <p className="text-sm text-muted-foreground mt-2">Your venue hire booking is confirmed!</p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-4 space-y-1">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm mb-2">Booking Details</h3>
                  <p className="text-sm"><span className="font-medium">Space:</span> {sampleVenue}</p>
                  <p className="text-sm"><span className="font-medium">Date:</span> {sampleDate} <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-semibold ml-1">IN 7 DAYS</span></p>
                  <p className="text-sm"><span className="font-medium">Time:</span> 10:00 AM - 2:00 PM (4 hours)</p>
                  <p className="text-sm"><span className="font-medium">Total:</span> $120.00 + GST</p>
                </div>

                {(activeInstructions["access"] || []).length > 0 && (
                  <div className="border-l-4 border-blue-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-2">Access Information</h3>
                    {activeInstructions["access"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-l-4 border-blue-500 bg-gray-50 dark:bg-muted/30 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-2">Arrival</h3>
                  <p className="text-sm"><span className="font-medium">ReserveTMK Digital Hub</span></p>
                  <p className="text-sm text-muted-foreground">133a Line Road, Glen Innes, Auckland 1072</p>
                  <p className="text-sm text-muted-foreground">Free parking available</p>
                </div>

                {(activeInstructions["opening"] || []).length > 0 && (
                  <div className="border-l-4 border-green-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-green-800 dark:text-green-300 mb-2">Opening Procedure</h3>
                    {activeInstructions["opening"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(activeInstructions["closing"] || []).length > 0 && (
                  <div className="border-l-4 border-amber-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">Closing Procedure</h3>
                    {activeInstructions["closing"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(activeInstructions["emergency"] || []).length > 0 && (
                  <div className="border-l-4 border-red-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300 mb-2">Emergency Contacts</h3>
                    {activeInstructions["emergency"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Questions or need to make changes?</p>
                  <p className="text-sm text-muted-foreground">Reply to this email or call <span className="font-medium">021 022 98172</span></p>
                  <p className="text-sm text-muted-foreground mt-3">Ngā mihi,<br /><span className="font-medium">ReserveTMK Digital Team</span></p>
                </div>

                <div className="bg-gray-50 dark:bg-muted/30 text-center py-3 rounded-b-lg">
                  <p className="text-xs text-muted-foreground">ReserveTMK Digital Hub • 133a Line Road, Glen Innes, Auckland 1072</p>
                </div>
              </div>
            </div>
            {!instructions?.some(i => i.isActive) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No active venue instructions. Add some in the Venue Instructions settings tab.
              </p>
            )}
          </TabsContent>

          <TabsContent value="survey" className="mt-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-[#1e40af] text-white text-center py-6 px-4">
                <h2 className="text-lg font-bold">How was your experience?</h2>
                <p className="text-blue-200 text-sm mt-1">ReserveTMK Digital</p>
              </div>
              <div className="p-6 bg-white dark:bg-card">
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">Subject:</span>{" "}
                  {surveySettings?.emailSubject || "How was your experience at ReserveTMK Digital?"}
                </p>
                <div className="border-b pb-4 mb-4">
                  <p className="text-sm text-muted-foreground italic">
                    {surveySettings?.emailIntro || "Thanks for using our space! We'd love to hear about your experience. It'll only take 2 minutes."}
                  </p>
                </div>

                <div className="space-y-5">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-1.5" data-testid={`preview-question-${q.id}`}>
                      <p className="text-sm font-medium">
                        {idx + 1}. {q.question}
                        {q.required && <span className="text-red-500 ml-0.5">*</span>}
                      </p>
                      {q.type === "rating" && (
                        <div className="flex gap-1">
                          {Array.from({ length: q.scale || 5 }, (_, i) => (
                            <Star key={i} className={`w-6 h-6 ${i < 3 ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1 self-center">3/{q.scale || 5}</span>
                        </div>
                      )}
                      {q.type === "yes_no" && (
                        <div className="flex gap-2">
                          <Badge className="bg-primary text-primary-foreground px-3 py-1"><ThumbsUp className="w-3 h-3 mr-1" /> Yes</Badge>
                          <Badge variant="outline" className="px-3 py-1"><ThumbsDown className="w-3 h-3 mr-1" /> No</Badge>
                        </div>
                      )}
                      {q.type === "text" && (
                        <div className="border rounded-md p-3 text-sm text-muted-foreground italic bg-muted/20 min-h-[60px]">
                          Type your answer here...
                        </div>
                      )}
                      {q.type === "testimonial" && (
                        <div className="space-y-2">
                          <div className="border rounded-md p-3 text-sm text-muted-foreground italic bg-muted/20 min-h-[60px]">
                            Share your experience...
                          </div>
                          {q.subtext && <p className="text-[10px] text-muted-foreground">{q.subtext}</p>}
                          {surveySettings?.googleReviewUrl && (
                            <p className="text-xs text-primary">
                              <ExternalLink className="w-3 h-3 inline mr-1" />
                              Leave a Google review
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="bg-primary text-primary-foreground text-center py-2.5 px-6 rounded-md text-sm font-semibold inline-block">
                    Submit Survey
                  </div>
                </div>

                {surveySettings?.emailSignoff && (
                  <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">{surveySettings.emailSignoff}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invoice" className="mt-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-gray-800 text-white py-4 px-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">INVOICE</h2>
                  <p className="text-gray-300 text-xs mt-0.5">Generated via Xero</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">ReserveTMK Digital</p>
                  <p className="text-xs text-gray-400">133a Line Road, Glen Innes</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-card space-y-5">
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
                    <p className="font-medium">[Hirer Name]</p>
                    <p className="text-muted-foreground text-xs">[Hirer Email]</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoice Details</p>
                    <p className="text-xs"><span className="text-muted-foreground">Invoice #:</span> INV-0042</p>
                    <p className="text-xs"><span className="text-muted-foreground">Date:</span> {format(new Date(), "d MMM yyyy")}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Due:</span> {format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "d MMM yyyy")}</p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium uppercase">Description</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium uppercase">Qty</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium uppercase">Rate</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3">
                        <p className="font-medium">{sampleVenue} Hire</p>
                        <p className="text-xs text-muted-foreground">{sampleDate}</p>
                        <p className="text-xs text-muted-foreground">10:00 AM - 2:00 PM</p>
                      </td>
                      <td className="py-3 text-right">4 hrs</td>
                      <td className="py-3 text-right">$30.00</td>
                      <td className="py-3 text-right font-medium">$120.00</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-48 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>$120.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST (15%)</span>
                      <span>$18.00</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold">
                      <span>Total</span>
                      <span>$138.00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-md p-4 text-xs space-y-2">
                  <p className="font-medium text-sm">How it works:</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">1.</span> When a venue hire is confirmed, an invoice is auto-generated in Xero</p>
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">2.</span> The hirer receives the invoice via Xero email with payment details</p>
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">3.</span> Koha, package credits, and $0 bookings are skipped (no invoice)</p>
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">4.</span> Discounted rates are applied automatically based on booker tier</p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-md border text-sm ${xeroStatus?.connected ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"}`}>
                  {xeroStatus?.connected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-green-800 dark:text-green-200">Connected to {xeroStatus.organisationName || "Xero"} — invoices will auto-generate</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-amber-800 dark:text-amber-200">Xero not connected — connect in the Xero tab to enable auto-invoicing</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const INSTRUCTION_TYPE_LABELS: Record<string, string> = {
  access: "Access",
  opening: "Opening Procedure",
  closing: "Closing Procedure",
  emergency: "Emergency",
};

const INSTRUCTION_TYPE_COLORS: Record<string, string> = {
  access: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  opening: "bg-green-500/15 text-green-700 dark:text-green-300",
  closing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  emergency: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function VenueInstructionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: instructions, isLoading } = useVenueInstructions();
  const createMutation = useCreateVenueInstruction();
  const updateMutation = useUpdateVenueInstruction();
  const deleteMutation = useDeleteVenueInstruction();
  const { toast } = useToast();

  const [editingInstruction, setEditingInstruction] = useState<VenueInstruction | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const groupedInstructions = useMemo(() => {
    if (!instructions) return {};
    const groups: Record<string, VenueInstruction[]> = {};
    INSTRUCTION_TYPES.forEach(type => { groups[type] = []; });
    instructions
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .forEach(inst => {
        if (!groups[inst.instructionType]) groups[inst.instructionType] = [];
        groups[inst.instructionType].push(inst);
      });
    return groups;
  }, [instructions]);

  const handleToggleActive = async (inst: VenueInstruction) => {
    try {
      await updateMutation.mutateAsync({ id: inst.id, data: { isActive: !inst.isActive } });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to toggle", variant: "destructive" });
    }
  };

  const handleMoveOrder = async (inst: VenueInstruction, direction: "up" | "down") => {
    const typeInstructions = groupedInstructions[inst.instructionType] || [];
    const currentIndex = typeInstructions.findIndex(i => i.id === inst.id);
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= typeInstructions.length) return;

    const swapInst = typeInstructions[swapIndex];
    try {
      await Promise.all([
        updateMutation.mutateAsync({ id: inst.id, data: { displayOrder: swapInst.displayOrder } }),
        updateMutation.mutateAsync({ id: swapInst.id, data: { displayOrder: inst.displayOrder } }),
      ]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to reorder", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Instruction removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-venue-instructions-title">Venue Instructions</DialogTitle>
            <DialogDescription>Manage instructions that are sent to bookers with their confirmation emails.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button
                onClick={() => { setEditingInstruction(null); setFormOpen(true); }}
                data-testid="button-add-venue-instruction"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Instruction
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !instructions?.length ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-instructions">No venue instructions yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {INSTRUCTION_TYPES.map(type => {
                  const typeInstructions = groupedInstructions[type] || [];
                  if (typeInstructions.length === 0) return null;
                  return (
                    <div key={type} data-testid={`instruction-group-${type}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={INSTRUCTION_TYPE_COLORS[type] || ""}>
                          {INSTRUCTION_TYPE_LABELS[type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">({typeInstructions.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {typeInstructions.map((inst, index) => (
                          <Card
                            key={inst.id}
                            className={`p-3 ${!inst.isActive ? "opacity-50" : ""}`}
                            data-testid={`card-instruction-${inst.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium" data-testid={`text-instruction-title-${inst.id}`}>
                                  {inst.title || "Untitled"}
                                </p>
                                {inst.content && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{inst.content}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === 0}
                                  onClick={() => handleMoveOrder(inst, "up")}
                                  data-testid={`button-instruction-up-${inst.id}`}
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === typeInstructions.length - 1}
                                  onClick={() => handleMoveOrder(inst, "down")}
                                  data-testid={`button-instruction-down-${inst.id}`}
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </Button>
                                <Switch
                                  checked={inst.isActive ?? true}
                                  onCheckedChange={() => handleToggleActive(inst)}
                                  data-testid={`switch-instruction-active-${inst.id}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setEditingInstruction(inst); setFormOpen(true); }}
                                  data-testid={`button-edit-instruction-${inst.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(inst.id)}
                                  data-testid={`button-delete-instruction-${inst.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <VenueInstructionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        instruction={editingInstruction}
        onSubmit={async (data) => {
          try {
            if (editingInstruction) {
              await updateMutation.mutateAsync({ id: editingInstruction.id, data });
              toast({ title: "Updated", description: "Instruction updated" });
            } else {
              await createMutation.mutateAsync(data);
              toast({ title: "Created", description: "Instruction added" });
            }
            setFormOpen(false);
            setEditingInstruction(null);
          } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </>
  );
}

function VenueInstructionFormDialog({
  open,
  onOpenChange,
  instruction,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruction: VenueInstruction | null;
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
}) {
  const [instructionType, setInstructionType] = useState(instruction?.instructionType || "access");
  const [title, setTitle] = useState(instruction?.title || "");
  const [content, setContent] = useState(instruction?.content || "");
  const [displayOrder, setDisplayOrder] = useState(instruction?.displayOrder?.toString() || "0");

  useEffect(() => {
    if (instruction) {
      setInstructionType(instruction.instructionType);
      setTitle(instruction.title || "");
      setContent(instruction.content || "");
      setDisplayOrder(instruction.displayOrder?.toString() || "0");
    }
  }, [instruction]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      instructionType,
      title: title.trim(),
      content: content.trim() || null,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-instruction-form-title">
            {instruction ? "Edit Instruction" : "Add Instruction"}
          </DialogTitle>
          <DialogDescription>
            {instruction ? "Update the venue instruction." : "Add a new instruction for venue hires."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Type *</Label>
            <Select value={instructionType} onValueChange={setInstructionType}>
              <SelectTrigger data-testid="select-instruction-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUCTION_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="capitalize">{INSTRUCTION_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Building Access Instructions"
              data-testid="input-instruction-title"
            />
          </div>

          <div>
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Detailed instructions for the booker..."
              className="resize-none min-h-[100px]"
              data-testid="input-instruction-content"
            />
          </div>

          <div>
            <Label>Display Order</Label>
            <Input
              type="number"
              min="0"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              data-testid="input-instruction-order"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-instruction-form">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
            data-testid="button-save-instruction"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {instruction ? "Save Changes" : "Add Instruction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
