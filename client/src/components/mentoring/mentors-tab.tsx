import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Loader2,
  UserPlus,
  Settings,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useMentorProfiles, getMentorBookingId } from "@/components/mentoring/mentoring-hooks";

function AddMentorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const create = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const res = await apiRequest("POST", "/api/mentor-profiles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-profiles"] });
      toast({ title: "Mentor added" });
      onOpenChange(false);
      setName("");
      setEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Mentor</DialogTitle>
          <DialogDescription>Add a new mentor to your roster</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-mentor-name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-mentor-email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate({ name, email })} disabled={!name.trim() || create.isPending} data-testid="button-submit-mentor">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Mentor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MentorsTab() {
  const { data: profiles, isLoading } = useMentorProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<number | null>(null);
  const [calendarId, setCalendarId] = useState("");

  const { data: calendars } = useQuery<{ id: string; summary: string; primary: boolean }[]>({
    queryKey: ["/api/google-calendar/list"],
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & any) => {
      const res = await apiRequest("PATCH", `/api/mentor-profiles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-profiles"] });
      toast({ title: "Mentor updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/mentor-profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor-profiles"] });
      toast({ title: "Mentor removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Mentor Roster</h3>
          <p className="text-xs text-muted-foreground">Manage who can offer mentoring sessions and their calendar connections</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-mentor">
          <UserPlus className="w-4 h-4 mr-1" /> Add Mentor
        </Button>
      </div>

      <div className="space-y-3">
        {(profiles || []).map((profile) => {
          const bookingId = getMentorBookingId(profile);
          const bookingUrl = `${window.location.origin}/book/${bookingId}`;
          const isEditingCal = editingCalendar === profile.id;

          return (
            <Card key={profile.id} className="p-4" data-testid={`mentor-card-${profile.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{profile.name}</h4>
                    {profile.isActive ? (
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">Inactive</Badge>
                    )}
                    {profile.mentorUserId ? (
                      <Badge variant="secondary" className="text-[10px] h-5">Account linked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-200">Pending login</Badge>
                    )}
                  </div>
                  {profile.email && (
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[11px] bg-muted px-2 py-1 rounded max-w-[260px] truncate">{bookingUrl}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingUrl);
                        toast({ title: "Link copied!" });
                      }}
                      data-testid={`button-copy-mentor-link-${profile.id}`}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => window.open(bookingUrl, '_blank')}
                      data-testid={`button-preview-mentor-link-${profile.id}`}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> Preview
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {isEditingCal ? (
                      <div className="flex items-center gap-2">
                        <Select value={calendarId} onValueChange={setCalendarId}>
                          <SelectTrigger className="h-7 text-xs w-[260px]" data-testid={`select-calendar-${profile.id}`}>
                            <SelectValue placeholder="Select calendar..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No calendar sync</SelectItem>
                            {(calendars || []).map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.summary} {c.primary ? "(Primary)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            updateProfile.mutate({
                              id: profile.id,
                              googleCalendarId: calendarId === "none" ? null : calendarId,
                            });
                            setEditingCalendar(null);
                          }}
                          data-testid={`button-save-calendar-${profile.id}`}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setEditingCalendar(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEditingCalendar(profile.id);
                          setCalendarId(profile.googleCalendarId || "none");
                        }}
                        data-testid={`button-edit-calendar-${profile.id}`}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        {profile.googleCalendarId ? `Calendar: ${profile.googleCalendarId.split('@')[0]}` : "Set Google Calendar"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Switch
                    checked={profile.isActive ?? true}
                    onCheckedChange={(checked) => updateProfile.mutate({ id: profile.id, isActive: checked })}
                    data-testid={`switch-mentor-active-${profile.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500"
                    onClick={() => {
                      if (confirm(`Remove ${profile.name} from the mentor roster?`)) {
                        deleteProfile.mutate(profile.id);
                      }
                    }}
                    data-testid={`button-delete-mentor-${profile.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AddMentorDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}
