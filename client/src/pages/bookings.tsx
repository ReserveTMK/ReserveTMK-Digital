import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  useBookings,
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useBookingPricingDefaults,
  useRegularBookers,
} from "@/hooks/use-bookings";
import { useContacts } from "@/hooks/use-contacts";
import { useGroups, useAllGroupAssociations } from "@/hooks/use-groups";
import { useMemberships, useMous } from "@/hooks/use-memberships";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BookingFormDialog, PRICING_LABELS, DURATION_LABELS } from "@/components/bookings/booking-form";
import { HirerPreviewDialog } from "@/components/bookings/hirer-preview";
import { SurveySettingsTab } from "@/components/bookings/survey-settings";
import { PortalSettingsTab } from "@/components/bookings/portal-settings";
import { XeroSettingsTab } from "@/components/bookings/xero-settings";
import { BookingRemindersSettingsTab } from "@/components/bookings/booking-reminders";
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
  Copy,
  CheckCircle2,
  Columns3,
  GripVertical,
  Ban,
  CircleDashed,
  MapPin,
  Package,
  ExternalLink,
  Settings,
  Moon,
  Receipt,
  Filter,
  Eye,
  RefreshCw,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { BOOKING_CLASSIFICATIONS, BOOKING_STATUSES, type Booking, type Venue } from "@shared/schema";
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

function formatTimeSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function Bookings({ embedded, onCreateReady }: { embedded?: boolean; onCreateReady?: (open: () => void) => void } = {}) {
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
  useEffect(() => { onCreateReady?.(() => setCreateOpen(true)); }, [onCreateReady]);
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
    const confirmedOrCompleted = scoped.filter((b) => b.status === "confirmed" || b.status === "completed");
    confirmedOrCompleted.forEach((b) => {
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

