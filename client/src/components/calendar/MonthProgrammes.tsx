import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  UserPlus,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import type { Programme } from "@shared/schema";
import {
  PROG_CLASSIFICATION_COLORS,
  PROG_STATUS_COLORS,
  PROGRAMME_MONTHLY_TARGET,
} from "./calendar-constants";

export interface MonthProgrammesProps {
  monthProgrammes: Programme[];
  programmeTargetCount: number;
  onNavigate: (path: string) => void;
}

export function MonthProgrammes({
  monthProgrammes,
  programmeTargetCount,
  onNavigate,
}: MonthProgrammesProps) {
  return (
    <div className="mt-6" data-testid="section-month-programmes">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-display font-bold text-foreground" data-testid="text-programmes-heading">
          Programmes this month
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate("/programmes")}
          data-testid="button-view-all-programmes"
        >
          View all
        </Button>
      </div>
      <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded-lg text-sm ${
        programmeTargetCount >= PROGRAMME_MONTHLY_TARGET
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : programmeTargetCount > 0
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-muted text-muted-foreground"
      }`} data-testid="programme-target-indicator">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          <span className="font-medium">
            {programmeTargetCount} / {PROGRAMME_MONTHLY_TARGET} target
          </span>
        </div>
        <span className="text-xs">
          {programmeTargetCount >= PROGRAMME_MONTHLY_TARGET
            ? "Target met"
            : `Need ${PROGRAMME_MONTHLY_TARGET - programmeTargetCount} more to hit target`}
        </span>
      </div>
      {monthProgrammes.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {monthProgrammes.map((p: Programme) => {
          const dateDisplay = (() => {
            if (p.tbcMonth && p.tbcYear) return `TBC - ${p.tbcMonth} ${p.tbcYear}`;
            if (!p.startDate) return null;
            const start = format(new Date(p.startDate), "d MMM");
            if (p.endDate && format(new Date(p.endDate), "yyyy-MM-dd") !== format(new Date(p.startDate), "yyyy-MM-dd")) {
              return `${start} - ${format(new Date(p.endDate), "d MMM")}`;
            }
            return start;
          })();

          const timeDisplay = p.startTime
            ? p.endTime ? `${p.startTime} - ${p.endTime}` : p.startTime
            : null;

          const totalBudget = parseFloat(p.facilitatorCost || "0") + parseFloat(p.cateringCost || "0") + parseFloat(p.promoCost || "0");

          const facCount = (p.facilitators || []).length;
          const attCount = (p.attendees || []).length;

          return (
            <Card
              key={p.id}
              className={`p-3 hover-elevate cursor-pointer transition-all ${PROG_STATUS_COLORS[p.status] || ""}`}
              onClick={() => onNavigate("/programmes")}
              data-testid={`card-cal-programme-${p.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className={`font-medium text-sm truncate ${p.status === "cancelled" ? "line-through opacity-70" : ""}`}>
                  {p.name}
                </h4>
                <Badge className={`text-xs shrink-0 ${PROG_CLASSIFICATION_COLORS[p.classification] || ""}`}>
                  {p.classification}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {dateDisplay && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {dateDisplay}
                  </span>
                )}
                {timeDisplay && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeDisplay}
                  </span>
                )}
                {p.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{p.location}</span>
                  </span>
                )}
                {totalBudget > 0 && (
                  <span className="flex items-center gap-1">
                    ${totalBudget.toLocaleString()}
                  </span>
                )}
                {facCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {facCount} facilitator{facCount !== 1 ? "s" : ""}
                  </span>
                )}
                {attCount > 0 && (
                  <span className="flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />
                    {attCount} attendee{attCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No programmes scheduled this month</p>
      )}
    </div>
  );
}
