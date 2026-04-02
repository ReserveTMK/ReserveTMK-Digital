import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

const ETHNICITY_OPTIONS = [
  { group: "Polynesian", options: ["Samoan", "Tongan", "Cook Islands Maori", "Niuean", "Tokelauan", "Fijian", "Hawaiian", "Tahitian", "Maori", "Other Polynesian"] },
  { group: "Pacific", options: ["Micronesian", "Melanesian"] },
  { group: "European", options: ["NZ European/Pakeha", "Other European"] },
  { group: "Asian", options: ["Chinese", "Indian", "Other Asian"] },
  { group: "Other", options: ["Middle Eastern", "Latin American", "African", "Other"] },
];

export { ETHNICITY_OPTIONS };

export interface EthnicityQuickEditProps {
  contact: any;
}

export function EthnicityQuickEdit({ contact }: EthnicityQuickEditProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(contact.ethnicity || []);
  const [saving, setSaving] = useState(false);
  const { data: allContacts } = useQuery<any[]>({ queryKey: ["/api/contacts"] });
  const ethnicityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of (allContacts || [])) {
      if (c.ethnicity) {
        for (const eth of c.ethnicity) {
          counts[eth] = (counts[eth] || 0) + 1;
        }
      }
    }
    return counts;
  }, [allContacts]);

  useEffect(() => {
    if (open) {
      setSelected(contact.ethnicity || []);
    }
  }, [open, contact.ethnicity]);

  const toggle = (eth: string) => {
    setSelected(prev =>
      prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contact.id}`, { ethnicity: selected });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contact.id] });
      toast({ title: "Ethnicity updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update ethnicity", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasEthnicity = contact.ethnicity && contact.ethnicity.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {hasEthnicity ? (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer group"
            data-testid="button-quick-edit-ethnicity"
          >
            <div className="flex gap-1">
              {contact.ethnicity.map((e: string, i: number) => (
                <span key={i} className="after:content-[','] last:after:content-none">{e}</span>
              ))}
            </div>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1"
            data-testid="button-add-ethnicity"
          >
            + Add Ethnicity
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {ETHNICITY_OPTIONS
            .map((group) => ({
              ...group,
              options: [...group.options].sort((a, b) => (ethnicityCounts[b] || 0) - (ethnicityCounts[a] || 0)),
              maxCount: Math.max(...group.options.map(o => ethnicityCounts[o] || 0)),
            }))
            .sort((a, b) => b.maxCount - a.maxCount)
            .map((group) => (
            <div key={group.group}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{group.group}</p>
              <div className="space-y-1">
                {group.options.map((eth) => (
                  <label
                    key={eth}
                    className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5"
                    data-testid={`quick-ethnicity-${eth.toLowerCase().replace(/[\s/]+/g, '-')}`}
                  >
                    <Checkbox
                      checked={selected.includes(eth)}
                      onCheckedChange={() => toggle(eth)}
                    />
                    {eth}
                    {(ethnicityCounts[eth] || 0) > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-auto">{ethnicityCounts[eth]}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} data-testid="button-cancel-ethnicity">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-ethnicity">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
