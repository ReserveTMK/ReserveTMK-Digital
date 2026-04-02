import { Card } from "@/components/ui/card";
import {
  Footprints,
  CalendarDays,
  FileText,
} from "lucide-react";
import { format, isSameMonth } from "date-fns";

export interface MonthSummaryBarProps {
  currentMonth: Date;
  monthEventCount: number;
  monthDebriefedCount: number;
  monthlyFootTrafficTotal: number;
}

export function MonthSummaryBar({
  currentMonth,
  monthEventCount,
  monthDebriefedCount,
  monthlyFootTrafficTotal,
}: MonthSummaryBarProps) {
  return (
    <Card className="p-4 mb-6" data-testid="panel-monthly-summary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold" data-testid="text-monthly-summary-title">
            {isSameMonth(currentMonth, new Date()) ? "This Month" : format(currentMonth, "MMMM yyyy")}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Events:</span>
            <span className="font-medium" data-testid="text-month-event-count">{monthEventCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Debriefed:</span>
            <span className="font-medium" data-testid="text-month-debriefed-count">{monthDebriefedCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Footprints className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Foot Traffic:</span>
            <span className="font-medium" data-testid="text-month-foot-traffic-total">{monthlyFootTrafficTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
