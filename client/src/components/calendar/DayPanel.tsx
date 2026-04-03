import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React from "react";
import {
  Calendar,
  Clock,
  Users,
  Loader2,
  EyeOff,
  Eye,
  Building2,
  Plus,
  Footprints,
  Save,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contact, Booking, Venue } from "@shared/schema";
import type { GoogleCalendarEvent } from "@/types/google-calendar";
import { EventCard } from "./EventCard";
import type { EventCardProps } from "./EventCard";
import {
  AppEvent,
  CombinedEvent,
  DebriefInfo,
  SpaceOccupancyItem,
  BOOKING_BADGE_COLORS,
  SPACE_STATUS_COLORS,
} from "./calendar-constants";

export interface DayPanelProps {
  selectedDate: Date;
  selectedDayEvents: CombinedEvent[];
  selectedDaySpace: SpaceOccupancyItem[];
  showSchedule: boolean;
  showSpace: boolean;
  gcalLoading: boolean;
  dayPanelRef: React.RefObject<HTMLDivElement>;
  // Foot traffic
  dailyFootTrafficValue: string;
  onFootTrafficChange: (value: string) => void;
  onSaveFootTraffic: () => void;
  dailyFTSaving: boolean;
  // Log activity
  onLogActivity: () => void;
  // Event card props passthrough
  appEvents: AppEvent[];
  programmes: any[];
  venues: Venue[];
  allBookings: Booking[];
  allContacts: Contact[];
  venueMap: Record<number, string>;
  dismissedEvents: { id: number; gcalEventId: string; reason: string }[];
  notPersonalIds: Set<string>;
  onLogDebrief: (gcal: GoogleCalendarEvent) => void;
  onLogDebriefFromApp: (app: AppEvent) => void;
  onDeleteEvent: (app: AppEvent) => void;
  onDismissEvent: (gcalId: string, reason: string) => void;
  onSkipDebrief: (eventId: number, reason: string) => Promise<void>;
  onMarkNotPersonal: (gcalId: string) => void;
  isDismissPending: boolean;
  isDebriefPending: boolean;
  getDebriefInfo: (entry: CombinedEvent) => DebriefInfo;
  onViewDebrief: (debriefId: number) => void;
  onRestore: (id: number) => void;
  onNavigate: (path: string) => void;
}

export function DayPanel({
  selectedDate,
  selectedDayEvents,
  selectedDaySpace,
  showSchedule,
  showSpace,
  gcalLoading,
  dayPanelRef,
  dailyFootTrafficValue,
  onFootTrafficChange,
  onSaveFootTraffic,
  dailyFTSaving,
  onLogActivity,
  appEvents,
  programmes,
  venues,
  allBookings,
  allContacts,
  venueMap,
  dismissedEvents,
  notPersonalIds,
  onLogDebrief,
  onLogDebriefFromApp,
  onDeleteEvent,
  onDismissEvent,
  onSkipDebrief,
  onMarkNotPersonal,
  isDismissPending,
  isDebriefPending,
  getDebriefInfo,
  onViewDebrief,
  onRestore,
  onNavigate,
}: DayPanelProps) {
  const footTrafficRow = (testIdSuffix: string = "") => (
    <div className="flex items-center gap-2 mt-1">
      <Footprints className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground whitespace-nowrap">Foot Traffic:</span>
      <Input
        type="number"
        className="w-20 min-h-[44px] md:min-h-0 md:h-8 text-sm"
        placeholder="0"
        value={dailyFootTrafficValue}
        onChange={e => onFootTrafficChange(e.target.value)}
        data-testid={`input-daily-foot-traffic${testIdSuffix}`}
      />
      <Button
        size="sm"
        className="min-h-[44px] md:min-h-0 md:h-8"
        onClick={onSaveFootTraffic}
        disabled={dailyFTSaving || dailyFootTrafficValue === ""}
        data-testid={`button-save-daily-foot-traffic${testIdSuffix}`}
      >
        {dailyFTSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );

  const logActivityButton = (testIdSuffix: string = "") => (
    <Button
      variant="outline"
      className="w-full border-dashed"
      onClick={onLogActivity}
      data-testid={`button-log-activity${testIdSuffix}`}
    >
      <Plus className="w-4 h-4 mr-2" />
      Log Activity
    </Button>
  );

  return (
    <div className="space-y-4" ref={dayPanelRef}>
      <h2 className="text-lg font-bold font-display" data-testid="text-selected-date">
        {format(selectedDate, "EEEE, MMM d")}
      </h2>

      {showSchedule && gcalLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (showSchedule && selectedDayEvents.length > 0) || (showSpace && selectedDaySpace.length > 0) ? (
        <div className="space-y-3">
          {showSchedule && selectedDayEvents.map((entry) => {
            const linkedBooking = entry.type === "app" && entry.app?.linkedBookingId
              ? (allBookings || []).find(b => Number(b.id) === Number(entry.app!.linkedBookingId))
              : null;
            const bookingToRender = (entry.type === "booking" && entry.booking) ? entry.booking : linkedBooking;

            return (
            <div key={entry.type === "gcal" ? `gcal-${entry.gcal!.id}` : `app-${entry.app!.id}`} className={`relative ${entry.isDismissed ? "opacity-40 hover:opacity-75 transition-opacity" : ""}`}>
              {entry.isDismissed && (
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    <EyeOff className="w-3 h-3 mr-1" />
                    Archived
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      const dismissed = (dismissedEvents || []).find(d => d.gcalEventId === entry.gcal?.id);
                      if (dismissed) onRestore(dismissed.id);
                    }}
                    data-testid={`button-restore-event-${entry.gcal?.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Restore
                  </Button>
                </div>
              )}
              <EventCard
                entry={entry}
                appEvents={appEvents || []}
                programmes={programmes || []}
                venueNames={(venues || []).filter((v: any) => v.active !== false).map((v: any) => v.name)}
                sourceBooking={bookingToRender || null}
                venueMap={venueMap}
                allContacts={(allContacts || []) as Contact[]}
                onLogDebrief={onLogDebrief}
                onLogDebriefFromApp={onLogDebriefFromApp}
                onDeleteEvent={onDeleteEvent}
                onDismissEvent={onDismissEvent}
                onSkipDebrief={onSkipDebrief}
                onMarkNotPersonal={onMarkNotPersonal}
                isDismissPending={isDismissPending}
                isDebriefPending={isDebriefPending}
                isMarkedNotPersonal={entry.gcal ? notPersonalIds.has(entry.gcal.id) : false}
                debriefInfo={getDebriefInfo(entry)}
                onViewDebrief={onViewDebrief}
              />
            </div>
            );
          })}
          {showSpace && selectedDaySpace.filter(item => {
            if (showSchedule && item.kind === "booking") {
              const shownAsSchedule = selectedDayEvents.some(e =>
                (e.type === "booking" && Number(e.booking?.id) === item.id) ||
                (e.type === "app" && Number(e.app?.linkedBookingId) === item.id)
              );
              if (shownAsSchedule) return false;
            }
            if (showSchedule && item.kind === "programme") {
              const shownAsSchedule = selectedDayEvents.some(e =>
                e.type === "app" && Number(e.app?.linkedProgrammeId) === item.id
              );
              if (shownAsSchedule) return false;
            }
            return true;
          }).map((item) => (
            <Card
              key={`${item.kind}-${item.id}`}
              className="p-4 border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/5 cursor-pointer overflow-visible hover-elevate"
              onClick={() => onNavigate(item.kind === "booking" ? "/spaces?tab=venue-hire" : "/programmes")}
              data-testid={`card-space-${item.kind}-${item.id}`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <Badge className={`text-xs shrink-0 ${BOOKING_BADGE_COLORS[item.classification] || ""}`}>
                    {item.classification}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {item.bookerName && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {item.bookerName}
                    </span>
                  )}
                  {item.startTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.startTime}{item.endTime ? ` - ${item.endTime}` : ""}
                    </span>
                  )}
                  {item.venue && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {item.venue}
                    </span>
                  )}
                  <Badge className={`text-[10px] ${item.kind === "programme" ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "bg-orange-500/10 text-orange-700 dark:text-orange-300"}`}>
                    {item.kind === "programme" ? "Programme" : "Venue Hire"}
                  </Badge>
                  <Badge className={`text-[10px] ${SPACE_STATUS_COLORS[item.status] || ""}`}>
                    {item.status}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
          {footTrafficRow()}
          {logActivityButton()}
        </div>
      ) : (
        <div className="space-y-3">
          <Card className="p-6">
            <div className="text-center text-muted-foreground text-sm">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No items on this day</p>
            </div>
          </Card>
          {footTrafficRow("-empty")}
          {logActivityButton("-empty")}
        </div>
      )}
    </div>
  );
}
