import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Plus,
  Check,
  Trash2,
  Pencil,
  CalendarPlus,
  ChevronDown,
  Clock,
  AlertTriangle,
  ArrowRight,
  Coffee,
  Search,
  X,
  History,
  Users,
} from "lucide-react";
import type { Contact } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type CatchUpItemData = {
  id: number;
  userId: string;
  contactId: number;
  note: string | null;
  priority: string | null;
  createdAt: string | null;
  dismissedAt: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactStage: string | null;
  contactConnectionStrength: string | null;
  contactIsInnovator: boolean | null;
  contactIsCommunityMember: boolean | null;
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  urgent: {
    label: "Urgent",
    color: "bg-red-500/15 text-red-700 dark:text-red-300",
    icon: AlertTriangle,
  },
  soon: {
    label: "Soon",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  whenever: {
    label: "Whenever",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    icon: Coffee,
  },
};

const STAGE_COLORS: Record<string, string> = {
  kakano: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  tipu: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ora: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  inactive: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function CatchUpPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [addContactSearch, setAddContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [addNote, setAddNote] = useState("");
  const [addPriority, setAddPriority] = useState("soon");
  const [editItem, setEditItem] = useState<CatchUpItemData | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState("soon");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const { data: catchUpItems, isLoading } = useQuery<CatchUpItemData[]>({
    queryKey: ["/api/catch-up-list"],
  });

  const { data: historyItems } = useQuery<CatchUpItemData[]>({
    queryKey: ["/api/catch-up-list/history"],
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { contactId: number; note: string; priority: string }) => {
      await apiRequest("POST", "/api/catch-up-list", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      setSelectedContactId(null);
      setAddContactSearch("");
      setAddNote("");
      setAddPriority("soon");
      toast({ title: "Added to catch-up list" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/catch-up-list/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list/history"] });
      setEditItem(null);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/catch-up-list/${id}`, { dismiss: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list/history"] });
      toast({ title: "Marked as done" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/catch-up-list/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      toast({ title: "Removed from list" });
    },
  });

  const items = catchUpItems || [];

  const grouped = useMemo(() => {
    const result: Record<string, CatchUpItemData[]> = {
      urgent: [],
      soon: [],
      whenever: [],
    };
    items.forEach((item) => {
      const p = item.priority || "soon";
      if (result[p]) result[p].push(item);
      else result.soon.push(item);
    });
    return result;
  }, [items]);

  const counts = useMemo(() => ({
    total: items.length,
    urgent: grouped.urgent.length,
    soon: grouped.soon.length,
    whenever: grouped.whenever.length,
  }), [items, grouped]);

  const filteredContacts = useMemo(() => {
    if (!contacts || !addContactSearch.trim()) return [];
    const q = addContactSearch.toLowerCase();
    const existingIds = new Set(items.map(i => i.contactId));
    return contacts
      .filter(c => !existingIds.has(c.id))
      .filter(c => c.name.toLowerCase().includes(q) || (c.businessName && c.businessName.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [contacts, addContactSearch, items]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId || !contacts) return null;
    return contacts.find(c => c.id === selectedContactId) || null;
  }, [selectedContactId, contacts]);

  const handleAdd = () => {
    if (!selectedContactId) {
      toast({ title: "Select a contact", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      contactId: selectedContactId,
      note: addNote,
      priority: addPriority,
    });
  };

  const handleEdit = (item: CatchUpItemData) => {
    setEditItem(item);
    setEditNote(item.note || "");
    setEditPriority(item.priority || "soon");
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      data: { note: editNote, priority: editPriority },
    });
    toast({ title: "Updated" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground" data-testid="text-catch-up-title">
                Catch Up
              </h1>
              <p className="text-muted-foreground text-sm mt-1" data-testid="text-catch-up-subtitle">
                Plan and manage who you need to connect with
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap" data-testid="text-catch-up-counts">
              <Badge variant="secondary" className={PRIORITY_CONFIG.urgent.color}>
                {counts.urgent} urgent
              </Badge>
              <Badge variant="secondary" className={PRIORITY_CONFIG.soon.color}>
                {counts.soon} soon
              </Badge>
              <Badge variant="secondary" className={PRIORITY_CONFIG.whenever.color}>
                {counts.whenever} whenever
              </Badge>
              <Badge variant="outline" data-testid="text-catch-up-total">
                {counts.total} total
              </Badge>
            </div>
          </div>
        </div>

        <Card className="p-4" data-testid="card-add-catch-up">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Add someone to catch up with</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                {selectedContact ? (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
                    <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1 truncate" data-testid="text-selected-contact">{selectedContact.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setSelectedContactId(null); setAddContactSearch(""); }}
                      data-testid="button-clear-selected-contact"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search for a contact..."
                        value={addContactSearch}
                        onChange={(e) => { setAddContactSearch(e.target.value); setShowContactDropdown(true); }}
                        onFocus={() => setShowContactDropdown(true)}
                        data-testid="input-contact-search"
                      />
                    </div>
                    {showContactDropdown && filteredContacts.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredContacts.map((c) => (
                          <button
                            key={c.id}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover-elevate"
                            onClick={() => {
                              setSelectedContactId(c.id);
                              setAddContactSearch(c.name);
                              setShowContactDropdown(false);
                            }}
                            data-testid={`option-contact-${c.id}`}
                          >
                            <span className="truncate flex-1">{c.name}</span>
                            {c.role && (
                              <span className="text-xs text-muted-foreground shrink-0">{c.role}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <Input
                placeholder="Note (optional)"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                className="flex-1"
                data-testid="input-catch-up-note"
              />
              <Select value={addPriority} onValueChange={setAddPriority}>
                <SelectTrigger className="w-[130px]" data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="soon">Soon</SelectItem>
                  <SelectItem value="whenever">Whenever</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAdd}
                disabled={!selectedContactId || addMutation.isPending}
                data-testid="button-add-catch-up"
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </Button>
            </div>
          </div>
        </Card>

        {items.length === 0 && (
          <Card className="p-8 text-center" data-testid="card-empty-state">
            <Coffee className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No one on your catch-up list yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Use the form above to add people you need to connect with.</p>
          </Card>
        )}

        {(["urgent", "soon", "whenever"] as const).map((priority) => {
          const groupItems = grouped[priority];
          if (groupItems.length === 0) return null;
          const config = PRIORITY_CONFIG[priority];
          const PriorityIcon = config.icon;

          return (
            <div key={priority} className="space-y-2" data-testid={`section-priority-${priority}`}>
              <div className="flex items-center gap-2 px-1">
                <PriorityIcon className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </h2>
                <Badge variant="secondary" className={config.color}>
                  {groupItems.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <CatchUpCard
                    key={item.id}
                    item={item}
                    onDismiss={() => dismissMutation.mutate(item.id)}
                    onRemove={() => removeMutation.mutate(item.id)}
                    onEdit={() => handleEdit(item)}
                    dismissPending={dismissMutation.isPending}
                    removePending={removeMutation.isPending}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {(historyItems && historyItems.length > 0) && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2"
                data-testid="button-toggle-history"
              >
                <History className="w-4 h-4" />
                <span>Recently Completed ({historyItems.length})</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 mt-2">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    data-testid={`history-item-${item.id}`}
                  >
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.contactName || "Unknown"}</p>
                      {item.note && <p className="text-xs text-muted-foreground truncate">{item.note}</p>}
                    </div>
                    {item.dismissedAt && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(item.dismissedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Catch Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Contact</label>
              <p className="text-sm text-muted-foreground" data-testid="text-edit-contact-name">{editItem?.contactName || "Unknown"}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Note</label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Why do you need to catch up?"
                data-testid="input-edit-note"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Priority</label>
              <Select value={editPriority} onValueChange={setEditPriority}>
                <SelectTrigger data-testid="select-edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="soon">Soon</SelectItem>
                  <SelectItem value="whenever">Whenever</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CatchUpCard({
  item,
  onDismiss,
  onRemove,
  onEdit,
  dismissPending,
  removePending,
}: {
  item: CatchUpItemData;
  onDismiss: () => void;
  onRemove: () => void;
  onEdit: () => void;
  dismissPending: boolean;
  removePending: boolean;
}) {
  const stageColor = STAGE_COLORS[item.contactStage || ""] || "bg-gray-500/15 text-gray-700 dark:text-gray-300";

  return (
    <Card className="p-4" data-testid={`catch-up-item-${item.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/contacts/${item.contactId}`}>
              <span className="text-sm font-semibold hover:underline cursor-pointer" data-testid={`link-contact-${item.contactId}`}>
                {item.contactName || "Unknown Contact"}
              </span>
            </Link>
            {item.contactRole && (
              <Badge variant="secondary" className="text-[10px]" data-testid={`badge-role-${item.id}`}>
                {item.contactRole}
              </Badge>
            )}
            {item.contactStage && (
              <Badge variant="secondary" className={`text-[10px] ${stageColor}`} data-testid={`badge-stage-${item.id}`}>
                {item.contactStage}
              </Badge>
            )}
          </div>
          {item.note && (
            <p className="text-sm text-muted-foreground" data-testid={`text-note-${item.id}`}>
              {item.note}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {item.createdAt && (
              <span className="text-xs text-muted-foreground" data-testid={`text-added-${item.id}`}>
                Added {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            )}
            {item.contactConnectionStrength && (
              <span className="text-xs text-muted-foreground">
                Connection: {item.contactConnectionStrength}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/calendar?newMeeting=true&contactId=${item.contactId}`}>
            <Button size="sm" variant="outline" className="gap-1" data-testid={`button-schedule-${item.id}`}>
              <CalendarPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Schedule</span>
            </Button>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            disabled={dismissPending}
            title="Mark as done"
            data-testid={`button-done-${item.id}`}
          >
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            title="Edit"
            data-testid={`button-edit-${item.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onRemove}
            disabled={removePending}
            title="Remove"
            data-testid={`button-remove-${item.id}`}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
