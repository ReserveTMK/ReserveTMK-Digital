import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeSlot } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Clock,
  Users,
  Copy,
  ExternalLink,
  Trash2,
  CalendarCheck,
  CalendarX,
  Zap,
  Pencil,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { MentorAvailability, MentorProfile } from "@shared/schema";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getMentorBookingId(profile: MentorProfile): string {
  return profile.mentorUserId || `mentor-${profile.id}`;
}

function useMentorProfiles() {
  return useQuery<MentorProfile[]>({ queryKey: ["/api/mentor-profiles"] });
}

function useAvailability(mentorUserId?: string, category?: string) {
  const params = new URLSearchParams();
  if (mentorUserId) params.set("mentorUserId", mentorUserId);
  if (category) params.set("category", category);
  const url = `/api/mentor-availability${params.toString() ? `?${params.toString()}` : ""}`;
  return useQuery<MentorAvailability[]>({
    queryKey: ["/api/mentor-availability", mentorUserId || "self", category || "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
  });
}

function useCreateAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/mentor-availability", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "Availability added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

function useUpdateAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & any) => {
      const res = await apiRequest("PATCH", `/api/mentor-availability/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] }),
  });
}

function useDeleteAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/mentor-availability/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "Slot removed" });
    },
  });
}

function AvailabilityDialog({ open, onOpenChange, mentorUserId, editSlot, category }: { open: boolean; onOpenChange: (v: boolean) => void; mentorUserId?: string; editSlot?: MentorAvailability | null; category?: string }) {
  const createAvailability = useCreateAvailability();
  const updateAvailability = useUpdateAvailability();
  const isEditing = !!editSlot;
  const [dayOfWeek, setDayOfWeek] = useState(editSlot ? String(editSlot.dayOfWeek) : "0");
  const [startTime, setStartTime] = useState(editSlot?.startTime || "09:00");
  const [endTime, setEndTime] = useState(editSlot?.endTime || "15:00");
  const [slotDuration, setSlotDuration] = useState(editSlot ? String(editSlot.slotDuration) : "60");
  const [bufferMinutes, setBufferMinutes] = useState(editSlot ? String(editSlot.bufferMinutes) : "15");

  const handleSubmit = () => {
    const data = {
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      slotDuration: parseInt(slotDuration),
      bufferMinutes: parseInt(bufferMinutes),
      isActive: true,
      ...(mentorUserId ? { userId: mentorUserId } : {}),
      ...(category ? { category } : {}),
    };
    if (isEditing && editSlot) {
      updateAvailability.mutate({ id: editSlot.id, ...data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createAvailability.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Availability Window" : "Add Availability Window"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update this availability slot" : "Set when this person is available"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Day</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger data-testid="select-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-avail-start" />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-avail-end" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Slot Duration</Label>
              <Select value={slotDuration} onValueChange={setSlotDuration}>
                <SelectTrigger data-testid="select-slot-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buffer Between</Label>
              <Select value={bufferMinutes} onValueChange={setBufferMinutes}>
                <SelectTrigger data-testid="select-buffer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No buffer</SelectItem>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createAvailability.isPending || updateAvailability.isPending} data-testid="button-add-availability">
            {(createAvailability.isPending || updateAvailability.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvailabilitySection({ category }: { category: string }) {
  const { data: profiles } = useMentorProfiles();
  const [selectedMentorId, setSelectedMentorId] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedProfile = useMemo(() => {
    if (!profiles || profiles.length === 0) return null;
    if (!selectedMentorId) return profiles[0];
    return profiles.find(p => String(p.id) === selectedMentorId) || profiles[0];
  }, [profiles, selectedMentorId]);

  const mentorUserId = selectedProfile ? getMentorBookingId(selectedProfile) : undefined;
  const { data: availability, isLoading } = useAvailability(mentorUserId, category);
  const updateAvailability = useUpdateAvailability();
  const deleteAvailability = useDeleteAvailability();
  const [showAdd, setShowAdd] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MentorAvailability | null>(null);

  const { data: calStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/google-calendar/status"],
  });

  const quickSetup = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mentor-availability/quick-setup", {
        mentorUserId: mentorUserId,
        startTime: "09:00",
        endTime: "16:00",
        category,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "Availability set up", description: "Default hours added: Mon\u2013Fri, 9am\u20134pm" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const quickSetupAll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mentor-availability/quick-setup-all", {
        startTime: "09:00",
        endTime: "16:00",
        category,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-availability"] });
      toast({ title: "All set up", description: data.message || "Mon\u2013Fri, 9am\u20134pm applied to all" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bookingUrl = useMemo(() => {
    if (!selectedProfile) return "";
    const id = getMentorBookingId(selectedProfile);
    return `${window.location.origin}/book/${id}`;
  }, [selectedProfile]);

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({ title: "Link copied!", description: "Share this link for people to book sessions" });
  };

  const handlePrevMentor = () => {
    if (!profiles || profiles.length <= 1) return;
    const currentIndex = profiles.findIndex(p => String(p.id) === selectedMentorId);
    const prevIndex = (currentIndex - 1 + profiles.length) % profiles.length;
    setSelectedMentorId(String(profiles[prevIndex].id));
  };

  const handleNextMentor = () => {
    if (!profiles || profiles.length <= 1) return;
    const currentIndex = profiles.findIndex(p => String(p.id) === selectedMentorId);
    const nextIndex = (currentIndex + 1) % profiles.length;
    setSelectedMentorId(String(profiles[nextIndex].id));
  };

  if (!profiles) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const slots = (availability || []) as MentorAvailability[];

  return (
    <div className="space-y-6">
      {profiles.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">Manage availability for:</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevMentor}
              data-testid="button-prev-mentor"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 py-1.5 bg-background border rounded-md min-w-[160px] text-center text-sm font-medium">
              {selectedProfile?.name}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextMentor}
              data-testid="button-next-mentor"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">{selectedProfile?.name}'s Booking Link</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Share this link so people can book sessions</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-3 py-1.5 rounded-md max-w-[300px] truncate" data-testid="text-booking-url">
              {bookingUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(bookingUrl, '_blank')} data-testid="button-preview-link">
              <ExternalLink className="w-4 h-4 mr-1" /> Preview
            </Button>
          </div>
        </div>
      </Card>

      {selectedProfile?.googleCalendarId ? (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2" data-testid="notice-gcal-connected">
          <CalendarCheck className="w-4 h-4 shrink-0" />
          <span>Google Calendar ({selectedProfile.googleCalendarId}) synced — busy times are automatically excluded from available slots</span>
        </div>
      ) : calStatus?.connected ? (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2" data-testid="notice-gcal-connected">
          <CalendarCheck className="w-4 h-4 shrink-0" />
          <span>Google Calendar connected (primary) — busy times are automatically excluded.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2" data-testid="notice-gcal-disconnected">
          <CalendarX className="w-4 h-4 shrink-0" />
          <span>Google Calendar not connected — connect it to automatically block busy times from booking slots</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Weekly Availability</h3>
          <p className="text-xs text-muted-foreground">Set the times {selectedProfile?.name} is available each week</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-availability">
          <Plus className="w-4 h-4 mr-1" /> Add Window
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : slots.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No availability set for {selectedProfile?.name}</p>
          <p className="text-xs text-muted-foreground mt-1">Add weekly hours so people can book sessions</p>
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add manually
            </Button>
            <Button size="sm" onClick={() => quickSetup.mutate()} disabled={quickSetup.isPending} data-testid="button-quick-setup">
              {quickSetup.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              Quick Setup (Mon–Fri, 9–4)
            </Button>
            {profiles && profiles.length > 1 && (
              <Button size="sm" variant="outline" onClick={() => quickSetupAll.mutate()} disabled={quickSetupAll.isPending} data-testid="button-quick-setup-all">
                {quickSetupAll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />}
                Set All (Mon–Fri, 9–4)
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-1">
          {DAY_NAMES.map((day, dayIdx) => {
            const daySlots = slots.filter(s => s.dayOfWeek === dayIdx);
            return (
              <div key={dayIdx} className={`flex items-center gap-3 px-3 py-2 rounded-md ${daySlots.length > 0 ? "bg-card border border-border" : "opacity-40"}`} data-testid={`availability-day-${dayIdx}`}>
                <span className="font-medium text-sm w-20 shrink-0">{day}</span>
                {daySlots.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No availability</span>
                ) : (
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${(slot.isActive ?? true) ? "" : "line-through text-muted-foreground"}`}>
                          {formatTimeSlot(slot.startTime)} {"\u2013"} {formatTimeSlot(slot.endTime)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {slot.slotDuration || 30}min slots
                        </span>
                        <Switch
                          checked={slot.isActive ?? true}
                          onCheckedChange={(checked) => updateAvailability.mutate({ id: slot.id, isActive: checked })}
                          className="scale-75"
                          data-testid={`switch-active-${slot.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => setEditingSlot(slot)}
                          data-testid={`button-edit-avail-${slot.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAvailability.mutate(slot.id)}
                          data-testid={`button-delete-avail-${slot.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AvailabilityDialog open={showAdd} onOpenChange={setShowAdd} mentorUserId={mentorUserId} category={category} />
      {editingSlot && (
        <AvailabilityDialog
          open={!!editingSlot}
          onOpenChange={(v) => { if (!v) setEditingSlot(null); }}
          mentorUserId={mentorUserId}
          editSlot={editingSlot}
          category={category}
        />
      )}
    </div>
  );
}

export default function SchedulingPage() {
  const [category, setCategory] = useState<string>("mentoring");

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-scheduling">
          <CalendarClock className="w-6 h-6 inline-block mr-2 align-text-bottom" />
          Availability
        </h1>
        <p className="text-muted-foreground text-sm">Manage weekly availability for mentors and staff</p>
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList data-testid="tabs-category">
          <TabsTrigger value="mentoring" data-testid="tab-mentoring">Mentoring</TabsTrigger>
          <TabsTrigger value="meeting" data-testid="tab-meeting">Meeting</TabsTrigger>
        </TabsList>
      </Tabs>

      <AvailabilitySection category={category} />
    </div>
  );
}
