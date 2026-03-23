/**
 * BookerAgreementPanel — inline agreement summary + quick edit for Spaces/Bookers tab
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Pencil, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useVenues } from "@/hooks/use-bookings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgreementSummary {
  type: "trial" | "community" | "paid" | "none";
  allowance: number;
  allowancePeriod: string;
  usedThisPeriod: number;
  allowedVenueIds: number[];
  allowedVenueNames: string[];
  notes: string | null;
  mouId: number | null;
  membershipId: number | null;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function AgreementTypeBadge({ type }: { type: AgreementSummary["type"] }) {
  switch (type) {
    case "trial":
      return (
        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 text-[10px]">
          Trial
        </Badge>
      );
    case "community":
      return (
        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-[10px]">
          Community
        </Badge>
      );
    case "paid":
      return (
        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px]">
          Paid
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 text-[10px]">
          No Agreement
        </Badge>
      );
  }
}

// ─── Allowance text ────────────────────────────────────────────────────────────

function AllowanceText({ summary }: { summary: AgreementSummary }) {
  if (summary.type === "trial") {
    return <span className="text-xs text-muted-foreground">Unlimited (Trial)</span>;
  }
  if (!summary.mouId && !summary.membershipId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (summary.allowance === 0) {
    return <span className="text-xs text-muted-foreground">No allowance set</span>;
  }
  const period = summary.allowancePeriod === "monthly" ? "month" : "quarter";
  const used = summary.usedThisPeriod;
  const total = summary.allowance;
  return (
    <span className={`text-xs ${used >= total ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
      {used} of {total} used this {period}
    </span>
  );
}

// ─── Edit Agreement Dialog ─────────────────────────────────────────────────────

interface EditAgreementDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mouId: number;
  summary: AgreementSummary;
}

function EditAgreementDialog({ open, onOpenChange, mouId, summary }: EditAgreementDialogProps) {
  const { toast } = useToast();
  const { data: venues } = useVenues();
  const activeVenues = (venues || []).filter((v: any) => v.active !== false);

  const [allowance, setAllowance] = useState(String(summary.allowance ?? 0));
  const [period, setPeriod] = useState(summary.allowancePeriod ?? "monthly");
  const [notes, setNotes] = useState(summary.notes ?? "");
  const [selectedVenueIds, setSelectedVenueIds] = useState<number[]>(summary.allowedVenueIds ?? []);

  const patchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/mous/${mouId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mous"] });
      queryClient.invalidateQueries({ queryKey: ["/api/regular-bookers"] });
      // Invalidate all agreement-summary queries
      queryClient.invalidateQueries({ queryKey: ["/api/regular-bookers"] });
      toast({ title: "Agreement updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    patchMutation.mutate({
      bookingAllowance: parseInt(allowance) || 0,
      allowancePeriod: period,
      notes: notes.trim() || null,
      allowedLocations: selectedVenueIds.length > 0
        ? activeVenues.filter((v: any) => selectedVenueIds.includes(v.id)).map((v: any) => v.spaceName || "Other")
        : [],
    });
  };

  const toggleVenue = (venueId: number) => {
    setSelectedVenueIds(prev =>
      prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Agreement</DialogTitle>
          <DialogDescription>
            Update the booking allowance, period, venue access, and notes for this MOU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Allowance</Label>
              <Input
                type="number"
                min="0"
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
                placeholder="0 = unlimited"
                data-testid="input-mou-allowance"
              />
              <p className="text-[10px] text-muted-foreground">0 = unlimited</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="select-mou-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Allowed Venues</Label>
            <p className="text-[10px] text-muted-foreground">Select venues this booker can access. Leave empty for all venues.</p>
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border rounded-md bg-muted/30">
              {activeVenues.length === 0 && (
                <span className="text-xs text-muted-foreground">No venues configured</span>
              )}
              {activeVenues.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVenue(v.id)}
                  data-testid={`toggle-venue-${v.id}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    selectedVenueIds.includes(v.id)
                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/60"
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  {v.name}
                </button>
              ))}
            </div>
            {selectedVenueIds.length === 0 && (
              <p className="text-[10px] text-green-600 dark:text-green-400">All venues accessible</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. TRIAL — free unlimited access..."
              className="resize-none h-20 text-xs"
              data-testid="input-mou-notes"
            />
            <p className="text-[10px] text-muted-foreground">
              Include "TRIAL" to mark as trial agreement.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={patchMutation.isPending}
            data-testid="button-save-agreement"
          >
            {patchMutation.isPending ? "Saving…" : "Save Agreement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface BookerAgreementPanelProps {
  bookerId: number;
  portalUrl?: string | null;
}

export function BookerAgreementPanel({ bookerId, portalUrl }: BookerAgreementPanelProps) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const { data: summary, isLoading } = useQuery<AgreementSummary>({
    queryKey: [`/api/regular-bookers/${bookerId}/agreement-summary`],
    queryFn: async () => {
      const res = await fetch(`/api/regular-bookers/${bookerId}/agreement-summary`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const copyPortal = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl).then(() => {
      toast({ title: "Portal link copied" });
    }).catch(() => {
      toast({ title: "Portal URL", description: portalUrl });
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5" data-testid={`agreement-panel-${bookerId}`}>
      {/* Agreement type badge */}
      <AgreementTypeBadge type={summary.type} />

      {/* Allowance usage */}
      <AllowanceText summary={summary} />

      {/* Venue access */}
      {summary.allowedVenueNames.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap">
          {summary.allowedVenueNames.map((name) => (
            <Badge
              key={name}
              variant="outline"
              className="text-[10px] gap-1 bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            >
              <Building2 className="w-2.5 h-2.5" />
              {name}
            </Badge>
          ))}
        </div>
      ) : (summary.mouId || summary.membershipId) ? (
        <Badge
          variant="outline"
          className="text-[10px] gap-1 bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
        >
          All venues
        </Badge>
      ) : null}

      {/* Portal copy button */}
      {portalUrl && (
        <button
          type="button"
          onClick={copyPortal}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Copy portal link"
          data-testid={`button-copy-portal-inline-${bookerId}`}
        >
          <Copy className="w-3 h-3" />
          Copy link
        </button>
      )}

      {/* Edit Agreement (MOU only) */}
      {summary.mouId && (
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`button-edit-agreement-${bookerId}`}
        >
          <Pencil className="w-3 h-3" />
          Edit Agreement
        </button>
      )}

      {/* Edit Dialog */}
      {summary.mouId && editOpen && (
        <EditAgreementDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mouId={summary.mouId}
          summary={summary}
        />
      )}
    </div>
  );
}
