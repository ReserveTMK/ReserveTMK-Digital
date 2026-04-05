import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  useMemberships,
  useCreateMembership,
  useUpdateMembership,
  useDeleteMembership,
  useMous,
  useCreateMou,
  useUpdateMou,
  useDeleteMou,
} from "@/hooks/use-memberships";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useGroups, useCreateGroup } from "@/hooks/use-groups";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useState, useMemo, useRef, useCallback, createElement } from "react";
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
  UserPlus,
  Users,
  X,
  FileText,
  Handshake,
  ArrowRightLeft,
  Network,
  Undo2,
  TrendingDown,
  Info,
  MapPin,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  MEMBERSHIP_STATUSES,
  MOU_STATUSES,
  PAYMENT_STATUSES,
  RELATIONSHIP_ROLES,
  ACCESS_PROVIDED_OPTIONS,
  WHAT_WE_GAIN_OPTIONS,
  GROWTH_POTENTIAL_OPTIONS,
  ACCESS_TO_BOOKING_CATEGORY,
  type Membership,
  type Mou,
  type Contact,
  type Booking,
  type Group,
} from "@shared/schema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const MEMBERSHIP_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  expired: "bg-gray-100/30 dark:bg-gray-900/10 border-gray-100 dark:border-gray-900/20 opacity-70",
  pending: "bg-yellow-50/50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
};

const MOU_STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-50/50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
  active: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  expired: "bg-gray-100/30 dark:bg-gray-900/10 border-gray-100 dark:border-gray-900/20 opacity-70",
  terminated: "bg-red-50/30 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 opacity-70",
};

const RELATIONSHIP_ROLE_LABELS: Record<string, { label: string; description: string }> = {
  deliver: { label: "We deliver", description: "Our people, our methodology" },
  enable: { label: "We enable", description: "Their delivery, our space/resource" },
  align: { label: "We align", description: "Shared values, growing connection" },
  commercial: { label: "Commercial", description: "Revenue relationship" },
};

const ACCESS_PROVIDED_LABELS: Record<string, string> = {
  venue: "Venue",
  hot_desk: "Hot Desk",
  gear: "Gear",
  studio: "Studio",
  mentoring: "Mentoring",
  programme_place: "Programme Place",
  promotion: "Promotion",
  network_introductions: "Network Introductions",
};

const WHAT_WE_GAIN_LABELS: Record<string, string> = {
  content_presence: "Content & Presence",
  revenue: "Revenue",
  co_delivery: "Co-delivery",
  demand_evidence: "Demand Evidence",
  network_reach: "Network Reach",
  youth_engagement: "Youth Engagement",
  workshop_facilitation: "Workshop Facilitation",
  community_programme: "Community Programme",
};

const GROWTH_POTENTIAL_LABELS: Record<string, string> = {
  co_delivery_potential: "Co-delivery Potential",
  event_collaboration: "Event Collaboration",
  programme_facilitation: "Programme Facilitation",
  referral_partner: "Referral Partner",
  joint_content: "Joint Content",
  no_growth_expected: "No Growth Expected",
};

const RELATIONSHIP_ROLE_COLORS: Record<string, string> = {
  deliver: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  enable: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  align: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  commercial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-500/15 text-green-700 dark:text-green-300",
  unpaid: "bg-red-500/15 text-red-700 dark:text-red-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  refunded: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function Agreements({ embedded }: { embedded?: boolean } = {}) {
  const { data: memberships, isLoading: membershipsLoading } = useMemberships();
  const { data: mous, isLoading: mousLoading } = useMous();
  const { data: contacts } = useContacts();
  const { data: allGroups } = useGroups();
  const { data: bookings } = useBookings();
  const createMembershipMutation = useCreateMembership();
  const updateMembershipMutation = useUpdateMembership();
  const deleteMembershipMutation = useDeleteMembership();
  const createMouMutation = useCreateMou();
  const updateMouMutation = useUpdateMou();
  const deleteMouMutation = useDeleteMou();
  const { toast } = useToast();

  const [agreementSearch, setAgreementSearch] = useState("");
  const [createMembershipOpen, setCreateMembershipOpen] = useState(false);
  const [editMembership, setEditMembership] = useState<Membership | null>(null);
  const [createMouOpen, setCreateMouOpen] = useState(false);
  const [editMou, setEditMou] = useState<Mou | null>(null);

  // Unified agreement list — memberships + MOUs merged
  type AgreementItem =
    | { kind: "membership"; data: Membership }
    | { kind: "mou"; data: Mou };

  const allAgreements = useMemo<AgreementItem[]>(() => {
    const items: AgreementItem[] = [];
    (memberships || []).forEach(m => items.push({ kind: "membership", data: m }));
    (mous || []).forEach(m => items.push({ kind: "mou", data: m }));
    return items;
  }, [memberships, mous]);

  const filteredAgreements = useMemo(() => {
    if (!agreementSearch.trim()) return allAgreements;
    const term = agreementSearch.toLowerCase();
    return allAgreements.filter((item) => {
      const contactName = contacts?.find((c) => c.id === item.data.contactId)?.name || "";
      if (item.kind === "membership") {
        return (
          item.data.name.toLowerCase().includes(term) ||
          contactName.toLowerCase().includes(term) ||
          item.data.notes?.toLowerCase().includes(term)
        );
      }
      return (
        item.data.title.toLowerCase().includes(term) ||
        item.data.partnerName?.toLowerCase().includes(term) ||
        contactName.toLowerCase().includes(term) ||
        item.data.notes?.toLowerCase().includes(term)
      );
    });
  }, [allAgreements, agreementSearch, contacts]);

  // Keep filtered lists for visibility filtering with undo
  const filteredMemberships = useMemo(() => {
    return filteredAgreements.filter(a => a.kind === "membership").map(a => a.data as Membership);
  }, [filteredAgreements]);

  const filteredMous = useMemo(() => {
    return filteredAgreements.filter(a => a.kind === "mou").map(a => a.data as Mou);
  }, [filteredAgreements]);

  const [pendingDelete, setPendingDelete] = useState<{ id: number; type: "membership" | "mou" } | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteExecuted = useRef(false);

  const membershipStats = useMemo(() => {
    if (!memberships) return { total: 0, active: 0, revenue: 0, valueGiven: 0 };
    const nonExpired = memberships.filter((m) => m.status !== "expired");
    const active = memberships.filter((m) => m.status === "active");
    const revenue = active.reduce((sum, m) => sum + parseFloat(m.annualFee || "0"), 0);
    const standardTotal = active.reduce((sum, m) => sum + parseFloat(m.standardValue || "0"), 0);
    return {
      total: nonExpired.length,
      active: active.length,
      revenue,
      valueGiven: Math.max(0, standardTotal - revenue),
    };
  }, [memberships]);

  const mouStats = useMemo(() => {
    if (!mous) return { total: 0, active: 0, inKindValue: 0, valueGiven: 0 };
    const active = mous.filter((m) => m.status === "active");
    const inKindTotal = active.reduce((sum, m) => sum + parseFloat(m.inKindValue || "0"), 0);
    const actualTotal = active.reduce((sum, m) => sum + parseFloat(m.actualValue || "0"), 0);
    return {
      total: mous.length,
      active: active.length,
      inKindValue: inKindTotal,
      valueGiven: Math.max(0, actualTotal - inKindTotal),
    };
  }, [mous]);

  const getMembershipBookingsUsed = (membershipId: number) => {
    if (!bookings) return 0;
    return bookings.filter((b) => b.membershipId === membershipId).length;
  };

  const getMouBookingsCount = (mouId: number) => {
    if (!bookings) return 0;
    return bookings.filter((b) => b.mouId === mouId).length;
  };

  const getContactName = (contactId: number | null) => {
    if (!contactId || !contacts) return null;
    return contacts.find((c) => c.id === contactId)?.name || null;
  };

  const getGroupName = (groupId: number | null | undefined) => {
    if (!groupId || !allGroups) return null;
    return (allGroups as Group[]).find((g) => g.id === groupId)?.name || null;
  };

  // Compute effective status — if endDate has passed and status is still "active", show as expired
  const getEffectiveStatus = (status: string, endDate: string | Date | null | undefined) => {
    if (!endDate || status === "expired" || status === "terminated") return status;
    return new Date(endDate) < new Date() ? "expired" : status;
  };

  // Days until expiry (null if no endDate or already expired)
  const getDaysUntilExpiry = (endDate: string | Date | null | undefined) => {
    if (!endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  // Next allowance reset date
  const getNextResetDate = (period: string | null | undefined) => {
    const now = new Date();
    if (period === "monthly") {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return format(next, "d MMM");
    }
    const qMonth = Math.floor(now.getMonth() / 3) * 3 + 3;
    const next = new Date(now.getFullYear(), qMonth, 1);
    return format(next, "d MMM");
  };

  // Value delivered — sum of booking amounts under an agreement
  const getValueDelivered = (agreementId: number, type: "membership" | "mou") => {
    if (!bookings) return 0;
    const matched = bookings.filter((b: Booking) =>
      type === "membership" ? b.membershipId === agreementId : b.mouId === agreementId
    );
    return matched.reduce((sum: number, b: Booking) => {
      const stdVal = type === "membership"
        ? parseFloat((memberships?.find(m => m.id === agreementId)?.standardValue) || "0")
        : parseFloat((mous?.find(m => m.id === agreementId)?.actualValue) || "0");
      const perBooking = matched.length > 0 && stdVal > 0 ? stdVal / (memberships?.find(m => m.id === agreementId)?.bookingAllowance || matched.length) : 0;
      return sum + perBooking;
    }, 0);
  };

  // Renew an agreement — create new one with same terms, bumped dates
  const handleRenewMembership = (membership: Membership) => {
    const nextYear = (membership.membershipYear || new Date().getFullYear()) + 1;
    const startDate = new Date(`${nextYear}-01-01`).toISOString();
    const endDate = new Date(`${nextYear}-12-31`).toISOString();
    createMembershipMutation.mutate({
      name: membership.name,
      contactId: membership.contactId,
      groupId: (membership as any).groupId,
      standardValue: membership.standardValue,
      annualFee: membership.annualFee,
      bookingAllowance: membership.bookingAllowance,
      allowancePeriod: membership.allowancePeriod,
      bookingCategories: membership.bookingCategories,
      allowedLocations: membership.allowedLocations,
      membershipYear: nextYear,
      startDate,
      endDate,
      status: "active",
      paymentStatus: "unpaid",
      notes: membership.notes,
    } as any, {
      onSuccess: () => {
        toast({ title: `Renewed for ${nextYear}` });
      },
    });
  };

  const handleRenewMou = (mou: Mou) => {
    const oldEnd = mou.endDate ? new Date(mou.endDate) : new Date();
    const duration = mou.startDate ? oldEnd.getTime() - new Date(mou.startDate).getTime() : 365 * 24 * 60 * 60 * 1000;
    const newStart = new Date(oldEnd.getTime() + 24 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + duration);
    createMouMutation.mutate({
      title: mou.title,
      partnerName: mou.partnerName,
      contactId: mou.contactId,
      groupId: (mou as any).groupId,
      providing: mou.providing,
      receiving: mou.receiving,
      actualValue: mou.actualValue,
      inKindValue: mou.inKindValue,
      bookingAllowance: mou.bookingAllowance,
      allowancePeriod: mou.allowancePeriod,
      bookingCategories: mou.bookingCategories,
      allowedLocations: mou.allowedLocations,
      startDate: newStart.toISOString(),
      endDate: newEnd.toISOString(),
      status: "draft",
      notes: mou.notes,
    } as any, {
      onSuccess: () => {
        toast({ title: "MOU renewed as draft" });
      },
    });
  };

  const handleDeleteWithUndo = useCallback((id: number, type: "membership" | "mou") => {
    if (pendingDeleteTimer.current) {
      clearTimeout(pendingDeleteTimer.current);
    }
    deleteExecuted.current = false;
    setPendingDelete({ id, type });

    const timer = setTimeout(async () => {
      deleteExecuted.current = true;
      pendingDeleteTimer.current = null;
      try {
        if (type === "membership") {
          await deleteMembershipMutation.mutateAsync(id);
        } else {
          await deleteMouMutation.mutateAsync(id);
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
      }
      setPendingDelete(null);
    }, 5000);

    pendingDeleteTimer.current = timer;

    toast({
      title: `${type === "membership" ? "Membership" : "MOU"} deleted`,
      description: "Click undo to restore",
      action: createElement(ToastAction as any, {
        altText: "Undo delete",
        onClick: () => {
          if (deleteExecuted.current) return;
          if (pendingDeleteTimer.current) {
            clearTimeout(pendingDeleteTimer.current);
            pendingDeleteTimer.current = null;
          }
          setPendingDelete(null);
          toast({ title: "Restored", description: `${type === "membership" ? "Membership" : "MOU"} restored` });
        },
        "data-testid": "button-undo-delete",
      }, "Undo") as any,
    });
  }, [deleteMembershipMutation, deleteMouMutation, toast]);

  const visibleAgreements = useMemo(() => {
    return filteredAgreements.filter(
      (item) => !(pendingDelete && (
        (pendingDelete.type === "membership" && item.kind === "membership" && pendingDelete.id === item.data.id) ||
        (pendingDelete.type === "mou" && item.kind === "mou" && pendingDelete.id === item.data.id)
      ))
    );
  }, [filteredAgreements, pendingDelete]);

  // Combined stats
  const combinedStats = useMemo(() => {
    return {
      total: membershipStats.total + mouStats.total,
      active: membershipStats.active + mouStats.active,
      revenue: membershipStats.revenue,
      inKindValue: mouStats.inKindValue,
      totalSubsidy: membershipStats.valueGiven + mouStats.valueGiven,
    };
  }, [membershipStats, mouStats]);

  const isLoading = membershipsLoading || mousLoading;

  return (
    <>
    <main className={embedded ? "space-y-6" : "flex-1 p-4 md:p-8 pb-8 overflow-y-auto"}>
        <div className={embedded ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}>
          {!embedded && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-agreements-title">Agreements</h1>
              <p className="text-muted-foreground mt-1">Memberships and MOUs in one view.</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="shadow-lg" data-testid="button-new-agreement">
                    <Plus className="w-4 h-4 mr-2" />
                    New Agreement
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCreateMembershipOpen(true)} data-testid="button-create-membership">
                    <FileText className="w-4 h-4 mr-2" />
                    New Membership
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateMouOpen(true)} data-testid="button-create-mou">
                    <Handshake className="w-4 h-4 mr-2" />
                    New MOU
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          )}

          {embedded && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="shadow-lg" data-testid="button-new-agreement-embedded">
                    <Plus className="w-4 h-4 mr-2" />
                    New Agreement
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCreateMembershipOpen(true)}>
                    <FileText className="w-4 h-4 mr-2" />
                    New Membership
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateMouOpen(true)}>
                    <Handshake className="w-4 h-4 mr-2" />
                    New MOU
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Combined dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold" data-testid="text-stat-total">{combinedStats.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold" data-testid="text-stat-active">{combinedStats.active}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Annual Revenue</p>
              <p className="text-2xl font-bold" data-testid="text-stat-revenue">${(combinedStats.revenue + combinedStats.inKindValue).toFixed(2)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Value Given</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-stat-subsidy">${combinedStats.totalSubsidy.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">subsidy provided</p>
            </Card>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agreements..."
                className="pl-10"
                value={agreementSearch}
                onChange={(e) => setAgreementSearch(e.target.value)}
                data-testid="input-search-agreements"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !visibleAgreements.length ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-agreements">No agreements yet</h3>
              <p className="text-muted-foreground mb-4">Create a membership or MOU to start tracking access agreements.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleAgreements.map((item) => {
                if (item.kind === "membership") {
                  const membership = item.data;
                  const contactName = getContactName(membership.contactId);
                  const groupName = getGroupName((membership as any).groupId);
                  const bookingsUsed = getMembershipBookingsUsed(membership.id);
                  const stdVal = parseFloat(membership.standardValue || "0");
                  const fee = parseFloat(membership.annualFee || "0");
                  const savings = stdVal - fee;
                  const effectiveStatus = getEffectiveStatus(membership.status, membership.endDate);
                  const daysLeft = getDaysUntilExpiry(membership.endDate);

                  return (
                    <Card
                      key={`m-${membership.id}`}
                      className={`p-4 hover-elevate transition-all ${MEMBERSHIP_STATUS_COLORS[effectiveStatus] || ""}`}
                      data-testid={`card-membership-${membership.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-base truncate" data-testid={`text-membership-contact-${membership.id}`}>
                              {groupName || contactName || "No contact assigned"}
                            </h3>
                            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                              Membership
                            </Badge>
                            <Badge className={PAYMENT_STATUS_BADGE[membership.paymentStatus || "unpaid"] || ""} data-testid={`badge-payment-${membership.id}`}>
                              {membership.paymentStatus || "unpaid"}
                            </Badge>
                            {(membership.bookingCategories || []).includes("venue_hire") && (
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">Venue</Badge>
                            )}
                            {(membership.bookingCategories || []).includes("hot_desking") && (
                              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">Desk</Badge>
                            )}
                            {(membership.bookingCategories || []).includes("gear") && (
                              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">Gear</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{membership.name}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {stdVal > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                Value: ${stdVal.toFixed(2)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Pays: ${fee.toFixed(2)}/yr
                            </span>
                            {savings > 0 && (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 text-[10px]">
                                <TrendingDown className="w-3 h-3 mr-0.5" />
                                Saves ${savings.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
                            {(membership.bookingAllowance || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {bookingsUsed} / {membership.bookingAllowance} used — resets {getNextResetDate(membership.allowancePeriod)}
                              </span>
                            )}
                            {effectiveStatus === "expired" && membership.status === "active" && (
                              <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 text-[10px]">
                                <AlertTriangle className="w-3 h-3 mr-0.5" />
                                Expired (update status)
                              </Badge>
                            )}
                            {daysLeft !== null && daysLeft <= 30 && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
                                <Clock className="w-3 h-3 mr-0.5" />
                                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                              </Badge>
                            )}
                          </div>
                          {membership.notes && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{membership.notes}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-membership-menu-${membership.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditMembership(membership)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRenewMembership(membership)}>
                              <RefreshCw className="w-4 h-4 mr-2" /> Renew
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteWithUndo(membership.id, "membership")} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  );
                }

                // MOU card
                const mou = item.data;
                const contactName = getContactName(mou.contactId);
                const groupName = getGroupName((mou as any).groupId);
                const linkedBookings = getMouBookingsCount(mou.id);
                const av = parseFloat(mou.actualValue || "0");
                const ikv = parseFloat(mou.inKindValue || "0");
                const subsidy = av - ikv;
                const effectiveStatus = getEffectiveStatus(mou.status, mou.endDate);
                const daysLeft = getDaysUntilExpiry(mou.endDate);

                return (
                  <Card
                    key={`mou-${mou.id}`}
                    className={`p-4 hover-elevate transition-all ${MOU_STATUS_COLORS[effectiveStatus] || ""}`}
                    data-testid={`card-mou-${mou.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-base truncate" data-testid={`text-mou-title-${mou.id}`}>
                            {mou.title}
                          </h3>
                          {(mou as any).relationshipRole && (
                            <Badge className={`text-[10px] ${RELATIONSHIP_ROLE_COLORS[(mou as any).relationshipRole] || ""}`}>
                              {RELATIONSHIP_ROLE_LABELS[(mou as any).relationshipRole]?.label || (mou as any).relationshipRole}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs" data-testid={`badge-mou-status-${mou.id}`}>
                            {mou.status}
                          </Badge>
                          {(() => {
                            const access = (mou as any).accessProvided?.length > 0
                              ? (mou as any).accessProvided
                              : (mou.bookingCategories || []).map((cat: string) => {
                                  const reverseMap: Record<string, string> = { venue_hire: "venue", hot_desking: "hot_desk", gear: "gear" };
                                  return reverseMap[cat] || cat;
                                });
                            return access.map((a: string) => (
                              <Badge key={a} variant="outline" className="text-[10px]">
                                {ACCESS_PROVIDED_LABELS[a] || a}
                              </Badge>
                            ));
                          })()}
                        </div>
                        {(groupName || mou.partnerName || contactName) && (
                          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5 flex-wrap" data-testid={`text-mou-partner-${mou.id}`}>
                            {groupName && (
                              <span className="flex items-center gap-1">
                                <Network className="w-3 h-3" />
                                {groupName}
                              </span>
                            )}
                            {!groupName && (mou.partnerName || contactName)}
                            {groupName && contactName && (
                              <span className="text-xs opacity-70">({contactName})</span>
                            )}
                          </p>
                        )}
                        {(mou as any).whatWeGain?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {(mou as any).whatWeGain.map((g: string) => (
                              <Badge key={g} variant="secondary" className="text-[10px]">
                                {WHAT_WE_GAIN_LABELS[g] || g}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {!(mou as any).whatWeGain?.length && mou.providing && (
                          <div className="text-xs mb-1">
                            <span className="font-medium text-foreground">Providing:</span>{" "}
                            <span className="text-muted-foreground">{mou.providing}</span>
                          </div>
                        )}
                        {!(mou as any).whatWeGain?.length && mou.receiving && (
                          <div className="text-xs mb-1">
                            <span className="font-medium text-foreground">Receiving:</span>{" "}
                            <span className="text-muted-foreground">{mou.receiving}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
                          {av > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Actual: ${av.toFixed(2)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            In-Kind: ${ikv.toFixed(2)}
                          </span>
                          {subsidy > 0 && (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 text-[10px]">
                              <TrendingDown className="w-3 h-3 mr-0.5" />
                              Subsidy: ${subsidy.toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
                          {mou.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(mou.startDate), "d MMM yyyy")}
                              {mou.endDate && ` - ${format(new Date(mou.endDate), "d MMM yyyy")}`}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            {linkedBookings} booking{linkedBookings !== 1 ? "s" : ""}
                          </span>
                          {(mou.bookingAllowance || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {linkedBookings} / {mou.bookingAllowance} used — resets {getNextResetDate(mou.allowancePeriod)}
                            </span>
                          )}
                          {effectiveStatus === "expired" && mou.status === "active" && (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 text-[10px]">
                              <AlertTriangle className="w-3 h-3 mr-0.5" />
                              Expired (update status)
                            </Badge>
                          )}
                          {daysLeft !== null && daysLeft <= 30 && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
                              <Clock className="w-3 h-3 mr-0.5" />
                              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                            </Badge>
                          )}
                        </div>
                        {mou.notes && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{mou.notes}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-mou-menu-${mou.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditMou(mou)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRenewMou(mou)}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Renew
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteWithUndo(mou.id, "mou")} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
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
      </main>

      <MembershipFormDialog
        open={createMembershipOpen}
        onOpenChange={setCreateMembershipOpen}
        onSubmit={async (data) => {
          try {
            await createMembershipMutation.mutateAsync(data);
            setCreateMembershipOpen(false);
            toast({ title: "Created", description: "Membership created successfully" });
          } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to create", variant: "destructive" });
          }
        }}
        isPending={createMembershipMutation.isPending}
      />

      {editMembership && (
        <MembershipFormDialog
          open={!!editMembership}
          onOpenChange={(open) => { if (!open) setEditMembership(null); }}
          membership={editMembership}
          onSubmit={async (data) => {
            try {
              await updateMembershipMutation.mutateAsync({ id: editMembership.id, data });
              setEditMembership(null);
              toast({ title: "Updated", description: "Membership updated successfully" });
            } catch (err: any) {
              toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
            }
          }}
          isPending={updateMembershipMutation.isPending}
        />
      )}

      <MouFormDialog
        open={createMouOpen}
        onOpenChange={setCreateMouOpen}
        onSubmit={async (data) => {
          try {
            await createMouMutation.mutateAsync(data);
            setCreateMouOpen(false);
            toast({ title: "Created", description: "MOU created successfully" });
          } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to create", variant: "destructive" });
          }
        }}
        isPending={createMouMutation.isPending}
      />

      {editMou && (
        <MouFormDialog
          open={!!editMou}
          onOpenChange={(open) => { if (!open) setEditMou(null); }}
          mou={editMou}
          onSubmit={async (data) => {
            try {
              await updateMouMutation.mutateAsync({ id: editMou.id, data });
              setEditMou(null);
              toast({ title: "Updated", description: "MOU updated successfully" });
            } catch (err: any) {
              toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
            }
          }}
          isPending={updateMouMutation.isPending}
        />
      )}
    </>
  );
}

function MembershipFormDialog({
  open,
  onOpenChange,
  membership,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership?: Membership;
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
}) {
  const { data: contacts } = useContacts();
  const { data: allGroups } = useGroups();
  const { data: venues } = useVenues();
  const createContact = useCreateContact();
  const createGroupMutation = useCreateGroup();

  const [name, setName] = useState(membership?.name || "");
  const [contactId, setContactId] = useState<number | null>(membership?.contactId || null);
  const [contactSearch, setContactSearch] = useState("");
  const [groupId, setGroupId] = useState<number | null>((membership as any)?.groupId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [showQuickAddContact, setShowQuickAddContact] = useState(false);
  const [quickContactName, setQuickContactName] = useState("");
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState("");
  const [standardValue, setStandardValue] = useState(membership?.standardValue || "0");
  const [annualFee, setAnnualFee] = useState(membership?.annualFee || "0");
  const [bookingCategories, setBookingCategories] = useState<string[]>(
    membership?.bookingCategories || []
  );
  const [allowedLocations, setAllowedLocations] = useState<string[]>(
    membership?.allowedLocations || []
  );

  const availableLocations = useMemo(() => {
    if (!venues) return [];
    return Array.from(new Set(venues.filter(v => v.active !== false && v.spaceName).map(v => v.spaceName!)));
  }, [venues]);
  const [bookingAllowance, setBookingAllowance] = useState((membership?.bookingAllowance || 0).toString());
  const [allowancePeriod, setAllowancePeriod] = useState(membership?.allowancePeriod || "quarterly");
  const [membershipYear, setMembershipYear] = useState(
    (membership?.membershipYear || new Date().getFullYear()).toString()
  );
  const [startDate, setStartDate] = useState(
    membership?.startDate ? format(new Date(membership.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    membership?.endDate ? format(new Date(membership.endDate), "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState(membership?.status || "active");
  const [paymentStatus, setPaymentStatus] = useState(membership?.paymentStatus || "unpaid");
  const [notes, setNotes] = useState(membership?.notes || "");

  const toggleCategory = (cat: string) => {
    setBookingCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const hasHotDeskingOrGear = bookingCategories.includes("hot_desking") || bookingCategories.includes("gear");

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return [];
    const term = contactSearch.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8);
  }, [contacts, contactSearch]);

  const filteredGroups = useMemo(() => {
    if (!allGroups || !groupSearch.trim()) return [];
    const term = groupSearch.toLowerCase();
    return (allGroups as Group[]).filter((g) => g.name.toLowerCase().includes(term)).slice(0, 8);
  }, [allGroups, groupSearch]);

  const handleSelectContact = (contact: Contact) => {
    setContactId(contact.id);
    setContactSearch("");
  };

  const handleQuickAddMembershipContact = async () => {
    if (!quickContactName.trim()) return;
    try {
      const newContact = await createContact.mutateAsync({ name: quickContactName.trim() });
      setContactId(newContact.id);
      setQuickContactName("");
      setShowQuickAddContact(false);
      setContactSearch("");
    } catch (err: any) {}
  };

  const handleQuickAddMembershipGroup = async () => {
    if (!quickGroupName.trim()) return;
    try {
      const newGroup = await createGroupMutation.mutateAsync({ name: quickGroupName.trim(), type: "Business" });
      setGroupId(newGroup.id);
      setQuickGroupName("");
      setShowQuickAddGroup(false);
      setGroupSearch("");
    } catch (err: any) {}
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const year = parseInt(membershipYear) || new Date().getFullYear();
    const computedStartDate = startDate ? new Date(startDate).toISOString() : new Date(`${year}-01-01`).toISOString();
    const computedEndDate = endDate ? new Date(endDate).toISOString() : new Date(`${year}-12-31`).toISOString();
    const data: any = {
      name: name.trim(),
      contactId: contactId || undefined,
      groupId: groupId || undefined,
      standardValue: standardValue || "0",
      annualFee: annualFee || "0",
      bookingCategories,
      allowedLocations: allowedLocations.length > 0 ? allowedLocations : null,
      bookingAllowance: parseInt(bookingAllowance) || 0,
      allowancePeriod,
      membershipYear: year,
      startDate: computedStartDate,
      endDate: computedEndDate,
      status,
      paymentStatus,
      notes: notes.trim() || undefined,
    };
    onSubmit(data);
  };

  const toggleLocation = (loc: string) => {
    setAllowedLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-membership-dialog-title">
            {membership ? "Edit Membership" : "New Membership"}
          </DialogTitle>
          <DialogDescription>
            {membership ? "Update membership details and payment information." : "Set up a new membership with venue hire hours and billing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Studio Membership"
              data-testid="input-membership-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Group / Organisation</Label>
            {groupId && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-membership-group-${groupId}`}>
                  <Network className="w-3 h-3 mr-0.5" />
                  {(allGroups as Group[])?.find((g) => g.id === groupId)?.name || `Group #${groupId}`}
                  <button
                    onClick={() => setGroupId(null)}
                    className="ml-0.5 transition-colors"
                    data-testid="button-remove-membership-group"
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
                data-testid="input-search-membership-group"
              />
            </div>
            {groupSearch.trim() && (
              <>
                {filteredGroups.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                    {filteredGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setGroupId(g.id); setGroupSearch(""); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                        data-testid={`button-select-membership-group-${g.id}`}
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
                {filteredGroups.length === 0 && !showQuickAddGroup && (
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
                      data-testid="button-quick-add-membership-group"
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
                  data-testid="input-quick-add-membership-group-name"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleQuickAddMembershipGroup}
                  disabled={!quickGroupName.trim() || createGroupMutation.isPending}
                  data-testid="button-save-quick-membership-group"
                >
                  {createGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
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

          <div className="space-y-2">
            <Label>Contact Person</Label>
            <p className="text-[10px] text-muted-foreground -mt-1">Link a contact if no group, or as the key person for the group</p>
            {contactId && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-membership-contact-${contactId}`}>
                  {contacts?.find((c) => c.id === contactId)?.name || `Contact #${contactId}`}
                  <button
                    onClick={() => setContactId(null)}
                    className="ml-0.5 transition-colors"
                    data-testid="button-remove-membership-contact"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="h-8 text-xs pl-7"
                data-testid="input-search-membership-contact"
              />
            </div>
            {contactSearch.trim() && (
              <>
                {filteredContacts.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                    {filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectContact(c)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                        data-testid={`button-select-contact-${c.id}`}
                      >
                        <span>{c.name}</span>
                        <UserPlus className="w-3 h-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                {filteredContacts.length === 0 && !showQuickAddContact && (
                  <div className="text-xs text-muted-foreground flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <span>No contacts found for "{contactSearch}"</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setQuickContactName(contactSearch);
                        setShowQuickAddContact(true);
                      }}
                      data-testid="button-quick-add-membership-contact"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Quick Add
                    </Button>
                  </div>
                )}
              </>
            )}
            {showQuickAddContact && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                <Input
                  value={quickContactName}
                  onChange={(e) => setQuickContactName(e.target.value)}
                  placeholder="Person's name"
                  className="h-7 text-xs flex-1"
                  data-testid="input-quick-add-membership-contact-name"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleQuickAddMembershipContact}
                  disabled={!quickContactName.trim() || createContact.isPending}
                  data-testid="button-save-quick-membership-contact"
                >
                  {createContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowQuickAddContact(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Standard Value</Label>
              <p className="text-[10px] text-muted-foreground">Full commercial value</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={standardValue}
                  onChange={(e) => setStandardValue(e.target.value)}
                  className="pl-7"
                  data-testid="input-membership-standard-value"
                />
              </div>
            </div>
            <div>
              <Label>Annual Fee</Label>
              <p className="text-[10px] text-muted-foreground">What they pay</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={annualFee}
                  onChange={(e) => setAnnualFee(e.target.value)}
                  className="pl-7"
                  data-testid="input-membership-fee"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Booking Categories</Label>
            <p className="text-[10px] text-muted-foreground mb-2">Select which resource types this membership grants access to</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-membership-venue-hire">
                <Checkbox
                  checked={bookingCategories.includes("venue_hire")}
                  onCheckedChange={() => toggleCategory("venue_hire")}
                />
                <span className="text-sm">Venue Hire</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-membership-hot-desking">
                <Checkbox
                  checked={bookingCategories.includes("hot_desking")}
                  onCheckedChange={() => toggleCategory("hot_desking")}
                />
                <span className="text-sm">Hot Desking</span>
              </label>
              {bookingCategories.includes("hot_desking") && (
                <div className="ml-6 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Unlimited desk access within the agreement date range</span>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-membership-gear">
                <Checkbox
                  checked={bookingCategories.includes("gear")}
                  onCheckedChange={() => toggleCategory("gear")}
                />
                <span className="text-sm">Gear Booking</span>
              </label>
              {bookingCategories.includes("gear") && (
                <div className="ml-6 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Unlimited gear access within the agreement date range</span>
                </div>
              )}
            </div>
          </div>

          {bookingCategories.includes("venue_hire") && (
            <>
              {availableLocations.length > 0 && (
                <div>
                  <Label>Allowed Locations</Label>
                  <p className="text-[10px] text-muted-foreground mb-2">Restrict which locations this membership can book. Leave empty to allow all locations.</p>
                  <div className="space-y-2">
                    {availableLocations.map((loc) => (
                      <label key={loc} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-membership-location-${loc}`}>
                        <Checkbox
                          checked={allowedLocations.includes(loc)}
                          onCheckedChange={() => toggleLocation(loc)}
                        />
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{loc}</span>
                      </label>
                    ))}
                  </div>
                  {allowedLocations.length === 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>All locations are currently allowed</span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Booking Allowance</Label>
                  <Input
                    type="number"
                    min="0"
                    value={bookingAllowance}
                    onChange={(e) => setBookingAllowance(e.target.value)}
                    placeholder="Full-day bookings"
                    data-testid="input-membership-booking-allowance"
                  />
                </div>
                <div>
                  <Label>Period</Label>
                  <Select value={allowancePeriod} onValueChange={setAllowancePeriod}>
                    <SelectTrigger data-testid="select-membership-allowance-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Year</Label>
              <Select value={membershipYear} onValueChange={setMembershipYear}>
                <SelectTrigger data-testid="select-membership-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date{hasHotDeskingOrGear ? " *" : ""}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-membership-start-date"
              />
            </div>
            <div>
              <Label>End Date{hasHotDeskingOrGear ? " *" : ""}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-membership-end-date"
              />
            </div>
          </div>
          {hasHotDeskingOrGear && !startDate && !endDate && (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20 rounded-md p-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Start and end dates define the access window for hot desking and gear booking</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-membership-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBERSHIP_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger data-testid="select-membership-payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              data-testid="input-membership-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-membership">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            data-testid="button-save-membership"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {membership ? "Save Changes" : "Create Membership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MouFormDialog({
  open,
  onOpenChange,
  mou,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mou?: Mou;
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
}) {
  const { data: contacts } = useContacts();
  const { data: allGroups } = useGroups();
  const { data: venues } = useVenues();
  const createContact = useCreateContact();
  const createGroupMutation = useCreateGroup();

  // Contact & group
  const [contactId, setContactId] = useState<number | null>(mou?.contactId || null);
  const [contactSearch, setContactSearch] = useState("");
  const [groupId, setGroupId] = useState<number | null>((mou as any)?.groupId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [showQuickAddContact, setShowQuickAddContact] = useState(false);
  const [quickContactName, setQuickContactName] = useState("");
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState("");

  // Framework fields
  const [relationshipRole, setRelationshipRole] = useState(mou?.relationshipRole || "");
  const [accessProvided, setAccessProvided] = useState<string[]>(
    (mou as any)?.accessProvided?.length > 0
      ? (mou as any).accessProvided
      : // Back-fill from bookingCategories for old records
        (mou?.bookingCategories || []).map((cat: string) => {
          const reverseMap: Record<string, string> = { venue_hire: "venue", hot_desking: "hot_desk", gear: "gear" };
          return reverseMap[cat] || cat;
        })
  );
  const [whatWeGain, setWhatWeGain] = useState<string[]>((mou as any)?.whatWeGain || []);
  const [growthPotential, setGrowthPotential] = useState<string[]>((mou as any)?.growthPotential || []);
  const [growthNotes, setGrowthNotes] = useState((mou as any)?.growthNotes || "");

  // Title
  const [titleOverride, setTitleOverride] = useState<string | null>(mou ? mou.title : null);
  const [editingTitle, setEditingTitle] = useState(false);

  // Terms
  const [actualValue, setActualValue] = useState(mou?.actualValue || "0");
  const [inKindValue, setInKindValue] = useState(mou?.inKindValue || "0");
  const [allowedLocations, setAllowedLocations] = useState<string[]>(
    mou?.allowedLocations || []
  );

  const availableLocations = useMemo(() => {
    if (!venues) return [];
    return Array.from(new Set(venues.filter(v => v.active !== false && v.spaceName).map(v => v.spaceName!)));
  }, [venues]);
  const [bookingAllowance, setBookingAllowance] = useState((mou?.bookingAllowance || 0).toString());
  const [allowancePeriod, setAllowancePeriod] = useState(mou?.allowancePeriod || "quarterly");
  const [startDate, setStartDate] = useState(
    mou?.startDate ? format(new Date(mou.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    mou?.endDate ? format(new Date(mou.endDate), "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState(mou?.status || "active");
  const [notes, setNotes] = useState(mou?.notes || "");

  // Toggles
  const toggleAccess = (item: string) => {
    setAccessProvided(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };
  const toggleGain = (item: string) => {
    setWhatWeGain(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };
  const toggleGrowth = (item: string) => {
    setGrowthPotential(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  // Derive bookingCategories from accessProvided for booking system compat
  const derivedBookingCategories = useMemo(() => {
    return accessProvided
      .filter(a => a in ACCESS_TO_BOOKING_CATEGORY)
      .map(a => ACCESS_TO_BOOKING_CATEGORY[a]);
  }, [accessProvided]);

  const hasHotDeskOrGear = accessProvided.includes("hot_desk") || accessProvided.includes("gear");

  // Auto-title
  const selectedContact = contacts?.find(c => c.id === contactId);
  const selectedGroup = (allGroups as Group[])?.find(g => g.id === groupId);
  const primaryAccessLabel = accessProvided.length > 0
    ? ACCESS_PROVIDED_LABELS[accessProvided[0]] || accessProvided[0]
    : "General";
  const titleYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  const autoTitle = `${selectedContact?.name || selectedGroup?.name || "Untitled"} — ${primaryAccessLabel} Access ${titleYear}`;
  const effectiveTitle = titleOverride || autoTitle;

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return [];
    const term = contactSearch.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8);
  }, [contacts, contactSearch]);

  const filteredMouGroups = useMemo(() => {
    if (!allGroups || !groupSearch.trim()) return [];
    const term = groupSearch.toLowerCase();
    return (allGroups as Group[]).filter((g) => g.name.toLowerCase().includes(term)).slice(0, 8);
  }, [allGroups, groupSearch]);

  const handleSelectContact = (contact: Contact) => {
    setContactId(contact.id);
    setContactSearch("");
  };

  const handleQuickAddMouContact = async () => {
    if (!quickContactName.trim()) return;
    try {
      const newContact = await createContact.mutateAsync({ name: quickContactName.trim() });
      setContactId(newContact.id);
      setQuickContactName("");
      setShowQuickAddContact(false);
      setContactSearch("");
    } catch (err: any) {}
  };

  const handleQuickAddMouGroup = async () => {
    if (!quickGroupName.trim()) return;
    try {
      const newGroup = await createGroupMutation.mutateAsync({ name: quickGroupName.trim(), type: "Business" });
      setGroupId(newGroup.id);
      setQuickGroupName("");
      setShowQuickAddGroup(false);
      setGroupSearch("");
    } catch (err: any) {}
  };

  const handleSubmit = () => {
    const data: any = {
      title: effectiveTitle,
      partnerName: selectedGroup?.name || "",
      contactId: contactId || undefined,
      groupId: groupId || undefined,
      relationshipRole: relationshipRole || undefined,
      accessProvided,
      whatWeGain,
      growthPotential,
      growthNotes: growthNotes.trim() || undefined,
      bookingCategories: derivedBookingCategories,
      allowedLocations: allowedLocations.length > 0 ? allowedLocations : null,
      actualValue: actualValue || "0",
      inKindValue: inKindValue || "0",
      bookingAllowance: parseInt(bookingAllowance) || 0,
      allowancePeriod,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      status,
      notes: notes.trim() || undefined,
    };
    onSubmit(data);
  };

  const toggleMouLocation = (loc: string) => {
    setAllowedLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-mou-dialog-title">
            {mou ? "Edit MOU" : "New MOU"}
          </DialogTitle>
          <DialogDescription>
            {mou ? "Update agreement details." : "Set up a new agreement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contact</Label>
            {contactId && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-mou-contact-${contactId}`}>
                  {contacts?.find((c) => c.id === contactId)?.name || `Contact #${contactId}`}
                  <button
                    onClick={() => setContactId(null)}
                    className="ml-0.5 transition-colors"
                    data-testid="button-remove-mou-contact"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="h-8 text-xs pl-7"
                data-testid="input-search-mou-contact"
              />
            </div>
            {contactSearch.trim() && (
              <>
                {filteredContacts.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                    {filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectContact(c)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                        data-testid={`button-select-mou-contact-${c.id}`}
                      >
                        <span>{c.name}</span>
                        <UserPlus className="w-3 h-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                {filteredContacts.length === 0 && !showQuickAddContact && (
                  <div className="text-xs text-muted-foreground flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <span>No contacts found for "{contactSearch}"</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setQuickContactName(contactSearch);
                        setShowQuickAddContact(true);
                      }}
                      data-testid="button-quick-add-mou-contact"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Quick Add
                    </Button>
                  </div>
                )}
              </>
            )}
            {showQuickAddContact && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                <Input
                  value={quickContactName}
                  onChange={(e) => setQuickContactName(e.target.value)}
                  placeholder="Person's name"
                  className="h-7 text-xs flex-1"
                  data-testid="input-quick-add-mou-contact-name"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleQuickAddMouContact}
                  disabled={!quickContactName.trim() || createContact.isPending}
                  data-testid="button-save-quick-mou-contact"
                >
                  {createContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowQuickAddContact(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Group / Organisation</Label>
            {groupId && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-mou-group-${groupId}`}>
                  <Network className="w-3 h-3 mr-0.5" />
                  {(allGroups as Group[])?.find((g) => g.id === groupId)?.name || `Group #${groupId}`}
                  <button
                    onClick={() => setGroupId(null)}
                    className="ml-0.5 transition-colors"
                    data-testid="button-remove-mou-group"
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
                data-testid="input-search-mou-group"
              />
            </div>
            {groupSearch.trim() && (
              <>
                {filteredMouGroups.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                    {filteredMouGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setGroupId(g.id); setGroupSearch(""); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                        data-testid={`button-select-mou-group-${g.id}`}
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
                {filteredMouGroups.length === 0 && !showQuickAddGroup && (
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
                      data-testid="button-quick-add-mou-group"
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
                  data-testid="input-quick-add-mou-group-name"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleQuickAddMouGroup}
                  disabled={!quickGroupName.trim() || createGroupMutation.isPending}
                  data-testid="button-save-quick-mou-group"
                >
                  {createGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
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

          {/* Relationship */}
          <div>
            <Label className="mb-2 block">Relationship</Label>
            <RadioGroup value={relationshipRole} onValueChange={setRelationshipRole} className="grid grid-cols-2 gap-2">
              {RELATIONSHIP_ROLES.map((role) => (
                <label
                  key={role}
                  className={`flex items-start gap-2 cursor-pointer rounded-md border p-2.5 transition-colors ${
                    relationshipRole === role ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={role} className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">{RELATIONSHIP_ROLE_LABELS[role].label}</span>
                    <p className="text-[10px] text-muted-foreground">{RELATIONSHIP_ROLE_LABELS[role].description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Access Provided */}
          <div>
            <Label className="mb-1 block">Access Provided</Label>
            <p className="text-[10px] text-muted-foreground mb-2">What resource access does this agreement grant?</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {ACCESS_PROVIDED_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={accessProvided.includes(opt)}
                    onCheckedChange={() => toggleAccess(opt)}
                  />
                  <span className="text-sm">{ACCESS_PROVIDED_LABELS[opt]}</span>
                </label>
              ))}
            </div>
            {accessProvided.includes("hot_desk") && (
              <div className="ml-6 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Unlimited desk access within the agreement date range</span>
              </div>
            )}
            {accessProvided.includes("gear") && (
              <div className="ml-6 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Unlimited gear access within the agreement date range</span>
              </div>
            )}
          </div>

          {/* Allowed Locations — conditional on venue */}
          {accessProvided.includes("venue") && (
            <>
              {availableLocations.length > 0 && (
                <div>
                  <Label>Allowed Locations</Label>
                  <p className="text-[10px] text-muted-foreground mb-2">Restrict which locations this agreement can book. Leave empty to allow all.</p>
                  <div className="space-y-1.5">
                    {availableLocations.map((loc) => (
                      <label key={loc} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={allowedLocations.includes(loc)}
                          onCheckedChange={() => toggleMouLocation(loc)}
                        />
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{loc}</span>
                      </label>
                    ))}
                  </div>
                  {allowedLocations.length === 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>All locations are currently allowed</span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Booking Allowance</Label>
                  <Input
                    type="number"
                    min="0"
                    value={bookingAllowance}
                    onChange={(e) => setBookingAllowance(e.target.value)}
                    placeholder="Free bookings per period"
                    data-testid="input-mou-booking-allowance"
                  />
                </div>
                <div>
                  <Label>Allowance Period</Label>
                  <Select value={allowancePeriod} onValueChange={setAllowancePeriod}>
                    <SelectTrigger data-testid="select-mou-allowance-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* What We Gain */}
          <div>
            <Label className="mb-1 block">What We Gain</Label>
            <p className="text-[10px] text-muted-foreground mb-2">What does Reserve Tāmaki get from this relationship?</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {WHAT_WE_GAIN_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={whatWeGain.includes(opt)}
                    onCheckedChange={() => toggleGain(opt)}
                  />
                  <span className="text-sm">{WHAT_WE_GAIN_LABELS[opt]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Growth Potential */}
          <div>
            <Label className="mb-1 block">Growth Potential</Label>
            <p className="text-[10px] text-muted-foreground mb-2">Where could this relationship go?</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {GROWTH_POTENTIAL_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={growthPotential.includes(opt)}
                    onCheckedChange={() => toggleGrowth(opt)}
                  />
                  <span className="text-sm">{GROWTH_POTENTIAL_LABELS[opt]}</span>
                </label>
              ))}
            </div>
            <Textarea
              value={growthNotes}
              onChange={(e) => setGrowthNotes(e.target.value)}
              placeholder="Growth notes (optional)"
              className="mt-2 text-xs"
              rows={2}
            />
          </div>

          {/* Terms */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Actual Value</Label>
                <p className="text-[10px] text-muted-foreground">Full commercial value</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                    className="pl-7"
                    data-testid="input-mou-actual-value"
                  />
                </div>
              </div>
              <div>
                <Label>In-Kind Value</Label>
                <p className="text-[10px] text-muted-foreground">What they pay / exchange</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inKindValue}
                    onChange={(e) => setInKindValue(e.target.value)}
                    className="pl-7"
                    data-testid="input-mou-inkind-value"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date{hasHotDeskOrGear ? " *" : ""}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-mou-start-date"
                />
              </div>
              <div>
                <Label>End Date{hasHotDeskOrGear ? " *" : ""}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-mou-end-date"
                />
              </div>
            </div>
            {hasHotDeskOrGear && !startDate && !endDate && (
              <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20 rounded-md p-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Start and end dates define the access window for hot desking and gear booking</span>
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-mou-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOU_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              data-testid="input-mou-notes"
            />
          </div>

          {/* Auto-title */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={titleOverride || autoTitle}
                    onChange={(e) => setTitleOverride(e.target.value)}
                    className="h-8 text-sm flex-1"
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground truncate flex-1" data-testid="text-mou-auto-title">
                    {effectiveTitle}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => {
                      if (!titleOverride) setTitleOverride(autoTitle);
                      setEditingTitle(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-mou">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="button-save-mou"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mou ? "Save Changes" : "Create Agreement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
