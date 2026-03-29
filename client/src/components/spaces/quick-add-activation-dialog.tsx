import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVenues } from "@/hooks/use-bookings";
import { Plus } from "lucide-react";

const CLASSIFICATIONS = [
  "Hub Activity",
  "Drop-in",
  "Studio",
  "Venue Hire",
  "Programme",
  "Workshop",
  "Other",
] as const;

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface QuickAddActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddActivationDialog({ open, onOpenChange }: QuickAddActivationDialogProps) {
  const { toast } = useToast();
  const { data: venues } = useVenues();

  const { data: groups } = useQuery<any[]>({
    queryKey: ["/api/groups"],
    staleTime: 60000,
  });

  const [form, setForm] = useState({
    date: todayString(),
    venueId: "",
    classification: "",
    headcount: "",
    duration: "",
    notes: "",
    groupId: "",
    groupSearch: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Space use logged", description: "Activation recorded successfully." });
      onOpenChange(false);
      setForm({
        date: todayString(),
        venueId: "",
        classification: "",
        headcount: "",
        duration: "",
        notes: "",
        groupId: "",
        groupSearch: "",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to log activation", variant: "destructive" });
    },
  });

  const filteredGroups = (groups || []).filter((g) =>
    !form.groupSearch || g.name?.toLowerCase().includes(form.groupSearch.toLowerCase())
  );

  const selectedGroup = (groups || []).find((g) => String(g.id) === form.groupId);

  function handleSave() {
    if (!form.classification) {
      toast({ title: "Validation", description: "Please select a classification.", variant: "destructive" });
      return;
    }

    const eventName = selectedGroup?.name || form.classification;
    const startDate = new Date(form.date + "T12:00:00");
    const endDate = new Date(form.date + "T13:00:00");

    const descriptionParts = ["booking_source:admin_catch_up"];
    if (form.duration) descriptionParts.push(`duration:${form.duration}`);
    if (form.notes) descriptionParts.push(form.notes);

    mutation.mutate({
      name: eventName,
      type: form.classification,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      attendeeCount: form.headcount ? parseInt(form.headcount) : undefined,
      description: descriptionParts.join("\n"),
      source: "internal",
      location: form.venueId
        ? (venues || []).find((v) => String(v.id) === form.venueId)?.name || ""
        : "",
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Space Use</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="qa-date">Date</Label>
              <Input
                id="qa-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Venue */}
            <div className="space-y-1.5">
              <Label>Space / Venue</Label>
              <Select value={form.venueId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, venueId: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select venue (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific venue</SelectItem>
                  {(venues || [])
                    .filter((v) => v.active !== false)
                    .map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Classification */}
            <div className="space-y-1.5">
              <Label>Classification *</Label>
              <Select value={form.classification} onValueChange={(v) => setForm((f) => ({ ...f, classification: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Headcount */}
            <div className="space-y-1.5">
              <Label htmlFor="qa-headcount">Headcount (optional)</Label>
              <Input
                id="qa-headcount"
                type="number"
                min="0"
                placeholder="e.g. 12"
                value={form.headcount}
                onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))}
              />
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="qa-duration">Duration (optional)</Label>
              <Input
                id="qa-duration"
                placeholder="e.g. 2 hours"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>

            {/* Organisation / Group */}
            <div className="space-y-1.5">
              <Label htmlFor="qa-group-search">Organisation / Group (optional)</Label>
              <Input
                id="qa-group-search"
                placeholder="Search groups…"
                value={form.groupSearch}
                onChange={(e) => setForm((f) => ({ ...f, groupSearch: e.target.value, groupId: "" }))}
              />
              {form.groupSearch && filteredGroups.length > 0 && !form.groupId && (
                <div className="border rounded-md bg-popover text-popover-foreground shadow-md max-h-40 overflow-y-auto">
                  {filteredGroups.slice(0, 8).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => setForm((f) => ({ ...f, groupId: String(g.id), groupSearch: g.name }))}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
              {form.groupId && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedGroup?.name}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setForm((f) => ({ ...f, groupId: "", groupSearch: "" }))}
                  >
                    clear
                  </button>
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="qa-notes">Notes (optional)</Label>
              <Textarea
                id="qa-notes"
                placeholder="Any extra context…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QuickAddActivationFAB({ activeTab }: { activeTab?: string }) {
  const [open, setOpen] = useState(false);

  // Only show on tabs where quick-add activation makes sense
  if (activeTab === "bookers" || activeTab === "resources") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
        title="Log Space Use"
      >
        <Plus className="w-4 h-4" />
        Log Space Use
      </button>
      <QuickAddActivationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const FAB_CONFIG: Record<string, { label: string; icon: typeof Plus }> = {
  "space-use": { label: "Log Activation", icon: Plus },
  "venue-hire": { label: "Create Booking", icon: Plus },
  "hot-desking": { label: "Log Activation", icon: Plus },
  "bookers": { label: "Add Booker", icon: Plus },
};

interface SpacesFABProps {
  activeTab: string;
  onVenueHireCreate?: () => void;
  onBookerAdd?: () => void;
}

export function SpacesFAB({ activeTab, onVenueHireCreate, onBookerAdd }: SpacesFABProps) {
  const [activationOpen, setActivationOpen] = useState(false);

  const config = FAB_CONFIG[activeTab];
  if (!config) return null;

  const handleClick = () => {
    switch (activeTab) {
      case "space-use":
      case "hot-desking":
        setActivationOpen(true);
        break;
      case "venue-hire":
        onVenueHireCreate?.();
        break;
      case "bookers":
        onBookerAdd?.();
        break;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
        title={config.label}
      >
        <Plus className="w-4 h-4" />
        {config.label}
      </button>
      <QuickAddActivationDialog open={activationOpen} onOpenChange={setActivationOpen} />
    </>
  );
}
