import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  Monitor,
  Calendar,
  Calendar as CalendarIcon,
  CalendarDays,
  Package,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import { useVenues, useBookableResources, useDeskAvailability, useDeskBookings } from "@/hooks/use-bookings";
import { useEvents } from "@/hooks/use-events";
import { useQuery } from "@tanstack/react-query";
import Bookings from "./bookings";
import ResourcesTab from "@/components/spaces/resources-tab";
import { ActivationsTab } from "@/components/spaces/space-use-tab";
// Bookers tab removed — lives at /bookers
import { SpacesFAB } from "@/components/spaces/quick-add-activation-dialog";
import { MonthlyReconcileDialog } from "@/components/spaces/monthly-reconcile-dialog";
import { RecurringBookingsTab } from "@/components/spaces/recurring-bookings-tab";
// Meeting type removed — spaces reads from events table

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const VENUE_HOURS = Array.from({ length: 24 }, (_, i) => i);

interface OperatingHoursEntry {
  dayOfWeek: string;
  openTime: string | null;
  closeTime: string | null;
  isStaffed: boolean;
}

function getDeskScheduleFromHours(opHours: OperatingHoursEntry[] | undefined) {
  const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const defaultStart = "09:00";
  const defaultEnd = "17:00";
  if (!opHours || opHours.length === 0) {
    return { days: defaultDays, startTime: defaultStart, endTime: defaultEnd };
  }
  const openDays = opHours.filter(h => h.isStaffed).map(h => h.dayOfWeek);
  const staffedEntries = opHours.filter(h => h.isStaffed && h.openTime && h.closeTime);
  const earliest = staffedEntries.length > 0
    ? staffedEntries.reduce((min, h) => h.openTime! < min ? h.openTime! : min, staffedEntries[0].openTime!)
    : defaultStart;
  const latest = staffedEntries.length > 0
    ? staffedEntries.reduce((max, h) => h.closeTime! > max ? h.closeTime! : max, staffedEntries[0].closeTime!)
    : defaultEnd;
  return { days: openDays.length > 0 ? openDays : defaultDays, startTime: earliest, endTime: latest };
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekDays(startDate: Date): Date[] {
  const dayOfWeek = startDate.getDay();
  const monday = addDays(startDate, dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function shortDay(date: Date): string {
  return date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric" });
}

function parseTime(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

type BookingBlock = { start: number; end: number; type: "venue_hire" | "internal" | "desk" };

function TimeSlotGrid({ bookingBlocks, hours = HOURS }: { bookingBlocks: BookingBlock[]; hours?: number[] }) {
  return (
    <div className="flex flex-1 min-w-0">
      {hours.map((hour) => {
        const venueBlock = bookingBlocks.find(
          (block) => block.type === "venue_hire" && block.start < hour + 1 && block.end > hour
        );
        const internalBlock = bookingBlocks.find(
          (block) => block.type === "internal" && block.start < hour + 1 && block.end > hour
        );
        const deskBlock = bookingBlocks.find(
          (block) => block.type === "desk" && block.start < hour + 1 && block.end > hour
        );
        const bgClass = venueBlock
          ? "bg-amber-200/60 dark:bg-amber-800/30"
          : internalBlock
          ? "bg-blue-200/60 dark:bg-blue-800/30"
          : deskBlock
          ? "bg-violet-200/60 dark:bg-violet-800/30"
          : "bg-emerald-100/60 dark:bg-emerald-900/20";
        const label = venueBlock ? "Venue Hire" : internalBlock ? "Internal" : deskBlock ? "Desk Booking" : "Available";
        return (
          <div
            key={hour}
            className={`flex-1 h-8 border-r border-border/40 last:border-r-0 ${bgClass}`}
            title={`${hour}:00 - ${label}`}
          />
        );
      })}
    </div>
  );
}

function TimeHeader({ hours = HOURS }: { hours?: number[] }) {
  return (
    <div className="flex">
      <div className="w-40 shrink-0" />
      <div className="flex flex-1 min-w-0">
        {hours.map((hour) => (
          <div
            key={hour}
            className="flex-1 text-[10px] text-muted-foreground text-center border-r border-border/40 last:border-r-0 overflow-hidden"
          >
            {hour % 2 === 0 ? `${hour}:00` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacesLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 border border-border/40" />
        <span className="text-xs text-muted-foreground">Available</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-amber-200/60 dark:bg-amber-800/30 border border-border/40" />
        <span className="text-xs text-muted-foreground">Venue Hire</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-blue-200/60 dark:bg-blue-800/30 border border-border/40" />
        <span className="text-xs text-muted-foreground">Internal</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-violet-200/60 dark:bg-violet-800/30 border border-border/40" />
        <span className="text-xs text-muted-foreground">Desk Booking</span>
      </div>
    </div>
  );
}

function SpacesCalendarTab({ initialDate, initialView }: { initialDate?: string; initialView?: "day" | "week" }) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialDate) {
      const d = new Date(initialDate + "T12:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [viewMode, setViewMode] = useState<"day" | "week">(initialView || "day");

  const dateStr = formatDate(currentDate);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const { data: operatingHoursData } = useQuery<OperatingHoursEntry[]>({
    queryKey: ['/api/operating-hours'],
  });
  const deskSchedule = useMemo(() => getDeskScheduleFromHours(operatingHoursData), [operatingHoursData]);
  const DESK_DAYS = deskSchedule.days;
  const DESK_START_HOUR = parseInt(deskSchedule.startTime.split(":")[0]);
  const DESK_END_HOUR = parseInt(deskSchedule.endTime.split(":")[0]);
  const DESK_HOURS = useMemo(() => Array.from({ length: DESK_END_HOUR - DESK_START_HOUR }, (_, i) => i + DESK_START_HOUR), [DESK_START_HOUR, DESK_END_HOUR]);

  const { data: venues, isLoading: venuesLoading } = useVenues();
  const { data: spaceEvents, isLoading: eventsLoading } = useEvents();
  const { data: deskResources, isLoading: desksLoading } = useBookableResources("hot_desking");
  const { data: deskAvailability, isLoading: deskAvailLoading } = useDeskAvailability(dateStr);

  const weekAvail0 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[0]) : "");
  const weekAvail1 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[1]) : "");
  const weekAvail2 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[2]) : "");
  const weekAvail3 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[3]) : "");
  const weekAvail4 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[4]) : "");
  const weekAvail5 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[5]) : "");
  const weekAvail6 = useDeskAvailability(viewMode === "week" ? formatDate(weekDays[6]) : "");
  const weekAvailData = [weekAvail0, weekAvail1, weekAvail2, weekAvail3, weekAvail4, weekAvail5, weekAvail6];

  const navigateDay = (direction: number) => {
    const step = viewMode === "week" ? 7 : 1;
    setCurrentDate(addDays(currentDate, direction * step));
  };

  const displayDate = viewMode === "day"
    ? currentDate.toLocaleDateString("en-NZ", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : (() => {
        const days = getWeekDays(currentDate);
        const start = days[0].toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
        const end = days[6].toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
        return `${start} \u2014 ${end}`;
      })();

  const activeVenues = (venues || []).filter((v) => v.active !== false);
  const activeDesks = (deskResources || []).filter((r) => r.active !== false);
  const isLoading = venuesLoading || eventsLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-base font-medium" data-testid="text-current-date">{displayDate}</p>
        <div className="flex items-center gap-2">
          <SpacesLegend />
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            size="icon"
            variant={viewMode === "day" ? "default" : "outline"}
            onClick={() => setViewMode("day")}
            data-testid="button-view-day"
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "week" ? "default" : "outline"}
            onClick={() => setViewMode("week")}
            data-testid="button-view-week"
          >
            <CalendarDays className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button size="icon" variant="outline" onClick={() => navigateDay(-1)} data-testid="button-prev-day">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())} data-testid="button-today">
            Today
          </Button>
          <Button size="icon" variant="outline" onClick={() => navigateDay(1)} data-testid="button-next-day">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <>
          {activeVenues.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Venues
              </h3>
              {viewMode === "week" ? (
                <Card>
                  <CardContent className="p-3 overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="flex">
                        <div className="w-40 shrink-0" />
                        <div className="flex flex-1 min-w-0">
                          {weekDays.map((day) => (
                            <div
                              key={day.toISOString()}
                              className={`flex-1 text-xs font-medium text-center py-1 ${
                                formatDate(day) === formatDate(new Date())
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {shortDay(day)}
                            </div>
                          ))}
                        </div>
                      </div>
                      {activeVenues.map((venue) => (
                        <div key={venue.id} className="flex items-center border-t border-border/40">
                          <div className="w-40 shrink-0 flex items-center gap-2 py-2 pr-2">
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate" data-testid={`text-venue-name-${venue.id}`}>{venue.name}</span>
                          </div>
                          <div className="flex flex-1 min-w-0">
                            {weekDays.map((day) => {
                              const dayStr = formatDate(day);
                              const dayEvents = (spaceEvents || []).filter(
                                (e: any) => e.venueId === venue.id && e.startTime && formatDate(new Date(e.startTime)) === dayStr && e.eventStatus !== "cancelled"
                              );
                              const dayVenueHires = dayEvents.filter((e: any) => e.type === "Venue Hire");
                              const dayInternal = dayEvents.filter((e: any) => e.type !== "Venue Hire");
                              const hasVenueHire = dayVenueHires.length > 0;
                              const hasInternal = dayInternal.length > 0;
                              const bgClass = hasVenueHire
                                ? "bg-amber-200/60 dark:bg-amber-800/30"
                                : hasInternal
                                ? "bg-blue-200/60 dark:bg-blue-800/30"
                                : "bg-emerald-100/60 dark:bg-emerald-900/20";
                              const total = dayEvents.length;
                              return (
                                <div
                                  key={day.toISOString()}
                                  className={`flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center ${bgClass}`}
                                  title={`${shortDay(day)} - ${hasVenueHire ? `${dayVenueHires.length} hire(s)` : hasInternal ? `${dayInternal.length} internal` : "Available"}`}
                                >
                                  {total > 0 && (
                                    <span className={`text-[10px] font-medium ${hasVenueHire ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"}`}>
                                      {total}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-3 overflow-x-auto">
                    <div className="min-w-[600px]">
                      <TimeHeader hours={VENUE_HOURS} />
                      {activeVenues.map((venue) => {
                        const dayEvents = (spaceEvents || []).filter(
                          (e: any) => e.venueId === venue.id && e.startTime && formatDate(new Date(e.startTime)) === dateStr && e.eventStatus !== "cancelled"
                        );
                        const blocks: BookingBlock[] = dayEvents.map((e: any) => {
                          const startStr = new Date(e.startTime).toTimeString().slice(0, 5);
                          const endStr = e.endTime ? new Date(e.endTime).toTimeString().slice(0, 5) : null;
                          const start = parseTime(startStr);
                          const end = endStr ? parseTime(endStr) : null;
                          if (start === null || end === null) return null;
                          return { start, end, type: e.type === "Venue Hire" ? "venue_hire" as const : "internal" as const };
                        }).filter(Boolean) as BookingBlock[];
                        return (
                          <div key={venue.id} className="flex items-center border-t border-border/40">
                            <div className="w-40 shrink-0 flex items-center gap-2 py-1 pr-2">
                              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" data-testid={`text-venue-name-${venue.id}`}>{venue.name}</p>
                                {venue.capacity && (
                                  <p className="text-[10px] text-muted-foreground">Cap: {venue.capacity}</p>
                                )}
                              </div>
                            </div>
                            <TimeSlotGrid bookingBlocks={blocks} hours={VENUE_HOURS} />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeDesks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                Desks
              </h3>
              {viewMode === "week" ? (
                <Card>
                  <CardContent className="p-3 overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="flex">
                        <div className="w-40 shrink-0" />
                        <div className="flex flex-1 min-w-0">
                          {weekDays.map((day) => {
                            const dayNameLower = day.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
                            const isDeskDay = DESK_DAYS.includes(dayNameLower);
                            return (
                              <div
                                key={day.toISOString()}
                                className={`flex-1 text-xs font-medium text-center py-1 ${
                                  !isDeskDay ? "text-muted-foreground/50" :
                                  formatDate(day) === formatDate(new Date()) ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {shortDay(day)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {activeDesks.map((desk) => (
                        <div key={desk.id} className="flex items-center border-t border-border/40">
                          <div className="w-40 shrink-0 flex items-center gap-2 py-2 pr-2">
                            <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate" data-testid={`text-desk-name-${desk.id}`}>{desk.name}</span>
                          </div>
                          <div className="flex flex-1 min-w-0">
                            {weekDays.map((day, dayIdx) => {
                              const dayNameLower = day.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
                              const isDeskDay = DESK_DAYS.includes(dayNameLower);
                              if (!isDeskDay) {
                                return (
                                  <div
                                    key={day.toISOString()}
                                    className="flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center bg-muted/40"
                                    title={`${shortDay(day)} - Closed`}
                                  >
                                    <span className="text-[10px] text-muted-foreground/60">Closed</span>
                                  </div>
                                );
                              }
                              const dayAvailData = weekAvailData[dayIdx]?.data || [];
                              const deskEntry = dayAvailData.find((a: any) => a.resourceId === desk.id);
                              const hasBooking = deskEntry ? !deskEntry.isAvailable : false;
                              return (
                                <div
                                  key={day.toISOString()}
                                  className={`flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center ${
                                    hasBooking ? "bg-violet-200/60 dark:bg-violet-800/30" : "bg-emerald-100/60 dark:bg-emerald-900/20"
                                  }`}
                                  title={`${shortDay(day)} - ${hasBooking ? "Booked" : "Available"}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (() => {
                const dayNameLower = currentDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
                const isDeskDay = DESK_DAYS.includes(dayNameLower);
                return (
                <Card>
                  <CardContent className="p-3 overflow-x-auto">
                    {!isDeskDay ? (
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground" data-testid="text-desks-closed">Desks are closed today. Check hot desking hours in Resources → Desks.</p>
                      </div>
                    ) : (
                    <div className="min-w-[600px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-muted-foreground">Available {deskSchedule.startTime} – {deskSchedule.endTime}</span>
                      </div>
                      <TimeHeader hours={DESK_HOURS} />
                      {activeDesks.map((desk) => {
                        const availability = (deskAvailability || []).find((a: any) => a.resourceId === desk.id);
                        const isBooked = availability ? !availability.isAvailable : false;
                        let blocks: BookingBlock[] = [];
                        if (isBooked) {
                          const bookingList = availability?.bookings || [];
                          const parsed = bookingList
                            .map((b: any) => {
                              const start = parseTime(b.startTime);
                              const end = parseTime(b.endTime);
                              if (start === null || end === null) return null;
                              return { start, end, type: "desk" as const };
                            })
                            .filter(Boolean) as BookingBlock[];
                          blocks = parsed.length > 0
                            ? parsed
                            : [{ start: DESK_HOURS[0], end: DESK_HOURS[DESK_HOURS.length - 1] + 1, type: "desk" as const }];
                        }
                        return (
                          <div key={desk.id} className="flex items-center border-t border-border/40">
                            <div className="w-40 shrink-0 flex items-center gap-2 py-1 pr-2">
                              <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" data-testid={`text-desk-name-${desk.id}`}>{desk.name}</p>
                                {desk.description && (
                                  <p className="text-[10px] text-muted-foreground truncate">{desk.description}</p>
                                )}
                              </div>
                            </div>
                            <TimeSlotGrid bookingBlocks={blocks} hours={DESK_HOURS} />
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </CardContent>
                </Card>
                );
              })()}
            </div>
          )}

          {activeVenues.length === 0 && activeDesks.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground" data-testid="text-no-spaces">No spaces or desks configured yet. Add them in Settings.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function HotDeskingTab() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateStr = formatDate(currentDate);

  const { data: operatingHoursData } = useQuery<OperatingHoursEntry[]>({
    queryKey: ['/api/operating-hours'],
  });
  const deskSchedule = useMemo(() => getDeskScheduleFromHours(operatingHoursData), [operatingHoursData]);
  const DESK_DAYS = deskSchedule.days;

  const { data: deskResources, isLoading: desksLoading } = useBookableResources("hot_desking");
  const { data: deskAvailability, isLoading: deskAvailLoading } = useDeskAvailability(dateStr);
  const { data: deskBookings } = useDeskBookings();

  const activeDesks = (deskResources || []).filter((r) => r.active !== false);

  const navigateDay = (direction: number) => {
    setCurrentDate(addDays(currentDate, direction));
  };

  const todayStr = formatDate(new Date());
  const upcomingBookings = (deskBookings || []).filter((b: any) => b.date >= todayStr && b.status !== "cancelled");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Desk Availability</h3>
          <p className="text-xs text-muted-foreground" data-testid="text-desk-hours-info">{formatTime12(deskSchedule.startTime)} – {formatTime12(deskSchedule.endTime)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => navigateDay(-1)} data-testid="button-desk-prev">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())} data-testid="button-desk-today">
            {currentDate.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}
          </Button>
          <Button size="icon" variant="outline" onClick={() => navigateDay(1)} data-testid="button-desk-next">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {(() => {
        const dayNameLower = currentDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        const isDeskDay = DESK_DAYS.includes(dayNameLower);

        if (desksLoading || deskAvailLoading) {
          return (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          );
        }

        if (activeDesks.length === 0) {
          return (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-desks">No desk resources configured</p>
            </Card>
          );
        }

        if (!isDeskDay) {
          return (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-desks-closed-hotdesking">Desks are closed today. Check hot desking hours in Resources → Desks.</p>
            </Card>
          );
        }

        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeDesks.map((desk) => {
              const availability = (deskAvailability || []).find((a: any) => a.resourceId === desk.id);
              const isAvailable = availability ? availability.isAvailable : true;
              return (
                <Card key={desk.id} className={`p-4 ${isAvailable ? "border-emerald-200 dark:border-emerald-800" : "border-destructive/30"}`} data-testid={`card-desk-${desk.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{desk.name}</span>
                    </div>
                    <Badge variant={isAvailable ? "secondary" : "destructive"} data-testid={`badge-desk-status-${desk.id}`}>
                      {isAvailable ? "Available" : "Booked"}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {upcomingBookings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Upcoming Desk Bookings</h3>
          <Card>
            <CardContent className="p-3">
              <div className="space-y-2">
                {upcomingBookings.slice(0, 10).map((booking: any) => {
                  const deskName = activeDesks.find(d => d.id === booking.resourceId)?.name || "Unknown";
                  return (
                    <div key={booking.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50" data-testid={`row-desk-booking-${booking.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm">{deskName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{booking.date}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const VALID_TABS = ["space-use", "venue-hire", "hot-desking", "resources"] as const;

function getTabFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") || "space-use";
  return (VALID_TABS as readonly string[]).includes(tab) ? tab : "space-use";
}

function getCalendarParamsFromUrl(): { date?: string; view?: "day" | "week" } {
  const params = new URLSearchParams(window.location.search);
  const date = params.get("date") || undefined;
  const view = params.get("view") as "day" | "week" | null;
  return { date, view: view === "week" ? "week" : view === "day" ? "day" : undefined };
}

function VenueHireSection({ onCreateReady }: { onCreateReady?: (open: () => void) => void }) {
  const [subTab, setSubTab] = useState<"bookings" | "recurring">("bookings");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setSubTab("bookings")}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${subTab === "bookings" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Bookings
        </button>
        <button
          type="button"
          onClick={() => setSubTab("recurring")}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${subTab === "recurring" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Recurring
        </button>
      </div>
      {subTab === "bookings" && <Bookings embedded onCreateReady={onCreateReady} />}
      {subTab === "recurring" && <RecurringBookingsTab />}
    </div>
  );
}

export default function SpacesPage() {
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [calendarParams, setCalendarParams] = useState(getCalendarParamsFromUrl);
  const [calendarKey, setCalendarKey] = useState(0);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const venueHireCreateRef = useRef<(() => void) | null>(null);
  // bookerAddRef removed — bookers tab moved to /bookers

  useEffect(() => {
    const params = getCalendarParamsFromUrl();
    const tab = getTabFromUrl();
    if (params.date) {
      setActiveTab("space-use");
      setCalendarParams(params);
      setCalendarKey(k => k + 1);
    } else {
      setActiveTab(tab);
    }
  }, [searchString]);

  const handleVenueHireReady = useCallback((fn: () => void) => { venueHireCreateRef.current = fn; }, []);
  // handleBookerAddReady removed

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const url = tab === "space-use" ? "/spaces" : `/spaces?tab=${tab}`;
    window.history.replaceState(null, "", url);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Spaces</h1>
          <p className="text-sm text-muted-foreground">Calendar, bookings, and desk availability</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReconcileOpen(true)}
          className="shrink-0 flex items-center gap-1.5"
        >
          <ClipboardCheck className="w-4 h-4" />
          Reconcile
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList data-testid="tabs-spaces" className="h-auto flex-wrap gap-y-1">
          <TabsTrigger value="space-use" data-testid="tab-space-use">
            <Calendar className="w-4 h-4 mr-1.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="venue-hire" data-testid="tab-venue-hire">
            <Building2 className="w-4 h-4 mr-1.5" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="hot-desking" data-testid="tab-hot-desking">
            <Monitor className="w-4 h-4 mr-1.5" />
            Desks
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Package className="w-4 h-4 mr-1.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="space-use">
          <ActivationsTab />
        </TabsContent>

        <TabsContent value="venue-hire">
          <VenueHireSection onCreateReady={handleVenueHireReady} />
        </TabsContent>

        <TabsContent value="hot-desking">
          <HotDeskingTab />
        </TabsContent>

        <TabsContent value="resources">
          <ResourcesTab />
        </TabsContent>
      </Tabs>

      {/* Floating action button — contextual per tab */}
      <SpacesFAB
        activeTab={activeTab}
        onVenueHireCreate={() => venueHireCreateRef.current?.()}
        onBookerAdd={() => {}}
      />

      {/* Monthly Reconcile dialog */}
      <MonthlyReconcileDialog open={reconcileOpen} onOpenChange={setReconcileOpen} />
    </div>
  );
}
