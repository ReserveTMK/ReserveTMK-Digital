import { Button } from "@/components/ui/beautiful-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export function BookingRemindersSettingsTab() {
  const { toast } = useToast();
  const { data: reminderData, isLoading } = useQuery<{ enabled: boolean; sendTimingHours: number }>({
    queryKey: ['/api/booking-reminder-settings'],
  });

  const [enabled, setEnabled] = useState(true);
  const [sendTimingHours, setSendTimingHours] = useState(4);

  useEffect(() => {
    if (reminderData) {
      setEnabled(reminderData.enabled ?? true);
      setSendTimingHours(reminderData.sendTimingHours ?? 4);
    }
  }, [reminderData]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => apiRequest('PUT', '/api/booking-reminder-settings', { enabled, sendTimingHours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-reminder-settings'] });
      toast({ title: "Saved", description: "Booking reminder settings updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Automatically send location instructions before venue hire bookings.</p>
      <div className="flex items-center gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          data-testid="switch-booking-reminders-settings"
        />
        <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
      </div>
      {enabled && (
        <div>
          <Label className="text-xs">Send reminder</Label>
          <Select value={String(sendTimingHours)} onValueChange={(v) => setSendTimingHours(Number(v))}>
            <SelectTrigger className="w-48 mt-1" data-testid="select-reminder-timing-settings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">1 day before</SelectItem>
              <SelectItem value="4">4 hours before</SelectItem>
              <SelectItem value="2">2 hours before</SelectItem>
              <SelectItem value="0">8am on day of venue hire</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        size="sm"
        onClick={() => saveSettingsMutation.mutate()}
        disabled={saveSettingsMutation.isPending}
        data-testid="button-save-booking-reminders-settings"
      >
        {saveSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Reminder Settings
      </Button>
    </div>
  );
}
