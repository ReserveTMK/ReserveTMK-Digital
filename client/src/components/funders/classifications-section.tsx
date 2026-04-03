import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { format } from "date-fns";

const COLOR_BG: Record<string, string> = {
  purple: "bg-purple-500", blue: "bg-blue-500", green: "bg-green-500",
  amber: "bg-amber-500", red: "bg-red-500", pink: "bg-pink-500",
  teal: "bg-teal-500", orange: "bg-orange-500", cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
};

const ENTITY_ICONS: Record<string, string> = {
  debrief: "Debrief", booking: "Booking", programme: "Programme", event: "Event",
};

export function FunderClassificationsSection({ funderId }: { funderId: number }) {
  const now = new Date();
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(monthEnd);
  const [entityFilter, setEntityFilter] = useState("all");

  const params = new URLSearchParams({ startDate, endDate });
  if (entityFilter !== "all") params.set("entityType", entityFilter);

  const { data: classifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/funders", funderId, "classifications", startDate, endDate, entityFilter],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/classifications?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load classifications");
      return res.json();
    },
  });

  // Group by category
  const byCategory = useMemo(() => {
    const map = new Map<string, { color: string | null; items: any[] }>();
    for (const c of classifications) {
      const key = c.categoryName || "Uncategorised";
      if (!map.has(key)) map.set(key, { color: c.categoryColor, items: [] });
      map.get(key)!.items.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].items.length - a[1].items.length);
  }, [classifications]);

  const confLabel = (c: number) => c >= 80 ? "High" : c >= 50 ? "Med" : "Low";
  const confColor = (c: number) => c >= 80 ? "bg-green-100 text-green-800" : c >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";

  return (
    <div>
      <h3 className="font-medium mb-2" data-testid="text-classifications-heading">Classifications</h3>
      <p className="text-xs text-muted-foreground mb-3">What got classified through this funder's taxonomy lens</p>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-xs" data-testid="input-class-start" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-xs" data-testid="input-class-end" />
        <div className="flex gap-1">
          {["all", "debrief", "booking", "programme", "event"].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={entityFilter === t ? "default" : "ghost"}
              onClick={() => setEntityFilter(t)}
              className="text-xs h-7 px-2"
              data-testid={`button-filter-${t}`}
            >
              {t === "all" ? "All" : ENTITY_ICONS[t] || t}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-muted-foreground text-sm">Loading...</div>
      ) : classifications.length === 0 ? (
        <div className="py-4 text-center text-muted-foreground text-sm" data-testid="text-no-classifications">
          No classifications for this period
        </div>
      ) : (
        <div className="space-y-2">
          {byCategory.map(([catName, { color, items }]) => (
            <details key={catName} className="border border-border rounded-lg" data-testid={`details-category-${catName}`}>
              <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50">
                <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_BG[color || "purple"] || "bg-purple-500"}`} />
                <span className="font-medium text-sm flex-1">{catName}</span>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </summary>
              <div className="px-3 pb-3 space-y-1">
                {items.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 text-sm border-t border-border/50">
                    <Badge variant="outline" className="text-[10px] shrink-0">{ENTITY_ICONS[c.entityType] || c.entityType}</Badge>
                    <span className="flex-1 truncate">{c.entityTitle}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {c.entityDate ? format(new Date(c.entityDate), "d MMM") : ""}
                    </span>
                    <Badge className={`text-[10px] ${confColor(c.confidence)}`}>{confLabel(c.confidence)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
