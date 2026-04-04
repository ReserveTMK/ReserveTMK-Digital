import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { useVenues, useUpdateVenue, useLocations, useUpdateLocation, useBookingPricingDefaults, useUpdateBookingPricingDefaults } from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2, Building2, DollarSign, ExternalLink } from "lucide-react";
import { COMMUNITY_DISCOUNT } from "@shared/schema";

export function BookerSettings() {
  const { data: venues, isLoading: venuesLoading } = useVenues();
  const { data: locationsList, isLoading: locationsLoading } = useLocations();
  const { data: pricing, isLoading: pricingLoading } = useBookingPricingDefaults();
  const updateVenue = useUpdateVenue();
  const updateLocation = useUpdateLocation();
  const updatePricing = useUpdateBookingPricingDefaults();
  const { toast } = useToast();

  const [hourlyRate, setHourlyRate] = useState("");
  const [halfDayRate, setHalfDayRate] = useState("");
  const [fullDayRate, setFullDayRate] = useState("");
  const [pricingDirty, setPricingDirty] = useState(false);

  useEffect(() => {
    if (pricing) {
      setHourlyRate((pricing as any).hourlyRate || "50");
      setHalfDayRate(pricing.halfDayRate || "175");
      setFullDayRate(pricing.fullDayRate || "300");
    }
  }, [pricing]);

  const isLoading = venuesLoading || locationsLoading || pricingLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const venuesByLocation = new Map<string, typeof venues>();
  for (const v of venues || []) {
    const loc = v.spaceName || "Ungrouped";
    if (!venuesByLocation.has(loc)) venuesByLocation.set(loc, []);
    venuesByLocation.get(loc)!.push(v);
  }

  const getLocationCasualEnabled = (spaceName: string) => {
    const loc = locationsList?.find((l: any) => l.name === spaceName);
    return loc?.casualEnabled ?? false;
  };

  const handleLocationToggle = async (spaceName: string, enabled: boolean) => {
    const loc = locationsList?.find((l: any) => l.name === spaceName);
    if (loc) {
      await updateLocation.mutateAsync({ id: loc.id, data: { casualEnabled: enabled } });
      toast({ title: `${spaceName} casual hiring ${enabled ? "enabled" : "disabled"}` });
    }
  };

  const handleVenueToggle = async (venueId: number, venueName: string, enabled: boolean) => {
    await updateVenue.mutateAsync({ id: venueId, data: { casualEnabled: enabled } });
    toast({ title: `${venueName} ${enabled ? "available" : "hidden"} for casual hire` });
  };

  const handleSavePricing = async () => {
    await updatePricing.mutateAsync({
      hourlyRate,
      halfDayRate,
      fullDayRate,
    });
    setPricingDirty(false);
    toast({ title: "Pricing updated" });
  };

  const communityDiscount = COMMUNITY_DISCOUNT * 100;

  return (
    <div className="space-y-6">
      {/* Casual Hire — rates, venues, and link in one card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Casual Hire
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/casual-hire", "_blank")}
              data-testid="button-view-casual-hire"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              View casual hire page
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rates */}
          <div>
            <h3 className="text-sm font-medium mb-3">Rates</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Standard rates shown on the public casual hire portal. All prices exclude GST.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourly-rate">Hourly</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="hourly-rate"
                    value={hourlyRate}
                    onChange={(e) => { setHourlyRate(e.target.value); setPricingDirty(true); }}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="half-day-rate">Half day (4hrs)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="half-day-rate"
                    value={halfDayRate}
                    onChange={(e) => { setHalfDayRate(e.target.value); setPricingDirty(true); }}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full-day-rate">Full day (8hrs)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="full-day-rate"
                    value={fullDayRate}
                    onChange={(e) => { setFullDayRate(e.target.value); setPricingDirty(true); }}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 mt-3">
              <p className="text-sm font-medium">Community discount: {communityDiscount}% off</p>
              <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                <span>${(parseFloat(hourlyRate || "0") * (1 - COMMUNITY_DISCOUNT)).toFixed(0)}/hr</span>
                <span>${(parseFloat(halfDayRate || "0") * (1 - COMMUNITY_DISCOUNT)).toFixed(0)}/half day</span>
                <span>${(parseFloat(fullDayRate || "0") * (1 - COMMUNITY_DISCOUNT)).toFixed(0)}/full day</span>
              </div>
            </div>

            {pricingDirty && (
              <Button onClick={handleSavePricing} disabled={updatePricing.isPending} className="mt-3">
                {updatePricing.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save pricing
              </Button>
            )}
          </div>

          {/* Available venues */}
          <div>
            <h3 className="text-sm font-medium mb-3">Available venues</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Toggle which venues appear on the public casual hire portal.
            </p>

            {Array.from(venuesByLocation.entries()).map(([spaceName, spaceVenues]) => {
              const locationEnabled = getLocationCasualEnabled(spaceName);
              return (
                <div key={spaceName} className="border rounded-lg p-4 space-y-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{spaceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {spaceVenues!.length} venue{spaceVenues!.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`loc-${spaceName}`} className="text-xs">
                        {locationEnabled ? "Available" : "Off"}
                      </Label>
                      <Switch
                        id={`loc-${spaceName}`}
                        checked={locationEnabled}
                        onCheckedChange={(checked) => handleLocationToggle(spaceName, checked)}
                      />
                    </div>
                  </div>

                  {locationEnabled && (
                    <div className="ml-7 space-y-2">
                      {spaceVenues!.map((v) => (
                        <div key={v.id} className="flex items-center justify-between py-1.5 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{v.name}</span>
                            {v.capacity && (
                              <Badge variant="secondary" className="text-xs">
                                {v.capacity} pax
                              </Badge>
                            )}
                          </div>
                          <Switch
                            checked={v.casualEnabled ?? false}
                            onCheckedChange={(checked) => handleVenueToggle(v.id, v.name, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
