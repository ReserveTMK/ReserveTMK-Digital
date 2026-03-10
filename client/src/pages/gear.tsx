import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Settings,
  Loader2,
} from "lucide-react";
import {
  useBookableResources,
  useCreateBookableResource,
  useUpdateBookableResource,
  useDeleteBookableResource,
  useGearBookings,
  useGearAvailability,
  useMarkGearReturned,
} from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";

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

export default function GearPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateStr = formatDate(currentDate);
  const [showSettings, setShowSettings] = useState(false);
  const [editingGear, setEditingGear] = useState<any>(null);
  const [gearFormOpen, setGearFormOpen] = useState(false);
  const [gearName, setGearName] = useState("");
  const [gearDescription, setGearDescription] = useState("");
  const [gearRequiresApproval, setGearRequiresApproval] = useState(false);

  const { data: gearResources, isLoading: gearLoading } = useBookableResources("gear");
  const { data: gearAvailability, isLoading: gearAvailLoading } = useGearAvailability(dateStr);
  const { data: gearBookings } = useGearBookings();
  const createMutation = useCreateBookableResource();
  const updateMutation = useUpdateBookableResource();
  const deleteMutation = useDeleteBookableResource();
  const markReturnedMutation = useMarkGearReturned();
  const { toast } = useToast();

  const activeGear = (gearResources || []).filter((r) => r.active !== false);
  const todayStr = formatDate(new Date());

  const activeCheckouts = useMemo(() => {
    return (gearBookings || []).filter((b: any) =>
      b.status === "booked" || b.status === "late"
    );
  }, [gearBookings]);

  const navigateDay = (direction: number) => {
    setCurrentDate(addDays(currentDate, direction));
  };

  const openGearForm = (gear?: any) => {
    if (gear) {
      setEditingGear(gear);
      setGearName(gear.name);
      setGearDescription(gear.description || "");
      setGearRequiresApproval(gear.requiresApproval || false);
    } else {
      setEditingGear(null);
      setGearName("");
      setGearDescription("");
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
          data: { name: gearName, description: gearDescription || null, requiresApproval: gearRequiresApproval },
        });
        toast({ title: "Updated", description: "Gear item updated" });
      } else {
        await createMutation.mutateAsync({
          name: gearName,
          category: "gear",
          description: gearDescription || null,
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

  const handleMarkReturned = async (bookingId: number) => {
    try {
      await markReturnedMutation.mutateAsync(bookingId);
      toast({ title: "Returned", description: "Gear marked as returned" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to mark returned", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Gear</h1>
          <p className="text-sm text-muted-foreground">Equipment lending and tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="button-gear-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-base font-semibold">Availability</h3>
        <div className="flex items-center gap-2">
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
          <p className="text-muted-foreground mb-4">Add equipment to start tracking.</p>
          <Button onClick={() => openGearForm()} data-testid="button-add-gear-empty">
            <Plus className="w-4 h-4 mr-2" />
            Add Gear
          </Button>
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
                            Checked out: {booking.checkoutDate || booking.date}
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

      {showSettings && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Gear Inventory</h3>
            <Button size="sm" onClick={() => openGearForm()} data-testid="button-add-gear">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Item
            </Button>
          </div>
          <Card>
            <CardContent className="p-3">
              {(gearResources || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No gear items configured</p>
              ) : (
                <div className="space-y-2">
                  {(gearResources || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-muted/50" data-testid={`row-gear-setting-${item.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{item.name}</span>
                          <div className="flex items-center gap-2">
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
              )}
            </CardContent>
          </Card>
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
