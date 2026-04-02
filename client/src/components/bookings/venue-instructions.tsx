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
  useVenueInstructions,
  useCreateVenueInstruction,
  useUpdateVenueInstruction,
  useDeleteVenueInstruction,
} from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";
import { INSTRUCTION_TYPES, type VenueInstruction } from "@shared/schema";

const INSTRUCTION_TYPE_LABELS: Record<string, string> = {
  access: "Access",
  opening: "Opening Procedure",
  closing: "Closing Procedure",
  emergency: "Emergency",
};

const INSTRUCTION_TYPE_COLORS: Record<string, string> = {
  access: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  opening: "bg-green-500/15 text-green-700 dark:text-green-300",
  closing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  emergency: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export { INSTRUCTION_TYPE_LABELS, INSTRUCTION_TYPE_COLORS };

export function VenueInstructionsDialog({
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
  const [instructionType, setInstructionType] = useState(instruction?.instructionType || "access");
  const [title, setTitle] = useState(instruction?.title || "");
  const [content, setContent] = useState(instruction?.content || "");
  const [displayOrder, setDisplayOrder] = useState(instruction?.displayOrder?.toString() || "0");

  useEffect(() => {
    if (instruction) {
      setInstructionType(instruction.instructionType);
      setTitle(instruction.title || "");
      setContent(instruction.content || "");
      setDisplayOrder(instruction.displayOrder?.toString() || "0");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-instruction-form-title">
            {instruction ? "Edit Instruction" : "Add Instruction"}
          </DialogTitle>
          <DialogDescription>
            {instruction ? "Update the venue instruction." : "Add a new instruction for venue hires."}
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
