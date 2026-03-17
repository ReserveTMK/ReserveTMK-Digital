import { useState, useMemo, useEffect, useCallback } from "react";
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
  Calendar as CalendarIcon,
  CalendarDays,
  Package,
  UserCheck,
} from "lucide-react";
import { useBookings, useVenues, useBookableResources, useDeskAvailability, useDeskBookings } from "@/hooks/use-bookings";
import { useQuery } from "@tanstack/react-query";
import Bookings from "./bookings";
import ResourcesTab from "@/components/spaces/resources-tab";
import RegularBookersPage from "./regular-bookers";
import type { Meeting } from "@shared/schema";
import { DESK_AVAILABILITY } from "@shared/schema";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const VENUE_HOURS = Array.from({ length: 24 }, (_, i) => i);
const DESK_START_HOUR = parseInt(DESK_AVAILABILITY.startTime.split(":")[0]);
const DESK_END_HOUR = parseInt(DESK_AVAILABILITY.endTime.split(":")[0]);
const DESK_HOURS = Array.from({ length: DESK_END_HOUR - DESK_START_HOUR }, (_, i) => i + DESK_START_HOUR);
const DESK_DAYS = DESK_AVAILABILITY.days as readonly string[];

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
            className="flex-1 text-[10px] text-muted-foreground text-center border-r border-border/40 last:border-r-0"
          >
            {hour}:00
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

function SpacesCalendarTab() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  const dateStr = formatDate(currentDate);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const { data: venues, isLoading: venuesLoading } = useVenues();
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: deskResources, isLoading: desksLoading } = useBookableResources("hot_desking");
  const { data: deskAvailability, isLoading: deskAvailLoading } = useDeskAvailability(dateStr);

  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings', 'with-venue'],
    queryFn: async () => {
      const res = await fetch('/api/meetings?withVenue=true', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

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
  const isLoading = venuesLoading || bookingsLoading;

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
                              const dayBookings = (bookings || []).filter(
                                (b) => (b.venueIds || (b.venueId ? [b.venueId] : [])).includes(venue.id) && b.startDate && formatDate(new Date(b.startDate)) === dayStr && b.status !== "cancelled"
                              );
                              const dayMeetings = (meetings || []).filter(
                                (m: any) => m.venueId === venue.id && m.startTime && formatDate(new Date(m.startTime)) === dayStr && m.status !== "cancelled"
                              );
                              const hasVenueHire = dayBookings.length > 0;
                              const hasInternal = dayMeetings.length > 0;
                              const bgClass = hasVenueHire
                                ? "bg-amber-200/60 dark:bg-amber-800/30"
                                : hasInternal
                                ? "bg-blue-200/60 dark:bg-blue-800/30"
                                : "bg-emerald-100/60 dark:bg-emerald-900/20";
                              const total = dayBookings.length + dayMeetings.length;
                              return (
                                <div
                                  key={day.toISOString()}
                                  className={`flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center ${bgClass}`}
                                  title={`${shortDay(day)} - ${hasVenueHire ? `${dayBookings.length} hire(s)` : hasInternal ? `${dayMeetings.length} internal` : "Available"}`}
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
                        const dayBookings = (bookings || []).filter(
                          (b) => (b.venueIds || (b.venueId ? [b.venueId] : [])).includes(venue.id) && b.startDate && formatDate(new Date(b.startDate)) === dateStr && b.status !== "cancelled"
                        );
                        const dayMeetings = (meetings || []).filter(
                          (m: any) => m.venueId === venue.id && m.startTime && formatDate(new Date(m.startTime)) === dateStr && m.status !== "cancelled"
                        );
                        const blocks: BookingBlock[] = [
                          ...dayBookings.map((b) => {
                            const start = parseTime(b.startTime);
                            const end = parseTime(b.endTime);
                            if (start === null || end === null) return null;
                            return { start, end, type: "venue_hire" as const };
                          }).filter(Boolean) as BookingBlock[],
                          ...dayMeetings.map((m: any) => {
                            const start = m.startTime ? parseTime(new Date(m.startTime).toTimeString().slice(0, 5)) : null;
                            const end = m.endTime ? parseTime(new Date(m.endTime).toTimeString().slice(0, 5)) : null;
                            if (start === null || end === null) return null;
                            return { start, end, type: "internal" as const };
                          }).filter(Boolean) as BookingBlock[],
                        ];
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
                                  title={`${shortDay(day)} - ${hasBooking ? "Booked" : "Available (9am–3pm)"}`}
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
                        <p className="text-sm text-muted-foreground" data-testid="text-desks-closed">Desks are closed on weekends. Available Monday–Friday, 9am–3pm.</p>
                      </div>
                    ) : (
                    <div className="min-w-[600px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-muted-foreground">Available {DESK_AVAILABILITY.startTime} – {DESK_AVAILABILITY.endTime}</span>
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
          <p className="text-xs text-muted-foreground" data-testid="text-desk-hours-info">Mon–Fri, {DESK_AVAILABILITY.startTime} – {DESK_AVAILABILITY.endTime}</p>
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
              <p className="text-muted-foreground" data-testid="text-desks-closed-hotdesking">Desks are closed on weekends. Available Monday–Friday, 9am–3pm.</p>
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

const VALID_TABS = ["calendar", "venue-hire", "hot-desking", "resources", "bookers"] as const;

function getTabFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") || "calendar";
  return (VALID_TABS as readonly string[]).includes(tab) ? tab : "calendar";
}

export default function SpacesPage() {
  const [activeTab, setActiveTab] = useState(getTabFromUrl);

  useEffect(() => {
    setActiveTab(getTabFromUrl());
    const onPopState = () => setActiveTab(getTabFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const url = tab === "calendar" ? "/spaces" : `/spaces?tab=${tab}`;
    window.history.replaceState(null, "", url);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Spaces</h1>
        <p className="text-sm text-muted-foreground">Manage your spaces, venue hire, hot desking, resources, and regular bookers</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList data-testid="tabs-spaces">
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarIcon className="w-4 h-4 mr-1.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="venue-hire" data-testid="tab-venue-hire">
            <Building2 className="w-4 h-4 mr-1.5" />
            Venue Hire
          </TabsTrigger>
          <TabsTrigger value="hot-desking" data-testid="tab-hot-desking">
            <Monitor className="w-4 h-4 mr-1.5" />
            Hot Desking
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Package className="w-4 h-4 mr-1.5" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="bookers" data-testid="tab-bookers">
            <UserCheck className="w-4 h-4 mr-1.5" />
            Bookers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <SpacesCalendarTab />
        </TabsContent>

        <TabsContent value="venue-hire">
          <Bookings embedded />
        </TabsContent>

        <TabsContent value="hot-desking">
          <HotDeskingTab />
        </TabsContent>

        <TabsContent value="resources">
          <ResourcesTab />
        </TabsContent>

        <TabsContent value="bookers">
          <RegularBookersPage embedded categoryScope={["venue_hire", "hot_desking"]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
