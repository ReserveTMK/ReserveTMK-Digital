import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Building2, Monitor, Wrench, CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import { useBookableResources, useDeskAvailability, useGearAvailability } from "@/hooks/use-bookings";
import { useBookings, useVenues } from "@/hooks/use-bookings";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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

function TimeSlotGrid({ bookingBlocks }: { bookingBlocks: Array<{ start: number; end: number }> }) {
  return (
    <div className="flex flex-1 min-w-0">
      {HOURS.map((hour) => {
        const isBooked = bookingBlocks.some(
          (block) => block.start < hour + 1 && block.end > hour
        );
        return (
          <div
            key={hour}
            className={`flex-1 h-8 border-r border-border/40 last:border-r-0 ${
              isBooked
                ? "bg-destructive/20 dark:bg-destructive/30"
                : "bg-emerald-100/60 dark:bg-emerald-900/20"
            }`}
            title={`${hour}:00 - ${isBooked ? "Booked" : "Available"}`}
          />
        );
      })}
    </div>
  );
}

function TimeHeader() {
  return (
    <div className="flex">
      <div className="w-40 shrink-0" />
      <div className="flex flex-1 min-w-0">
        {HOURS.map((hour) => (
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

function DayStatusRow({
  icon: Icon,
  name,
  description,
  statusLabel,
  isBooked,
  resourceId,
}: {
  icon: typeof Building2;
  name: string;
  description?: string | null;
  statusLabel: string;
  isBooked: boolean;
  resourceId: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate" data-testid={`text-resource-name-${resourceId}`}>{name}</p>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
      <Badge
        variant={isBooked ? "destructive" : "secondary"}
        data-testid={`badge-availability-${resourceId}`}
      >
        {statusLabel}
      </Badge>
    </div>
  );
}

function VenuesCalendar({ currentDate, viewMode }: { currentDate: Date; viewMode: "day" | "week" }) {
  const dateStr = formatDate(currentDate);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const { data: venues, isLoading: venuesLoading } = useVenues();
  const { data: bookings, isLoading: bookingsLoading } = useBookings();

  if (venuesLoading || bookingsLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const activeVenues = (venues || []).filter((v) => v.active !== false);

  if (activeVenues.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-venues">No venue resources configured</p>;
  }

  if (viewMode === "week") {
    return (
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
                  <span className="text-sm font-medium truncate" data-testid={`text-resource-name-${venue.id}`}>{venue.name}</span>
                </div>
                <div className="flex flex-1 min-w-0">
                  {weekDays.map((day) => {
                    const dayStr = formatDate(day);
                    const dayBookings = (bookings || []).filter(
                      (b) =>
                        (b.venueIds || (b.venueId ? [b.venueId] : [])).includes(venue.id) &&
                        b.startDate &&
                        formatDate(new Date(b.startDate)) === dayStr &&
                        b.status !== "cancelled"
                    );
                    const hasBooking = dayBookings.length > 0;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center ${
                          hasBooking
                            ? "bg-destructive/20 dark:bg-destructive/30"
                            : "bg-emerald-100/60 dark:bg-emerald-900/20"
                        }`}
                        title={`${shortDay(day)} - ${hasBooking ? `${dayBookings.length} venue hire(s)` : "Available"}`}
                      >
                        {hasBooking && (
                          <span className="text-[10px] font-medium text-destructive dark:text-red-300">
                            {dayBookings.length}
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
    );
  }

  return (
    <Card>
      <CardContent className="p-3 overflow-x-auto">
        <div className="min-w-[600px]">
          <TimeHeader />
          {activeVenues.map((venue) => {
            const dayBookings = (bookings || []).filter(
              (b) =>
                (b.venueIds || (b.venueId ? [b.venueId] : [])).includes(venue.id) &&
                b.startDate &&
                formatDate(new Date(b.startDate)) === dateStr &&
                b.status !== "cancelled"
            );
            const blocks = dayBookings
              .map((b) => {
                const start = parseTime(b.startTime);
                const end = parseTime(b.endTime);
                if (start === null || end === null) return null;
                return { start, end };
              })
              .filter(Boolean) as Array<{ start: number; end: number }>;

            return (
              <div key={venue.id} className="flex items-center border-t border-border/40">
                <div className="w-40 shrink-0 flex items-center gap-2 py-1 pr-2">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-resource-name-${venue.id}`}>{venue.name}</p>
                    {venue.capacity && (
                      <p className="text-[10px] text-muted-foreground">Cap: {venue.capacity}</p>
                    )}
                  </div>
                </div>
                <TimeSlotGrid bookingBlocks={blocks} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DesksCalendar({ currentDate, viewMode }: { currentDate: Date; viewMode: "day" | "week" }) {
  const dateStr = formatDate(currentDate);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const { data: deskResources, isLoading: desksLoading } = useBookableResources("hot_desking");
  const { data: deskAvailability, isLoading: deskAvailLoading } = useDeskAvailability(dateStr);

  const weekAvailQueries = weekDays.map((d) => formatDate(d));
  const weekAvail0 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[0] : "");
  const weekAvail1 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[1] : "");
  const weekAvail2 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[2] : "");
  const weekAvail3 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[3] : "");
  const weekAvail4 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[4] : "");
  const weekAvail5 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[5] : "");
  const weekAvail6 = useDeskAvailability(viewMode === "week" ? weekAvailQueries[6] : "");
  const weekAvailData = [weekAvail0, weekAvail1, weekAvail2, weekAvail3, weekAvail4, weekAvail5, weekAvail6];

  if (desksLoading || (viewMode === "day" && deskAvailLoading)) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const activeDesks = (deskResources || []).filter((r) => r.active !== false);

  if (activeDesks.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-desks">No desk resources configured</p>;
  }

  if (viewMode === "week") {
    return (
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
            {activeDesks.map((desk) => (
              <div key={desk.id} className="flex items-center border-t border-border/40">
                <div className="w-40 shrink-0 flex items-center gap-2 py-2 pr-2">
                  <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate" data-testid={`text-resource-name-${desk.id}`}>{desk.name}</span>
                </div>
                <div className="flex flex-1 min-w-0">
                  {weekDays.map((day, dayIdx) => {
                    const dayAvailData = weekAvailData[dayIdx]?.data || [];
                    const deskEntry = dayAvailData.find((a: any) => a.resourceId === desk.id);
                    const hasBooking = deskEntry ? !deskEntry.isAvailable : false;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center ${
                          hasBooking
                            ? "bg-destructive/20 dark:bg-destructive/30"
                            : "bg-emerald-100/60 dark:bg-emerald-900/20"
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
    );
  }

  return (
    <Card>
      <CardContent className="p-3 overflow-x-auto">
        <div className="min-w-[600px]">
          <TimeHeader />
          {activeDesks.map((desk) => {
            const availability = (deskAvailability || []).find((a: any) => a.resourceId === desk.id);
            const blocks = (availability?.bookings || [])
              .map((b: any) => {
                const start = parseTime(b.startTime);
                const end = parseTime(b.endTime);
                if (start === null || end === null) return null;
                return { start, end };
              })
              .filter(Boolean) as Array<{ start: number; end: number }>;

            return (
              <div key={desk.id} className="flex items-center border-t border-border/40">
                <div className="w-40 shrink-0 flex items-center gap-2 py-1 pr-2">
                  <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-resource-name-${desk.id}`}>{desk.name}</p>
                    {desk.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{desk.description}</p>
                    )}
                  </div>
                </div>
                <TimeSlotGrid bookingBlocks={blocks} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function GearCalendar({ currentDate, viewMode }: { currentDate: Date; viewMode: "day" | "week" }) {
  const dateStr = formatDate(currentDate);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const { data: gearResources, isLoading: gearLoading } = useBookableResources("gear");
  const { data: gearAvailability, isLoading: gearAvailLoading } = useGearAvailability(dateStr);

  const weekAvailQueries = weekDays.map((d) => formatDate(d));
  const weekAvail0 = useGearAvailability(viewMode === "week" ? weekAvailQueries[0] : "");
  const weekAvail1 = useGearAvailability(viewMode === "week" ? weekAvailQueries[1] : "");
  const weekAvail2 = useGearAvailability(viewMode === "week" ? weekAvailQueries[2] : "");
  const weekAvail3 = useGearAvailability(viewMode === "week" ? weekAvailQueries[3] : "");
  const weekAvail4 = useGearAvailability(viewMode === "week" ? weekAvailQueries[4] : "");
  const weekAvail5 = useGearAvailability(viewMode === "week" ? weekAvailQueries[5] : "");
  const weekAvail6 = useGearAvailability(viewMode === "week" ? weekAvailQueries[6] : "");
  const weekAvailData = [weekAvail0, weekAvail1, weekAvail2, weekAvail3, weekAvail4, weekAvail5, weekAvail6];

  if (gearLoading || (viewMode === "day" && gearAvailLoading)) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const activeGear = (gearResources || []).filter((r) => r.active !== false);

  if (activeGear.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-gear">No gear resources configured</p>;
  }

  if (viewMode === "week") {
    return (
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
            {activeGear.map((item) => (
              <div key={item.id} className="flex items-center border-t border-border/40">
                <div className="w-40 shrink-0 flex items-center gap-2 py-2 pr-2">
                  <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block" data-testid={`text-resource-name-${item.id}`}>{item.name}</span>
                    {item.requiresApproval && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">Approval req.</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 min-w-0">
                  {weekDays.map((day, dayIdx) => {
                    const dayAvailData = weekAvailData[dayIdx]?.data || [];
                    const gearEntry = dayAvailData.find((a: any) => a.resourceId === item.id);
                    const isCheckedOut = gearEntry ? !gearEntry.isAvailable : false;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex-1 h-10 border-r border-border/40 last:border-r-0 flex items-center justify-center ${
                          isCheckedOut
                            ? "bg-destructive/20 dark:bg-destructive/30"
                            : "bg-emerald-100/60 dark:bg-emerald-900/20"
                        }`}
                        title={`${shortDay(day)} - ${isCheckedOut ? "Checked Out" : "Available"}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="space-y-0">
          {activeGear.map((item) => {
            const availability = (gearAvailability || []).find((a: any) => a.resourceId === item.id);
            const isCheckedOut = availability ? !availability.isAvailable : false;
            const bookingStatus = availability?.bookings?.[0]?.status;
            const isLate = bookingStatus === "late";

            return (
              <div key={item.id} className="border-b border-border/40 last:border-b-0">
                <DayStatusRow
                  icon={Wrench}
                  name={item.name}
                  description={item.requiresApproval ? "Requires approval" : item.description}
                  statusLabel={isLate ? "Late Return" : isCheckedOut ? "Checked Out" : "Available"}
                  isBooked={isCheckedOut}
                  resourceId={item.id}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 border border-border/40" />
        <span className="text-xs text-muted-foreground">Available</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-destructive/20 dark:bg-destructive/30 border border-border/40" />
        <span className="text-xs text-muted-foreground">Booked</span>
      </div>
    </div>
  );
}

function ResourceCalendarPage() {
  const [activeTab, setActiveTab] = useState("venues");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Resource Calendar</h1>
          <p className="text-sm text-muted-foreground">View availability across venues, desks, and gear</p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-base font-medium" data-testid="text-current-date">{displayDate}</p>
        <Legend />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="venues" data-testid="tab-venues">
            <Building2 className="w-4 h-4 mr-1.5" />
            Venues
          </TabsTrigger>
          <TabsTrigger value="desks" data-testid="tab-desks">
            <Monitor className="w-4 h-4 mr-1.5" />
            Desks
          </TabsTrigger>
          <TabsTrigger value="gear" data-testid="tab-gear">
            <Wrench className="w-4 h-4 mr-1.5" />
            Gear
          </TabsTrigger>
        </TabsList>

        <TabsContent value="venues">
          <VenuesCalendar currentDate={currentDate} viewMode={viewMode} />
        </TabsContent>

        <TabsContent value="desks">
          <DesksCalendar currentDate={currentDate} viewMode={viewMode} />
        </TabsContent>

        <TabsContent value="gear">
          <GearCalendar currentDate={currentDate} viewMode={viewMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ResourceCalendarPage;
