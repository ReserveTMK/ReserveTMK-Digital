import { useState, useRef, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Check, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Sprout, TreePine, Sun, Pause } from "lucide-react";

export const TABLE_ETHNICITY_OPTIONS = [
  { group: "Polynesian", options: ["Samoan", "Tongan", "Cook Islands Māori", "Niuean", "Tokelauan", "Fijian", "Hawaiian", "Tahitian", "Māori", "Other Polynesian"] },
  { group: "Pacific", options: ["Micronesian", "Melanesian"] },
  { group: "European", options: ["NZ European/Pākehā", "Other European"] },
  { group: "Asian", options: ["Chinese", "Indian", "Other Asian"] },
  { group: "Other", options: ["Middle Eastern", "Latin American", "African", "Other"] },
];

export const STAGE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  kakano: { label: "Kakano", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-800", icon: Sprout },
  tipu: { label: "Tipu", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-500/10 border-green-200 dark:border-green-800", icon: TreePine },
  ora: { label: "Ora", color: "text-sky-700 dark:text-sky-400", bgColor: "bg-sky-500/10 border-sky-200 dark:border-sky-800", icon: Sun },
  inactive: { label: "Inactive", color: "text-muted-foreground", bgColor: "bg-muted border-border", icon: Pause },
};

export const CONNECTION_CONFIG: Record<string, { label: string; level: number; color: string; dotColor: string }> = {
  known: { label: "Known", level: 1, color: "text-slate-600 dark:text-slate-400", dotColor: "bg-slate-400" },
  connected: { label: "Connected", level: 2, color: "text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500" },
  engaged: { label: "Engaged", level: 3, color: "text-green-600 dark:text-green-400", dotColor: "bg-green-500" },
  embedded: { label: "Embedded", level: 4, color: "text-purple-600 dark:text-purple-400", dotColor: "bg-purple-500" },
  partnering: { label: "Partnering", level: 5, color: "text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" },
};

export const CONNECTION_LEVELS = ["known", "connected", "engaged", "embedded", "partnering"];

export const SUPPORT_OPTIONS = ["mentoring", "workshop_skills", "space", "venue_hire", "hot_desking", "service_trade", "paid_work", "networking"];

export const SUPPORT_LABEL_MAP: Record<string, string> = {
  mentoring: "Mentoring",
  workshop_skills: "Workshop/Skills",
  space: "Space",
  venue_hire: "Venue Hire",
  hot_desking: "Hot Desking",
  service_trade: "Service Trade",
  paid_work: "Paid Work",
  networking: "Networking",
};

export const SUPPORT_COLOR_MAP: Record<string, string> = {
  mentoring: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  workshop_skills: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  space: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
  venue_hire: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
  hot_desking: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
  service_trade: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  paid_work: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20",
  networking: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

export function InlineTextCell({ contactId, field, value, placeholder }: { contactId: number; field: string; value: string; placeholder: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setText(value || "");
  }, [value, contactId, editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed === (value || "")) return;
    try {
      const body: Record<string, any> = { [field]: trimmed || null };
      if (field === "age") {
        const parsed = parseInt(trimmed);
        body[field] = trimmed && !isNaN(parsed) ? parsed : null;
      }
      await apiRequest("PATCH", `/api/contacts/${contactId}`, body);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: `${field.charAt(0).toUpperCase() + field.slice(1)} updated` });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
      setText(value || "");
    }
  };

  if (!editing) {
    return (
      <button
        className="text-left w-full px-2 py-1 rounded hover:bg-muted/60 transition-colors text-sm truncate cursor-pointer"
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        data-testid={`table-cell-${field}-${contactId}`}
      >
        {value || <span className="text-muted-foreground/50">{placeholder}</span>}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setText(value || ""); setEditing(false); } }}
      className="h-7 text-sm px-2"
      data-testid={`table-input-${field}-${contactId}`}
    />
  );
}

export function InlineEthnicityCell({ contactId, ethnicities, ethnicityCounts }: { contactId: number; ethnicities: string[]; ethnicityCounts: Record<string, number> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(ethnicities || []);
  const [saving, setSaving] = useState(false);

  const toggle = (eth: string) => {
    setSelected(prev => prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { ethnicity: selected });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Ethnicity updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update ethnicity", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSelected(ethnicities || []); }}>
      <PopoverTrigger asChild>
        <button
          className="text-left w-full px-2 py-1 rounded hover:bg-muted/60 transition-colors text-sm truncate cursor-pointer group flex items-center gap-1"
          data-testid={`table-cell-ethnicity-${contactId}`}
        >
          {ethnicities?.length > 0 ? (
            <span className="truncate">{ethnicities.join(", ")}</span>
          ) : (
            <span className="text-muted-foreground/50">+ Add</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {TABLE_ETHNICITY_OPTIONS
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
                    data-testid={`table-ethnicity-opt-${eth.toLowerCase().replace(/[\s/]+/g, '-')}-${contactId}`}
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
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} data-testid={`table-ethnicity-cancel-${contactId}`}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid={`table-ethnicity-save-${contactId}`}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InlineStageCell({ stage, contactId }: { stage?: string; contactId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const stages = ["kakano", "tipu", "ora", "inactive"];

  const handleSelect = async (newStage: string) => {
    if (newStage === stage) { setOpen(false); return; }
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { stage: newStage });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Stage updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update stage", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const config = STAGE_CONFIG[stage || ""] || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-left px-2 py-1 rounded hover:bg-muted/60 transition-colors cursor-pointer group flex items-center gap-1" data-testid={`table-cell-stage-${contactId}`}>
          {config ? (
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${config.bgColor} ${config.color}`}>
              {(() => { const I = config.icon; return <I className="w-3 h-3 mr-1" />; })()}
              {config.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground/50 text-xs">+ Set</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {stages.map(s => {
            const sc = STAGE_CONFIG[s];
            const Icon = sc.icon;
            const isActive = s === stage;
            return (
              <button
                key={s}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent/50 transition-colors ${isActive ? "bg-accent" : ""}`}
                onClick={() => handleSelect(s)}
                disabled={saving}
                data-testid={`stage-opt-${s}-${contactId}`}
              >
                <Icon className={`w-3.5 h-3.5 ${sc.color}`} />
                <span>{sc.label}</span>
                {isActive && <Check className="w-3 h-3 ml-auto" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InlineSupportCell({ contactId, supportTypes }: { contactId: number; supportTypes: string[] }) {
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
          className="text-left w-full px-2 py-1 rounded hover:bg-muted/60 transition-colors text-sm cursor-pointer group flex items-center gap-1 flex-wrap"
          data-testid={`table-cell-support-${contactId}`}
        >
          {supportTypes?.length > 0 ? (
            supportTypes.map(t => (
              <Badge key={t} className={`text-[10px] h-5 px-1.5 ${SUPPORT_COLOR_MAP[t] || ""}`}>
                {SUPPORT_LABEL_MAP[t] || t}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground/50">+ Add</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-1">
          {SUPPORT_OPTIONS.map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5" data-testid={`support-opt-${t}-${contactId}`}>
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

export function InlineConnectionCell({ contactId, connectionStrength }: { contactId: number; connectionStrength?: string | null }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (val: string) => {
    if (val === connectionStrength) { setOpen(false); return; }
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { connectionStrength: val });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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
        <button className="text-left px-2 py-1 rounded hover:bg-muted/60 transition-colors cursor-pointer group flex items-center gap-1.5" data-testid={`table-cell-connection-${contactId}`}>
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
            <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
          ) : (
            <span className="text-muted-foreground/50 text-[10px]">+ Set</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
                data-testid={`connection-opt-${l}-${contactId}`}
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

export function ConnectionStrengthDisplay({ connectionStrength }: { connectionStrength?: string | null }) {
  const config = CONNECTION_CONFIG[connectionStrength || ""] || null;
  const activeLevel = config?.level || 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {CONNECTION_LEVELS.map((l, i) => {
          const lc = CONNECTION_CONFIG[l];
          return (
            <div
              key={l}
              className={`w-3 h-1.5 rounded-sm ${i < activeLevel ? lc.dotColor : "bg-muted-foreground/15"}`}
            />
          );
        })}
      </div>
      {config && (
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      )}
    </div>
  );
}

export type SortField = "name" | "role" | "ethnicity" | "age" | "suburb" | "lastActive" | "community" | "stage" | "support" | "connection";
export type SortDir = "asc" | "desc";

export function SortHeader({ label, field, activeField, dir, onSort, className }: { label: string; field: SortField; activeField: SortField | null; dir: SortDir; onSort: (f: SortField) => void; className?: string }) {
  const isActive = activeField === field;
  return (
    <th className={`text-left py-3 font-medium text-muted-foreground whitespace-nowrap ${className || ""}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={() => onSort(field)}
        data-testid={`sort-${field}`}
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
