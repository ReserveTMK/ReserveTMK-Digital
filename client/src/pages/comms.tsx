import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Mail,
  Megaphone,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  Users,
  Calendar,
  Pencil,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// === Types ===
interface CommsStory {
  id: number;
  title: string;
  body: string | null;
  pullQuote: string | null;
  contactId: number | null;
  impactLogId: number | null;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

interface CommsNewsletter {
  id: number;
  subject: string;
  intro: string | null;
  body: string | null;
  footer: string | null;
  storyIds: number[] | null;
  status: "draft" | "sent";
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

interface CommsAnnouncement {
  id: number;
  subject: string;
  body: string;
  targetType: "all" | "group" | "cohort";
  targetId: number | null;
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// === Stories Tab ===
function StoriesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<CommsStory | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pullQuote, setPullQuote] = useState("");

  const { data: stories, isLoading } = useQuery<CommsStory[]>({
    queryKey: ["/api/comms/stories"],
  });

  const { data: impactLogs } = useQuery<any[]>({
    queryKey: ["/api/impact-logs"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/comms/stories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/stories"] });
      toast({ title: "Story saved", description: "Story created successfully" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/comms/stories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/stories"] });
      toast({ title: "Saved", description: "Story updated" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const togglePublish = async (story: CommsStory) => {
    await updateMutation.mutateAsync({
      id: story.id,
      status: story.status === "published" ? "draft" : "published",
    });
  };

  const openCreate = (impactLog?: any) => {
    setEditingStory(null);
    setTitle(impactLog?.summary ? `Story: ${impactLog.title || "Untitled"}` : "");
    setBody(impactLog?.summary || "");
    setPullQuote("");
    setDialogOpen(true);
  };

  const openEdit = (story: CommsStory) => {
    setEditingStory(story);
    setTitle(story.title);
    setBody(story.body || "");
    setPullQuote(story.pullQuote || "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    if (editingStory) {
      updateMutation.mutate({ id: editingStory.id, title, body, pull_quote: pullQuote });
    } else {
      createMutation.mutate({ title, body, pull_quote: pullQuote });
    }
  };

  const confirmedDebriefs = (impactLogs || []).filter((l: any) => l.status === "confirmed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Impact Stories</h3>
          <p className="text-xs text-muted-foreground">Stories from confirmed debriefs — embed in newsletters</p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Story
        </Button>
      </div>

      {/* Quick-create from debrief */}
      {confirmedDebriefs.length > 0 && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-purple-400 mb-2">Create from a confirmed debrief</p>
            <div className="space-y-1">
              {confirmedDebriefs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-xs text-muted-foreground truncate">{log.title || "Untitled debrief"}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => openCreate(log)}>
                    Use this
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : (stories || []).length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No stories yet. Create one from a debrief or from scratch.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(stories || []).map(story => (
            <Card key={story.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{story.title}</span>
                    <Badge
                      variant={story.status === "published" ? "default" : "secondary"}
                      className={story.status === "published" ? "bg-emerald-600" : ""}
                    >
                      {story.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {story.pullQuote && (
                    <p className="text-xs text-muted-foreground italic truncate">"{story.pullQuote}"</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(story.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => togglePublish(story)}>
                    {story.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(story)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStory ? "Edit Story" : "Create Story"}</DialogTitle>
            <DialogDescription className="sr-only">Story form</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Story title" />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Tell the story..."
                className="min-h-[120px]"
              />
            </div>
            <div>
              <Label>Pull Quote</Label>
              <Textarea
                value={pullQuote}
                onChange={e => setPullQuote(e.target.value)}
                placeholder="A standout quote or highlight..."
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Newsletters Tab ===
function NewslettersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [selectedStoryIds, setSelectedStoryIds] = useState<number[]>([]);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewNewsletter, setPreviewNewsletter] = useState<CommsNewsletter | null>(null);

  const { data: newsletters, isLoading } = useQuery<CommsNewsletter[]>({
    queryKey: ["/api/comms/newsletters"],
  });

  const { data: stories } = useQuery<CommsStory[]>({
    queryKey: ["/api/comms/stories"],
  });

  const publishedStories = (stories || []).filter(s => s.status === "published");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/comms/newsletters", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/newsletters"] });
      toast({ title: "Newsletter saved" });
      setComposerOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/comms/newsletters/${id}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/newsletters"] });
      toast({ title: "Newsletter sent!", description: "Sent via kiaora@reservetmk.co.nz" });
      setSendingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
      setSendingId(null);
    },
  });

  const resetForm = () => {
    setSubject("");
    setIntro("");
    setBody("");
    setFooter("");
    setSelectedStoryIds([]);
    setScheduleMode(false);
    setScheduleDate("");
  };

  const handleSave = () => {
    if (!subject.trim()) return;
    createMutation.mutate({
      subject,
      intro,
      body,
      footer,
      story_ids: selectedStoryIds,
    });
  };

  const handleSendNow = async (id: number) => {
    setSendingId(id);
    sendMutation.mutate(id);
  };

  const toggleStory = (id: number) => {
    setSelectedStoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Newsletters</h3>
          <p className="text-xs text-muted-foreground">Monthly updates to your community — sending via kiaora@reservetmk.co.nz</p>
        </div>
        <Button size="sm" onClick={() => setComposerOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Newsletter
        </Button>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5 p-3">
        <p className="text-xs text-blue-400">📨 Sending via kiaora@reservetmk.co.nz — Gmail integration active</p>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : (newsletters || []).length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No newsletters yet. Monthly cadence suggested.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(newsletters || []).map(nl => (
            <Card key={nl.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{nl.subject}</span>
                    <Badge variant={nl.status === "sent" ? "default" : "secondary"} className={nl.status === "sent" ? "bg-emerald-600" : ""}>
                      {nl.status === "sent" ? "Sent" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {nl.sentAt ? `Sent ${formatDate(nl.sentAt)}` : `Created ${formatDate(nl.createdAt)}`}
                    {nl.recipientCount ? ` · ${nl.recipientCount} recipients` : ""}
                  </p>
                </div>
                {nl.status !== "sent" && (
                  <Button
                    size="sm"
                    onClick={() => handleSendNow(nl.id)}
                    disabled={sendingId === nl.id}
                  >
                    {sendingId === nl.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Send Now
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Newsletter</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Sending via kiaora@reservetmk.co.nz</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Subject Line</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Reserve Tāmaki — Monthly Update" />
            </div>
            <div>
              <Label>Intro</Label>
              <Textarea value={intro} onChange={e => setIntro(e.target.value)} placeholder="Opening paragraph..." className="min-h-[60px]" />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Main newsletter content..." className="min-h-[100px]" />
            </div>

            {publishedStories.length > 0 && (
              <div>
                <Label className="mb-2 block">Add Stories</Label>
                <div className="space-y-1">
                  {publishedStories.map(story => (
                    <label key={story.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selectedStoryIds.includes(story.id)}
                        onChange={() => toggleStory(story.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{story.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Footer</Label>
              <Textarea value={footer} onChange={e => setFooter(e.target.value)} placeholder="Footer text..." className="min-h-[50px]" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleSave} disabled={!subject.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Announcements Tab ===
function AnnouncementsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "group" | "cohort">("all");
  const [targetId, setTargetId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const { data: announcements, isLoading } = useQuery<CommsAnnouncement[]>({
    queryKey: ["/api/comms/announcements"],
  });

  const { data: groups } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const { data: programmes } = useQuery<any[]>({
    queryKey: ["/api/programmes"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/comms/announcements", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/announcements"] });
      toast({ title: "Announcement created" });
      // Auto-send
      sendMutation.mutate(data.id);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/comms/announcements/${id}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/announcements"] });
      toast({ title: "Announcement sent!", description: "Sent via kiaora@reservetmk.co.nz" });
      setSubject("");
      setBody("");
      setTargetType("all");
      setTargetId("");
      setSendingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
      setSendingId(null);
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    createMutation.mutate({
      subject,
      body,
      target_type: targetType,
      target_id: targetId ? parseInt(targetId) : null,
    });
  };

  const handleResend = (id: number) => {
    setSendingId(id);
    sendMutation.mutate(id);
  };

  const isSending = createMutation.isPending || sendMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-1">Send Announcement</h3>
        <p className="text-xs text-muted-foreground mb-4">Quick broadcast — sending via kiaora@reservetmk.co.nz</p>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Announcement subject..." />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your announcement..."
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label>Target</Label>
              <Select value={targetType} onValueChange={(v: any) => { setTargetType(v); setTargetId(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="group">Specific Group</SelectItem>
                  <SelectItem value="cohort">Programme Cohort</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === "group" && (groups || []).length > 0 && (
              <div>
                <Label>Select Group</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups || []).map((g: any) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === "cohort" && (programmes || []).length > 0 && (
              <div>
                <Label>Select Programme</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a programme..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(programmes || []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!subject.trim() || !body.trim()}
              >
                Preview
              </Button>
              <Button
                onClick={handleSend}
                disabled={!subject.trim() || !body.trim() || isSending}
              >
                {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3">Send History</h3>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : (announcements || []).filter(a => a.sentAt).length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
        ) : (
          <div className="space-y-2">
            {(announcements || []).filter(a => a.sentAt).map(ann => (
              <Card key={ann.id}>
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium">{ann.subject}</span>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ann.sentAt)}
                      {ann.recipientCount ? ` · ${ann.recipientCount} recipients` : ""}
                      {" · "}
                      <span className="capitalize">{ann.targetType === "all" ? "All contacts" : ann.targetType}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Announcement Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-3 border rounded-md bg-muted/20">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</p>
              <p className="text-sm">{subject}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</p>
              <p className="text-sm whitespace-pre-wrap">{body}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Target: {targetType === "all" ? "All contacts" : targetType}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Main Page ===
export default function CommsPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comms</h1>
        <p className="text-sm text-muted-foreground">Stories, newsletters, and announcements</p>
      </div>

      <Tabs defaultValue="stories">
        <TabsList>
          <TabsTrigger value="stories">
            <BookOpen className="w-4 h-4 mr-1.5" />
            Stories
          </TabsTrigger>
          <TabsTrigger value="newsletters">
            <Mail className="w-4 h-4 mr-1.5" />
            Newsletters
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Megaphone className="w-4 h-4 mr-1.5" />
            Announcements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="mt-4">
          <StoriesTab />
        </TabsContent>
        <TabsContent value="newsletters" className="mt-4">
          <NewslettersTab />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
