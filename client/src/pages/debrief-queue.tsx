import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Clock,
  FileText,
  Loader2,
  SkipForward,
  Calendar,
  MapPin,
  Link2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Event } from "@shared/schema";

export default function DebriefQueuePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [skipDialogEvent, setSkipDialogEvent] = useState<Event | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const { data: queueEvents, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/needs-debrief"],
  });

  const skipMutation = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/skip-debrief`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      setSkipDialogEvent(null);
      setSkipReason("");
      toast({ title: "Debrief skipped", description: "Event removed from queue" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  function handleLogDebrief(event: Event) {
    navigate(`/debriefs?fromEvent=${event.id}`);
  }

  function getDaysSince(dateStr: string | Date) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-14 md:pt-0 pb-24 md:pb-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-queue-heading">
              Needs Debrief
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-queue-description">
              Past events linked to programmes that are waiting for a debrief to be logged.
            </p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!queueEvents || queueEvents.length === 0) && (
            <Card className="p-8 text-center" data-testid="card-empty-queue">
              <div className="space-y-2">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <h3 className="font-medium text-foreground">All caught up</h3>
                <p className="text-sm text-muted-foreground">
                  No events are waiting for debriefs. Events linked to programmes will appear here after they've taken place.
                </p>
              </div>
            </Card>
          )}

          {queueEvents && queueEvents.length > 0 && (
            <div className="space-y-3" data-testid="list-debrief-queue">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>{queueEvents.length} event{queueEvents.length !== 1 ? "s" : ""} awaiting debrief</span>
              </div>

              {queueEvents.map((event) => (
                <Card
                  key={event.id}
                  className="p-4 border-amber-500/20 bg-amber-500/5"
                  data-testid={`card-queue-event-${event.id}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm text-foreground" data-testid={`text-event-name-${event.id}`}>
                          {event.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(event.startTime), "EEE d MMM yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(event.startTime), "h:mm a")}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{event.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {event.type}
                        </Badge>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          {getDaysSince(event.startTime)}
                        </span>
                      </div>
                    </div>

                    {event.linkedProgrammeId && (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                        <Link2 className="w-3 h-3" />
                        <span>Linked to Programme #{event.linkedProgrammeId}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
                        onClick={() => handleLogDebrief(event)}
                        data-testid={`button-log-debrief-${event.id}`}
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        Log Debrief
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSkipDialogEvent(event);
                          setSkipReason("");
                        }}
                        data-testid={`button-skip-debrief-${event.id}`}
                      >
                        <SkipForward className="w-3.5 h-3.5 mr-1" />
                        Skip
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={!!skipDialogEvent} onOpenChange={(open) => !open && setSkipDialogEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skip Debrief</DialogTitle>
              <DialogDescription>
                Provide a reason for skipping the debrief for "{skipDialogEvent?.name}". This event will be removed from the queue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="text-sm">Reason (optional)</Label>
              <Textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g., Event was cancelled, Not relevant..."
                className="min-h-[80px]"
                data-testid="textarea-skip-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkipDialogEvent(null)} data-testid="button-cancel-skip">
                Cancel
              </Button>
              <Button
                onClick={() => skipDialogEvent && skipMutation.mutate({
                  eventId: skipDialogEvent.id,
                  reason: skipReason.trim() || "Skipped by user",
                })}
                disabled={skipMutation.isPending}
                data-testid="button-confirm-skip"
              >
                {skipMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Skip Debrief
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
