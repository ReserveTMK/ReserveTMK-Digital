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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  Settings,
} from "lucide-react";
import type { MeetingType } from "@shared/schema";

const COLOR_OPTIONS = [
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#ec4899", label: "Pink" },
];

export function useMeetingTypes(category?: string) {
  const url = category ? `/api/meeting-types?category=${category}` : "/api/meeting-types";
  return useQuery<MeetingType[]>({
    queryKey: ["/api/meeting-types", category || "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch meeting types");
      return res.json();
    },
  });
}

export function MeetingTypeDialog({
  open,
  onOpenChange,
  editingType,
  category,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingType?: MeetingType | null;
  category?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(editingType?.name || "");
  const [description, setDescription] = useState(editingType?.description || "");
  const [duration, setDuration] = useState(String(editingType?.duration || 30));
  const [color, setColor] = useState(editingType?.color || "#3b82f6");
  const [isActive, setIsActive] = useState(editingType?.isActive ?? true);

  const isEditing = !!editingType;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/meeting-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-types"] });
      toast({ title: "Session type created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/meeting-types/${editingType!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-types"] });
      toast({ title: "Session type updated" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      duration: parseInt(duration),
      color,
      isActive,
    };
    if (category) {
      payload.category = category;
    }
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Session Type" : "Add Session Type"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this session type" : "Create a new session type for booking"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="e.g., Quick Check-in"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-meeting-type-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of this session type..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              data-testid="input-meeting-type-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger data-testid="select-meeting-type-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`w-8 h-8 rounded-md border-2 transition-all ${
                    color === c.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  data-testid={`color-option-${c.label.toLowerCase()}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid="switch-meeting-type-active"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending} data-testid="button-submit-meeting-type">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? "Save Changes" : "Add Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingTypesSection({ category }: { category?: string }) {
  const { data: meetingTypes, isLoading } = useMeetingTypes(category);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingType, setEditingType] = useState<MeetingType | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/meeting-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-types"] });
      toast({ title: "Session type deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & any) => {
      const res = await apiRequest("PATCH", `/api/meeting-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-types"] });
    },
  });

  const handleEdit = (mt: MeetingType) => {
    setEditingType(mt);
    setShowDialog(true);
  };

  const handleCloseDialog = (v: boolean) => {
    setShowDialog(v);
    if (!v) setEditingType(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Session Types</h3>
          <p className="text-xs text-muted-foreground">Define different types of sessions people can book</p>
        </div>
        <Button size="sm" onClick={() => { setEditingType(null); setShowDialog(true); }} data-testid="button-add-meeting-type">
          <Plus className="w-4 h-4 mr-1" /> Add Type
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !meetingTypes || meetingTypes.length === 0 ? (
        <Card className="p-8 text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No session types defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add session types to offer different session options</p>
          <Button size="sm" className="mt-3" onClick={() => { setEditingType(null); setShowDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Session Type
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {meetingTypes.map((mt) => (
            <Card key={mt.id} className="p-4" data-testid={`meeting-type-card-${mt.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: mt.color || "#3b82f6" }}
                    data-testid={`meeting-type-color-${mt.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{mt.name}</h4>
                      <Badge variant="outline" className="text-[10px] h-5">{mt.duration} min</Badge>
                      {!mt.isActive && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    {mt.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mt.description}</p>
                    )}
                    {mt.focus && (
                      <Badge variant="secondary" className="text-[10px] h-5 mt-1.5">{mt.focus}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0 items-end">
                  <Switch
                    checked={mt.isActive ?? true}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: mt.id, isActive: checked })}
                    data-testid={`switch-meeting-type-${mt.id}`}
                  />
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(mt)}
                      data-testid={`button-edit-meeting-type-${mt.id}`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete session type "${mt.name}"?`)) {
                          deleteMutation.mutate(mt.id);
                        }
                      }}
                      data-testid={`button-delete-meeting-type-${mt.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showDialog && (
        <MeetingTypeDialog
          open={showDialog}
          onOpenChange={handleCloseDialog}
          editingType={editingType}
          category={category}
        />
      )}
    </div>
  );
}
