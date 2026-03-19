import { getAgreementAllowanceUsage, getPeriodLabel } from "@/lib/utils";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useVenues, useBookings, useLocationInstructions } from "@/hooks/use-bookings";
import { useContacts } from "@/hooks/use-contacts";
import { useMemberships, useMous } from "@/hooks/use-memberships";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  MapPin,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  Loader2,
  CircleDashed,
  Ban,
  FileText,
  Mail,
  Package,
  Star,
  Eye,
  AlertCircle,
  Moon,
  Receipt,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import type { Booking, Contact, Venue, RegularBooker, Survey, VenueInstruction } from "@shared/schema";
import { INSTRUCTION_TYPES } from "@shared/schema";

const STATUS_BADGE_STYLES: Record<string, string> = {
  enquiry: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  cancelled: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  enquiry: "Enquiry",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRICING_LABELS: Record<string, string> = {
  full_price: "Full Price",
  discounted: "Discounted",
  free_koha: "Free / Koha",
};

const DURATION_LABELS: Record<string, string> = {
  hourly: "Hourly",
  half_day: "Half Day",
  full_day: "Full Day",
};

function formatTimeSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function BookingDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const bookingId = parseInt(params.id || "0");

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [surveyResponseOpen, setSurveyResponseOpen] = useState(false);

  const { data: booking, isLoading: bookingLoading } = useQuery<Booking>({
    queryKey: ['/api/bookings', bookingId],
    enabled: bookingId > 0,
  });

  const { data: venues } = useVenues();
  const { data: contacts } = useContacts();
  const { data: allMemberships } = useMemberships();
  const { data: allMous } = useMous();
  const { data: allBookings } = useBookings();

  const { data: regularBooker } = useQuery<RegularBooker | null>({
    queryKey: ['/api/regular-bookers/by-contact', booking?.bookerId],
    enabled: !!booking?.bookerId,
  });

  const { data: survey } = useQuery<Survey | null>({
    queryKey: ['/api/bookings', bookingId, 'survey'],
    enabled: bookingId > 0,
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/bookings/${bookingId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: "Venue Hire Accepted", description: "Venue hire has been confirmed and confirmation email sent." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (reason: string) => apiRequest('POST', `/api/bookings/${bookingId}/decline`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setDeclineOpen(false);
      setDeclineReason("");
      toast({ title: "Venue Hire Declined", description: "Venue hire has been cancelled." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/bookings/${bookingId}/complete`),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', bookingId, 'survey'] });
      toast({
        title: "Venue Hire Completed",
        description: data.surveyDecision || "Venue hire marked as completed.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/bookings/${bookingId}/resend-confirmation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: "Sent", description: "Confirmation email resent successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendInstructionsMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/bookings/${bookingId}/send-instructions`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: "Sent", description: "Venue instructions sent successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendSurveyMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/bookings/${bookingId}/send-survey`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', bookingId, 'survey'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: "Survey Sent", description: "Post-venue hire survey has been sent." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (bookingLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2" data-testid="text-booking-not-found">Venue Hire Not Found</h2>
            <p className="text-muted-foreground mb-4">This venue hire doesn't exist or you don't have access to it.</p>
            <Button onClick={() => setLocation("/spaces?tab=venue-hire")} data-testid="button-back-bookings">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Venue Hire
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  const bookingVenueIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
  const bookingVenues = venues?.filter((v: Venue) => bookingVenueIds.includes(v.id)) || [];
  const venue = bookingVenues[0];

  const allSpaceNames = useMemo(() => {
    if (!venues) return [];
    const names = new Set<string>();
    for (const v of venues) {
      if (v.spaceName) names.add(v.spaceName);
    }
    return Array.from(names).sort();
  }, [venues]);

  const venueSpaceNames = useMemo(() => {
    const names = new Set<string>();
    for (const v of bookingVenues) {
      if (v.spaceName) names.add(v.spaceName);
    }
    return Array.from(names);
  }, [bookingVenues]);
  const bookerContact = booking.bookerId ? contacts?.find((c: Contact) => c.id === booking.bookerId) : null;

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return null;
    return format(new Date(d), "d MMM yyyy");
  };

  const amount = parseFloat(booking.amount || "0");
  const discountPct = parseFloat(booking.discountPercentage || "0");
  const discountAmt = parseFloat(booking.discountAmount || "0");

  const StatusIcon = booking.status === "enquiry" ? CircleDashed
    : booking.status === "confirmed" ? CheckCircle2
    : booking.status === "completed" ? CheckCircle2
    : Ban;

  return (
    <>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/spaces?tab=venue-hire")} data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-display font-bold" data-testid="text-booking-header">
                  {booking.title || bookingVenues.map(v => v.name).join(" + ") || "Venue Hire"}
                </h1>
                <Badge className={STATUS_BADGE_STYLES[booking.status] || ""} data-testid="badge-booking-status">
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {STATUS_LABELS[booking.status] || booking.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Venue Hire #{booking.id}
                {booking.createdAt && ` — Created ${formatDate(booking.createdAt)}`}
              </p>
            </div>
          </div>

          {booking.status === "enquiry" && (
            <Card className="p-4 border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm" data-testid="text-action-required">Action Required</h3>
                  <p className="text-sm text-muted-foreground">This venue hire enquiry is awaiting your decision.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setDeclineOpen(true)}
                    disabled={declineMutation.isPending}
                    data-testid="button-decline-booking"
                  >
                    {declineMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Decline
                  </Button>
                  <Button
                    onClick={() => acceptMutation.mutate()}
                    disabled={acceptMutation.isPending}
                    data-testid="button-accept-booking"
                  >
                    {acceptMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Accept Venue Hire
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {booking.status === "confirmed" && (
            <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm" data-testid="text-confirmed-status">Venue Hire Confirmed</h3>
                  <p className="text-sm text-muted-foreground">
                    {booking.confirmationSent ? "Confirmation email has been sent." : "Confirmation email not yet sent."}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending}
                    data-testid="button-resend-confirmation"
                  >
                    {resendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Resend Confirmation
                  </Button>
                  <Button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    data-testid="button-complete-booking"
                  >
                    {completeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Mark as Completed
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {booking.status === "confirmed" && (
            <Card className="p-4 border-gray-200 dark:border-gray-800">
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm flex items-center gap-2" data-testid="text-instructions-status">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Booking Reminder
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {booking.autoInstructionsSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-green-600" />
                          Reminder sent {booking.autoInstructionsSentAt ? `on ${format(new Date(booking.autoInstructionsSentAt), "d MMM, h:mm a")}` : ""}
                        </>
                      ) : (
                        "Location instructions will be included with the booking reminder"
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendInstructionsMutation.mutate()}
                    disabled={sendInstructionsMutation.isPending}
                    data-testid="button-send-instructions"
                  >
                    {sendInstructionsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : booking.autoInstructionsSent ? (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {booking.autoInstructionsSent ? "Resend Instructions" : "Send Instructions Now"}
                  </Button>
                </div>

                {allSpaceNames.length > 0 && (
                  <LocationAccessControl
                    bookingId={booking.id}
                    allSpaceNames={allSpaceNames}
                    defaultSpaceNames={venueSpaceNames}
                    currentAccess={booking.locationAccess as string[] | null}
                  />
                )}
              </div>
            </Card>
          )}

          {(booking.status === "confirmed" || booking.status === "completed") && (
            <BookerAccessInfoCard bookingId={booking.id} />
          )}

          {(booking.status === "confirmed" || booking.status === "completed") && (
            <XeroInvoiceCard booking={booking} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-details">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Venue Hire Details
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Venue</span>
                  <span className="font-medium flex items-center gap-1" data-testid="text-venue-name">
                    <MapPin className="w-3 h-3" />
                    {bookingVenues.map(v => v.name).join(" + ") || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Classification</span>
                  <Badge variant="outline" data-testid="text-classification">{booking.classification}</Badge>
                </div>
                {booking.startDate && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium" data-testid="text-booking-date">
                      {formatDate(booking.startDate)}
                      {booking.endDate && booking.isMultiDay && ` — ${formatDate(booking.endDate)}`}
                    </span>
                  </div>
                )}
                {booking.tbcMonth && booking.tbcYear && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium" data-testid="text-booking-tbc-date">TBC — {booking.tbcMonth} {booking.tbcYear}</span>
                  </div>
                )}
                {booking.startTime && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium flex items-center gap-1" data-testid="text-booking-time">
                      <Clock className="w-3 h-3" />
                      {formatTimeSlot(booking.startTime)}
                      {booking.endTime && ` — ${formatTimeSlot(booking.endTime)}`}
                    </span>
                  </div>
                )}
                {booking.durationType && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Duration Type</span>
                    <span className="font-medium" data-testid="text-duration-type">{DURATION_LABELS[booking.durationType] || booking.durationType}</span>
                  </div>
                )}
                {booking.attendeeCount && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Attendees</span>
                    <span className="font-medium" data-testid="text-attendee-count">{booking.attendeeCount}</span>
                  </div>
                )}
                {booking.bookingSource && booking.bookingSource !== "manual" && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Source</span>
                    <Badge variant="outline" data-testid="text-booking-source">{booking.bookingSource}</Badge>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-client">
                <Users className="w-4 h-4 text-muted-foreground" />
                Client Information
              </h2>
              <div className="space-y-3 text-sm">
                {bookerContact ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Contact</span>
                      <span className="font-medium" data-testid="text-booker-name">{bookerContact.name}</span>
                    </div>
                    {bookerContact.email && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium" data-testid="text-booker-email">{bookerContact.email}</span>
                      </div>
                    )}
                    {bookerContact.phone && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium" data-testid="text-booker-phone">{bookerContact.phone}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground italic" data-testid="text-no-booker">No booker contact assigned</p>
                )}
                {regularBooker && (
                  <>
                    <div className="border-t border-border pt-3 mt-3">
                      <Badge variant="outline" className="mb-2 bg-blue-500/10 text-blue-700 dark:text-blue-300" data-testid="badge-regular-booker">
                        Regular Booker
                      </Badge>
                    </div>
                    {regularBooker.organizationName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Organization</span>
                        <span className="font-medium" data-testid="text-org-name">{regularBooker.organizationName}</span>
                      </div>
                    )}
                    {!(regularBooker.membershipId || regularBooker.mouId) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Pricing Tier</span>
                        <Badge variant="secondary" data-testid="text-booker-tier">
                          {PRICING_LABELS[regularBooker.pricingTier] || regularBooker.pricingTier}
                        </Badge>
                      </div>
                    )}
                  </>
                )}
                {(() => {
                  const bookingMembershipId = booking?.membershipId;
                  const bookingMouId = booking?.mouId;
                  const bookerMembershipId = regularBooker?.membershipId;
                  const bookerMouId = regularBooker?.mouId;
                  const membershipId = bookingMembershipId || bookerMembershipId;
                  const mouId = bookingMouId || bookerMouId;
                  const membership = membershipId ? allMemberships?.find(m => m.id === membershipId) : null;
                  const mou = mouId ? allMous?.find(m => m.id === mouId) : null;
                  const isFromBooking = !!(bookingMembershipId || bookingMouId);
                  if (!membership && !mou) return null;
                  return (
                    <div className="border-t border-border pt-3 mt-3 space-y-2" data-testid="section-agreement-info">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">
                          {isFromBooking ? "Venue Hire Agreement" : "Booker's Agreement"}
                        </span>
                      </div>
                      {membership && (() => {
                        const period = membership.allowancePeriod || "quarterly";
                        const periodLabel = getPeriodLabel(period);
                        const used = getAgreementAllowanceUsage(allBookings, "membership", membership.id, period);
                        const remaining = membership.bookingAllowance ? Math.max(0, membership.bookingAllowance - used) : null;
                        return (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-xs space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">Membership</Badge>
                              <span className="font-medium">{membership.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Pricing:</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {membership.annualFee && parseFloat(membership.annualFee) > 0 ? "Per Membership" : "Free / Koha"}
                              </Badge>
                            </div>
                            {membership.annualFee && membership.standardValue && (
                              <p className="text-muted-foreground">
                                Fee: ${membership.annualFee} / year (standard: ${membership.standardValue})
                              </p>
                            )}
                            {membership.bookingAllowance ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Calendar className="w-3 h-3 text-blue-500" />
                                <span className="text-muted-foreground">
                                  {used}/{membership.bookingAllowance} used this {periodLabel}
                                </span>
                                {remaining !== null && (
                                  <Badge variant="secondary" className={`text-[10px] ${remaining === 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : ""}`}>
                                    {remaining} remaining
                                  </Badge>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                      {mou && (() => {
                        const period = mou.allowancePeriod || "quarterly";
                        const periodLabel = getPeriodLabel(period);
                        const used = getAgreementAllowanceUsage(allBookings, "mou", mou.id, period);
                        const remaining = mou.bookingAllowance ? Math.max(0, mou.bookingAllowance - used) : null;
                        return (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-xs space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">MOU</Badge>
                              <span className="font-medium">{mou.title}</span>
                            </div>
                            {mou.partnerName && (
                              <p className="text-muted-foreground">Partner: {mou.partnerName}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Pricing:</span>
                              <Badge variant="secondary" className="text-[10px]">Free / Koha (from MOU)</Badge>
                            </div>
                            {mou.bookingAllowance ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Calendar className="w-3 h-3 text-blue-500" />
                                <span className="text-muted-foreground">
                                  {used}/{mou.bookingAllowance} used this {periodLabel}
                                </span>
                                {remaining !== null && (
                                  <Badge variant="secondary" className={`text-[10px] ${remaining === 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : ""}`}>
                                    {remaining} remaining
                                  </Badge>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-pricing">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Pricing Breakdown
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Pricing Tier</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={booking.pricingTier === "full_price" ? "default" : booking.pricingTier === "discounted" ? "outline" : "secondary"}
                      className={booking.pricingTier === "free_koha" ? "bg-green-500/15 text-green-700 dark:text-green-300" : ""}
                      data-testid="badge-pricing-tier"
                    >
                      {PRICING_LABELS[booking.pricingTier] || booking.pricingTier}
                    </Badge>
                    {(booking.membershipId || booking.mouId) && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">via agreement</span>
                    )}
                  </div>
                </div>
                {booking.rateType && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Rate Type</span>
                    <span className="font-medium" data-testid="text-rate-type">
                      {booking.rateType === "community" ? "Community (20% off)" : "Standard"}
                    </span>
                  </div>
                )}
                {discountPct > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium text-green-600 dark:text-green-400" data-testid="text-discount">{discountPct}%</span>
                  </div>
                )}
                {discountAmt > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Discount Amount</span>
                    <span className="font-medium text-green-600 dark:text-green-400" data-testid="text-discount-amount">-${discountAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2 border-t border-border pt-2">
                  <span className="font-semibold">Total (excl. GST)</span>
                  <span className="font-bold text-base" data-testid="text-total-amount">${amount.toFixed(2)}</span>
                </div>
                {booking.usePackageCredit && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Package className="w-3 h-3" />
                    <span className="text-xs" data-testid="text-package-credit">Using package credit</span>
                  </div>
                )}
              </div>
            </Card>

            {regularBooker?.hasBookingPackage && !(regularBooker?.membershipId || regularBooker?.mouId) && (
              <Card className="p-5 space-y-4">
                <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-package">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  Venue Hire Package
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Total Venue Hires</span>
                    <span className="font-medium" data-testid="text-package-total">{regularBooker.packageTotalBookings || 0}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium" data-testid="text-package-used">{regularBooker.packageUsedBookings || 0}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-bold" data-testid="text-package-remaining">
                      {(regularBooker.packageTotalBookings || 0) - (regularBooker.packageUsedBookings || 0)}
                    </span>
                  </div>
                  {regularBooker.packageExpiresAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="font-medium" data-testid="text-package-expiry">{formatDate(regularBooker.packageExpiresAt)}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {booking.bookingSummary && (
            <Card className="p-5 space-y-2">
              <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-requests">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Tell Us About Your Booking
              </h2>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-booking-summary">{booking.bookingSummary}</p>
            </Card>
          )}

          {booking.notes && (
            <Card className="p-5 space-y-2">
              <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-notes">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Notes
              </h2>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">{booking.notes}</p>
            </Card>
          )}

          {booking.description && (
            <Card className="p-5 space-y-2">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Description
              </h2>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-description">{booking.description}</p>
            </Card>
          )}

          {booking.status === "completed" && (
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2" data-testid="text-section-survey">
                <Star className="w-4 h-4 text-muted-foreground" />
                Post-Venue Hire Survey
              </h2>
              {survey ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={survey.status === "completed" ? "default" : "outline"}
                      className={survey.status === "completed" ? "bg-green-500/15 text-green-700 dark:text-green-300" : ""}
                      data-testid="badge-survey-status"
                    >
                      {survey.status === "completed" ? "Completed" : survey.status === "sent" ? "Sent" : survey.status === "pending" ? "Pending" : "Expired"}
                    </Badge>
                  </div>
                  {survey.sentAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Sent At</span>
                      <span className="font-medium" data-testid="text-survey-sent">{formatDate(survey.sentAt)}</span>
                    </div>
                  )}
                  {survey.completedAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Completed At</span>
                      <span className="font-medium" data-testid="text-survey-completed">{formatDate(survey.completedAt)}</span>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {survey.status === "completed" && survey.responses && (
                      <Button
                        variant="outline"
                        onClick={() => setSurveyResponseOpen(true)}
                        data-testid="button-view-survey-response"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Response
                      </Button>
                    )}
                    {survey.status !== "completed" && bookerContact?.email && (
                      <Button
                        variant="outline"
                        onClick={() => sendSurveyMutation.mutate()}
                        disabled={sendSurveyMutation.isPending}
                        data-testid="button-resend-survey"
                      >
                        {sendSurveyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Resend Survey
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground" data-testid="text-no-survey">
                    {booking.postSurveySent === false && regularBooker
                      ? "Not sent (regular booker, not first venue hire)"
                      : "No survey has been sent for this venue hire."}
                  </p>
                  {bookerContact?.email && (
                    <Button
                      variant="outline"
                      onClick={() => sendSurveyMutation.mutate()}
                      disabled={sendSurveyMutation.isPending}
                      data-testid="button-send-survey"
                    >
                      {sendSurveyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send Survey Now
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {booking.status === "cancelled" && (
            <Card className="p-5 border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/10">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-sm" data-testid="text-cancelled-status">Venue Hire Cancelled</h3>
                  <p className="text-sm text-muted-foreground">This venue hire has been declined or cancelled.</p>
                </div>
              </div>
            </Card>
          )}

          {(booking.confirmedAt || booking.completedAt) && (
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Timeline
              </h2>
              <div className="space-y-2 text-sm">
                {booking.createdAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    Created on {formatDate(booking.createdAt)}
                  </div>
                )}
                {booking.confirmedAt && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Confirmed on {formatDate(booking.confirmedAt)}
                    {booking.confirmationSent && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Mail className="w-2.5 h-2.5 mr-0.5" />
                        Email sent
                      </Badge>
                    )}
                  </div>
                )}
                {booking.completedAt && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Completed on {formatDate(booking.completedAt)}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Venue Hire</DialogTitle>
            <DialogDescription>
              Provide a reason for declining this venue hire. The venue hire will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for declining (optional)"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="min-h-[80px]"
            data-testid="input-decline-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} data-testid="button-cancel-decline">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => declineMutation.mutate(declineReason)}
              disabled={declineMutation.isPending}
              data-testid="button-confirm-decline"
            >
              {declineMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Decline Venue Hire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={surveyResponseOpen} onOpenChange={setSurveyResponseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Survey Response</DialogTitle>
            <DialogDescription>
              Responses from the post-venue hire survey.
            </DialogDescription>
          </DialogHeader>
          {survey?.questions && survey?.responses && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {survey.questions.map((q) => {
                const response = survey.responses?.find((r) => r.questionId === q.id);
                return (
                  <div key={q.id} className="space-y-1">
                    <p className="text-sm font-medium" data-testid={`text-survey-question-${q.id}`}>{q.question}</p>
                    {response ? (
                      <div className="text-sm text-muted-foreground" data-testid={`text-survey-answer-${q.id}`}>
                        {q.type === "rating" ? (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: q.scale || 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < Number(response.answer) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                              />
                            ))}
                            <span className="ml-2">{String(response.answer)}/{q.scale || 5}</span>
                          </div>
                        ) : q.type === "yes_no" ? (
                          <span>{response.answer === true || response.answer === "true" ? "Yes" : "No"}</span>
                        ) : (
                          <p className="whitespace-pre-wrap">{String(response.answer)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No response</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  authorised: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  paid: "bg-green-500/15 text-green-700 dark:text-green-300",
  voided: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function XeroInvoiceCard({ booking }: { booking: Booking }) {
  const { toast } = useToast();

  const { data: xeroStatus } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/xero/status'],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bookings/${booking.id}/generate-invoice`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.skipped) {
        toast({ title: "No invoice needed", description: data.reason });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/bookings', booking.id] });
        toast({ title: "Invoice generated", description: `Invoice ${data.invoiceNumber} created in Xero` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate invoice", description: err.message, variant: "destructive" });
    },
  });

  if (!xeroStatus?.connected) return null;

  const amount = parseFloat(booking.amount || "0");
  const isSkipped = booking.pricingTier === "free_koha" || booking.usePackageCredit || amount <= 0;

  if (booking.xeroInvoiceId) {
    return (
      <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <h3 className="font-semibold text-sm flex items-center gap-2" data-testid="text-xero-invoice-heading">
              <Receipt className="w-4 h-4 text-blue-600" />
              Xero Invoice
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium" data-testid="text-xero-invoice-number">{booking.xeroInvoiceNumber}</span>
              {booking.xeroInvoiceStatus && (
                <Badge className={INVOICE_STATUS_STYLES[booking.xeroInvoiceStatus] || ""} data-testid="badge-xero-invoice-status">
                  {booking.xeroInvoiceStatus}
                </Badge>
              )}
            </div>
          </div>
          <a
            href={`https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${booking.xeroInvoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" data-testid="button-view-in-xero">
              <ExternalLink className="w-4 h-4 mr-2" />
              View in Xero
            </Button>
          </a>
        </div>
      </Card>
    );
  }

  if (isSkipped) {
    const reason = booking.pricingTier === "free_koha" ? "Koha / free venue hire"
      : booking.usePackageCredit ? "Package credit used"
      : "No charge amount";
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium" data-testid="text-no-invoice-needed">No invoice needed</p>
            <p className="text-xs text-muted-foreground">{reason}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            Xero Invoice
          </h3>
          <p className="text-sm text-muted-foreground">No invoice generated yet</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-invoice"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Receipt className="w-4 h-4 mr-2" />
          )}
          Generate Invoice
        </Button>
      </div>
    </Card>
  );
}

const BOOKER_ACCESS_LABELS: Record<string, string> = {
  access: "Access",
  opening: "Opening Procedure",
  closing: "Closing Procedure",
  emergency: "Emergency",
};

const BOOKER_ACCESS_COLORS: Record<string, string> = {
  access: "text-blue-700 dark:text-blue-300",
  opening: "text-green-700 dark:text-green-300",
  closing: "text-amber-700 dark:text-amber-300",
  emergency: "text-red-700 dark:text-red-300",
};

function BookerAccessInfoCard({ bookingId }: { bookingId: number }) {
  const { data: instructions, isLoading } = useQuery<VenueInstruction[]>({
    queryKey: ['/api/bookings', bookingId, 'instructions'],
    enabled: bookingId > 0,
  });

  const activeInstructions = instructions?.filter(i => i.isActive) || [];

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading access info...</span>
        </div>
      </Card>
    );
  }

  if (activeInstructions.length === 0) return null;

  const grouped: Record<string, VenueInstruction[]> = {};
  for (const inst of activeInstructions) {
    const key = inst.instructionType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(inst);
  }

  return (
    <Card className="p-5 space-y-4" data-testid="card-booker-access-info">
      <h3 className="font-semibold text-sm flex items-center gap-2" data-testid="text-booker-access-heading">
        <FileText className="w-4 h-4 text-muted-foreground" />
        Booker Access Info
      </h3>
      <div className="space-y-3">
        {INSTRUCTION_TYPES.map(type => {
          const typeInstructions = grouped[type];
          if (!typeInstructions || typeInstructions.length === 0) return null;
          return (
            <div key={type} className="space-y-1" data-testid={`booker-access-section-${type}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${BOOKER_ACCESS_COLORS[type] || "text-muted-foreground"}`}>
                {BOOKER_ACCESS_LABELS[type] || type}
              </p>
              {typeInstructions
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map(inst => (
                  <div key={inst.id} className="text-sm text-foreground" data-testid={`booker-access-item-${inst.id}`}>
                    {inst.title && <span className="font-medium">{inst.title}: </span>}
                    <span className="text-muted-foreground whitespace-pre-wrap">{inst.content}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LocationAccessControl({
  bookingId,
  allSpaceNames,
  defaultSpaceNames,
  currentAccess,
}: {
  bookingId: number;
  allSpaceNames: string[];
  defaultSpaceNames: string[];
  currentAccess: string[] | null;
}) {
  const { toast } = useToast();
  const effectiveAccess = currentAccess || defaultSpaceNames;
  const [selected, setSelected] = useState<string[]>(effectiveAccess);

  const updateMutation = useMutation({
    mutationFn: (locationAccess: string[]) =>
      apiRequest('PATCH', `/api/bookings/${bookingId}`, { locationAccess }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: "Updated", description: "Location access updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleToggle = (spaceName: string, checked: boolean) => {
    const next = checked
      ? [...selected, spaceName]
      : selected.filter(s => s !== spaceName);
    setSelected(next);
    updateMutation.mutate(next);
  };

  return (
    <div className="border-t pt-3">
      <p className="text-xs font-medium mb-2">Location Access</p>
      <p className="text-xs text-muted-foreground mb-2">Select which locations this booker has access to. Only instructions for selected locations will be sent.</p>
      <div className="space-y-2">
        {allSpaceNames.map(name => (
          <label key={name} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-location-access-${name.replace(/\s+/g, '-')}`}>
            <Checkbox
              checked={selected.includes(name)}
              onCheckedChange={(checked) => handleToggle(name, !!checked)}
              disabled={updateMutation.isPending}
            />
            <span className="text-sm">{name}</span>
            {defaultSpaceNames.includes(name) && (
              <Badge variant="secondary" className="text-[10px]">venue location</Badge>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
