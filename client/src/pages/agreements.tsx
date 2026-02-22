import { Sidebar } from "@/components/layout/sidebar";
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
import { useContacts } from "@/hooks/use-contacts";
import { useGroups } from "@/hooks/use-groups";
import { useBookings } from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
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
} from "lucide-react";
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
  type Membership,
  type Mou,
  type Contact,
  type Booking,
  type Group,
} from "@shared/schema";

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

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-500/15 text-green-700 dark:text-green-300",
  unpaid: "bg-red-500/15 text-red-700 dark:text-red-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  refunded: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function Agreements() {
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

  const [activeTab, setActiveTab] = useState<"memberships" | "mous">("memberships");
  const [membershipSearch, setMembershipSearch] = useState("");
  const [mouSearch, setMouSearch] = useState("");
  const [createMembershipOpen, setCreateMembershipOpen] = useState(false);
  const [editMembership, setEditMembership] = useState<Membership | null>(null);
  const [createMouOpen, setCreateMouOpen] = useState(false);
  const [editMou, setEditMou] = useState<Mou | null>(null);

  const filteredMemberships = useMemo(() => {
    if (!memberships) return [];
    if (!membershipSearch.trim()) return memberships;
    const term = membershipSearch.toLowerCase();
    return memberships.filter((m) => {
      const contactName = contacts?.find((c) => c.id === m.contactId)?.name || "";
      return (
        m.name.toLowerCase().includes(term) ||
        contactName.toLowerCase().includes(term) ||
        m.notes?.toLowerCase().includes(term)
      );
    });
  }, [memberships, membershipSearch, contacts]);

  const filteredMous = useMemo(() => {
    if (!mous) return [];
    if (!mouSearch.trim()) return mous;
    const term = mouSearch.toLowerCase();
    return mous.filter((m) => {
      const contactName = contacts?.find((c) => c.id === m.contactId)?.name || "";
      return (
        m.title.toLowerCase().includes(term) ||
        m.partnerName?.toLowerCase().includes(term) ||
        contactName.toLowerCase().includes(term) ||
        m.notes?.toLowerCase().includes(term)
      );
    });
  }, [mous, mouSearch, contacts]);

  const membershipStats = useMemo(() => {
    if (!memberships) return { total: 0, active: 0, revenue: 0, hours: 0 };
    const nonExpired = memberships.filter((m) => m.status !== "expired");
    const active = memberships.filter((m) => m.status === "active");
    return {
      total: nonExpired.length,
      active: active.length,
      revenue: active.reduce((sum, m) => sum + parseFloat(m.annualFee || "0"), 0),
      hours: active.reduce((sum, m) => sum + (m.venueHireHours || 0), 0),
    };
  }, [memberships]);

  const mouStats = useMemo(() => {
    if (!mous) return { total: 0, active: 0, inKindValue: 0 };
    const active = mous.filter((m) => m.status === "active");
    return {
      total: mous.length,
      active: active.length,
      inKindValue: active.reduce((sum, m) => sum + parseFloat(m.inKindValue || "0"), 0),
    };
  }, [mous]);

  const getMembershipHoursUsed = (membershipId: number) => {
    if (!bookings) return 0;
    return bookings
      .filter((b) => b.membershipId === membershipId)
      .reduce((sum, b) => {
        if (b.startTime && b.endTime) {
          const [sh, sm] = b.startTime.split(":").map(Number);
          const [eh, em] = b.endTime.split(":").map(Number);
          return sum + (eh + em / 60) - (sh + sm / 60);
        }
        return sum;
      }, 0);
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

  const handleDeleteMembership = async (id: number) => {
    try {
      await deleteMembershipMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Membership removed successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  const handleDeleteMou = async (id: number) => {
    try {
      await deleteMouMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "MOU removed successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  const isLoading = membershipsLoading || mousLoading;

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-16 md:pt-0 pb-24 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-agreements-title">Agreements</h1>
              <p className="text-muted-foreground mt-1">Manage memberships and memoranda of understanding.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className={`toggle-elevate ${activeTab === "memberships" ? "toggle-elevated" : ""}`}
              onClick={() => setActiveTab("memberships")}
              data-testid="button-tab-memberships"
            >
              <FileText className="w-4 h-4 mr-2" />
              Memberships
            </Button>
            <Button
              variant="ghost"
              className={`toggle-elevate ${activeTab === "mous" ? "toggle-elevated" : ""}`}
              onClick={() => setActiveTab("mous")}
              data-testid="button-tab-mous"
            >
              <Handshake className="w-4 h-4 mr-2" />
              MOUs
            </Button>
          </div>

          {activeTab === "memberships" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-total-members">{membershipStats.total}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-active-members">{membershipStats.active}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Annual Revenue</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-annual-revenue">${membershipStats.revenue.toFixed(2)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Hours Allocated</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-hours-allocated">{membershipStats.hours}</p>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search memberships..."
                    className="pl-10"
                    value={membershipSearch}
                    onChange={(e) => setMembershipSearch(e.target.value)}
                    data-testid="input-search-memberships"
                  />
                </div>
                <Button className="shadow-lg" onClick={() => setCreateMembershipOpen(true)} data-testid="button-create-membership">
                  <Plus className="w-4 h-4 mr-2" />
                  New Membership
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !filteredMemberships.length ? (
                <Card className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="text-no-memberships">No memberships yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first membership to start tracking venue hire agreements.</p>
                  <Button onClick={() => setCreateMembershipOpen(true)} data-testid="button-create-membership-empty">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Membership
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMemberships.map((membership) => {
                    const contactName = getContactName(membership.contactId);
                    const groupName = getGroupName((membership as any).groupId);
                    const hoursUsed = getMembershipHoursUsed(membership.id);

                    return (
                      <Card
                        key={membership.id}
                        className={`p-4 hover-elevate transition-all ${MEMBERSHIP_STATUS_COLORS[membership.status] || ""}`}
                        data-testid={`card-membership-${membership.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold text-base truncate" data-testid={`text-membership-contact-${membership.id}`}>
                                {groupName || contactName || "No contact assigned"}
                              </h3>
                              {groupName && contactName && (
                                <Badge variant="outline" className="text-[10px]">{contactName}</Badge>
                              )}
                              <Badge className={PAYMENT_STATUS_BADGE[membership.paymentStatus || "unpaid"] || ""} data-testid={`badge-payment-${membership.id}`}>
                                {membership.paymentStatus || "unpaid"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2" data-testid={`text-membership-name-${membership.id}`}>
                              {membership.name}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1" data-testid={`text-membership-fee-${membership.id}`}>
                                <DollarSign className="w-3 h-3" />
                                ${parseFloat(membership.annualFee || "0").toFixed(2)}/yr
                              </span>
                              <span className="flex items-center gap-1" data-testid={`text-membership-hours-${membership.id}`}>
                                <Clock className="w-3 h-3" />
                                {membership.venueHireHours || 0} hrs included
                              </span>
                              {(membership.bookingAllowance || 0) > 0 && (
                                <span className="flex items-center gap-1" data-testid={`text-membership-allowance-${membership.id}`}>
                                  <Calendar className="w-3 h-3" />
                                  {membership.bookingAllowance} bookings/{membership.allowancePeriod === "monthly" ? "mo" : "qtr"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
                              <span className="flex items-center gap-1" data-testid={`text-membership-hours-used-${membership.id}`}>
                                <Users className="w-3 h-3" />
                                {hoursUsed.toFixed(1)} / {membership.venueHireHours || 0} hrs used
                              </span>
                              {membership.startDate && (
                                <span className="flex items-center gap-1" data-testid={`text-membership-dates-${membership.id}`}>
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(membership.startDate), "d MMM yyyy")}
                                  {membership.endDate && ` - ${format(new Date(membership.endDate), "d MMM yyyy")}`}
                                </span>
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
                              <DropdownMenuItem onClick={() => setEditMembership(membership)} data-testid={`button-edit-membership-${membership.id}`}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteMembership(membership.id)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-membership-${membership.id}`}
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
            </>
          )}

          {activeTab === "mous" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Total MOUs</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-total-mous">{mouStats.total}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-active-mous">{mouStats.active}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">In-Kind Value</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-inkind-value">${mouStats.inKindValue.toFixed(2)}</p>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search MOUs..."
                    className="pl-10"
                    value={mouSearch}
                    onChange={(e) => setMouSearch(e.target.value)}
                    data-testid="input-search-mous"
                  />
                </div>
                <Button className="shadow-lg" onClick={() => setCreateMouOpen(true)} data-testid="button-create-mou">
                  <Plus className="w-4 h-4 mr-2" />
                  New MOU
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !filteredMous.length ? (
                <Card className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Handshake className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="text-no-mous">No MOUs yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first MOU to track venue hire and gear exchange agreements.</p>
                  <Button onClick={() => setCreateMouOpen(true)} data-testid="button-create-mou-empty">
                    <Plus className="w-4 h-4 mr-2" />
                    Create MOU
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMous.map((mou) => {
                    const contactName = getContactName(mou.contactId);
                    const groupName = getGroupName((mou as any).groupId);
                    const linkedBookings = getMouBookingsCount(mou.id);

                    return (
                      <Card
                        key={mou.id}
                        className={`p-4 hover-elevate transition-all ${MOU_STATUS_COLORS[mou.status] || ""}`}
                        data-testid={`card-mou-${mou.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold text-base truncate" data-testid={`text-mou-title-${mou.id}`}>
                                {mou.title}
                              </h3>
                              <Badge variant="outline" className="text-xs" data-testid={`badge-mou-status-${mou.id}`}>
                                {mou.status}
                              </Badge>
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
                            {mou.providing && (
                              <div className="text-xs mb-1">
                                <span className="font-medium text-foreground">Providing:</span>{" "}
                                <span className="text-muted-foreground">{mou.providing}</span>
                              </div>
                            )}
                            {mou.receiving && (
                              <div className="text-xs mb-1">
                                <span className="font-medium text-foreground">Receiving:</span>{" "}
                                <span className="text-muted-foreground">{mou.receiving}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
                              <span className="flex items-center gap-1" data-testid={`text-mou-value-${mou.id}`}>
                                <DollarSign className="w-3 h-3" />
                                ${parseFloat(mou.inKindValue || "0").toFixed(2)} in-kind
                              </span>
                              {mou.startDate && (
                                <span className="flex items-center gap-1" data-testid={`text-mou-dates-${mou.id}`}>
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(mou.startDate), "d MMM yyyy")}
                                  {mou.endDate && ` - ${format(new Date(mou.endDate), "d MMM yyyy")}`}
                                </span>
                              )}
                              <span className="flex items-center gap-1" data-testid={`text-mou-bookings-${mou.id}`}>
                                <ArrowRightLeft className="w-3 h-3" />
                                {linkedBookings} booking{linkedBookings !== 1 ? "s" : ""}
                              </span>
                              {(mou.bookingAllowance || 0) > 0 && (
                                <span className="flex items-center gap-1" data-testid={`text-mou-allowance-${mou.id}`}>
                                  <Clock className="w-3 h-3" />
                                  {mou.bookingAllowance}/{mou.allowancePeriod === "monthly" ? "mo" : "qtr"}
                                </span>
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
                              <DropdownMenuItem onClick={() => setEditMou(mou)} data-testid={`button-edit-mou-${mou.id}`}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteMou(mou.id)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-mou-${mou.id}`}
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
            </>
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
    </div>
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

  const [name, setName] = useState(membership?.name || "");
  const [contactId, setContactId] = useState<number | null>(membership?.contactId || null);
  const [contactSearch, setContactSearch] = useState("");
  const [groupId, setGroupId] = useState<number | null>((membership as any)?.groupId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [annualFee, setAnnualFee] = useState(membership?.annualFee || "0");
  const [venueHireHours, setVenueHireHours] = useState((membership?.venueHireHours || 0).toString());
  const [bookingAllowance, setBookingAllowance] = useState((membership?.bookingAllowance || 0).toString());
  const [allowancePeriod, setAllowancePeriod] = useState(membership?.allowancePeriod || "quarterly");
  const [startDate, setStartDate] = useState(
    membership?.startDate ? format(new Date(membership.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    membership?.endDate ? format(new Date(membership.endDate), "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState(membership?.status || "pending");
  const [paymentStatus, setPaymentStatus] = useState(membership?.paymentStatus || "unpaid");
  const [notes, setNotes] = useState(membership?.notes || "");

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

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data: any = {
      name: name.trim(),
      contactId: contactId || undefined,
      groupId: groupId || undefined,
      annualFee: annualFee || "0",
      venueHireHours: parseInt(venueHireHours) || 0,
      bookingAllowance: parseInt(bookingAllowance) || 0,
      allowancePeriod,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      status,
      paymentStatus,
      notes: notes.trim() || undefined,
    };
    onSubmit(data);
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
            <Label>Contact</Label>
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
          </div>

          <div>
            <Label>Annual Fee</Label>
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

          <div>
            <Label>Venue Hire Hours</Label>
            <Input
              type="number"
              min="0"
              value={venueHireHours}
              onChange={(e) => setVenueHireHours(e.target.value)}
              placeholder="Hours of venue hire included"
              data-testid="input-membership-hours"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Booking Allowance</Label>
              <Input
                type="number"
                min="0"
                value={bookingAllowance}
                onChange={(e) => setBookingAllowance(e.target.value)}
                placeholder="Free bookings per period"
                data-testid="input-membership-booking-allowance"
              />
            </div>
            <div>
              <Label>Allowance Period</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-membership-start-date"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-membership-end-date"
              />
            </div>
          </div>

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

  const [title, setTitle] = useState(mou?.title || "");
  const [partnerName, setPartnerName] = useState(mou?.partnerName || "");
  const [contactId, setContactId] = useState<number | null>(mou?.contactId || null);
  const [contactSearch, setContactSearch] = useState("");
  const [groupId, setGroupId] = useState<number | null>((mou as any)?.groupId || null);
  const [groupSearch, setGroupSearch] = useState("");
  const [providing, setProviding] = useState(mou?.providing || "");
  const [receiving, setReceiving] = useState(mou?.receiving || "");
  const [inKindValue, setInKindValue] = useState(mou?.inKindValue || "0");
  const [bookingAllowance, setBookingAllowance] = useState((mou?.bookingAllowance || 0).toString());
  const [allowancePeriod, setAllowancePeriod] = useState(mou?.allowancePeriod || "quarterly");
  const [startDate, setStartDate] = useState(
    mou?.startDate ? format(new Date(mou.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    mou?.endDate ? format(new Date(mou.endDate), "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState(mou?.status || "draft");
  const [notes, setNotes] = useState(mou?.notes || "");

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

  const handleSubmit = () => {
    if (!title.trim()) return;
    const data: any = {
      title: title.trim(),
      partnerName: partnerName.trim() || undefined,
      contactId: contactId || undefined,
      groupId: groupId || undefined,
      providing: providing.trim() || undefined,
      receiving: receiving.trim() || undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-mou-dialog-title">
            {mou ? "Edit MOU" : "New MOU"}
          </DialogTitle>
          <DialogDescription>
            {mou ? "Update memorandum of understanding details." : "Set up a new memorandum of understanding for venue/gear exchange."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="MOU title"
              data-testid="input-mou-title"
            />
          </div>

          <div>
            <Label>Partner Name</Label>
            <Input
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Organisation name"
              data-testid="input-mou-partner-name"
            />
          </div>

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
          </div>

          <div>
            <Label>Providing</Label>
            <Textarea
              value={providing}
              onChange={(e) => setProviding(e.target.value)}
              placeholder="What you provide: e.g., venue hire 4hrs/week, PA system access"
              data-testid="input-mou-providing"
            />
          </div>

          <div>
            <Label>Receiving</Label>
            <Textarea
              value={receiving}
              onChange={(e) => setReceiving(e.target.value)}
              placeholder="What you receive: e.g., free youth workshops, community program delivery"
              data-testid="input-mou-receiving"
            />
          </div>

          <div>
            <Label>In-Kind Value</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={inKindValue}
                onChange={(e) => setInKindValue(e.target.value)}
                className="pl-7"
                placeholder="Estimated annual value"
                data-testid="input-mou-inkind-value"
              />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-mou-start-date"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-mou-end-date"
              />
            </div>
          </div>

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

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              data-testid="input-mou-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-mou">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
            data-testid="button-save-mou"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mou ? "Save Changes" : "Create MOU"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
