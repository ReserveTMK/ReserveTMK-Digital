import { useState, useMemo } from "react";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import {
  useVenues,
  useCreateVenue,
  useUpdateVenue,
  useDeleteVenue,
  useBookableResources,
  useCreateBookableResource,
  useUpdateBookableResource,
  useDeleteBookableResource,
  useGearBookings,
  useMarkGearReturned,
  useDeskBookings,
  useBookingPricingDefaults,
  useUpdateBookingPricingDefaults,
} from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Venue, BookableResource } from "@shared/schema";

export default function ResourcesTab() {
  const { data: pricingDefaults } = useBookingPricingDefaults();
  const updatePricingMutation = useUpdateBookingPricingDefaults();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-resources-heading">Resources</h2>
        <p className="text-sm text-muted-foreground">Manage your venues, desks, and gear inventory</p>
      </div>
      <Tabs defaultValue="venues">
        <TabsList className="flex-wrap">
          <TabsTrigger value="venues" data-testid="tab-resources-venues">Venues</TabsTrigger>
          <TabsTrigger value="desks" data-testid="tab-resources-desks">Desks</TabsTrigger>
          <TabsTrigger value="gear" data-testid="tab-resources-gear">Gear</TabsTrigger>
        </TabsList>
        <TabsContent value="venues" className="mt-3">
          <VenuesSubSection
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
        </TabsContent>
        <TabsContent value="desks" className="mt-3">
          <ResourceSubSection category="hot_desking" label="Desk" />
        </TabsContent>
        <TabsContent value="gear" className="mt-3">
          <GearSubSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VenuesSubSection({
  pricingDefaults,
  onUpdatePricing,
  pricingPending,
}: {
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
  );
}

function ResourceSubSection({ category, label }: { category: string; label: string }) {
  const { data: resources, isLoading } = useBookableResources(category);
  const createResource = useCreateBookableResource();
  const updateResource = useUpdateBookableResource();
  const deleteResource = useDeleteBookableResource();
  const { toast } = useToast();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: deskBookings } = useDeskBookings({ start: todayStr, end: todayStr });

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const todayOccupancy = useMemo(() => {
    if (!deskBookings || !resources) return {};
    const counts: Record<number, number> = {};
    resources.forEach(r => { counts[r.id] = 0; });
    deskBookings.forEach(b => {
      if (b.status === "booked") {
        counts[b.resourceId] = (counts[b.resourceId] || 0) + 1;
      }
    });
    return counts;
  }, [deskBookings, resources]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createResource.mutateAsync({
        name: newName.trim(),
        category,
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      toast({ title: "Created", description: `${label} created successfully` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || `Failed to create ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateResource.mutateAsync({
        id,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        },
      });
      setEditingId(null);
      toast({ title: "Updated", description: `${label} updated successfully` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || `Failed to update ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteResource.mutateAsync(id);
      toast({ title: "Deleted", description: `${label} deleted successfully` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || `Failed to delete ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const handleToggleActive = async (resource: BookableResource) => {
    try {
      await updateResource.mutateAsync({ id: resource.id, data: { active: !resource.active } });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to toggle resource", variant: "destructive" });
    }
  };

  const startEditing = (resource: BookableResource) => {
    setEditingId(resource.id);
    setEditName(resource.name);
    setEditDescription(resource.description || "");
  };

  if (isLoading) {
    return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {resources?.map((resource) => (
          <Card key={resource.id} className="p-3" data-testid={`card-resource-${resource.id}`}>
            {editingId === resource.id ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={`${label} name`}
                  data-testid={`input-edit-resource-name-${resource.id}`}
                />
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                  data-testid={`input-edit-resource-desc-${resource.id}`}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleUpdate(resource.id)} disabled={updateResource.isPending} data-testid={`button-save-resource-${resource.id}`}>
                    {updateResource.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-resource-${resource.id}`}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`text-resource-name-${resource.id}`}>{resource.name}</span>
                    {!resource.active && (
                      <Badge variant="outline" className="text-xs opacity-60">Inactive</Badge>
                    )}
                    {category === "hot_desking" && todayOccupancy[resource.id] !== undefined && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-desk-occupancy-${resource.id}`}>
                        {todayOccupancy[resource.id]} booked today
                      </Badge>
                    )}
                  </div>
                  {resource.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{resource.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={resource.active ?? true}
                    onCheckedChange={() => handleToggleActive(resource)}
                    data-testid={`switch-resource-active-${resource.id}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => startEditing(resource)} data-testid={`button-edit-resource-${resource.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(resource.id)} data-testid={`button-delete-resource-${resource.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {(!resources || resources.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No {label.toLowerCase()}s yet. Add one below.</p>
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        <Label className="text-sm font-semibold">Add New {label}</Label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`${label} name`}
          data-testid={`input-new-resource-name-${category}`}
        />
        <Input
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description (optional)"
          data-testid={`input-new-resource-desc-${category}`}
        />
        <Button onClick={handleCreate} disabled={!newName.trim() || createResource.isPending} data-testid={`button-add-resource-${category}`}>
          {createResource.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Plus className="w-4 h-4 mr-2" />
          Add {label}
        </Button>
      </div>
    </div>
  );
}

function GearSubSection() {
  const { data: resources, isLoading } = useBookableResources("gear");
  const createResource = useCreateBookableResource();
  const updateResource = useUpdateBookableResource();
  const deleteResource = useDeleteBookableResource();
  const markReturned = useMarkGearReturned();
  const { toast } = useToast();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: gearBookingsToday } = useGearBookings({ start: todayStr, end: todayStr });

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRequiresApproval, setNewRequiresApproval] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRequiresApproval, setEditRequiresApproval] = useState(false);

  const todayBookingsByResource = useMemo(() => {
    if (!gearBookingsToday || !resources) return {};
    const map: Record<number, typeof gearBookingsToday> = {};
    resources.forEach(r => { map[r.id] = []; });
    gearBookingsToday.forEach(b => {
      if (!map[b.resourceId]) map[b.resourceId] = [];
      map[b.resourceId].push(b);
    });
    return map;
  }, [gearBookingsToday, resources]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createResource.mutateAsync({
        name: newName.trim(),
        category: "gear",
        description: newDescription.trim() || undefined,
        requiresApproval: newRequiresApproval,
      });
      setNewName("");
      setNewDescription("");
      setNewRequiresApproval(false);
      toast({ title: "Created", description: "Gear item created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create gear item", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateResource.mutateAsync({
        id,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          requiresApproval: editRequiresApproval,
        },
      });
      setEditingId(null);
      toast({ title: "Updated", description: "Gear item updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update gear item", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteResource.mutateAsync(id);
      toast({ title: "Deleted", description: "Gear item deleted successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete gear item", variant: "destructive" });
    }
  };

  const handleToggleActive = async (resource: BookableResource) => {
    try {
      await updateResource.mutateAsync({ id: resource.id, data: { active: !resource.active } });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to toggle resource", variant: "destructive" });
    }
  };

  const handleMarkReturned = async (bookingId: number) => {
    try {
      await markReturned.mutateAsync(bookingId);
      toast({ title: "Returned", description: "Gear marked as returned" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to mark as returned", variant: "destructive" });
    }
  };

  const startEditing = (resource: BookableResource) => {
    setEditingId(resource.id);
    setEditName(resource.name);
    setEditDescription(resource.description || "");
    setEditRequiresApproval(resource.requiresApproval ?? false);
  };

  if (isLoading) {
    return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {resources?.map((resource) => (
          <Card key={resource.id} className="p-3" data-testid={`card-gear-${resource.id}`}>
            {editingId === resource.id ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Gear item name"
                  data-testid={`input-edit-gear-name-${resource.id}`}
                />
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                  data-testid={`input-edit-gear-desc-${resource.id}`}
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editRequiresApproval}
                    onCheckedChange={setEditRequiresApproval}
                    data-testid={`switch-edit-gear-approval-${resource.id}`}
                  />
                  <Label className="text-xs">Requires Approval (training needed)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleUpdate(resource.id)} disabled={updateResource.isPending} data-testid={`button-save-gear-${resource.id}`}>
                    {updateResource.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-gear-${resource.id}`}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-gear-name-${resource.id}`}>{resource.name}</span>
                      {resource.requiresApproval && (
                        <Badge variant="secondary" className="text-xs">Approval Required</Badge>
                      )}
                      {!resource.active && (
                        <Badge variant="outline" className="text-xs opacity-60">Inactive</Badge>
                      )}
                    </div>
                    {resource.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{resource.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={resource.active ?? true}
                      onCheckedChange={() => handleToggleActive(resource)}
                      data-testid={`switch-gear-active-${resource.id}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => startEditing(resource)} data-testid={`button-edit-gear-${resource.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(resource.id)} data-testid={`button-delete-gear-${resource.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {todayBookingsByResource[resource.id]?.length > 0 && (
                  <div className="border-t pt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Today's bookings:</p>
                    {todayBookingsByResource[resource.id].map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between gap-2 text-xs" data-testid={`gear-booking-${booking.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={booking.status === "returned" ? "secondary" : booking.status === "late" ? "destructive" : "outline"}
                            className="text-[10px]"
                            data-testid={`badge-gear-status-${booking.id}`}
                          >
                            {booking.status === "returned" ? "Returned" : booking.status === "late" ? "Late" : "Booked"}
                          </Badge>
                        </div>
                        {booking.status === "booked" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkReturned(booking.id)}
                            disabled={markReturned.isPending}
                            data-testid={`button-mark-returned-${booking.id}`}
                          >
                            {markReturned.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                            Mark Returned
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
        {(!resources || resources.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No gear items yet. Add one below.</p>
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        <Label className="text-sm font-semibold">Add New Gear Item</Label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Gear item name"
          data-testid="input-new-gear-name"
        />
        <Input
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description (optional)"
          data-testid="input-new-gear-desc"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={newRequiresApproval}
            onCheckedChange={setNewRequiresApproval}
            data-testid="switch-new-gear-approval"
          />
          <Label className="text-xs">Requires Approval (training needed)</Label>
        </div>
        <Button onClick={handleCreate} disabled={!newName.trim() || createResource.isPending} data-testid="button-add-gear">
          {createResource.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Plus className="w-4 h-4 mr-2" />
          Add Gear Item
        </Button>
      </div>
    </div>
  );
}
