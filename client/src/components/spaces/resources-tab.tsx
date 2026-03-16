import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  ArrowUp,
  ArrowDown,
  Settings2,
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
  useDeskBookings,
  useBookingPricingDefaults,
  useUpdateBookingPricingDefaults,
  useVenueInstructions,
  useCreateVenueInstruction,
  useUpdateVenueInstruction,
  useDeleteVenueInstruction,
} from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Venue, BookableResource, VenueInstruction } from "@shared/schema";
import { INSTRUCTION_TYPES, DEFAULT_AVAILABILITY_SCHEDULE, type AvailabilitySchedule, type DayAvailability } from "@shared/schema";

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

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export default function ResourcesTab() {
  const { data: pricingDefaults } = useBookingPricingDefaults();
  const updatePricingMutation = useUpdateBookingPricingDefaults();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-resources-heading">Resources</h2>
        <p className="text-sm text-muted-foreground">Manage your venues and desks</p>
      </div>
      <Tabs defaultValue="venues">
        <TabsList className="flex-wrap">
          <TabsTrigger value="venues" data-testid="tab-resources-venues">Venues</TabsTrigger>
          <TabsTrigger value="desks" data-testid="tab-resources-desks">Desks</TabsTrigger>
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
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [localFullDay, setLocalFullDay] = useState(pricingDefaults?.fullDayRate || "0");
  const [localHalfDay, setLocalHalfDay] = useState(pricingDefaults?.halfDayRate || "0");
  const [expandedVenueId, setExpandedVenueId] = useState<number | null>(null);

  useEffect(() => {
    if (pricingDefaults?.fullDayRate !== undefined) setLocalFullDay(pricingDefaults.fullDayRate || "0");
    if (pricingDefaults?.halfDayRate !== undefined) setLocalHalfDay(pricingDefaults.halfDayRate || "0");
  }, [pricingDefaults?.fullDayRate, pricingDefaults?.halfDayRate]);

  const handleCreateVenue = async () => {
    if (!newName.trim()) return;
    try {
      await createVenue.mutateAsync({
        name: newName.trim(),
        spaceName: newSpaceName.trim() || undefined,
        description: newDescription.trim() || undefined,
        capacity: newCapacity ? parseInt(newCapacity) : undefined,
      });
      setNewName("");
      setNewSpaceName("");
      setNewDescription("");
      setNewCapacity("");
      setShowAddForm(false);
      toast({ title: "Created", description: "Venue created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create venue", variant: "destructive" });
    }
  };

  const handleDeleteVenue = async (id: number) => {
    try {
      await deleteVenue.mutateAsync(id);
      if (expandedVenueId === id) setExpandedVenueId(null);
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

  const existingSpaceNames = useMemo(() => {
    if (!venues) return [];
    const names = new Set<string>();
    for (const v of venues) {
      if (v.spaceName) names.add(v.spaceName);
    }
    return Array.from(names).sort();
  }, [venues]);

  const groupedVenues = useMemo(() => {
    if (!venues) return {};
    const groups: Record<string, typeof venues> = {};
    for (const v of venues) {
      const group = v.spaceName || "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(v);
    }
    return groups;
  }, [venues]);

  return (
    <div className="space-y-4">
      {Object.entries(groupedVenues).map(([spaceName, spaceVenues]) => (
        <div key={spaceName} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1" data-testid={`text-space-name-${spaceName}`}>{spaceName}</h3>
          {spaceVenues.map((venue) => (
          <Card key={venue.id} className="overflow-hidden" data-testid={`card-venue-${venue.id}`}>
            <div
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpandedVenueId(expandedVenueId === venue.id ? null : venue.id)}
              data-testid={`button-expand-venue-${venue.id}`}
            >
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
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`switch-venue-active-${venue.id}`}
                  />
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteVenue(venue.id); }} data-testid={`button-delete-venue-${venue.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                  {expandedVenueId === venue.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {expandedVenueId === venue.id && (
              <VenueManagementPanel venue={venue} />
            )}
          </Card>
        ))}
        </div>
      ))}
      {(!venues || venues.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">No venues yet. Click "Add New Venue" to create one.</p>
      )}

      <div className="border-t pt-4 space-y-2">
        {!showAddForm ? (
          <Button variant="outline" onClick={() => setShowAddForm(true)} data-testid="button-show-add-venue-form">
            <Plus className="w-4 h-4 mr-2" />
            Add New Venue
          </Button>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Add New Venue</Label>
            <Input
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Space (e.g. ReserveTMK Office, ReserveTMK Studio)"
              data-testid="input-new-venue-space"
              list="space-name-options"
            />
            {existingSpaceNames.length > 0 && (
              <datalist id="space-name-options">
                {existingSpaceNames.map(s => <option key={s} value={s} />)}
              </datalist>
            )}
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
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateVenue} disabled={!newName.trim() || createVenue.isPending} data-testid="button-add-venue">
                {createVenue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Plus className="w-4 h-4 mr-2" />
                Add Venue
              </Button>
              <Button variant="outline" onClick={() => { setShowAddForm(false); setNewName(""); setNewSpaceName(""); setNewDescription(""); setNewCapacity(""); }} data-testid="button-cancel-add-venue">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-3">
        {!showPricing ? (
          <Button variant="outline" onClick={() => setShowPricing(true)} data-testid="button-show-edit-pricing">
            <DollarSign className="w-4 h-4 mr-2" />
            Edit Pricing
          </Button>
        ) : (
          <div className="space-y-3">
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onUpdatePricing({ fullDayRate: localFullDay, halfDayRate: localHalfDay });
                  setShowPricing(false);
                }}
                disabled={pricingPending}
                data-testid="button-save-pricing-defaults"
              >
                {pricingPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Save Pricing Defaults
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowPricing(false); setLocalFullDay(pricingDefaults?.fullDayRate || "0"); setLocalHalfDay(pricingDefaults?.halfDayRate || "0"); }} data-testid="button-cancel-edit-pricing">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VenueManagementPanel({ venue }: { venue: Venue }) {
  return (
    <div className="border-t bg-muted/30">
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger
            value="details"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
            data-testid={`tab-venue-details-${venue.id}`}
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            Details
          </TabsTrigger>
          <TabsTrigger
            value="availability"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
            data-testid={`tab-venue-availability-${venue.id}`}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Availability
          </TabsTrigger>
          <TabsTrigger
            value="instructions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-xs"
            data-testid={`tab-venue-instructions-${venue.id}`}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Instructions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="p-4 mt-0">
          <VenueDetailsSection venue={venue} />
        </TabsContent>
        <TabsContent value="availability" className="p-4 mt-0">
          <VenueAvailabilitySection venue={venue} />
        </TabsContent>
        <TabsContent value="instructions" className="p-4 mt-0">
          <VenueInstructionsSection venue={venue} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VenueDetailsSection({ venue }: { venue: Venue }) {
  const updateVenue = useUpdateVenue();
  const { toast } = useToast();

  const [editName, setEditName] = useState(venue.name);
  const [editDescription, setEditDescription] = useState(venue.description || "");
  const [editCapacity, setEditCapacity] = useState(venue.capacity?.toString() || "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setEditName(venue.name);
    setEditDescription(venue.description || "");
    setEditCapacity(venue.capacity?.toString() || "");
    setIsDirty(false);
  }, [venue]);

  const handleSave = async () => {
    try {
      await updateVenue.mutateAsync({
        id: venue.id,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          capacity: editCapacity ? parseInt(editCapacity) : undefined,
        },
      });
      setIsDirty(false);
      toast({ title: "Updated", description: "Venue details saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update venue", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Name</Label>
        <Input
          value={editName}
          onChange={(e) => { setEditName(e.target.value); setIsDirty(true); }}
          placeholder="Venue name"
          data-testid={`input-edit-venue-name-${venue.id}`}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Input
          value={editDescription}
          onChange={(e) => { setEditDescription(e.target.value); setIsDirty(true); }}
          placeholder="Description"
          data-testid={`input-edit-venue-description-${venue.id}`}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Capacity</Label>
        <Input
          type="number"
          value={editCapacity}
          onChange={(e) => { setEditCapacity(e.target.value); setIsDirty(true); }}
          placeholder="Capacity"
          data-testid={`input-edit-venue-capacity-${venue.id}`}
        />
      </div>
      {isDirty && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={updateVenue.isPending} data-testid={`button-save-venue-${venue.id}`}>
            {updateVenue.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Save Changes
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setEditName(venue.name);
            setEditDescription(venue.description || "");
            setEditCapacity(venue.capacity?.toString() || "");
            setIsDirty(false);
          }} data-testid={`button-cancel-edit-venue-${venue.id}`}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function VenueAvailabilitySection({ venue }: { venue: Venue }) {
  const updateVenue = useUpdateVenue();
  const { toast } = useToast();

  const currentSchedule = (venue.availabilitySchedule as AvailabilitySchedule) || DEFAULT_AVAILABILITY_SCHEDULE;
  const [schedule, setSchedule] = useState<AvailabilitySchedule>(currentSchedule);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setSchedule((venue.availabilitySchedule as AvailabilitySchedule) || DEFAULT_AVAILABILITY_SCHEDULE);
    setIsDirty(false);
  }, [venue.availabilitySchedule]);

  const updateDay = (day: string, updates: Partial<DayAvailability>) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateVenue.mutateAsync({
        id: venue.id,
        data: { availabilitySchedule: schedule },
      });
      setIsDirty(false);
      toast({ title: "Updated", description: "Availability schedule saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save schedule", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Set the operating hours for this venue. Days marked as closed will not show available time slots.</p>
      <div className="space-y-2">
        {DAY_NAMES.map((day) => {
          const dayData = schedule[day] || { open: false, startTime: "08:00", endTime: "17:00" };
          return (
            <div key={day} className="flex items-center gap-3 py-1" data-testid={`availability-row-${day}-${venue.id}`}>
              <div className="w-24 flex items-center gap-2">
                <Switch
                  checked={dayData.open}
                  onCheckedChange={(open) => updateDay(day, { open })}
                  data-testid={`switch-day-open-${day}-${venue.id}`}
                />
                <span className={`text-xs font-medium ${!dayData.open ? "text-muted-foreground" : ""}`}>
                  {DAY_LABELS[day]}
                </span>
              </div>
              {dayData.open ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={dayData.startTime}
                    onChange={(e) => updateDay(day, { startTime: e.target.value })}
                    className="w-28 h-8 text-xs"
                    data-testid={`input-start-time-${day}-${venue.id}`}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={dayData.endTime}
                    onChange={(e) => updateDay(day, { endTime: e.target.value })}
                    className="w-28 h-8 text-xs"
                    data-testid={`input-end-time-${day}-${venue.id}`}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      {isDirty && (
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={updateVenue.isPending} data-testid={`button-save-availability-${venue.id}`}>
            {updateVenue.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Save Schedule
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setSchedule((venue.availabilitySchedule as AvailabilitySchedule) || DEFAULT_AVAILABILITY_SCHEDULE);
            setIsDirty(false);
          }} data-testid={`button-cancel-availability-${venue.id}`}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function VenueInstructionsSection({ venue }: { venue: Venue }) {
  const { data: instructions, isLoading } = useVenueInstructions(venue.id);
  const createMutation = useCreateVenueInstruction();
  const updateMutation = useUpdateVenueInstruction();
  const deleteMutation = useDeleteVenueInstruction();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<VenueInstruction | null>(null);

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

  const handleSubmit = async (data: any) => {
    try {
      if (editingInstruction) {
        await updateMutation.mutateAsync({ id: editingInstruction.id, data });
        toast({ title: "Updated", description: "Instruction updated" });
      } else {
        await createMutation.mutateAsync({ ...data, venueId: venue.id });
        toast({ title: "Created", description: "Instruction added" });
      }
      setShowForm(false);
      setEditingInstruction(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Instructions specific to this venue (access, arrival, etc.).</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setEditingInstruction(null); setShowForm(true); }}
          data-testid={`button-add-venue-instruction-${venue.id}`}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>

      {showForm && (
        <InlineInstructionForm
          instruction={editingInstruction}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingInstruction(null); }}
          isPending={createMutation.isPending || updateMutation.isPending}
          venueId={venue.id}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !instructions?.length ? (
        <div className="text-center py-4">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground" data-testid={`text-no-venue-instructions-${venue.id}`}>No instructions for this venue yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {INSTRUCTION_TYPES.map(type => {
            const typeInstructions = groupedInstructions[type] || [];
            if (typeInstructions.length === 0) return null;
            return (
              <div key={type} data-testid={`venue-instruction-group-${type}-${venue.id}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className={`text-[10px] ${INSTRUCTION_TYPE_COLORS[type] || ""}`}>
                    {INSTRUCTION_TYPE_LABELS[type]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">({typeInstructions.length})</span>
                </div>
                <div className="space-y-1">
                  {typeInstructions.map((inst, index) => (
                    <div
                      key={inst.id}
                      className={`flex items-start justify-between gap-2 p-2 rounded-md border bg-background ${!inst.isActive ? "opacity-50" : ""}`}
                      data-testid={`card-venue-instruction-${inst.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" data-testid={`text-venue-instruction-title-${inst.id}`}>
                          {inst.title || "Untitled"}
                        </p>
                        {inst.content && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{inst.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => handleMoveOrder(inst, "up")}
                          data-testid={`button-venue-instruction-up-${inst.id}`}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === typeInstructions.length - 1}
                          onClick={() => handleMoveOrder(inst, "down")}
                          data-testid={`button-venue-instruction-down-${inst.id}`}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Switch
                          checked={inst.isActive ?? true}
                          onCheckedChange={() => handleToggleActive(inst)}
                          data-testid={`switch-venue-instruction-active-${inst.id}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => { setEditingInstruction(inst); setShowForm(true); }}
                          data-testid={`button-edit-venue-instruction-${inst.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDelete(inst.id)}
                          data-testid={`button-delete-venue-instruction-${inst.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InlineInstructionForm({
  instruction,
  onSubmit,
  onCancel,
  isPending,
  venueId,
}: {
  instruction: VenueInstruction | null;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  venueId: number;
}) {
  const [instructionType, setInstructionType] = useState(instruction?.instructionType || "general");
  const [title, setTitle] = useState(instruction?.title || "");
  const [content, setContent] = useState(instruction?.content || "");
  const [displayOrder, setDisplayOrder] = useState(instruction?.displayOrder?.toString() || "0");

  useEffect(() => {
    if (instruction) {
      setInstructionType(instruction.instructionType);
      setTitle(instruction.title || "");
      setContent(instruction.content || "");
      setDisplayOrder(instruction.displayOrder?.toString() || "0");
    } else {
      setInstructionType("general");
      setTitle("");
      setContent("");
      setDisplayOrder("0");
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
    <div className="border rounded-md p-3 space-y-3 bg-background" data-testid={`form-venue-instruction-${venueId}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={instructionType} onValueChange={setInstructionType}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-venue-instruction-type-${venueId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTRUCTION_TYPES.map(t => (
                <SelectItem key={t} value={t}>{INSTRUCTION_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Display Order</Label>
          <Input
            type="number"
            min="0"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className="h-8 text-xs"
            data-testid={`input-venue-instruction-order-${venueId}`}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Title *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Building Access Instructions"
          className="h-8 text-xs"
          data-testid={`input-venue-instruction-title-${venueId}`}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Content</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Detailed instructions..."
          className="resize-none min-h-[60px] text-xs"
          data-testid={`input-venue-instruction-content-${venueId}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !title.trim()} data-testid={`button-save-venue-instruction-${venueId}`}>
          {isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          {instruction ? "Save Changes" : "Add Instruction"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} data-testid={`button-cancel-venue-instruction-${venueId}`}>
          Cancel
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
  const [showAddForm, setShowAddForm] = useState(false);

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
      setShowAddForm(false);
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
      const response = await updateResource.mutateAsync({ id: resource.id, data: { active: !resource.active } });
      const result = await response.json();
      if (result.futureBookingsWarning) {
        toast({ title: "Resource Deactivated", description: result.futureBookingsWarning, variant: "destructive" });
      }
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
          <p className="text-sm text-muted-foreground text-center py-4">No {label.toLowerCase()}s yet. Click "Add New {label}" to create one.</p>
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        {!showAddForm ? (
          <Button variant="outline" onClick={() => setShowAddForm(true)} data-testid={`button-show-add-resource-form-${category}`}>
            <Plus className="w-4 h-4 mr-2" />
            Add New {label}
          </Button>
        ) : (
          <div className="space-y-2">
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
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!newName.trim() || createResource.isPending} data-testid={`button-add-resource-${category}`}>
                {createResource.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Plus className="w-4 h-4 mr-2" />
                Add {label}
              </Button>
              <Button variant="outline" onClick={() => { setShowAddForm(false); setNewName(""); setNewDescription(""); }} data-testid={`button-cancel-add-resource-${category}`}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
