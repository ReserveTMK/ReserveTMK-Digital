import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Loader2,
  Search,
  Trash2,
  Pencil,
  Trophy,
  DollarSign,
  Calendar,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { MILESTONE_TYPES, type Milestone, type Contact, type Programme } from "@shared/schema";

const MILESTONE_TYPE_LABELS: Record<string, string> = {
  funding_secured: "Funding Secured",
  business_launched: "Business Launched",
  collaboration_formed: "Collaboration Formed",
  job_created: "Job Created",
  prototype_completed: "Prototype Completed",
  revenue_milestone: "Revenue Milestone",
  other: "Other",
};

const MILESTONE_TYPE_COLORS: Record<string, string> = {
  funding_secured: "bg-green-500/15 text-green-700 dark:text-green-300",
  business_launched: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  collaboration_formed: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  job_created: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  prototype_completed: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  revenue_milestone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  other: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

const milestoneFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  milestoneType: z.enum(MILESTONE_TYPES).default("other"),
  description: z.string().optional().default(""),
  linkedContactId: z.number().nullable().optional(),
  linkedGroupId: z.number().nullable().optional(),
  linkedProgrammeId: z.number().nullable().optional(),
  valueAmount: z.string().optional().default(""),
  valueCurrency: z.string().default("NZD"),
  funderTags: z.array(z.string()).default([]),
});

type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

type Group = {
  id: number;
  name: string;
};

export default function MilestonesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
  const [search, setSearch] = useState("");
  const [funderTagInput, setFunderTagInput] = useState("");

  const { data: milestones, isLoading } = useQuery<Milestone[]>({
    queryKey: ["/api/milestones"],
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: groups } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
  });

  const { data: programmes } = useQuery<Programme[]>({
    queryKey: ["/api/programmes"],
  });

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      title: "",
      milestoneType: "other",
      description: "",
      linkedContactId: null,
      linkedGroupId: null,
      linkedProgrammeId: null,
      valueAmount: "",
      valueCurrency: "NZD",
      funderTags: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/milestones", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      toast({ title: "Milestone created" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/milestones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      toast({ title: "Milestone updated" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/milestones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      toast({ title: "Milestone deleted" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingMilestone(null);
    setFunderTagInput("");
    form.reset({
      title: "",
      milestoneType: "other",
      description: "",
      linkedContactId: null,
      linkedGroupId: null,
      linkedProgrammeId: null,
      valueAmount: "",
      valueCurrency: "NZD",
      funderTags: [],
    });
  }

  function openCreate() {
    closeDialog();
    setDialogOpen(true);
  }

  function openEdit(milestone: Milestone) {
    setEditingMilestone(milestone);
    form.reset({
      title: milestone.title,
      milestoneType: milestone.milestoneType as MilestoneFormValues["milestoneType"],
      description: milestone.description || "",
      linkedContactId: milestone.linkedContactId || null,
      linkedGroupId: milestone.linkedGroupId || null,
      linkedProgrammeId: milestone.linkedProgrammeId || null,
      valueAmount: milestone.valueAmount ? String(milestone.valueAmount) : "",
      valueCurrency: milestone.valueCurrency || "NZD",
      funderTags: milestone.funderTags || [],
    });
    setDialogOpen(true);
  }

  function onSubmit(values: MilestoneFormValues) {
    const payload: Record<string, unknown> = {
      title: values.title,
      milestoneType: values.milestoneType,
      description: values.description || null,
      linkedContactId: values.linkedContactId || null,
      linkedGroupId: values.linkedGroupId || null,
      linkedProgrammeId: values.linkedProgrammeId || null,
      valueAmount: values.valueAmount ? values.valueAmount : null,
      valueCurrency: values.valueCurrency,
      funderTags: values.funderTags.length > 0 ? values.funderTags : null,
    };

    if (editingMilestone) {
      updateMutation.mutate({ id: editingMilestone.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function addFunderTag() {
    const tag = funderTagInput.trim();
    if (tag && !form.getValues("funderTags").includes(tag)) {
      form.setValue("funderTags", [...form.getValues("funderTags"), tag]);
    }
    setFunderTagInput("");
  }

  function removeFunderTag(tag: string) {
    form.setValue(
      "funderTags",
      form.getValues("funderTags").filter((t) => t !== tag)
    );
  }

  const filtered = milestones?.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    MILESTONE_TYPE_LABELS[m.milestoneType]?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-milestones-heading">
              Milestones
            </h1>
            <p className="text-muted-foreground mt-1">
              Track achievements, funding, and key outcomes.
            </p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-milestone">
            <Plus className="w-4 h-4 mr-2" />
            New Milestone
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search milestones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-milestones"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground" data-testid="text-no-milestones">
              {search ? "No milestones match your search." : "No milestones yet. Create your first one!"}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((milestone) => {
              const contact = contacts?.find((c) => c.id === milestone.linkedContactId);
              const group = groups?.find((g) => g.id === milestone.linkedGroupId);
              const programme = programmes?.find((p) => p.id === milestone.linkedProgrammeId);

              return (
                <Card
                  key={milestone.id}
                  className="p-4"
                  data-testid={`card-milestone-${milestone.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <Trophy className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm" data-testid={`text-milestone-title-${milestone.id}`}>
                            {milestone.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className={MILESTONE_TYPE_COLORS[milestone.milestoneType] || ""}
                            data-testid={`badge-milestone-type-${milestone.id}`}
                          >
                            {MILESTONE_TYPE_LABELS[milestone.milestoneType] || milestone.milestoneType}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {milestone.createdAt && (
                            <span className="flex items-center gap-1" data-testid={`text-milestone-date-${milestone.id}`}>
                              <Calendar className="w-3 h-3" />
                              {format(new Date(milestone.createdAt), "d MMM yyyy")}
                            </span>
                          )}
                          {milestone.valueAmount && (
                            <span className="flex items-center gap-1 font-medium text-foreground" data-testid={`text-milestone-value-${milestone.id}`}>
                              <DollarSign className="w-3 h-3" />
                              {Number(milestone.valueAmount).toLocaleString()} {milestone.valueCurrency || "NZD"}
                            </span>
                          )}
                          {contact && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-milestone-contact-${milestone.id}`}>
                              {contact.name}
                            </Badge>
                          )}
                          {group && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-milestone-group-${milestone.id}`}>
                              {group.name}
                            </Badge>
                          )}
                          {programme && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-milestone-programme-${milestone.id}`}>
                              {programme.name}
                            </Badge>
                          )}
                        </div>

                        {milestone.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {milestone.description}
                          </p>
                        )}

                        {milestone.funderTags && milestone.funderTags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {milestone.funderTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(milestone)}
                        data-testid={`button-edit-milestone-${milestone.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(milestone)}
                        data-testid={`button-delete-milestone-${milestone.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingMilestone ? "Edit Milestone" : "New Milestone"}
            </DialogTitle>
            <DialogDescription className="sr-only">{editingMilestone ? "Edit milestone details" : "Create a new milestone"}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Secured $50k grant" data-testid="input-milestone-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="milestoneType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-milestone-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MILESTONE_TYPES.map((t) => (
                          <SelectItem key={t} value={t} data-testid={`option-type-${t}`}>
                            {MILESTONE_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Textarea {...field} placeholder="Optional description..." rows={3} data-testid="input-milestone-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedContactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Contact</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : Number(v))}
                      value={field.value ? String(field.value) : "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-linked-contact">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {contacts?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Group</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : Number(v))}
                      value={field.value ? String(field.value) : "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-linked-group">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {groups?.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedProgrammeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Programme</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : Number(v))}
                      value={field.value ? String(field.value) : "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-linked-programme">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {programmes?.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valueAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0.00" data-testid="input-milestone-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valueCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="NZD" data-testid="input-milestone-currency" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>Funder Tags</FormLabel>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    value={funderTagInput}
                    onChange={(e) => setFunderTagInput(e.target.value)}
                    placeholder="Add funder tag..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFunderTag();
                      }
                    }}
                    data-testid="input-funder-tag"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFunderTag}
                    data-testid="button-add-funder-tag"
                  >
                    Add
                  </Button>
                </div>
                {form.watch("funderTags").length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {form.watch("funderTags").map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeFunderTag(tag)}
                          data-testid={`button-remove-tag-${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel-milestone">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-save-milestone">
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingMilestone ? "Save Changes" : "Create Milestone"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
