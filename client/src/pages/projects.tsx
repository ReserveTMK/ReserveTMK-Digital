import { useState, useMemo } from "react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { Plus, Search, Loader2, Rocket, ArrowUpDown } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useContacts } from "@/hooks/use-contacts";
import { useProjects, useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { PROJECT_STATUSES, insertProjectSchema } from "@shared/schema";
import type { Project } from "@shared/schema";

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  active: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

type SortKey = "name" | "status" | "endDate" | "updatedAt";

const formSchema = insertProjectSchema.extend({
  name: z.string().min(1, "Name is required").max(200),
  ownerId: z.number({ required_error: "Owner is required" }).nullable(),
  endDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
}).omit({ createdBy: true });

type FormValues = z.infer<typeof formSchema>;

function ProjectFormDialog({
  open,
  onOpenChange,
  editProject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editProject?: Project | null;
}) {
  const { toast } = useToast();
  const { data: contacts } = useContacts();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { data: allGroups } = useProjects();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editProject?.name ?? "",
      description: editProject?.description ?? "",
      status: (editProject?.status as any) ?? "planning",
      startDate: editProject?.startDate ? format(new Date(editProject.startDate), "yyyy-MM-dd") : "",
      endDate: editProject?.endDate ? format(new Date(editProject.endDate), "yyyy-MM-dd") : "",
      ownerId: editProject?.ownerId ?? null,
      teamMembers: editProject?.teamMembers ?? [],
      relatedGroupId: editProject?.relatedGroupId ?? null,
      relatedContactIds: editProject?.relatedContactIds ?? [],
      goals: editProject?.goals ?? "",
      deliverables: editProject?.deliverables ?? "",
      notes: editProject?.notes ?? "",
    },
  });

  const isEditing = !!editProject;
  const isPending = createProject.isPending || updateProject.isPending;

  async function onSubmit(values: FormValues) {
    const payload: any = {
      ...values,
      startDate: values.startDate ? new Date(values.startDate).toISOString() : null,
      endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
    };

    try {
      if (isEditing && editProject) {
        await updateProject.mutateAsync({ id: editProject.id, ...payload });
        toast({ title: "Success", description: "Project updated" });
      } else {
        await createProject.mutateAsync(payload);
        toast({ title: "Success", description: "Project created" });
      }
      onOpenChange(false);
      form.reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-project-form">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit Project" : "New Project"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Project name" data-testid="input-project-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Brief description" data-testid="input-project-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select value={field.value ?? "planning"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner *</FormLabel>
                    <Select
                      value={field.value?.toString() ?? ""}
                      onValueChange={(v) => field.onChange(v ? parseInt(v) : null)}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-project-owner">
                          <SelectValue placeholder="Select owner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(contacts ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} data-testid="input-project-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} data-testid="input-project-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goals</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Project goals" data-testid="input-project-goals" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deliverables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deliverables</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Key deliverables" data-testid="input-project-deliverables" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Additional notes" data-testid="input-project-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-project">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-project">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const { data: contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const contactMap = useMemo(() => {
    const map = new Map<number, string>();
    (contacts ?? []).forEach((c: any) => map.set(c.id, c.name));
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = projects ?? [];

    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "status":
          return (a.status ?? "").localeCompare(b.status ?? "");
        case "endDate": {
          const aDate = a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const bDate = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return aDate - bDate;
        }
        case "updatedAt":
        default: {
          const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bDate - aDate;
        }
      }
    });

    return list;
  }, [projects, statusFilter, search, sortBy]);

  function handleEdit(project: Project) {
    setEditProject(project);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditProject(null);
    setDialogOpen(true);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Projects</h1>
        </div>
        <Button onClick={handleCreate} data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap" data-testid="tabs-status-filter">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          {PROJECT_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} data-testid={`tab-${s}`}>
              {statusLabels[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort">
            <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Last Updated</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="endDate">Due Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state">
          <Rocket className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {search || statusFilter !== "all"
              ? "No projects match your filters."
              : "No projects yet. Create your first project to get started!"}
          </p>
          {!search && statusFilter === "all" && (
            <Button variant="outline" className="mt-4" onClick={handleCreate} data-testid="button-empty-create">
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card
                className="p-4 space-y-2 cursor-pointer hover-elevate"
                data-testid={`card-project-${project.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm leading-snug line-clamp-2" data-testid={`text-project-name-${project.id}`}>
                    {project.name}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] flex-shrink-0 ${statusColors[project.status ?? "planning"]}`}
                    data-testid={`badge-status-${project.id}`}
                  >
                    {statusLabels[project.status ?? "planning"]}
                  </Badge>
                </div>

                {project.ownerId && (
                  <p className="text-xs text-muted-foreground" data-testid={`text-owner-${project.id}`}>
                    Owner: {contactMap.get(project.ownerId) ?? "Unknown"}
                  </p>
                )}

                {(project.startDate || project.endDate) && (
                  <p className="text-xs text-muted-foreground">
                    {project.startDate && format(new Date(project.startDate), "d MMM yyyy")}
                    {project.startDate && project.endDate && " — "}
                    {project.endDate && format(new Date(project.endDate), "d MMM yyyy")}
                  </p>
                )}

                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}

                {project.updatedAt && (
                  <p className="text-[11px] text-muted-foreground/70" data-testid={`text-updated-${project.id}`}>
                    Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditProject(null);
        }}
        editProject={editProject}
      />
    </div>
  );
}
