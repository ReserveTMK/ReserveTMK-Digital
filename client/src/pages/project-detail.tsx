import { useRoute, Link, useLocation } from "wouter";
import { useState } from "react";
import { useProject, useProjectUpdates, useUpdateProject, useDeleteProject, useCreateProjectUpdate } from "@/hooks/use-projects";
import { useContacts } from "@/hooks/use-contacts";
import { useGroups } from "@/hooks/use-groups";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, Trash2, Plus, Calendar, Users, Target, FileText, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { PROJECT_STATUSES, PROJECT_UPDATE_TYPES } from "@shared/schema";
import type { Project } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const UPDATE_TYPE_LABELS: Record<string, string> = {
  status_change: "Status Change",
  milestone: "Milestone",
  note: "Note",
  blocker: "Blocker",
  completed_task: "Completed Task",
};

const UPDATE_TYPE_COLORS: Record<string, string> = {
  status_change: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  milestone: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  note: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  blocker: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed_task: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

function resolveContactName(contacts: any[] | undefined, id: number | null | undefined): string {
  if (!id || !contacts) return "Unknown";
  const c = contacts.find((c: any) => c.id === id);
  return c ? c.name : "Unknown";
}

function resolveContactNames(contacts: any[] | undefined, ids: number[] | null | undefined): string[] {
  if (!ids || !contacts) return [];
  return ids.map(id => {
    const c = contacts.find((c: any) => c.id === id);
    return c ? c.name : `Contact #${id}`;
  });
}

function EditProjectDialog({
  project,
  open,
  onOpenChange,
  contacts,
  groups,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[] | undefined;
  groups: any[] | undefined;
}) {
  const { toast } = useToast();
  const updateProject = useUpdateProject();
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    status: project.status,
    startDate: project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
    endDate: project.endDate ? format(new Date(project.endDate), "yyyy-MM-dd") : "",
    ownerId: project.ownerId?.toString() || "",
    goals: project.goals || "",
    deliverables: project.deliverables || "",
    notes: project.notes || "",
    relatedGroupId: project.relatedGroupId?.toString() || "",
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      toast({ title: "Error", description: "End date must be on or after start date", variant: "destructive" });
      return;
    }

    updateProject.mutate(
      {
        id: project.id,
        name: formData.name.trim(),
        description: formData.description || null,
        status: formData.status,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        ownerId: formData.ownerId ? parseInt(formData.ownerId) : null,
        goals: formData.goals || null,
        deliverables: formData.deliverables || null,
        notes: formData.notes || null,
        relatedGroupId: formData.relatedGroupId ? parseInt(formData.relatedGroupId) : null,
      } as any,
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Project updated" });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to update project", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              data-testid="input-project-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={200}
            />
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger data-testid="select-project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              data-testid="input-project-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                data-testid="input-project-start-date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                data-testid="input-project-end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={formData.ownerId} onValueChange={(v) => setFormData({ ...formData, ownerId: v })}>
              <SelectTrigger data-testid="select-project-owner">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {(contacts || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Related Group</Label>
            <Select value={formData.relatedGroupId} onValueChange={(v) => setFormData({ ...formData, relatedGroupId: v })}>
              <SelectTrigger data-testid="select-project-group">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {(groups || []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Goals</Label>
            <Textarea
              data-testid="input-project-goals"
              value={formData.goals}
              onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Deliverables</Label>
            <Textarea
              data-testid="input-project-deliverables"
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              data-testid="input-project-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateProject.isPending} data-testid="button-save-project">
            {updateProject.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUpdateDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const createUpdate = useCreateProjectUpdate();
  const [updateType, setUpdateType] = useState("note");
  const [updateText, setUpdateText] = useState("");

  const handleSubmit = () => {
    if (!updateText.trim()) {
      toast({ title: "Error", description: "Update text is required", variant: "destructive" });
      return;
    }
    createUpdate.mutate(
      { projectId, updateType, updateText: updateText.trim() },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Update added" });
          setUpdateType("note");
          setUpdateText("");
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to add update", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={updateType} onValueChange={setUpdateType}>
              <SelectTrigger data-testid="select-update-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_UPDATE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{UPDATE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Details</Label>
            <Textarea
              data-testid="input-update-text"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="What's the update?"
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-update">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createUpdate.isPending} data-testid="button-submit-update">
            {createUpdate.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0");
  const { data: project, isLoading } = useProject(id || undefined);
  const { data: updates, isLoading: updatesLoading } = useProjectUpdates(id || undefined);
  const { data: contacts } = useContacts();
  const { data: groups } = useGroups();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold" data-testid="text-project-not-found">Project not found</h2>
        <Link href="/projects">
          <Button variant="outline" data-testid="link-back-to-projects">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const ownerName = resolveContactName(contacts, project.ownerId);
  const teamMemberNames = resolveContactNames(contacts, project.teamMembers as number[] | null);
  const relatedContactNames = resolveContactNames(contacts, project.relatedContactIds as number[] | null);
  const relatedGroup = groups?.find((g: any) => g.id === project.relatedGroupId);

  const handleDelete = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Project has been deleted" });
        setLocation("/projects");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to delete project", variant: "destructive" });
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/projects">
          <Button variant="ghost" size="icon" data-testid="button-back-to-projects">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate" data-testid="text-project-name">{project.name}</h1>
        </div>
        <Badge className={STATUS_COLORS[project.status] || ""} data-testid="badge-project-status">
          {STATUS_LABELS[project.status] || project.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)} data-testid="button-delete-project" className="text-destructive">
          <Trash2 className="w-4 h-4 mr-1" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="w-4 h-4" />
            Owner
          </div>
          <p className="text-sm" data-testid="text-project-owner">{ownerName}</p>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="w-4 h-4" />
            Timeline
          </div>
          <div className="text-sm space-y-1">
            <p data-testid="text-project-start-date">
              Start: {project.startDate ? format(new Date(project.startDate), "d MMM yyyy") : "Not set"}
            </p>
            <p data-testid="text-project-end-date">
              End: {project.endDate ? format(new Date(project.endDate), "d MMM yyyy") : "Not set"}
            </p>
          </div>
        </Card>
      </div>

      {project.description && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="w-4 h-4" />
            Description
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-description">{project.description}</p>
        </Card>
      )}

      {project.goals && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Target className="w-4 h-4" />
            Goals
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-goals">{project.goals}</p>
        </Card>
      )}

      {project.deliverables && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CheckCircle2 className="w-4 h-4" />
            Deliverables
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-deliverables">{project.deliverables}</p>
        </Card>
      )}

      {teamMemberNames.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="w-4 h-4" />
            Team Members
          </div>
          <div className="flex flex-wrap gap-2">
            {teamMemberNames.map((name, i) => (
              <Badge key={i} variant="secondary" data-testid={`badge-team-member-${i}`}>
                {name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {(relatedGroup || relatedContactNames.length > 0) && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Related</div>
          {relatedGroup && (
            <div className="text-sm">
              <span className="text-muted-foreground">Group: </span>
              <span data-testid="text-related-group">{relatedGroup.name}</span>
            </div>
          )}
          {relatedContactNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {relatedContactNames.map((name, i) => (
                <Badge key={i} variant="outline" data-testid={`badge-related-contact-${i}`}>
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      {project.notes && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Notes</div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-project-notes">{project.notes}</p>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Updates & Activity</h2>
          <Button size="sm" onClick={() => setAddUpdateOpen(true)} data-testid="button-add-update">
            <Plus className="w-4 h-4 mr-1" />
            Add Update
          </Button>
        </div>

        {updatesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !updates || updates.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground" data-testid="text-no-updates">No updates yet. Add the first one!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {updates.map((update) => (
              <Card key={update.id} className="p-4" data-testid={`card-update-${update.id}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={UPDATE_TYPE_COLORS[update.updateType] || ""} data-testid={`badge-update-type-${update.id}`}>
                      {UPDATE_TYPE_LABELS[update.updateType] || update.updateType}
                    </Badge>
                    {update.createdBy && (
                      <span className="text-xs text-muted-foreground" data-testid={`text-update-author-${update.id}`}>
                        by {update.createdBy}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-update-date-${update.id}`}>
                    <Clock className="w-3 h-3" />
                    {update.createdAt
                      ? formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })
                      : "Unknown"}
                  </span>
                </div>
                {update.updateText && (
                  <p className="text-sm mt-2 whitespace-pre-wrap" data-testid={`text-update-content-${update.id}`}>
                    {update.updateText}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        contacts={contacts}
        groups={groups}
      />

      <AddUpdateDialog
        projectId={project.id}
        open={addUpdateOpen}
        onOpenChange={setAddUpdateOpen}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be undone and will remove all associated updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteProject.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}