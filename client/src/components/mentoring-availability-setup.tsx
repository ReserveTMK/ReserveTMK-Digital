import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Zap } from "lucide-react";
import { formatTimeSlot } from "@/lib/utils";
import type { MentorAvailability, MentorProfile } from "@shared/schema";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];
const AVAIL_KEY = "/api/mentor-availability";

function getMentorBookingId(profile: MentorProfile): string {
  return profile.mentorUserId || `mentor-${profile.id}`;
}

function useAllAvailabilityByCategory(profiles: MentorProfile[] | undefined, category: string) {
  return useQuery<MentorAvailability[]>({
    queryKey: [AVAIL_KEY, "all-mentors", category],
    queryFn: async () => {
      if (!profiles || profiles.length === 0) return [];
      const fetches = profiles.map(async (profile) => {
        const mentorId = getMentorBookingId(profile);
        const res = await fetch(`${AVAIL_KEY}?mentorUserId=${mentorId}&category=${category}`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      });
      const results = await Promise.all(fetches);
      return results.flat();
    },
    enabled: !!profiles && profiles.length > 0,
  });
}

function invalidateAvailability(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [AVAIL_KEY] });
}

export function AvailabilityDayToggles({ category = "mentoring" }: { category?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles, isLoading: profilesLoading } = useQuery<MentorProfile[]>({
    queryKey: ["/api/mentor-profiles"],
  });

  const { data: allAvailability, isLoading: availLoading } = useAllAvailabilityByCategory(profiles, category);

  const createSlot = useMutation({
    mutationFn: async (data: { userId: string; dayOfWeek: number }) => {
      const res = await apiRequest("POST", "/api/mentor-availability", {
        userId: data.userId,
        dayOfWeek: data.dayOfWeek,
        startTime: "09:00",
        endTime: "16:00",
        slotDuration: 30,
        bufferMinutes: 15,
        isActive: true,
        category,
      });
      return res.json();
    },
    onSuccess: () => invalidateAvailability(queryClient),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSlots = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/mentor-availability/${id}`)));
    },
    onSuccess: () => invalidateAvailability(queryClient),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const quickSetupMentor = useMutation({
    mutationFn: async (mentorUserId: string) => {
      const res = await apiRequest("POST", "/api/mentor-availability/quick-setup", {
        mentorUserId,
        startTime: "09:00",
        endTime: "16:00",
        category,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateAvailability(queryClient);
      toast({ title: "Availability set", description: "Mon\u2013Fri, 9am\u20134pm added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (profilesLoading || availLoading) {
    return <div className="flex justify-center py-8" data-testid="loading-availability"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground" data-testid="text-no-mentors">
        {category === "meeting"
          ? "No staff added yet. Add mentor profiles first to configure meeting availability."
          : "No mentors added yet. Add mentors in the Mentors tab first."}
      </div>
    );
  }

  const availability = allAvailability || [];
  const isPending = createSlot.isPending || deleteSlots.isPending;
  const sessionLabel = category === "meeting" ? "meetings" : "mentoring sessions";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" data-testid="text-availability-desc">
        Toggle which days each mentor is available for {sessionLabel}. Each active day defaults to 9am\u20134pm.
      </p>

      <div className="space-y-3">
        {profiles.map((profile) => {
          const mentorId = getMentorBookingId(profile);
          const mentorSlots = availability.filter(s => s.userId === mentorId);
          const hasAnySlots = mentorSlots.length > 0;

          return (
            <Card key={profile.id} className="p-3" data-testid={`avail-mentor-${profile.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate" data-testid={`text-mentor-name-${profile.id}`}>{profile.name}</span>
                  {!profile.isActive && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inactive</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {DAY_INITIALS.map((initial, dayIdx) => {
                    const daySlots = mentorSlots.filter(s => s.dayOfWeek === dayIdx);
                    const isActive = daySlots.length > 0 && daySlots.some(s => s.isActive);
                    const slot = daySlots[0];

                    return (
                      <Button
                        key={dayIdx}
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        disabled={isPending}
                        onClick={() => {
                          if (isActive && daySlots.length > 0) {
                            deleteSlots.mutate(daySlots.map(s => s.id));
                          } else {
                            createSlot.mutate({ userId: mentorId, dayOfWeek: dayIdx });
                          }
                        }}
                        className="h-8 w-8 p-0 text-xs font-medium"
                        title={`${DAY_NAMES[dayIdx]}${isActive && slot ? ` (${formatTimeSlot(slot.startTime)}\u2013${formatTimeSlot(slot.endTime)})` : ""}`}
                        data-testid={`toggle-day-${profile.id}-${dayIdx}`}
                      >
                        {initial}
                      </Button>
                    );
                  })}

                  {!hasAnySlots && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs ml-2"
                      onClick={() => quickSetupMentor.mutate(mentorId)}
                      disabled={quickSetupMentor.isPending}
                      data-testid={`button-quick-setup-${profile.id}`}
                    >
                      {quickSetupMentor.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Zap className="w-3 h-3 mr-1" />
                      )}
                      Mon\u2013Fri
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="text-availability-hint">
        For detailed time and slot configuration, use the Availability page in Settings.
      </p>
    </div>
  );
}

export { AvailabilityDayToggles as MentoringAvailabilitySetup };
