import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActionItems, useCreateActionItem, useUpdateActionItem } from "@/hooks/use-action-items";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Loader2,
  CheckSquare,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Circle,
} from "lucide-react";
import type { ActionItem, Contact } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  high: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export default function Actions() {
  const { data: items, isLoading } = useActionItems();
  const { data: contacts } = useQuery<Contact[]>({ queryKey: ['/api/contacts'] });
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const updateMutation = useUpdateActionItem();
  const { toast } = useToast();

  const allItems = (items as ActionItem[]) || [];
  const filteredItems = filter === "all" ? allItems : allItems.filter((i) => i.status === filter);

  const handleStatusChange = async (item: ActionItem, newStatus: string) => {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: {
          status: newStatus,
          completedAt: newStatus === "completed" ? new Date().toISOString() : null,
        },
      });
      toast({ title: "Updated", description: `Status changed to ${STATUS_LABELS[newStatus] || newStatus}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    }
  };

  const getContactName = (contactId: number | null) => {
    if (!contactId || !contacts) return null;
    return contacts.find((c) => c.id === contactId)?.name || null;
  };

  return (
    <>
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-actions-title">Action Items</h1>
              <p className="text-muted-foreground mt-1">Track and manage follow-up actions</p>
            </div>
            <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-new-action">
              <Plus className="w-4 h-4 mr-2" />
              New Action
            </Button>
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList data-testid="tabs-filter">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="in_progress" data-testid="tab-in-progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No action items</h3>
              <p className="text-muted-foreground mb-6">
                {filter === "all" ? "Create your first action item to get started." : `No ${STATUS_LABELS[filter] || filter} items.`}
              </p>
              {filter === "all" && (
                <Button onClick={() => setCreateOpen(true)} variant="outline" data-testid="button-new-action-empty">
                  New Action
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="p-5" data-testid={`card-action-${item.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-bold text-lg font-display truncate flex-1" data-testid={`text-action-title-${item.id}`}>
                      {item.title}
                    </h3>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${STATUS_COLORS[item.status] || ""}`} data-testid={`badge-action-status-${item.id}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3" data-testid={`text-action-desc-${item.id}`}>
                      {item.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 flex-wrap">
                    {item.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span data-testid={`text-action-due-${item.id}`}>
                          {new Date(item.dueDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    )}
                    {item.contactId && (
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span data-testid={`text-action-contact-${item.id}`}>{getContactName(item.contactId) || "Unknown"}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {item.status !== "completed" && (
                      <>
                        {item.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(item, "in_progress")}
                            data-testid={`button-start-action-${item.id}`}
                          >
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Start
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(item, "completed")}
                          data-testid={`button-complete-action-${item.id}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Complete
                        </Button>
                      </>
                    )}
                    {item.status === "completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(item, "pending")}
                        data-testid={`button-reopen-action-${item.id}`}
                      >
                        <Circle className="w-3.5 h-3.5 mr-1" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <NewActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        contacts={contacts || []}
      />
    </>
  );
}

function NewActionDialog({
  open,
  onOpenChange,
  contacts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: Contact[];
}) {
  const createMutation = useCreateActionItem();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Missing title", description: "Please enter a title.", variant: "destructive" });
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description || null,
        contactId: contactId ? parseInt(contactId) : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        status: "pending",
        userId: "temp",
      });
      toast({ title: "Created", description: "Action item created successfully." });
      setTitle("");
      setDescription("");
      setContactId("");
      setDueDate("");
      setPriority("medium");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Action Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="action-title">Title</Label>
            <Input
              id="action-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow up with Jane"
              data-testid="input-action-title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              className="resize-none"
              rows={3}
              data-testid="input-action-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="action-contact">Linked Contact</Label>
            <select
              id="action-contact"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="select-action-contact"
            >
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id.toString()}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action-due">Due Date</Label>
              <Input
                id="action-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-action-due"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-priority">Priority</Label>
              <select
                id="action-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="select-action-priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" isLoading={createMutation.isPending} className="w-full" data-testid="button-submit-action">
              Create Action
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
