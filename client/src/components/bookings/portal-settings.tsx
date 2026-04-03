import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBookingPricingDefaults, useUpdateBookingPricingDefaults } from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export function PortalSettingsTab() {
  const { toast } = useToast();
  const { data: pricingDefaults } = useBookingPricingDefaults();
  const updateDefaults = useUpdateBookingPricingDefaults();
  const [maxMonths, setMaxMonths] = useState<number>(3);

  useEffect(() => {
    if (pricingDefaults?.maxAdvanceMonths != null) {
      setMaxMonths(pricingDefaults.maxAdvanceMonths);
    }
  }, [pricingDefaults?.maxAdvanceMonths]);

  const handleSave = () => {
    const val = Math.max(1, Math.min(12, maxMonths));
    updateDefaults.mutate({ maxAdvanceMonths: val }, {
      onSuccess: () => toast({ title: "Portal settings saved" }),
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure settings for the booker portal.</p>
      <div className="space-y-2">
        <Label htmlFor="max-advance-months" className="text-sm font-medium">Max Advance Booking</Label>
        <p className="text-xs text-muted-foreground">How far in advance bookers can make venue hire requests.</p>
        <div className="flex items-center gap-2">
          <Input
            id="max-advance-months"
            type="number"
            min={1}
            max={12}
            value={maxMonths}
            onChange={(e) => setMaxMonths(parseInt(e.target.value) || 1)}
            className="w-24"
            data-testid="input-max-advance-months"
          />
          <span className="text-sm text-muted-foreground">months</span>
        </div>
      </div>
      <Button
        onClick={handleSave}
        disabled={updateDefaults.isPending}
        data-testid="button-save-portal-settings"
      >
        {updateDefaults.isPending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
