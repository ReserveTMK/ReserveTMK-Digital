import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Check } from "lucide-react";
import { useState } from "react";
import {
  CONNECTION_CONFIG,
  CONNECTION_LEVELS,
} from "@/components/community/inline-cells";

export interface DetailConnectionEditorProps {
  contactId: number;
  connectionStrength?: string | null;
}

export function DetailConnectionEditor({ contactId, connectionStrength }: DetailConnectionEditorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (val: string) => {
    if (val === connectionStrength) { setOpen(false); return; }
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { connectionStrength: val });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/:id"] });
      toast({ title: "Connection updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const config = CONNECTION_CONFIG[connectionStrength || ""] || null;
  const activeLevel = config?.level || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors cursor-pointer group border border-transparent hover:border-border"
          data-testid="detail-connection-editor"
        >
          <span className="text-xs text-muted-foreground">Connection:</span>
          <div className="flex items-center gap-0.5">
            {CONNECTION_LEVELS.map((l, i) => {
              const lc = CONNECTION_CONFIG[l];
              return (
                <div
                  key={l}
                  className={`w-3 h-1.5 rounded-sm transition-colors ${i < activeLevel ? lc.dotColor : "bg-muted-foreground/15"}`}
                />
              );
            })}
          </div>
          {config ? (
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          ) : (
            <span className="text-muted-foreground/50 text-xs">Set</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="space-y-0.5">
          {CONNECTION_LEVELS.map((l, i) => {
            const lc = CONNECTION_CONFIG[l];
            const isActive = l === connectionStrength;
            return (
              <button
                key={l}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent/50 transition-colors ${isActive ? "bg-accent" : ""}`}
                onClick={() => handleSelect(l)}
                disabled={saving}
                data-testid={`detail-connection-opt-${l}`}
              >
                <div className="flex items-center gap-0.5">
                  {CONNECTION_LEVELS.map((_, si) => (
                    <div key={si} className={`w-2.5 h-1.5 rounded-sm ${si <= i ? lc.dotColor : "bg-muted-foreground/15"}`} />
                  ))}
                </div>
                <span className={lc.color}>{lc.label}</span>
                {isActive && <Check className="w-3 h-3 ml-auto" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
