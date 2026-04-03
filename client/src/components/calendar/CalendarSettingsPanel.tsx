import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  X,
} from "lucide-react";
import type { GoogleCalendarInfo } from "@/types/google-calendar";

export interface CalendarSettingsPanelProps {
  showSettings: boolean;
  onClose: () => void;
  availableCalendars: GoogleCalendarInfo[] | undefined;
  calendarsListLoading: boolean;
  calendarSettings: { id: number; calendarId: string; label: string; active: boolean; autoImport: boolean }[] | undefined;
  onToggleCalendar: (calendarId: string, label: string, enabled: boolean) => void;
  onToggleAutoImport: (settingId: number, autoImport: boolean) => void;
  isTogglePending: boolean;
}

export function CalendarSettingsPanel({
  showSettings,
  onClose,
  availableCalendars,
  calendarsListLoading,
  calendarSettings,
  onToggleCalendar,
  onToggleAutoImport,
  isTogglePending,
}: CalendarSettingsPanelProps) {
  if (!showSettings) return null;

  return (
    <Card className="p-4 mb-6" data-testid="panel-calendar-settings">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold">My Calendars</h3>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Toggle which calendars to sync. Shared events across calendars are automatically deduplicated.
      </p>
      {calendarsListLoading ? (
        <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading calendars...
        </div>
      ) : availableCalendars && availableCalendars.length > 0 ? (
        <div className="space-y-1">
          {availableCalendars.map(cal => {
            const setting = (calendarSettings || []).find(s => s.calendarId === cal.id);
            const isEnabled = cal.primary || !!setting;
            return (
              <div
                key={cal.id}
                className="flex items-center gap-3 p-2 rounded-md"
                data-testid={`calendar-toggle-${cal.id}`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.backgroundColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{cal.summary}</p>
                  {cal.description && (
                    <p className="text-xs text-muted-foreground truncate">{cal.description}</p>
                  )}
                  {isEnabled && setting && (
                    <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-3 h-3 rounded"
                        checked={!!setting.autoImport}
                        onChange={(e) => onToggleAutoImport(setting.id, e.target.checked)}
                      />
                      <span className="text-xs text-muted-foreground">Auto-import events</span>
                    </label>
                  )}
                </div>
                <Switch
                  checked={isEnabled}
                  disabled={cal.primary || isTogglePending}
                  onCheckedChange={(checked) => {
                    if (!cal.primary) {
                      onToggleCalendar(cal.id, cal.summary, checked);
                    }
                  }}
                  data-testid={`switch-calendar-${cal.id}`}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Google Calendar not connected.
          </p>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch("/api/google-calendar/oauth/authorize", { credentials: "include" });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              } catch (e) {
                console.error("Failed to get auth URL", e);
              }
            }}
          >
            Connect Google Calendar
          </Button>
        </div>
      )}
    </Card>
  );
}
