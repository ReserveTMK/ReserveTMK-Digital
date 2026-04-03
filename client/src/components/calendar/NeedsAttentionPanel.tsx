import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  CircleAlert,
} from "lucide-react";
import { format } from "date-fns";
import {
  CombinedEvent,
  DebriefInfo,
  getEventType,
  getEventDotColor,
  EVENT_TYPE_BADGE_COLORS,
} from "./calendar-constants";

export interface NeedsAttentionPanelProps {
  needsAttentionEvents: CombinedEvent[];
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  getDebriefInfo: (entry: CombinedEvent) => DebriefInfo;
}

export function NeedsAttentionPanel({
  needsAttentionEvents,
  onClose,
  onSelectDate,
  getDebriefInfo,
}: NeedsAttentionPanelProps) {
  if (needsAttentionEvents.length === 0) return null;

  return (
    <Card className="p-4 mb-6 border-amber-500/30 bg-amber-500/5" data-testid="panel-needs-attention">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleAlert className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">Events Needing Attention</span>
            <Badge variant="secondary" className="text-xs">{needsAttentionEvents.length}</Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-needs-attention"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {[...needsAttentionEvents]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((e) => {
              const eventName = e.type === "gcal" ? e.gcal?.summary : e.app?.name;
              const eventType = getEventType(e);
              const info = getDebriefInfo(e);
              const missingDebrief = !info || info.status !== "confirmed";
              const missingAttendance = e.type === "app" && e.app && e.app.attendeeCount === null;
              const status = info?.status === "draft" ? "In Progress" : missingDebrief && missingAttendance ? "Missing Debrief & Attendance" : missingDebrief ? "Missing Debrief" : "Missing Attendance";
              const stableKey = e.type === "gcal" ? `gcal-${e.gcal!.id}` : `app-${e.app!.id}`;
              return (
                <button
                  key={stableKey}
                  className="w-full text-left flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                  onClick={() => onSelectDate(e.date)}
                  data-testid={`button-attention-event-${stableKey}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getEventDotColor(e)}`} />
                    <span className="text-sm font-medium truncate">{eventName || "Untitled"}</span>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${EVENT_TYPE_BADGE_COLORS[eventType] || ""}`}>
                      {eventType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${info?.status === "draft" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                      {status}
                    </span>
                    <span className="text-xs text-muted-foreground">{format(e.date, "MMM d")}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </Card>
  );
}
