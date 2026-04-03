import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  SUPPORT_LABEL_MAP,
  SUPPORT_COLOR_MAP,
  SUPPORT_OPTIONS,
} from "@/components/community/inline-cells";

export interface DetailSupportEditorProps {
  contactId: number;
  supportTypes: string[];
}

export function DetailSupportEditor({ contactId, supportTypes }: DetailSupportEditorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(supportTypes || []);
  const [saving, setSaving] = useState(false);

  const toggle = (t: string) => {
    setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { supportType: selected });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/:id"] });
      toast({ title: "Support type updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSelected(supportTypes || []); }}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors cursor-pointer group border border-transparent hover:border-border"
          data-testid="detail-support-editor"
        >
          <span className="text-xs text-muted-foreground">Support:</span>
          {supportTypes?.length > 0 ? (
            supportTypes.map(t => (
              <Badge key={t} className={`text-[10px] h-5 px-1.5 ${SUPPORT_COLOR_MAP[t] || ""}`}>
                {SUPPORT_LABEL_MAP[t] || t}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground/50 text-xs">Set</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-1">
          {SUPPORT_OPTIONS.map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5" data-testid={`detail-support-opt-${t}`}>
              <Checkbox checked={selected.includes(t)} onCheckedChange={() => toggle(t)} />
              {SUPPORT_LABEL_MAP[t] || t}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
