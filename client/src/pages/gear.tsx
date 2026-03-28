import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Wrench,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Package,
  Users,
  History,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { GEAR_SUBCATEGORIES, GEAR_COLLECTIONS, GEAR_TIERS, type BookableResource } from "@shared/schema";
import {
  useBookableResources,
  useCreateBookableResource,
  useUpdateBookableResource,
  useDeleteBookableResource,
  useGearBookings,
  useGearAvailability,
  useMarkGearReturned,
  useCreateGearBooking,
  useApproveGearBooking,
  useRejectGearBooking,
  useRegularBookers,
} from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import RegularBookersPage from "./regular-bookers";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDisplayDate(dateStr: string | Date | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function GearAvailabilityTab() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateStr = formatDate(currentDate);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutResourceId, setCheckoutResourceId] = useState<string>("");
  const [checkoutBookerId, setCheckoutBookerId] = useState<string>("");
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyBookingId, setDenyBookingId] = useState<number | null>(null);
  const [denyReason, setDenyReason] = useState("");

  const { data: gearResources, isLoading: gearLoading } = useBookableResources("gear");
  const { data: gearAvailability, isLoading: gearAvailLoading } = useGearAvailability(dateStr);
  const { data: gearBookings } = useGearBookings();
  const { data: regularBookers } = useRegularBookers();
  const markReturnedMutation = useMarkGearReturned();
  const createGearBookingMutation = useCreateGearBooking();
  const approveMutation = useApproveGearBooking();
  const rejectMutation = useRejectGearBooking();
  const { toast } = useToast();

  const activeGear = (gearResources || []).filter((r) => r.active !== false);

  const activeCheckouts = useMemo(() => {
    return (gearBookings || []).filter((b: any) =>
      (b.status === "booked" || b.status === "late") && b.approved !== false
    );
  }, [gearBookings]);

  const pendingApprovals = useMemo(() => {
    return (gearBookings || []).filter((b: any) =>
      b.status === "booked" && b.approved === false
    );
  }, [gearBookings]);

  const navigateDay = (direction: number) => {
    setCurrentDate(addDays(currentDate, direction));
  };

  const handleMarkReturned = async (bookingId: number) => {
    try {
      await markReturnedMutation.mutateAsync(bookingId);
      toast({ title: "Returned", description: "Gear marked as returned" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to mark returned", variant: "destructive" });
    }
  };

  const handleApprove = async (bookingId: number) => {
    try {
      await approveMutation.mutateAsync(bookingId);
      toast({ title: "Approved", description: "Gear booking approved — confirmation sent to booker" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to approve", variant: "destructive" });
    }
  };

  const handleReject = (bookingId: number) => {
    setDenyBookingId(bookingId);
    setDenyReason("");
    setDenyDialogOpen(true);
  };

  const handleConfirmDeny = async () => {
    if (!denyBookingId) return;
    try {
      await rejectMutation.mutateAsync({ id: denyBookingId, reason: denyReason });
      toast({ title: "Denied", description: "Gear booking denied — booker notified" });
      setDenyDialogOpen(false);
      setDenyBookingId(null);
      setDenyReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to deny", variant: "destructive" });
    }
  };

  const handleCheckout = async () => {
    if (!checkoutResourceId || !checkoutBookerId) return;
    const isSelf = checkoutBookerId === "self";
    try {
      await createGearBookingMutation.mutateAsync({
        resourceId: parseInt(checkoutResourceId),
        ...(isSelf ? { selfCheckout: true, regularBookerId: 0 } : { regularBookerId: parseInt(checkoutBookerId) }),
        date: new Date().toISOString(),
        status: "booked",
        approved: true,
      });
      toast({ title: "Checked Out", description: "Gear checked out successfully" });
      setCheckoutOpen(false);
      setCheckoutResourceId("");
      setCheckoutBookerId("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to check out gear", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-base font-semibold">Availability</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCheckoutOpen(true)} data-testid="button-checkout-gear">
            <UserCheck className="w-4 h-4 mr-1.5" />
            Check Out
          </Button>
          <Button size="icon" variant="outline" onClick={() => navigateDay(-1)} data-testid="button-gear-prev">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())} data-testid="button-gear-today">
            {currentDate.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}
          </Button>
          <Button size="icon" variant="outline" onClick={() => navigateDay(1)} data-testid="button-gear-next">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {gearLoading || gearAvailLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : activeGear.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-gear">No gear items</h3>
          <p className="text-muted-foreground mb-4">Add equipment in the Inventory tab to start tracking.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeGear.map((item) => {
            const availability = (gearAvailability || []).find((a: any) => a.resourceId === item.id);
            const isCheckedOut = availability ? !availability.isAvailable : false;
            const bookingStatus = availability?.bookings?.[0]?.status;
            const isLate = bookingStatus === "late";

            return (
              <Card
                key={item.id}
                className={`p-4 ${isLate ? "border-amber-300 dark:border-amber-700" : isCheckedOut ? "border-destructive/30" : "border-emerald-200 dark:border-emerald-800"}`}
                data-testid={`card-gear-${item.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{item.name}</span>
                      {item.requiresApproval && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">Approval required</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={isLate ? "outline" : isCheckedOut ? "destructive" : "secondary"}
                    className={isLate ? "border-amber-500 text-amber-600" : ""}
                    data-testid={`badge-gear-status-${item.id}`}
                  >
                    {isLate ? "Late Return" : isCheckedOut ? "Checked Out" : "Available"}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pendingApprovals.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            Pending Approvals
            <Badge variant="secondary" data-testid="badge-pending-count">{pendingApprovals.length}</Badge>
          </h3>
          <Card>
            <CardContent className="p-3">
              <div className="space-y-2">
                {pendingApprovals.map((booking: any) => {
                  const gearItem = activeGear.find(g => g.id === booking.resourceId);
                  return (
                    <div key={booking.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-muted/50" data-testid={`row-pending-approval-${booking.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{gearItem?.name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground block">
                            {booking.bookerOrganization || booking.bookerName || "Unknown borrower"} &middot; {formatDisplayDate(booking.date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(booking.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${booking.id}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(booking.id)}
                          disabled={rejectMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-reject-${booking.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeCheckouts.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3">Active Checkouts</h3>
          <Card>
            <CardContent className="p-3">
              <div className="space-y-2">
                {activeCheckouts.map((booking: any) => {
                  const gearItem = activeGear.find(g => g.id === booking.resourceId);
                  const isLate = booking.status === "late";
                  return (
                    <div key={booking.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-muted/50" data-testid={`row-gear-checkout-${booking.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {isLate ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{gearItem?.name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground block">
                            {booking.bookerOrganization || booking.bookerName || "Unknown borrower"} &middot; Checked out: {formatDisplayDate(booking.date)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkReturned(booking.id)}
                        disabled={markReturnedMutation.isPending}
                        data-testid={`button-mark-returned-${booking.id}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Mark Returned
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Gear</DialogTitle>
            <DialogDescription>Select a gear item and a borrower to check out.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gear Item</Label>
              <Select value={checkoutResourceId} onValueChange={setCheckoutResourceId} data-testid="select-checkout-resource">
                <SelectTrigger data-testid="select-trigger-checkout-resource">
                  <SelectValue placeholder="Select gear item" />
                </SelectTrigger>
                <SelectContent>
                  {activeGear.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)} data-testid={`select-item-resource-${item.id}`}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Borrower</Label>
              <Select value={checkoutBookerId} onValueChange={setCheckoutBookerId} data-testid="select-checkout-booker">
                <SelectTrigger data-testid="select-trigger-checkout-booker">
                  <SelectValue placeholder="Select borrower" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self" data-testid="select-item-booker-self">
                    Myself (Staff)
                  </SelectItem>
                  {(regularBookers || []).map((booker) => (
                    <SelectItem key={booker.id} value={String(booker.id)} data-testid={`select-item-booker-${booker.id}`}>
                      {booker.organizationName || booker.billingEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              disabled={!checkoutResourceId || !checkoutBookerId || createGearBookingMutation.isPending}
              data-testid="button-confirm-checkout"
            >
              {createGearBookingMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Gear Booking</DialogTitle>
            <DialogDescription>Optionally provide a reason. The booker will be notified by email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="e.g. Item unavailable, training required first..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeny}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deny Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GearHistoryTab() {
  const { data: gearBookings, isLoading } = useGearBookings();
  const { data: gearResources } = useBookableResources("gear");

  const historyBookings = useMemo(() => {
    return (gearBookings || []).filter((b: any) =>
      b.status === "returned" || b.status === "cancelled"
    );
  }, [gearBookings]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (historyBookings.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2" data-testid="text-no-history">No history yet</h3>
        <p className="text-muted-foreground">Returned and cancelled gear bookings will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Booking History</h3>
      <Card>
        <CardContent className="p-3">
          <div className="space-y-2">
            {historyBookings.map((booking: any) => {
              const gearItem = (gearResources || []).find((g) => g.id === booking.resourceId);
              const isReturned = booking.status === "returned";
              return (
                <div key={booking.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-muted/50" data-testid={`row-gear-history-${booking.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isReturned ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{gearItem?.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground block">
                        {booking.bookerOrganization || booking.bookerName || "Unknown borrower"}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        Out: {formatDisplayDate(booking.date)}
                        {isReturned && booking.returnedAt && ` · Returned: ${formatDisplayDate(booking.returnedAt)}`}
                      </span>
                    </div>
                  </div>
                  <Badge variant={isReturned ? "secondary" : "outline"} data-testid={`badge-history-status-${booking.id}`}>
                    {isReturned ? "Returned" : "Cancelled"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GearInventoryTab() {
  const [editingGear, setEditingGear] = useState<BookableResource | null>(null);
  const [gearFormOpen, setGearFormOpen] = useState(false);
  const [gearName, setGearName] = useState("");
  const [gearDescription, setGearDescription] = useState("");
  const [gearSubcategory, setGearSubcategory] = useState("");
  const [gearCollection, setGearCollection] = useState("");
  const [gearTier, setGearTier] = useState("");
  const [gearRequiresApproval, setGearRequiresApproval] = useState(false);

  const { data: gearResources, isLoading: gearLoading } = useBookableResources("gear");
  const createMutation = useCreateBookableResource();
  const updateMutation = useUpdateBookableResource();
  const deleteMutation = useDeleteBookableResource();
  const { toast } = useToast();

  const [collectionFilter, setCollectionFilter] = useState<string>("all");

  const groupedGear = useMemo(() => {
    if (!gearResources || gearResources.length === 0) return [];
    const filtered = collectionFilter === "all"
      ? gearResources
      : gearResources.filter(item => item.collection === collectionFilter);
    const groups: Record<string, BookableResource[]> = {};
    for (const item of filtered) {
      const key = item.subcategory || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    const knownSet = new Set<string>([...GEAR_SUBCATEGORIES, "Uncategorized"]);
    const unknownKeys = Object.keys(groups).filter(k => !knownSet.has(k)).sort();
    const orderedKeys = [...GEAR_SUBCATEGORIES.filter(c => groups[c]), ...unknownKeys, ...(groups["Uncategorized"] ? ["Uncategorized"] : [])];
    return orderedKeys.map(key => ({ category: key, items: groups[key] }));
  }, [gearResources, collectionFilter]);

  const openGearForm = (gear?: BookableResource) => {
    if (gear) {
      setEditingGear(gear);
      setGearName(gear.name);
      setGearDescription(gear.description || "");
      setGearSubcategory(gear.subcategory || "");
      setGearCollection(gear.collection || "");
      setGearTier(gear.tier || "");
      setGearRequiresApproval(gear.requiresApproval || false);
    } else {
      setEditingGear(null);
      setGearName("");
      setGearDescription("");
      setGearSubcategory("");
      setGearCollection("");
      setGearTier("");
      setGearRequiresApproval(false);
    }
    setGearFormOpen(true);
  };

  const handleSaveGear = async () => {
    if (!gearName.trim()) return;
    try {
      if (editingGear) {
        await updateMutation.mutateAsync({
          id: editingGear.id,
          data: { name: gearName, description: gearDescription || null, subcategory: gearSubcategory || null, collection: gearCollection || null, tier: gearTier || null, requiresApproval: gearRequiresApproval },
        });
        toast({ title: "Updated", description: "Gear item updated" });
      } else {
        await createMutation.mutateAsync({
          name: gearName,
          category: "gear",
          description: gearDescription || null,
          subcategory: gearSubcategory || null,
          collection: gearCollection || null,
          tier: gearTier || null,
          requiresApproval: gearRequiresApproval,
          active: true,
        });
        toast({ title: "Created", description: "Gear item added" });
      }
      setGearFormOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    }
  };

  const handleDeleteGear = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Gear item removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Gear Inventory</h3>
        <Button size="sm" onClick={() => openGearForm()} data-testid="button-add-gear">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Item
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "creators", label: "Creators" },
          { value: "personal", label: "Personal" },
        ].map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={collectionFilter === opt.value ? "default" : "outline"}
            onClick={() => setCollectionFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {gearLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (gearResources || []).length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No gear items configured</h3>
          <p className="text-muted-foreground mb-4">Add equipment to your inventory to start tracking.</p>
          <Button onClick={() => openGearForm()} data-testid="button-add-gear-empty">
            <Plus className="w-4 h-4 mr-2" />
            Add Gear
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedGear.map((group) => (
            <div key={group.category}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2" data-testid={`text-gear-category-${group.category}`}>{group.category}</h4>
              <Card>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-muted/50" data-testid={`row-gear-setting-${item.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{item.name}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.collection && (
                                <Badge variant="secondary" className="text-[10px] capitalize">{item.collection}</Badge>
                              )}
                              {item.tier && (
                                <Badge variant={item.tier === "pro" ? "default" : "outline"} className="text-[10px] capitalize">{item.tier}</Badge>
                              )}
                              {item.subcategory && (
                                <Badge variant="secondary" className="text-[10px]" data-testid={`badge-subcategory-${item.id}`}>{item.subcategory}</Badge>
                              )}
                              {item.requiresApproval && (
                                <Badge variant="outline" className="text-[10px]">Approval req.</Badge>
                              )}
                              {item.active === false && (
                                <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openGearForm(item)} data-testid={`button-edit-gear-${item.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteGear(item.id)} data-testid={`button-delete-gear-${item.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Dialog open={gearFormOpen} onOpenChange={setGearFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGear ? "Edit Gear Item" : "Add Gear Item"}</DialogTitle>
            <DialogDescription className="sr-only">Form to add or edit a gear item</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={gearName}
                onChange={(e) => setGearName(e.target.value)}
                placeholder="e.g. Camera Gear"
                data-testid="input-gear-name"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={gearSubcategory || "__none__"} onValueChange={(v) => setGearSubcategory(v === "__none__" ? "" : v)} data-testid="select-gear-subcategory">
                <SelectTrigger data-testid="select-trigger-gear-subcategory">
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {GEAR_SUBCATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} data-testid={`select-item-subcategory-${cat}`}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Collection</Label>
                <Select value={gearCollection || "__none__"} onValueChange={(v) => setGearCollection(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {GEAR_COLLECTIONS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c === "creators" ? "Creators" : "Personal"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={gearTier || "__none__"} onValueChange={(v) => setGearTier(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {GEAR_TIERS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t === "beginner" ? "Beginner" : "Pro"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={gearDescription}
                onChange={(e) => setGearDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="input-gear-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={gearRequiresApproval}
                onCheckedChange={setGearRequiresApproval}
                data-testid="switch-requires-approval"
              />
              <Label>Requires approval (e.g. training needed)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGearFormOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveGear}
              disabled={!gearName.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-gear"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingGear ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GearPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Gear</h1>
        <p className="text-sm text-muted-foreground">Equipment lending and tracking</p>
      </div>

      <Tabs defaultValue="availability">
        <TabsList data-testid="tabs-gear">
          <TabsTrigger value="availability" data-testid="tab-gear-availability">
            <Wrench className="w-4 h-4 mr-1.5" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-gear-history">
            <History className="w-4 h-4 mr-1.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-gear-inventory">
            <Package className="w-4 h-4 mr-1.5" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="bookers" data-testid="tab-gear-bookers">
            <Users className="w-4 h-4 mr-1.5" />
            Bookers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="availability">
          <GearAvailabilityTab />
        </TabsContent>

        <TabsContent value="history">
          <GearHistoryTab />
        </TabsContent>

        <TabsContent value="inventory">
          <GearInventoryTab />
        </TabsContent>

        <TabsContent value="bookers">
          <RegularBookersPage embedded categoryScope={["gear"]} hideSuggestions />
        </TabsContent>
      </Tabs>
    </div>
  );
}
