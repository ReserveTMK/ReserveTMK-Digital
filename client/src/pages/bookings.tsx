import { getAgreementAllowanceUsage, getPeriodLabel } from "@/lib/utils";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useGroups, useCreateGroup } from "@/hooks/use-groups";
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
import { format } from "date-fns";
import { BOOKING_CLASSIFICATIONS, BOOKING_STATUSES, PRICING_TIERS, DURATION_TYPES, RATE_TYPES, COMMUNITY_DISCOUNT, INSTRUCTION_TYPES, REGULAR_BOOKER_STATUSES, PAYMENT_TERMS, DAYS_OF_WEEK, type Booking, type Venue, type Contact, type RegularBooker, type VenueInstruction, type OperatingHours, type Group } from "@shared/schema";
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

const PRICING_LABELS: Record<string, string> = {
  full_price: "Full Price",
  discounted: "Discounted",
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

export default function Bookings() {
  const { data: bookings, isLoading } = useBookings();
  const { data: venues } = useVenues();
  const { data: contacts } = useContacts();
  const { data: allGroups } = useGroups();
  const { data: allMemberships } = useMemberships();
  const { data: allMous } = useMous();
  const { data: pricingDefaults } = useBookingPricingDefaults();
  const updatePricingMutation = useUpdateBookingPricingDefaults();
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
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [venueInstructionsOpen, setVenueInstructionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionBooking, setCompletionBooking] = useState<Booking | null>(null);
  const [completionNeedsInvoice, setCompletionNeedsInvoice] = useState(false);
  const [completionInvoiceDone, setCompletionInvoiceDone] = useState(false);
  const [completionServedDone, setCompletionServedDone] = useState(false);
  const [completionInvoiceLoading, setCompletionInvoiceLoading] = useState(false);
  const [completionServedLoading, setCompletionServedLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => {
      const venueName = venues?.find((v) => v.id === b.venueId)?.name || "";
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
    const nonCancelled = bookings.filter((b) => b.status !== "cancelled");
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const completed = bookings.filter((b) => b.status === "completed");

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
    nonCancelled.forEach((b) => {
      const amt = parseFloat(b.amount || "0");
      if (b.pricingTier === "free_koha") {
        inKind += amt;
      } else {
        revenue += amt;
      }
      if (b.membershipId) membershipBookings++;
      if (b.mouId) mouBookings++;
    });

    return { total: nonCancelled.length, confirmed, communityHours, revenue, inKind, membershipBookings, mouBookings };
  }, [bookings]);

  const getVenueName = (venueId: number) => {
    return venues?.find((v) => v.id === venueId)?.name || "Unknown Venue";
  };

  const getBookerName = (bookerId: number | null) => {
    if (!bookerId || !contacts) return null;
    return contacts.find((c) => c.id === bookerId)?.name || null;
  };

  const getBookingGroupName = (gId: number | null | undefined) => {
    if (!gId || !allGroups) return null;
    return (allGroups as any[]).find((g: any) => g.id === gId)?.name || null;
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
    const venueName = getVenueName(b.venueId);
    const dateTime = formatDateTime(b);
    if (dateTime) return `${venueName} — ${dateTime.date}`;
    return venueName;
  };

  const handleDuplicate = async (b: Booking) => {
    try {
      await createMutation.mutateAsync({
        venueId: b.venueId,
        description: b.description || undefined,
        classification: b.classification,
        status: "enquiry",
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
      toast({ title: "Duplicated", description: `Booking has been duplicated` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to duplicate", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Booking removed successfully" });
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
      toast({ title: "Booking completed", description: data.surveyDecision || "Booking marked as completed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to complete booking", variant: "destructive" });
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
      toast({ title: "Marked as served", description: "Booking has been marked as served" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to mark as served", variant: "destructive" });
    } finally {
      setCompletionServedLoading(false);
    }
  }, [completionBooking, toast]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
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
      toast({ title: "Status updated", description: `Booking moved to ${STATUS_LABELS[newStatus]}` });
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
    return columns;
  }, [filtered]);

  return (
    <>
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className={`${viewMode === "kanban" ? "max-w-[1600px]" : "max-w-6xl"} mx-auto space-y-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-bookings-title">Bookings</h1>
              <p className="text-muted-foreground mt-1">Manage venue hire and community space bookings.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center border border-border rounded-lg overflow-hidden" data-testid="view-toggle">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="rounded-none gap-1.5 text-xs"
                  data-testid="button-kanban-view"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  Board
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-none gap-1.5 text-xs"
                  data-testid="button-list-view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  List
                </Button>
              </div>
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
                New Booking
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Bookings"
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
                placeholder="Search bookings..."
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
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-bookings">No bookings yet</h3>
              <p className="text-muted-foreground mb-4">Create your first booking to start managing venue hire.</p>
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-booking-empty">
                <Plus className="w-4 h-4 mr-2" />
                Create Booking
              </Button>
            </Card>
          ) : viewMode === "kanban" ? (
            filtered?.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No bookings match your filters.</p>
              </Card>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-4 gap-4" data-testid="kanban-board">
                  {BOOKING_STATUSES.map(status => {
                    const items = kanbanColumns[status] || [];
                    const StatusIcon = STATUS_ICONS[status] || CircleDashed;
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
                              {items.map((booking, index) => {
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
                                                {getBookingGroupName(booking.bookerGroupId) || getVenueName(booking.venueId)}
                                              </p>
                                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                {getBookingGroupName(booking.bookerGroupId) ? getVenueName(booking.venueId) : ""}
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
                                                {booking.xeroInvoiceId && (
                                                  <Badge variant="outline" className={`text-[10px] ${booking.xeroInvoiceStatus === "paid" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"}`} data-testid={`badge-xero-invoice-${booking.id}`}>
                                                    <Receipt className="w-2.5 h-2.5 mr-0.5" />
                                                    {booking.xeroInvoiceStatus || "invoiced"}
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

                                        {(parseFloat(booking.amount || "0") > 0 || getBookerName(booking.bookerId)) && (
                                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                                            {parseFloat(booking.amount || "0") > 0 && (
                                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                                <DollarSign className="w-3 h-3" />
                                                {parseFloat(booking.amount || "0").toFixed(2)}
                                                {booking.rateType === "community" && (
                                                  <Badge variant="secondary" className="text-[8px] ml-1 px-1 py-0">Community</Badge>
                                                )}
                                              </span>
                                            )}
                                            {getBookerName(booking.bookerId) && (
                                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                                                <Users className="w-3 h-3" />
                                                {getBookerName(booking.bookerId)}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
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
                  <p className="text-muted-foreground">No bookings match your filters.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((booking) => {
                    const dateTime = formatDateTime(booking);
                    const bookerName = getBookerName(booking.bookerId);
                    const bookingGroupName = getBookingGroupName(booking.bookerGroupId);
                    const isCancelled = booking.status === "cancelled";

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
                                {bookingGroupName || getVenueName(booking.venueId)}
                              </h3>
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
                            </div>
                            {bookingGroupName && (
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {getVenueName(booking.venueId)}
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
      </main>

      <BookingFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        venues={venues || []}
        onSubmit={async (data) => {
          try {
            await createMutation.mutateAsync(data);
            setCreateOpen(false);
            toast({ title: "Created", description: "Booking created successfully" });
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
              toast({ title: "Updated", description: "Booking updated successfully" });
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
            <DialogTitle>Booking Settings</DialogTitle>
            <DialogDescription>Configure venues and bookers</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="regular-bookers">
            <TabsList className="flex-wrap">
              <TabsTrigger value="regular-bookers" data-testid="tab-booking-regular-bookers">Regular Bookers</TabsTrigger>
              <TabsTrigger value="venue-instructions" data-testid="tab-booking-venue-instructions">Venue Instructions</TabsTrigger>
              <TabsTrigger value="venues" data-testid="tab-booking-venues">Venues</TabsTrigger>
              <TabsTrigger value="after-hours" data-testid="tab-booking-after-hours">After Hours</TabsTrigger>
              <TabsTrigger value="xero" data-testid="tab-booking-xero">Xero</TabsTrigger>
            </TabsList>
            <TabsContent value="regular-bookers" className="mt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Regular bookers are now managed from their own dedicated page.</p>
                <Button
                  variant="outline"
                  onClick={() => { setSettingsOpen(false); setLocation("/regular-bookers"); }}
                  data-testid="button-open-regular-bookers"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Go to Regular Bookers
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="venue-instructions" className="mt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Configure instructions sent to bookers with their confirmation emails.</p>
                <Button
                  variant="outline"
                  onClick={() => { setSettingsOpen(false); setVenueInstructionsOpen(true); }}
                  data-testid="button-open-venue-instructions"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Manage Venue Instructions
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="venues" className="mt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Add, edit, or remove venues and configure default pricing.</p>
                <Button
                  variant="outline"
                  onClick={() => { setSettingsOpen(false); setVenueDialogOpen(true); }}
                  data-testid="button-open-manage-venues"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Manage Venues
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="after-hours" className="mt-4">
              <AfterHoursSettingsTab />
            </TabsContent>
            <TabsContent value="xero" className="mt-4">
              <XeroSettingsTab />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <VenueManagementDialog
        open={venueDialogOpen}
        onOpenChange={setVenueDialogOpen}
        pricingDefaults={pricingDefaults}
        onUpdatePricing={async (data) => {
          try {
            await updatePricingMutation.mutateAsync(data);
            toast({ title: "Pricing defaults saved" });
          } catch {
            toast({ title: "Error saving pricing defaults", variant: "destructive" });
          }
        }}
        pricingPending={updatePricingMutation.isPending}
      />

      <VenueInstructionsDialog
        open={venueInstructionsOpen}
        onOpenChange={setVenueInstructionsOpen}
      />

      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-booking-completed">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-completion-title">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Booking Completed
            </DialogTitle>
            <DialogDescription>
              Take follow-up actions for this completed booking.
            </DialogDescription>
          </DialogHeader>

          {completionBooking && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <div className="font-medium" data-testid="text-completion-booking-name">
                  {getBookingGroupName(completionBooking.bookerGroupId) || completionBooking.title || getVenueName(completionBooking.venueId)}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {getVenueName(completionBooking.venueId)}
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
                {getBookerName(completionBooking.bookerId) && (
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
                  variant={completionInvoiceDone ? "secondary" : "default"}
                  onClick={handleGenerateInvoice}
                  disabled={completionInvoiceDone || !completionNeedsInvoice || completionInvoiceLoading}
                  data-testid="button-generate-invoice"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    {completionInvoiceDone ? "Invoice Generated" : completionNeedsInvoice ? "Generate Invoice" : "No invoice needed"}
                  </span>
                  {completionInvoiceLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : completionInvoiceDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : null}
                </Button>

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

const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

function AfterHoursSettingsTab() {
  const { toast } = useToast();
  const { data: operatingHoursData, isLoading: hoursLoading } = useQuery<OperatingHours[]>({
    queryKey: ['/api/operating-hours'],
  });
  const { data: afterHoursData, isLoading: settingsLoading } = useQuery<{ autoSendEnabled: boolean; sendTimingHours: number }>({
    queryKey: ['/api/after-hours-settings'],
  });

  const [hours, setHours] = useState<Array<{ dayOfWeek: string; openTime: string | null; closeTime: string | null; isStaffed: boolean }>>([]);
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [sendTimingHours, setSendTimingHours] = useState(4);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && operatingHoursData && operatingHoursData.length > 0) {
      setHours(DAYS_OF_WEEK.map(day => {
        const existing = operatingHoursData.find(h => h.dayOfWeek === day);
        return {
          dayOfWeek: day,
          openTime: existing?.openTime || null,
          closeTime: existing?.closeTime || null,
          isStaffed: existing?.isStaffed ?? !["saturday", "sunday"].includes(day),
        };
      }));
      setInitialized(true);
    } else if (!initialized && operatingHoursData && operatingHoursData.length === 0) {
      setHours(DAYS_OF_WEEK.map(day => ({
        dayOfWeek: day,
        openTime: ["saturday", "sunday"].includes(day) ? null : "09:00",
        closeTime: ["saturday", "sunday"].includes(day) ? null : "17:00",
        isStaffed: !["saturday", "sunday"].includes(day),
      })));
      setInitialized(true);
    }
  }, [operatingHoursData, initialized]);

  useEffect(() => {
    if (afterHoursData) {
      setAutoSendEnabled(afterHoursData.autoSendEnabled ?? true);
      setSendTimingHours(afterHoursData.sendTimingHours ?? 4);
    }
  }, [afterHoursData]);

  const saveHoursMutation = useMutation({
    mutationFn: () => apiRequest('PUT', '/api/operating-hours', { hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operating-hours'] });
      toast({ title: "Saved", description: "Operating hours updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: () => apiRequest('PUT', '/api/after-hours-settings', { autoSendEnabled, sendTimingHours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/after-hours-settings'] });
      toast({ title: "Saved", description: "After-hours settings updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSave() {
    saveHoursMutation.mutate();
    saveSettingsMutation.mutate();
  }

  function handleQuickSetup() {
    setHours(DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day,
      openTime: ["saturday", "sunday"].includes(day) ? null : "09:00",
      closeTime: ["saturday", "sunday"].includes(day) ? null : "17:00",
      isStaffed: !["saturday", "sunday"].includes(day),
    })));
  }

  function updateDay(dayOfWeek: string, field: string, value: any) {
    setHours(prev => prev.map(h => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h));
  }

  if (hoursLoading || settingsLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-1">Auto-Send Reminders</h3>
        <p className="text-xs text-muted-foreground mb-3">Automatically send venue instructions before after-hours bookings.</p>
        <div className="flex items-center gap-3">
          <Switch
            checked={autoSendEnabled}
            onCheckedChange={setAutoSendEnabled}
            data-testid="switch-auto-send"
          />
          <span className="text-sm">{autoSendEnabled ? "Enabled" : "Disabled"}</span>
        </div>
        {autoSendEnabled && (
          <div className="mt-3">
            <Label className="text-xs">Send reminder</Label>
            <Select value={String(sendTimingHours)} onValueChange={(v) => setSendTimingHours(Number(v))}>
              <SelectTrigger className="w-48 mt-1" data-testid="select-send-timing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">1 day before</SelectItem>
                <SelectItem value="4">4 hours before</SelectItem>
                <SelectItem value="2">2 hours before</SelectItem>
                <SelectItem value="0">8am on day of booking</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Operating Hours</h3>
            <p className="text-xs text-muted-foreground">Bookings outside these hours are flagged as after-hours.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleQuickSetup} data-testid="button-quick-setup">
            Quick Setup
          </Button>
        </div>
        <div className="space-y-2">
          {hours.map(h => (
            <div key={h.dayOfWeek} className="flex items-center gap-3 text-sm" data-testid={`row-${h.dayOfWeek}`}>
              <span className="w-24 font-medium">{DAY_LABELS[h.dayOfWeek]}</span>
              <Switch
                checked={h.isStaffed}
                onCheckedChange={(v) => updateDay(h.dayOfWeek, 'isStaffed', v)}
                data-testid={`switch-staffed-${h.dayOfWeek}`}
              />
              {h.isStaffed ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={h.openTime || "09:00"}
                    onChange={(e) => updateDay(h.dayOfWeek, 'openTime', e.target.value)}
                    className="w-28 h-8 text-xs"
                    data-testid={`input-open-${h.dayOfWeek}`}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={h.closeTime || "17:00"}
                    onChange={(e) => updateDay(h.dayOfWeek, 'closeTime', e.target.value)}
                    className="w-28 h-8 text-xs"
                    data-testid={`input-close-${h.dayOfWeek}`}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Unstaffed - all bookings are after-hours</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saveHoursMutation.isPending || saveSettingsMutation.isPending}
        data-testid="button-save-after-hours"
      >
        {(saveHoursMutation.isPending || saveSettingsMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Settings
      </Button>
    </div>
  );
}

function XeroSettingsTab() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const { data: xeroStatus, isLoading } = useQuery<{
    connected: boolean;
    hasCredentials: boolean;
    organisationName: string | null;
    connectedAt: string | null;
    tokenExpiresAt: string | null;
  }>({
    queryKey: ['/api/xero/status'],
  });

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
          Invoices will be automatically generated in Xero when bookings are accepted. Bookings with koha, package credits, or zero amounts are skipped.
        </p>
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
        Connect to Xero to automatically generate invoices when bookings are confirmed. You'll need to create a Xero app first.
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

function VenueManagementDialog({
  open,
  onOpenChange,
  pricingDefaults,
  onUpdatePricing,
  pricingPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricingDefaults?: { fullDayRate?: string | null; halfDayRate?: string | null };
  onUpdatePricing: (data: { fullDayRate?: string; halfDayRate?: string }) => void;
  pricingPending?: boolean;
}) {
  const { data: venues } = useVenues();
  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();
  const deleteVenue = useDeleteVenue();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [localFullDay, setLocalFullDay] = useState(pricingDefaults?.fullDayRate || "0");
  const [localHalfDay, setLocalHalfDay] = useState(pricingDefaults?.halfDayRate || "0");

  const handleCreateVenue = async () => {
    if (!newName.trim()) return;
    try {
      await createVenue.mutateAsync({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        capacity: newCapacity ? parseInt(newCapacity) : undefined,
      });
      setNewName("");
      setNewDescription("");
      setNewCapacity("");
      toast({ title: "Created", description: "Venue created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create venue", variant: "destructive" });
    }
  };

  const handleUpdateVenue = async (id: number) => {
    try {
      await updateVenue.mutateAsync({
        id,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          capacity: editCapacity ? parseInt(editCapacity) : undefined,
        },
      });
      setEditingId(null);
      toast({ title: "Updated", description: "Venue updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update venue", variant: "destructive" });
    }
  };

  const handleDeleteVenue = async (id: number) => {
    try {
      await deleteVenue.mutateAsync(id);
      toast({ title: "Deleted", description: "Venue deleted successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete venue", variant: "destructive" });
    }
  };

  const handleToggleActive = async (venue: Venue) => {
    try {
      await updateVenue.mutateAsync({ id: venue.id, data: { active: !venue.active } });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to toggle venue", variant: "destructive" });
    }
  };

  const startEditing = (venue: Venue) => {
    setEditingId(venue.id);
    setEditName(venue.name);
    setEditDescription(venue.description || "");
    setEditCapacity(venue.capacity?.toString() || "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-venue-dialog-title">Manage Venues</DialogTitle>
          <DialogDescription>Add, edit, or remove venues for bookings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {venues?.map((venue) => (
              <Card key={venue.id} className="p-3" data-testid={`card-venue-${venue.id}`}>
                {editingId === venue.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Venue name"
                      data-testid={`input-edit-venue-name-${venue.id}`}
                    />
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      data-testid={`input-edit-venue-description-${venue.id}`}
                    />
                    <Input
                      type="number"
                      value={editCapacity}
                      onChange={(e) => setEditCapacity(e.target.value)}
                      placeholder="Capacity"
                      data-testid={`input-edit-venue-capacity-${venue.id}`}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleUpdateVenue(venue.id)} disabled={updateVenue.isPending} data-testid={`button-save-venue-${venue.id}`}>
                        {updateVenue.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-venue-${venue.id}`}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`text-venue-name-${venue.id}`}>{venue.name}</span>
                        {venue.capacity && (
                          <Badge variant="secondary" className="text-xs">
                            Cap: {venue.capacity}
                          </Badge>
                        )}
                        {!venue.active && (
                          <Badge variant="outline" className="text-xs opacity-60">Inactive</Badge>
                        )}
                      </div>
                      {venue.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{venue.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={venue.active ?? true}
                        onCheckedChange={() => handleToggleActive(venue)}
                        data-testid={`switch-venue-active-${venue.id}`}
                      />
                      <Button variant="ghost" size="icon" onClick={() => startEditing(venue)} data-testid={`button-edit-venue-${venue.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteVenue(venue.id)} data-testid={`button-delete-venue-${venue.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
            {(!venues || venues.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No venues yet. Add one below.</p>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label className="text-sm font-semibold">Add New Venue</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Venue name"
              data-testid="input-new-venue-name"
            />
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              data-testid="input-new-venue-description"
            />
            <Input
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              placeholder="Capacity (optional)"
              data-testid="input-new-venue-capacity"
            />
            <Button onClick={handleCreateVenue} disabled={!newName.trim() || createVenue.isPending} data-testid="button-add-venue">
              {createVenue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" />
              Add Venue
            </Button>
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Default Pricing (Full Price, GST Excl.)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Full Day Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={localFullDay}
                    onChange={(e) => setLocalFullDay(e.target.value)}
                    className="pl-7"
                    data-testid="input-default-full-day-rate"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Half Day Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={localHalfDay}
                    onChange={(e) => setLocalHalfDay(e.target.value)}
                    className="pl-7"
                    data-testid="input-default-half-day-rate"
                  />
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdatePricing({ fullDayRate: localFullDay, halfDayRate: localHalfDay })}
              disabled={pricingPending}
              data-testid="button-save-pricing-defaults"
            >
              {pricingPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Save Pricing Defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  const [venueId, setVenueId] = useState(booking?.venueId?.toString() || "");
  const [classification, setClassification] = useState(booking?.classification || "");
  const [status, setStatus] = useState(booking?.status || "enquiry");
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
  const [groupId, setGroupId] = useState<number | null>(booking?.bookerGroupId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState("");
  const [membershipId, setMembershipId] = useState<number | null>(booking?.membershipId || null);
  const [mouId, setMouId] = useState<number | null>(booking?.mouId || null);
  const [agreementAutoPopulated, setAgreementAutoPopulated] = useState(false);
  const [conflictOverride, setConflictOverride] = useState(false);

  const conflictQueryEnabled = !isTBC && !!venueId && !!startDate && !!startTime && !!endTime;
  const { data: conflictData, isLoading: conflictLoading } = useQuery<{
    conflicts: { type: string; id: number; title: string; date: string; time: string }[];
    availableSlots: { startTime: string; endTime: string }[];
  }>({
    queryKey: ['/api/venue-conflicts', venueId, startDate, startTime, endTime, booking?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        venueId,
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
  }, [venueId, startDate, startTime, endTime]);

  const { data: allMemberships } = useMemberships();
  const { data: allMous } = useMous();
  const { data: regularBookers } = useRegularBookers();
  const { data: bookings } = useBookings();
  const activeMemberships = useMemo(() => (allMemberships || []).filter(m => m.status === "active"), [allMemberships]);
  const activeMous = useMemo(() => (allMous || []).filter(m => m.status === "active"), [allMous]);

  const handleBookerSelected = useCallback((contactId: number) => {
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
      const newContact = await createContact.mutateAsync({ name: quickBookerName.trim() });
      setBookerId(newContact.id);
      setQuickBookerName("");
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

  const handleSubmit = () => {
    if (!classification || !venueId) return;
    const data: any = {
      venueId: parseInt(venueId),
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
      durationType,
      rateType,
      amount: amount || "0",
      bookerId: bookerId || null,
      bookerGroupId: groupId || null,
      membershipId: membershipId || null,
      mouId: mouId || null,
      notes: notes.trim() || undefined,
      ...(conflictOverride ? { conflictOverride: true } : {}),
    };
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-booking-dialog-title">
            {booking ? "Edit Booking" : "New Booking"}
          </DialogTitle>
          <DialogDescription>
            {booking ? "Update booking details and schedule." : "Create a new venue booking."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Booker (Person)</Label>
            {bookerId && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid="badge-selected-booker">
                  {contacts?.find((c) => c.id === bookerId)?.name || `Contact #${bookerId}`}
                  <button
                    onClick={() => setBookerId(null)}
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
                {filteredBookerContacts.length === 0 && !showQuickAddBooker && (
                  <div className="text-xs text-muted-foreground flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <span>No contacts found for "{bookerSearch}"</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setQuickBookerName(bookerSearch);
                        setShowQuickAddBooker(true);
                      }}
                      data-testid="button-quick-add-booker"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Quick Add
                    </Button>
                  </div>
                )}
              </>
            )}
            {showQuickAddBooker && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                <Input
                  value={quickBookerName}
                  onChange={(e) => setQuickBookerName(e.target.value)}
                  placeholder="Person's name"
                  className="h-7 text-xs flex-1"
                  data-testid="input-quick-add-booker-name"
                />
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
                  onClick={() => setShowQuickAddBooker(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Booking Group / Organisation</Label>
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

          <div>
            <Label>Venue *</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger data-testid="select-booking-venue">
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.filter((v) => v.active !== false).map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-booking-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                <div className={`grid ${isMultiDay ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                  <div>
                    <Label className="text-xs text-muted-foreground">{isMultiDay ? "Start Date" : "Date"}</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (!isMultiDay) setEndDate(e.target.value);
                      }}
                      data-testid="input-booking-start-date"
                    />
                  </div>
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
                </div>
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
                    <Badge variant="secondary" className="text-[10px]">{c.type === "booking" ? "Booking" : "Programme"}</Badge>
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

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Pricing (GST Exclusive)</Label>
            <div className="grid grid-cols-3 gap-3">
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
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount (excl. GST)</Label>
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
              {rateType === "community" && parseFloat(amount || "0") > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1" data-testid="text-community-rate-info">
                  Standard rate: ${(parseFloat(amount || "0") / (1 - COMMUNITY_DISCOUNT)).toFixed(2)} → Community rate (20% off): ${parseFloat(amount || "0").toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {(activeMemberships.length > 0 || activeMous.length > 0) && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Agreement</Label>
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
              {(membershipId || mouId) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2.5 text-xs space-y-1.5 mt-2" data-testid="text-agreement-auto-populated">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      {agreementAutoPopulated ? "Auto-linked from regular booker agreement" : "Agreement linked"}
                    </span>
                  </div>
                  {(() => {
                    const m = membershipId ? activeMemberships.find(ms => ms.id === membershipId) : null;
                    const mou = mouId ? activeMous.find(ms => ms.id === mouId) : null;
                    const agreement = m || mou;
                    if (!agreement) return null;
                    const allowance = (agreement as any).bookingAllowance;
                    const period = (agreement as any).allowancePeriod || "quarterly";
                    const periodLabel = getPeriodLabel(period);
                    const type = membershipId ? "membership" as const : "mou" as const;
                    const id = (membershipId || mouId)!;
                    const used = getAgreementAllowanceUsage(bookings, type, id, period);
                    const remaining = allowance ? Math.max(0, allowance - used) : null;
                    return (
                      <div className="pl-5 space-y-1">
                        <p className="text-muted-foreground font-medium">{m ? m.name : (mou as any)?.title}</p>
                        {m && (
                          <p className="text-muted-foreground">
                            Pricing: {m.annualFee && parseFloat(m.annualFee) > 0 ? "Per Membership" : "Free / Koha"}
                          </p>
                        )}
                        {mou && (
                          <p className="text-muted-foreground">Pricing: Free / Koha (from MOU)</p>
                        )}
                        {allowance && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <Calendar className="w-3 h-3 text-blue-500" />
                            <span className="text-muted-foreground">
                              {used}/{allowance} used this {periodLabel}
                            </span>
                            {remaining !== null && (
                              <Badge variant="secondary" className={`text-[10px] ${remaining === 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : ""}`}>
                                {remaining} remaining
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
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
            disabled={isPending || !classification || !venueId || (hasConflicts && !conflictOverride)}
            data-testid="button-save-booking"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {booking ? "Save Changes" : "Create Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const INSTRUCTION_TYPE_LABELS: Record<string, string> = {
  access: "Access",
  arrival: "Arrival",
  departure: "Departure",
  emergency: "Emergency",
  general: "General",
};

const INSTRUCTION_TYPE_COLORS: Record<string, string> = {
  access: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  arrival: "bg-green-500/15 text-green-700 dark:text-green-300",
  departure: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  emergency: "bg-red-500/15 text-red-700 dark:text-red-300",
  general: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
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
  const [instructionType, setInstructionType] = useState(instruction?.instructionType || "general");
  const [title, setTitle] = useState(instruction?.title || "");
  const [content, setContent] = useState(instruction?.content || "");
  const [displayOrder, setDisplayOrder] = useState(instruction?.displayOrder?.toString() || "0");

  useState(() => {
    if (instruction) {
      setInstructionType(instruction.instructionType);
      setTitle(instruction.title || "");
      setContent(instruction.content || "");
      setDisplayOrder(instruction.displayOrder?.toString() || "0");
    }
  });

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
            {instruction ? "Update the venue instruction." : "Add a new instruction for venue bookings."}
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
