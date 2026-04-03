import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, getDaysInMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Calendar,
  ChevronRight,
} from "lucide-react";

// ── Period helpers ─────────────────────────────────────────────────────────

function getPeriodOptions() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      label: format(d, "MMMM yyyy"),
      value: format(d, "yyyy-MM"),
      year: d.getFullYear(),
      month: d.getMonth(), // 0-based
    };
  });
}

// ── Monthly Reconcile Dialog ────────────────────────────────────────────────

interface MonthlyReconcileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonthlyReconcileDialog({ open, onOpenChange }: MonthlyReconcileDialogProps) {
  const periodOptions = getPeriodOptions();
  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0].value);
  const [confirmed, setConfirmed] = useState(false);

  const period = periodOptions.find((p) => p.value === selectedPeriod)!;
  const periodStart = startOfMonth(new Date(period.year, period.month, 1));
  const periodEnd = endOfMonth(periodStart);
  const monthParam = format(periodStart, "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Monthly Reconcile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Month selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Month</label>
            <Select
              value={selectedPeriod}
              onValueChange={(v) => { setSelectedPeriod(v); setConfirmed(false); }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section 1: Foot Traffic */}
          <FootTrafficSection monthParam={monthParam} periodStart={periodStart} period={period} />

          {/* Section 2: Unplanned Use Check */}
          <UnplannedUseSection periodStart={periodStart} periodEnd={periodEnd} />

          {/* Section 3: Debrief Check */}
          <DebriefCheckSection periodStart={periodStart} periodEnd={periodEnd} />

          {/* Section 4: Confirm Month */}
          <ConfirmMonthSection
            periodStart={periodStart}
            periodEnd={periodEnd}
            monthParam={monthParam}
            confirmed={confirmed}
            onConfirmed={() => setConfirmed(true)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Section 1: Foot Traffic Grid ──────────────────────────────────────────

function FootTrafficSection({
  monthParam,
  periodStart,
  period,
}: {
  monthParam: string;
  periodStart: Date;
  period: { year: number; month: number; label: string };
}) {
  const { toast } = useToast();
  const daysInMonth = getDaysInMonth(periodStart);

  const { data: footTrafficRows } = useQuery<any[]>({
    queryKey: ["/api/daily-foot-traffic", monthParam],
    queryFn: async () => {
      const res = await fetch(`/api/daily-foot-traffic?month=${monthParam}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30000,
    enabled: !!monthParam,
  });

  const trafficByDay = useMemo(() => {
    const map: Record<number, number> = {};
    for (const row of footTrafficRows || []) {
      const d = new Date(row.date);
      map[d.getDate()] = row.count;
    }
    return map;
  }, [footTrafficRows]);

  const [localValues, setLocalValues] = useState<Record<number, string>>({});

  const saveMutation = useMutation({
    mutationFn: async ({ day, count }: { day: number; count: number }) => {
      const date = new Date(period.year, period.month, day);
      const res = await apiRequest("POST", "/api/daily-foot-traffic", {
        date: date.toISOString(),
        count,
      });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-foot-traffic", monthParam] });
      toast({ title: `Day ${vars.day} saved` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function getValue(day: number): string {
    if (localValues[day] !== undefined) return localValues[day];
    const v = trafficByDay[day];
    return v !== undefined ? String(v) : "";
  }

  const totalTraffic = Array.from({ length: daysInMonth }, (_, i) => i + 1).reduce((sum, d) => {
    const v = trafficByDay[d];
    return sum + (v || 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Section 1 — Foot Traffic
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            Total this month: {totalTraffic}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const val = getValue(day);
            const saved = trafficByDay[day] !== undefined;
            return (
              <div key={day} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-muted-foreground">{day}</span>
                <input
                  type="number"
                  min="0"
                  className={`w-full h-8 text-center text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring ${saved && !localValues[day] ? "border-emerald-500/50" : "border-border"}`}
                  value={val}
                  onChange={(e) => setLocalValues((prev) => ({ ...prev, [day]: e.target.value }))}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== "" && v !== String(trafficByDay[day] ?? "")) {
                      saveMutation.mutate({ day, count: parseInt(v) || 0 });
                      setLocalValues((prev) => {
                        const next = { ...prev };
                        delete next[day];
                        return next;
                      });
                    }
                  }}
                  placeholder="0"
                />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Tab between days or click away to auto-save each entry. Green border = saved.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Section 2: Unplanned Use Check ────────────────────────────────────────

const SPACE_USE_TYPE_OPTIONS = [
  { value: "hub_activity", label: "Hub Activity" },
  { value: "drop_in", label: "Drop-in" },
  { value: "studio", label: "Studio" },
  { value: "venue_hire", label: "Venue Hire" },
  { value: "programme", label: "Programme" },
  { value: "workshop", label: "Workshop" },
  { value: "other", label: "Other" },
];

function UnplannedUseSection({ periodStart, periodEnd }: { periodStart: Date; periodEnd: Date }) {
  const { toast } = useToast();

  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  });

  const untagged = useMemo(() => {
    const UNPLANNED_TYPES = ["Hub Activity", "Drop-in", "Other"];
    return (events || []).filter((e) => {
      const d = new Date(e.startTime);
      return (
        d >= periodStart &&
        d <= periodEnd &&
        UNPLANNED_TYPES.includes(e.type) &&
        !e.spaceUseType &&
        e.eventStatus !== "cancelled"
      );
    });
  }, [events, periodStart, periodEnd]);

  const tagMutation = useMutation({
    mutationFn: async ({ id, spaceUseType }: { id: number; spaceUseType: string }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}`, { spaceUseType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (untagged.length === 0) {
    return (
      <Card className="border-emerald-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Section 2 — Unplanned Use Check
            <Badge variant="secondary" className="ml-auto text-[10px]">All done ✓</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">All Hub Activity / Drop-in / Other events are tagged.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          Section 2 — Unplanned Use Check
          <Badge variant="secondary" className="ml-auto text-[10px]">{untagged.length} to tag</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {untagged.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.startTime), "EEE d MMM")} · {e.type}
                </p>
              </div>
              <Select
                onValueChange={(v) => tagMutation.mutate({ id: e.id, spaceUseType: v })}
              >
                <SelectTrigger className="w-36 h-7 text-xs">
                  <SelectValue placeholder="Tag type…" />
                </SelectTrigger>
                <SelectContent>
                  {SPACE_USE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section 3: Debrief Check ──────────────────────────────────────────────

function DebriefCheckSection({ periodStart, periodEnd }: { periodStart: Date; periodEnd: Date }) {
  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  });

  const { data: impactLogs } = useQuery<any[]>({
    queryKey: ["/api/impact-logs"],
    staleTime: 30000,
  });

  const needsDebrief = useMemo(() => {
    const confirmedEventIds = new Set(
      (impactLogs || [])
        .filter((d) => d.eventId && d.status === "confirmed")
        .map((d) => d.eventId)
    );

    const NON_DEBRIEFABLE_TYPES = ["Public Holiday", "Staff Closure", "Other"];
    return (events || []).filter((e) => {
      const d = new Date(e.startTime);
      return (
        d >= periodStart &&
        d <= periodEnd &&
        e.requiresDebrief &&
        !confirmedEventIds.has(e.id) &&
        e.eventStatus !== "cancelled" &&
        !NON_DEBRIEFABLE_TYPES.includes(e.type)
      );
    });
  }, [events, impactLogs, periodStart, periodEnd]);

  if (needsDebrief.length === 0) {
    return (
      <Card className="border-emerald-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Section 3 — Debrief Check
            <Badge variant="secondary" className="ml-auto text-[10px]">All done ✓</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No outstanding debriefs for this month.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          Section 3 — Debrief Check
          <Badge variant="destructive" className="ml-auto text-[10px]">{needsDebrief.length} outstanding</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {needsDebrief.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.startTime), "EEE d MMM")} · requires debrief
                </p>
              </div>
              <a
                href={`/debriefs?eventId=${e.id}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                Create debrief <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section 4: Confirm Month ──────────────────────────────────────────────

function ConfirmMonthSection({
  periodStart,
  periodEnd,
  monthParam,
  confirmed,
  onConfirmed,
}: {
  periodStart: Date;
  periodEnd: Date;
  monthParam: string;
  confirmed: boolean;
  onConfirmed: () => void;
}) {
  const { toast } = useToast();

  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  });

  const { data: bookings } = useQuery<any[]>({
    queryKey: ["/api/bookings"],
    staleTime: 30000,
  });

  const { data: footTrafficRows } = useQuery<any[]>({
    queryKey: ["/api/daily-foot-traffic", monthParam],
    queryFn: async () => {
      const res = await fetch(`/api/daily-foot-traffic?month=${monthParam}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30000,
    enabled: !!monthParam,
  });

  const EXCLUDE_TYPES = ["Meeting", "Catch Up", "Planning", "Mentoring Session", "External Event"];

  const monthEvents = useMemo(() => {
    return (events || []).filter((e) => {
      const d = new Date(e.startTime);
      return d >= periodStart && d <= periodEnd && e.eventStatus !== "cancelled" && !EXCLUDE_TYPES.includes(e.type);
    });
  }, [events, periodStart, periodEnd]);

  const monthBookings = useMemo(() => {
    return (bookings || []).filter((b) => {
      if (!b.startDate) return false;
      const d = new Date(b.startDate);
      return d >= periodStart && d <= periodEnd && b.status !== "cancelled";
    });
  }, [bookings, periodStart, periodEnd]);

  const totalFootTraffic = useMemo(() => {
    return (footTrafficRows || []).reduce((sum: number, r: any) => sum + (r.count || 0), 0);
  }, [footTrafficRows]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/monthly-snapshots", {
        month: monthParam,
        footTraffic: totalFootTraffic,
        notes: "Confirmed via Monthly Reconcile",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-snapshots"] });
      toast({ title: "Month confirmed!", description: `${format(periodStart, "MMMM yyyy")} marked as complete.` });
      onConfirmed();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className={confirmed ? "border-emerald-500/50" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {confirmed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          )}
          Section 4 — Confirm Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Activations</span>
            </div>
            <p className="text-2xl font-bold">{monthEvents.length}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Foot Traffic</span>
            </div>
            <p className="text-2xl font-bold">{totalFootTraffic}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Venue Hires</span>
            </div>
            <p className="text-2xl font-bold">{monthBookings.length}</p>
          </div>
        </div>

        {confirmed ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Month confirmed! Snapshot saved.
            </p>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
          >
            {confirmMutation.isPending ? "Confirming…" : "Confirm Month Complete"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
