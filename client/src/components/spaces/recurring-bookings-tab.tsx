import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVenues } from "@/hooks/use-bookings";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

const CLASSIFICATIONS = [
  "Hub Activity",
  "Drop-in",
  "Studio",
  "Venue Hire",
  "Programme",
  "Workshop",
  "Other",
];

const DAYS_OF_WEEK = [
  { label: "Monday", value: 0 },
  { label: "Tuesday", value: 1 },
  { label: "Wednesday", value: 2 },
  { label: "Thursday", value: 3 },
  { label: "Friday", value: 4 },
  { label: "Saturday", value: 5 },
  { label: "Sunday", value: 6 },
];

interface RecurringTemplate {
  id: number;
  user_id: string;
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
  created_at: string;
}

const emptyForm = {
  name: "",
  venueId: "",
  classification: "",
  dayOfWeek: "",
  startTime: "",
  endTime: "",
  startDate: "",
  endDate: "",
  bookerName: "",
  notes: "",
};

export function RecurringBookingsTab() {
  const { toast } = useToast();
  const { data: venues } = useVenues();

  const { data: templates, isLoading } = useQuery<RecurringTemplate[]>({
    queryKey: ["/api/recurring-booking-templates"],
    staleTime: 30000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/recurring-booking-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-booking-templates"] });
      toast({ title: "Recurring booking created" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/recurring-booking-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-booking-templates"] });
      toast({ title: "Updated" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recurring-booking-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-booking-templates"] });
      toast({ title: "Deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/recurring-booking-templates/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-booking-templates"] });
    },
  });

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(t: RecurringTemplate) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      venueId: t.venue_id ? String(t.venue_id) : "",
      classification: t.classification || "",
      dayOfWeek: String(t.day_of_week),
      startTime: t.start_time || "",
      endTime: t.end_time || "",
      startDate: t.start_date ? t.start_date.slice(0, 10) : "",
      endDate: t.end_date ? t.end_date.slice(0, 10) : "",
      bookerName: t.booker_name || "",
      notes: t.notes || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function handleSave() {
    if (!form.name || form.dayOfWeek === "") {
      toast({ title: "Validation", description: "Name and day of week are required.", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      venue_id: form.venueId ? parseInt(form.venueId) : null,
      classification: form.classification || null,
      day_of_week: parseInt(form.dayOfWeek),
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      booker_name: form.bookerName || null,
      notes: form.notes || null,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const activeTemplates = (templates || []).filter((t) => t.active);
  const inactiveTemplates = (templates || []).filter((t) => !t.active);

  function getDayLabel(n: number) {
    return DAYS_OF_WEEK.find((d) => d.value === n)?.label || String(n);
  }

  function getVenueName(id: number | null) {
    if (!id) return null;
    return (venues || []).find((v) => v.id === id)?.name || `Venue #${id}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Recurring Bookings</h3>
          <p className="text-xs text-muted-foreground">Admin-managed recurring schedules</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Recurring Booking
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (templates || []).length === 0 ? (
        <Card className="p-10 text-center">
          <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No recurring bookings yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Set up recurring schedules like weekly meetings or regular studio use.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</p>
              {activeTemplates.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  dayLabel={getDayLabel(t.day_of_week)}
                  venueName={getVenueName(t.venue_id)}
                  onEdit={() => openEdit(t)}
                  onDelete={() => deleteMutation.mutate(t.id)}
                  onToggle={(active) => toggleMutation.mutate({ id: t.id, active })}
                />
              ))}
            </div>
          )}
          {inactiveTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inactive</p>
              {inactiveTemplates.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  dayLabel={getDayLabel(t.day_of_week)}
                  venueName={getVenueName(t.venue_id)}
                  onEdit={() => openEdit(t)}
                  onDelete={() => deleteMutation.mutate(t.id)}
                  onToggle={(active) => toggleMutation.mutate({ id: t.id, active })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Recurring Booking" : "New Recurring Booking"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Roof Hub Monday Meetings"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Venue</Label>
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

            <div className="space-y-1.5">
              <Label>Classification</Label>
              <Select value={form.classification || "none"} onValueChange={(v) => setForm((f) => ({ ...f, classification: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Day of Week *</Label>
              <Select value={form.dayOfWeek} onValueChange={(v) => setForm((f) => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Booker Name</Label>
              <Input
                placeholder="Contact or organisation name"
                value={form.bookerName}
                onChange={(e) => setForm((f) => ({ ...f, bookerName: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any extra notes…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateRow({
  template,
  dayLabel,
  venueName,
  onEdit,
  onDelete,
  onToggle,
}: {
  template: RecurringTemplate;
  dayLabel: string;
  venueName: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  return (
    <Card className={`${!template.active ? "opacity-60" : ""}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{template.name}</p>
            {template.classification && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {template.classification}
              </Badge>
            )}
            {!template.active && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{dayLabel}</span>
            {template.start_time && (
              <span className="text-xs text-muted-foreground">
                {template.start_time}
                {template.end_time ? ` – ${template.end_time}` : ""}
              </span>
            )}
            {venueName && (
              <span className="text-xs text-muted-foreground">{venueName}</span>
            )}
            {template.booker_name && (
              <span className="text-xs text-muted-foreground">{template.booker_name}</span>
            )}
          </div>
          {(template.start_date || template.end_date) && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              {template.start_date ? template.start_date.slice(0, 10) : ""}
              {template.start_date && template.end_date ? " → " : ""}
              {template.end_date ? template.end_date.slice(0, 10) : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={template.active}
            onCheckedChange={onToggle}
            title={template.active ? "Deactivate" : "Activate"}
          />
          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
