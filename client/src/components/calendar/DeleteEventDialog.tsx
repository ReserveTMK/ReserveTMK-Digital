import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AppEvent } from "./calendar-constants";
import { formatDate } from "./calendar-constants";

export interface DeleteEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteTarget: { type: "gcal" | "app"; event: any } | null;
  deleteReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteEventDialog({
  open,
  onOpenChange,
  deleteTarget,
  deleteReason,
  onReasonChange,
  onConfirm,
  isPending,
}: DeleteEventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remove Event</DialogTitle>
          <DialogDescription>This action cannot be undone. Please provide a reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {deleteTarget?.type === "app" && (
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm font-medium">{(deleteTarget.event as AppEvent).name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate((deleteTarget.event as AppEvent).startTime)}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Why is this event being removed?</Label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Event was cancelled, duplicate entry, never happened..."
              className="resize-none"
              rows={3}
              data-testid="input-delete-reason"
            />
            <p className="text-xs text-muted-foreground">
              A reason is required so we can keep accurate records.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-delete">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!deleteReason.trim() || isPending}
            data-testid="button-confirm-delete"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
