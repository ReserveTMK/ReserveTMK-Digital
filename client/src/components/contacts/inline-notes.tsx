import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

export interface InlineNotesProps {
  contactId: number;
  notes?: string | null;
}

export function InlineNotes({ contactId, notes }: InlineNotesProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes || "");
  const { toast } = useToast();
  const updateMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { notes: newNotes || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditing(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (editing) {
    return (
      <div className="space-y-1.5">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-xs min-h-[60px] resize-none"
          placeholder="Add notes..."
          autoFocus
        />
        <div className="flex gap-1.5">
          <Button size="sm" variant="default" className="h-6 text-xs px-2" onClick={() => updateMutation.mutate(value)} disabled={updateMutation.isPending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEditing(false); setValue(notes || ""); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      onClick={() => setEditing(true)}
      data-testid="inline-notes"
    >
      {notes ? notes : <span className="italic text-muted-foreground/60">+ Add notes</span>}
    </button>
  );
}
