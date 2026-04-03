import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import {
  Clock,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Building2,
} from "lucide-react";
import type { Contact, Booking } from "@shared/schema";
import { EVENT_TYPE_BADGE_COLORS, BOOKING_CARD_COLORS } from "./calendar-constants";

export interface BookingCalendarCardProps {
  booking: Booking;
  venueMap: Record<number, string>;
  allContacts: Contact[];
  debriefStatus?: "none" | "draft" | "confirmed" | null;
  onLogDebrief?: (booking: Booking) => void;
  onViewDebrief?: (booking: Booking) => void;
  onSkipDebrief?: (booking: Booking) => void;
  isSkipped?: boolean;
}

export function BookingCalendarCard({ booking, venueMap, allContacts, debriefStatus, onLogDebrief, onViewDebrief, onSkipDebrief, isSkipped }: BookingCalendarCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState<string>(booking.attendeeCount?.toString() || "");
  const [rangatahiCount, setRangatahiCount] = useState<string>(booking.rangatahiCount?.toString() || "");
  const [isRangatahi, setIsRangatahi] = useState<boolean>(booking.isRangatahi || false);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [taggedIds, setTaggedIds] = useState<number[]>(booking.attendees || []);
  const { toast } = useToast();

  useEffect(() => {
    setAttendeeCount(booking.attendeeCount?.toString() || "");
    setRangatahiCount(booking.rangatahiCount?.toString() || "");
    setIsRangatahi(booking.isRangatahi || false);
    setTaggedIds(booking.attendees || []);
  }, [booking]);

  const attendanceMutation = useMutation({
    mutationFn: async (data: { attendeeCount?: number | null; rangatahiCount?: number | null; attendees?: number[]; isRangatahi?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${booking.id}/attendance`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save attendance", description: err.message, variant: "destructive" });
    },
  });

  const saveAttendance = () => {
    const parsedAttendee = attendeeCount ? parseInt(attendeeCount, 10) : null;
    const parsedRangatahi = rangatahiCount ? parseInt(rangatahiCount, 10) : null;
    attendanceMutation.mutate({
      attendeeCount: parsedAttendee !== null && !isNaN(parsedAttendee) ? parsedAttendee : null,
      rangatahiCount: parsedRangatahi !== null && !isNaN(parsedRangatahi) ? parsedRangatahi : null,
      attendees: taggedIds,
      isRangatahi,
    });
  };

  const toggleRangatahi = () => {
    const next = !isRangatahi;
    setIsRangatahi(next);
    const parsedAttendee = attendeeCount ? parseInt(attendeeCount, 10) : null;
    const parsedRangatahi = rangatahiCount ? parseInt(rangatahiCount, 10) : null;
    attendanceMutation.mutate({
      isRangatahi: next,
      attendeeCount: parsedAttendee !== null && !isNaN(parsedAttendee) ? parsedAttendee : null,
      rangatahiCount: parsedRangatahi !== null && !isNaN(parsedRangatahi) ? parsedRangatahi : null,
      attendees: taggedIds,
    });
  };

  const addAttendee = (contactId: number) => {
    if (taggedIds.includes(contactId)) return;
    const next = [...taggedIds, contactId];
    setTaggedIds(next);
    setAttendeeSearch("");
    attendanceMutation.mutate({ attendees: next });
  };

  const removeAttendee = (contactId: number) => {
    const next = taggedIds.filter(id => id !== contactId);
    setTaggedIds(next);
    attendanceMutation.mutate({ attendees: next });
  };

  const filteredContacts = useMemo(() => {
    if (!attendeeSearch.trim()) return [];
    const q = attendeeSearch.toLowerCase();
    return allContacts.filter(c => c.name?.toLowerCase().includes(q) && !taggedIds.includes(c.id)).slice(0, 8);
  }, [attendeeSearch, allContacts, taggedIds]);

  const bookingVIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
  const venueName = bookingVIds.map((id: number) => venueMap[id]).filter(Boolean).join(" + ") || null;
  const defaultCardColor = BOOKING_CARD_COLORS[booking.classification] || BOOKING_CARD_COLORS["Other"];

  const cardColor = debriefStatus === "confirmed"
    ? "border-green-500/20 bg-green-500/5"
    : debriefStatus === "draft"
    ? "border-blue-500/20 bg-blue-500/5"
    : defaultCardColor;
  const cardOpacity = debriefStatus === "confirmed"
    ? "opacity-50 hover:opacity-75 transition-opacity"
    : debriefStatus === "draft"
    ? "opacity-70 hover:opacity-90 transition-opacity"
    : isSkipped ? "opacity-40 hover:opacity-75 transition-opacity" : "";

  return (
    <Card
      className={`p-4 overflow-visible ${cardColor} ${cardOpacity}`}
      data-testid={`card-booking-calendar-${booking.id}`}
    >
      <div
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-booking-${booking.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{(booking as any).displayName || booking.title || booking.classification || "Untitled booking"}</h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              {(booking.bookerName || booking.bookerId) && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {booking.bookerName || allContacts.find(c => c.id === booking.bookerId)?.name || (booking as any).displayName || booking.classification || "Venue Hire"}
                </span>
              )}
              {booking.startTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {booking.startTime}{booking.endTime ? ` - ${booking.endTime}` : ""}
                </span>
              )}
              {venueName && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {venueName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isRangatahi && (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Rangatahi</Badge>
            )}
            <Badge className={`text-[10px] ${EVENT_TYPE_BADGE_COLORS["Venue Hire"] || ""}`}>
              Venue Hire
            </Badge>
            <Badge className={`text-[10px] ${booking.status === "completed" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-blue-500/10 text-blue-700 dark:text-blue-300"}`}>
              {booking.status}
            </Badge>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
        {!expanded && (taggedIds.length > 0 || booking.attendeeCount) && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            {booking.attendeeCount ? `${booking.attendeeCount} attendees` : ""}
            {taggedIds.length > 0 ? `${booking.attendeeCount ? " / " : ""}${taggedIds.length} tagged` : ""}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <button
              onClick={toggleRangatahi}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors ${isRangatahi ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:bg-muted"}`}
              data-testid={`toggle-rangatahi-${booking.id}`}
            >
              <Users className="w-3.5 h-3.5" />
              {isRangatahi ? "Rangatahi Event" : "Mark as Rangatahi"}
            </button>
            {attendanceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div className={`grid ${isRangatahi ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
            <div>
              <Label className="text-xs text-muted-foreground">Head Count</Label>
              <Input
                type="number"
                placeholder="0"
                value={attendeeCount}
                onChange={e => setAttendeeCount(e.target.value)}
                onBlur={saveAttendance}
                className="h-8 text-sm"
                data-testid={`input-attendee-count-${booking.id}`}
              />
            </div>
            {isRangatahi && (
            <div>
              <Label className="text-xs text-muted-foreground">Rangatahi Count</Label>
              <Input
                type="number"
                placeholder="0"
                value={rangatahiCount}
                onChange={e => setRangatahiCount(e.target.value)}
                onBlur={saveAttendance}
                className="h-8 text-sm"
                data-testid={`input-rangatahi-count-${booking.id}`}
              />
            </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); onSkipDebrief?.(booking); }}>
              <EyeOff className="w-3.5 h-3.5 mr-1" />
              Archive
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
