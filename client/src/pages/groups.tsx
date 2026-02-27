import { Button } from "@/components/ui/beautiful-button";
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, useGroupMembers, useAddGroupMember, useRemoveGroupMember, useEnrichGroup, useGroupTaxonomyLinks, useSaveGroupTaxonomyLinks } from "@/hooks/use-groups";
import { useContacts } from "@/hooks/use-contacts";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { Plus, Search, Loader2, Building2, Users, X, Trash2, UserPlus, ChevronRight, Mail, Phone, MapPin, Sparkles, Check, Globe, Target, History, ChevronDown, Pencil, Edit3, CheckSquare, UserCheck, ArrowRightLeft, Tag, Merge } from "lucide-react";
import { RelationshipStageSelector } from "@/components/relationship-stage-selector";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { GROUP_TYPES, type Group, type GroupMember } from "@shared/schema";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const GROUP_TYPE_COLORS: Record<string, string> = {
  "Organisation": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Collective": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "Community Group": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "Community Collective": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Whānau Group": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Business": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Resident Company": "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "Partner": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Government": "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  "Iwi": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "NGO": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "Education": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  "Other": "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

const MEMBER_ROLES = ["Lead Contact", "Representative", "Member", "Coordinator", "Director", "Trustee"] as const;

export default function Groups() {
  const { data: groups, isLoading } = useGroups();
  const { data: contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"community" | "all">("all");
  const [bulkTierOpen, setBulkTierOpen] = useState(false);
  const [bulkTierValue, setBulkTierValue] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const { toast } = useToast();

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const { data: communityDensity } = useQuery<Record<number, { communityCount: number; totalMembers: number }>>({
    queryKey: ['/api/groups/community-density'],
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (groupIds: number[]) => {
      await apiRequest('POST', '/api/groups/bulk-delete', { groupIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      toast({ title: "Groups deleted", description: `${selectedGroups.size} group(s) deleted successfully` });
      setSelectedGroups(new Set());
      setBulkDeleteOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkTierMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/groups/bulk-update-tier', { groupIds: Array.from(selectedGroups), tier: bulkTierValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      toast({ title: "Tier updated", description: `${selectedGroups.size} group(s) updated to "${bulkTierValue}"` });
      setSelectedGroups(new Set());
      setBulkTierOpen(false);
      setBulkTierValue("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryId, mergeIds }: { primaryId: number; mergeIds: number[] }) => {
      const res = await apiRequest("POST", "/api/groups/merge", { primaryId, mergeIds });
      if (!res.ok) throw new Error("Failed to merge groups");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      toast({ title: "Groups merged successfully" });
      setSelectedGroups(new Set());
      setMergeDialogOpen(false);
      setPrimaryMergeId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openMergeDialog = () => {
    if (selectedGroups.size < 2) {
      toast({ title: "Select at least 2 groups to merge", variant: "destructive" });
      return;
    }
    setPrimaryMergeId(Array.from(selectedGroups)[0]);
    setMergeDialogOpen(true);
  };

  const confirmMerge = () => {
    if (!primaryMergeId) return;
    const mergeIds = Array.from(selectedGroups).filter(id => id !== primaryMergeId);
    mergeMutation.mutate({ primaryId: primaryMergeId, mergeIds });
  };

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    return groups.filter((g: Group) => {
      const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase()) ||
        g.contactEmail?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || g.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [groups, search, typeFilter]);

  const displayGroups = useMemo(() => {
    let result = filteredGroups;
    if (viewMode === "community") {
      result = result.filter((g: Group) => {
        const density = communityDensity?.[g.id];
        return density && density.communityCount > 0;
      });
    }
    result.sort((a: Group, b: Group) => {
      const aCount = communityDensity?.[a.id]?.communityCount || 0;
      const bCount = communityDensity?.[b.id]?.communityCount || 0;
      return bCount - aCount;
    });
    return result;
  }, [filteredGroups, communityDensity, viewMode]);

  const openCreateDialog = () => {
    setEditingGroup(null);
    setDialogOpen(true);
  };

  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const toggleEditMode = () => {
    if (editMode) {
      setSelectedGroups(new Set());
    }
    setEditMode(!editMode);
  };

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = displayGroups.map((g: Group) => g.id);
    setSelectedGroups(new Set(allIds));
  };

  const renderGroupCard = (group: Group) => (
    <GroupCard
      key={group.id}
      group={group}
      onSelect={() => setSelectedGroup(group)}
      onEdit={() => openEditDialog(group)}
      onDelete={() => setDeleteConfirmId(group.id)}
      editMode={editMode}
      isSelected={selectedGroups.has(group.id)}
      onToggleSelect={() => toggleGroupSelection(group.id)}
      communityCount={communityDensity?.[group.id]?.communityCount || 0}
    />
  );

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      {editMode && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-md px-4 md:px-8 py-3" data-testid="edit-toolbar-groups">
          <div className="max-w-6xl mx-auto w-full flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all-groups">
              <CheckSquare className="w-4 h-4 mr-2" />
              Select All
            </Button>
            {selectedGroups.size > 0 && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  data-testid="button-bulk-delete-groups"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedGroups.size})
                </Button>
                {viewMode === "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast({
                        title: "Community membership",
                        description: "Community status is determined by member engagement, not manual assignment.",
                      });
                    }}
                    data-testid="button-move-to-community"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Move to Community
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkTierOpen(true)}
                  data-testid="button-change-tier"
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Change Tier
                </Button>
                {selectedGroups.size >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openMergeDialog}
                    data-testid="button-merge-groups"
                  >
                    <Merge className="w-4 h-4 mr-2" />
                    Merge ({selectedGroups.size})
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={toggleEditMode} data-testid="button-toggle-edit-mode">
              <Check className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        </div>
      )}
        <div className="max-w-6xl mx-auto space-y-6">

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-groups-title">
                Groups & Organisations
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage organisations, collectives and community groups
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!editMode && (
                <>
                  <Button variant="outline" onClick={toggleEditMode} data-testid="button-toggle-edit-mode">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button onClick={openCreateDialog} data-testid="button-create-group">
                    <Plus className="w-4 h-4 mr-2" />
                    New Group
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2" data-testid="view-toggle">
              <Button
                variant={viewMode === "community" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("community")}
                data-testid="button-view-community"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Community
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("all")}
                data-testid="button-view-all"
              >
                <Building2 className="w-4 h-4 mr-2" />
                All
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-groups"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {GROUP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : displayGroups.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold mb-2">
                  {groups?.length === 0 ? "No groups yet" : "No matching groups"}
                </h3>
                <p className="text-sm mb-4">
                  {groups?.length === 0
                    ? "Create your first group or organisation to start tracking community relationships"
                    : "Try adjusting your search or filters"}
                </p>
                {groups?.length === 0 && (
                  <Button onClick={openCreateDialog} data-testid="button-create-group-empty">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Group
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayGroups.map(renderGroupCard)}
            </div>
          )}
        </div>

        <GroupFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          group={editingGroup}
          onCreate={createGroup}
          onUpdate={updateGroup}
        />

        {selectedGroup && (
          <GroupDetailDialog
            group={selectedGroup}
            open={!!selectedGroup}
            onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}
            contacts={contacts || []}
            onEdit={() => { setSelectedGroup(null); openEditDialog(selectedGroup); }}
          />
        )}

        <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete Group</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will remove the group and all its member links. Individual contacts will not be deleted. Are you sure?
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmId) {
                    deleteGroup.mutate(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                data-testid="button-confirm-delete"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle data-testid="text-bulk-delete-title">Delete {selectedGroups.size} groups?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground" data-testid="text-bulk-delete-description">
              This will remove all member links. This cannot be undone.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} data-testid="button-cancel-bulk-delete">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedGroups))}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-confirm-bulk-delete"
              >
                {bulkDeleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkTierOpen} onOpenChange={(open) => { setBulkTierOpen(open); if (!open) setBulkTierValue(""); }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle data-testid="text-bulk-tier-title">Change Tier for {selectedGroups.size} groups</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Relationship Tier</Label>
              <Select value={bulkTierValue} onValueChange={setBulkTierValue}>
                <SelectTrigger data-testid="select-bulk-tier">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="collaborate">Collaborate</SelectItem>
                  <SelectItem value="mentioned">Noted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setBulkTierOpen(false); setBulkTierValue(""); }} data-testid="button-cancel-bulk-tier">
                Cancel
              </Button>
              <Button
                onClick={() => bulkTierMutation.mutate()}
                disabled={!bulkTierValue || bulkTierMutation.isPending}
                data-testid="button-confirm-bulk-tier"
              >
                {bulkTierMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Tier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={mergeDialogOpen} onOpenChange={(v) => { setMergeDialogOpen(v); if (!v) setPrimaryMergeId(null); }}>
          <DialogContent data-testid="dialog-merge-groups">
            <DialogHeader>
              <DialogTitle data-testid="text-merge-groups-title">Merge {selectedGroups.size} Groups</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Choose the primary group to keep. Members, taxonomy links, and all related data from the other groups will be merged into it, and the duplicates will be removed.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto py-2">
              {Array.from(selectedGroups).map(id => {
                const g = groups?.find((gr: any) => gr.id === id);
                if (!g) return null;
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${primaryMergeId === id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    onClick={() => setPrimaryMergeId(id)}
                    data-testid={`merge-group-option-${id}`}
                  >
                    <input type="radio" checked={primaryMergeId === id} onChange={() => setPrimaryMergeId(id)} className="accent-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[g.type, g.relationshipTier].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {primaryMergeId === id && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeDialogOpen(false)} data-testid="button-cancel-merge-groups">
                Cancel
              </Button>
              <Button
                onClick={confirmMerge}
                disabled={!primaryMergeId || mergeMutation.isPending}
                data-testid="button-confirm-merge-groups"
              >
                {mergeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
                {mergeMutation.isPending ? "Merging..." : "Merge"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
  );
}

function GroupCard({ group, onSelect, onEdit, onDelete, editMode, isSelected, onToggleSelect, communityCount }: {
  group: Group;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  communityCount: number;
}) {
  const { data: members } = useGroupMembers(group.id);
  const memberCount = members?.length || 0;

  const handleClick = () => {
    if (editMode) {
      onToggleSelect();
    } else {
      onSelect();
    }
  };

  return (
    <Card
      className={`p-4 hover-elevate cursor-pointer ${editMode && isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={handleClick}
      data-testid={`card-group-${group.id}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {editMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect()}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
                data-testid={`checkbox-group-${group.id}`}
              />
            )}
            <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-sm truncate" data-testid={`text-group-name-${group.id}`}>{group.name}</h3>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <Badge className={`text-[10px] ${GROUP_TYPE_COLORS[group.type] || ""}`}>
                  {group.type}
                </Badge>
                {communityCount > 0 && (
                  <Badge className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300" data-testid={`badge-community-${group.id}`}>
                    <UserCheck className="w-3 h-3 mr-0.5" />
                    {communityCount} community
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {!editMode && (
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" onClick={onEdit} title="Edit" data-testid={`button-edit-group-${group.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={onDelete} title="Delete" data-testid={`button-delete-group-${group.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {group.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
          {group.contactEmail && (
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {group.contactEmail}
            </span>
          )}
          {group.address && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {group.address}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function GroupFormDialog({ open, onOpenChange, group, onCreate, onUpdate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  onCreate: ReturnType<typeof useCreateGroup>;
  onUpdate: ReturnType<typeof useUpdateGroup>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("Organisation");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName(group?.name || "");
    setType(group?.type || "Organisation");
    setDescription(group?.description || "");
    setContactEmail(group?.contactEmail || "");
    setContactPhone(group?.contactPhone || "");
    setAddress(group?.address || "");
    setWebsite(group?.website || "");
    setNotes(group?.notes || "");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (group) {
      onUpdate.mutate({ id: group.id, data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      onCreate.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isPending = onCreate.isPending || onUpdate.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{group ? "Edit Group" : "New Group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Creative Collective NZ" data-testid="input-group-name" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-group-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." data-testid="input-group-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="info@org.co.nz" data-testid="input-group-email" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+64..." data-testid="input-group-phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" data-testid="input-group-address" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.org.co.nz" data-testid="input-group-website" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." data-testid="input-group-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-group">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending} data-testid="button-save-group">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {group ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetailDialog({ group, open, onOpenChange, contacts, onEdit }: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[];
  onEdit: () => void;
}) {
  const { data: members, isLoading: membersLoading } = useGroupMembers(group.id);
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const enrichGroup = useEnrichGroup();
  const updateGroup = useUpdateGroup();
  const saveTaxonomyLinks = useSaveGroupTaxonomyLinks();
  const { data: taxonomyLinks } = useGroupTaxonomyLinks(group.id);
  const { data: taxonomyCategories } = useTaxonomy();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("Member");
  const [enrichData, setEnrichData] = useState<Record<string, any> | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [selectedKaupapa, setSelectedKaupapa] = useState<Set<number>>(new Set());
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);
  const { toast } = useToast();

  const stageUpdateMutation = useMutation({
    mutationFn: (stage: string) => apiRequest('PATCH', `/api/groups/${group.id}/relationship-stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/relationship-stage-history', 'group', group.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/relationship-stages'] });
      toast({ title: "Stage updated" });
    },
  });

  const { data: stageHistory } = useQuery({
    queryKey: ['/api/relationship-stage-history', 'group', group.id],
    queryFn: async () => {
      const res = await fetch(`/api/relationship-stage-history/group/${group.id}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const existingContactIds = new Set((members || []).map((m: GroupMember) => m.contactId));
  const availableContacts = contacts.filter((c) => !existingContactIds.has(c.id));
  const filteredAvailable = availableContacts.filter((c) =>
    c.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const getContactName = (contactId: number) => {
    return contacts.find((c) => c.id === contactId)?.name || `Contact #${contactId}`;
  };

  const handleAddMember = (contactId: number) => {
    addMember.mutate({ groupId: group.id, contactId, role: selectedRole }, {
      onSuccess: () => {
        setAddMemberOpen(false);
        setMemberSearch("");
        toast({ title: "Member added", description: `${getContactName(contactId)} added to ${group.name}` });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleRemoveMember = (member: GroupMember) => {
    removeMember.mutate({ groupId: group.id, memberId: member.id, contactId: member.contactId });
  };

  const handleEnrich = () => {
    enrichGroup.mutate(group.id, {
      onSuccess: (data) => {
        const nonNullFields = Object.entries(data).filter(([k, v]) => k !== "kaupapa" && v != null);
        const hasKaupapa = Array.isArray(data.kaupapa) && data.kaupapa.length > 0;
        if (nonNullFields.length === 0 && !hasKaupapa) {
          toast({ title: "No suggestions found", description: "AI couldn't find public information for this organisation" });
          return;
        }
        setEnrichData(data);
        setSelectedFields(new Set(nonNullFields.map(([k]) => k)));
        if (hasKaupapa) {
          setSelectedKaupapa(new Set(data.kaupapa.map((_: any, i: number) => i)));
        }
      },
      onError: (err) => {
        toast({ title: "Enrichment failed", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleAcceptEnrichment = () => {
    if (!enrichData) return;
    const updates: Record<string, any> = {};
    selectedFields.forEach((field) => {
      if (enrichData[field] != null) {
        updates[field] = enrichData[field];
      }
    });

    const kaupapa = enrichData.kaupapa || [];
    const selectedKaupLinks = kaupapa
      .filter((_: any, i: number) => selectedKaupapa.has(i))
      .map((k: any) => ({
        taxonomyId: k.taxonomyId,
        confidence: k.confidence,
        reasoning: k.reasoning,
      }));

    const hasFieldUpdates = Object.keys(updates).length > 0;
    const hasKaupUpdates = selectedKaupLinks.length > 0;

    if (!hasFieldUpdates && !hasKaupUpdates) {
      toast({ title: "No items selected", description: "Select at least one field or kaupapa match to apply" });
      return;
    }

    const onDone = () => {
      toast({ title: "Group updated", description: "AI suggestions applied successfully" });
      setEnrichData(null);
      setSelectedFields(new Set());
      setSelectedKaupapa(new Set());
    };

    if (hasFieldUpdates && hasKaupUpdates) {
      updateGroup.mutate({ id: group.id, data: updates }, {
        onSuccess: () => {
          saveTaxonomyLinks.mutate({ groupId: group.id, links: selectedKaupLinks }, { onSuccess: onDone });
        },
      });
    } else if (hasFieldUpdates) {
      updateGroup.mutate({ id: group.id, data: updates }, { onSuccess: onDone });
    } else {
      saveTaxonomyLinks.mutate({ groupId: group.id, links: selectedKaupLinks }, { onSuccess: onDone });
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const ENRICH_FIELD_LABELS: Record<string, { label: string; icon: any }> = {
    description: { label: "Description", icon: Building2 },
    contactEmail: { label: "Email", icon: Mail },
    contactPhone: { label: "Phone", icon: Phone },
    address: { label: "Address", icon: MapPin },
    website: { label: "Website", icon: Globe },
    notes: { label: "Notes", icon: Building2 },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setEnrichData(null); setSelectedKaupapa(new Set()); } }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {group.name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={GROUP_TYPE_COLORS[group.type] || ""}>{group.type}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrich}
                disabled={enrichGroup.isPending}
                data-testid="button-enrich-group"
              >
                {enrichGroup.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                {enrichGroup.isPending ? "Researching..." : "Enrich"}
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit} data-testid="button-edit-from-detail">
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Relationship Stage</h4>
          <RelationshipStageSelector
            currentStage={group.relationshipStage || "new"}
            onStageChange={(stage) => stageUpdateMutation.mutate(stage)}
            disabled={stageUpdateMutation.isPending}
          />
          <Collapsible open={stageHistoryOpen} onOpenChange={setStageHistoryOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="toggle-group-stage-history">
              <History className="w-3 h-3" />
              Stage History
              <ChevronDown className={`w-3 h-3 transition-transform ${stageHistoryOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              {Array.isArray(stageHistory) && stageHistory.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {stageHistory.map((h: any) => (
                    <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{h.previousStage || "—"}</span>
                      <span>→</span>
                      <Badge variant="secondary" className="text-[10px]">{h.newStage}</Badge>
                      <span className="ml-auto">{h.changedAt ? format(new Date(h.changedAt), "dd MMM yyyy") : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No stage changes recorded yet.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {enrichData && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Suggestions
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEnrichData(null); setSelectedFields(new Set()); setSelectedKaupapa(new Set()); }}
                  data-testid="button-dismiss-enrich"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptEnrichment}
                  disabled={(selectedFields.size === 0 && selectedKaupapa.size === 0) || updateGroup.isPending || saveTaxonomyLinks.isPending}
                  data-testid="button-accept-enrich"
                >
                  {updateGroup.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Apply Selected
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(enrichData).filter(([k, v]) => k !== "kaupapa" && v != null).map(([field, value]) => {
                const meta = ENRICH_FIELD_LABELS[field];
                if (!meta) return null;
                const IconComp = meta.icon;
                const isSelected = selectedFields.has(field);
                const existingValue = (group as any)[field];
                const isOverwrite = !!existingValue && existingValue !== value;
                return (
                  <div
                    key={field}
                    className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                      isSelected ? "border-primary/50 bg-primary/10" : "border-border bg-background"
                    }`}
                    onClick={() => toggleField(field)}
                    data-testid={`enrich-field-${field}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <IconComp className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
                          {isOverwrite && (
                            <Badge variant="secondary" className="text-[9px]">overwrites existing</Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{String(value)}</p>
                        {isOverwrite && (
                          <p className="text-xs text-muted-foreground mt-1 line-through">{String(existingValue)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {Array.isArray(enrichData.kaupapa) && enrichData.kaupapa.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Kaupapa Alignment
                </h5>
                {enrichData.kaupapa.map((match: any, idx: number) => {
                  const isSelected = selectedKaupapa.has(idx);
                  const TAXONOMY_COLORS: Record<string, string> = {
                    green: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
                    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
                    purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
                    orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
                    pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
                    red: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
                    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
                  };
                  const colorClass = TAXONOMY_COLORS[match.color] || TAXONOMY_COLORS.blue;
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                        isSelected ? `${colorClass}` : "border-border bg-background"
                      }`}
                      onClick={() => {
                        setSelectedKaupapa(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      data-testid={`enrich-kaupapa-${idx}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-medium">{match.category}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {match.confidence}% match
                            </Badge>
                          </div>
                          {match.reasoning && (
                            <p className="text-xs text-muted-foreground">{match.reasoning}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {group.contactEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {group.contactEmail}
              </span>
            )}
            {group.contactPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {group.contactPhone}
              </span>
            )}
            {group.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {group.address}
              </span>
            )}
            {group.website && (
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <a href={String(group.website).startsWith("http") ? String(group.website) : `https://${group.website}`} target="_blank" rel="noopener noreferrer" className="underline">{group.website}</a>
              </span>
            )}
          </div>

          {taxonomyLinks && taxonomyLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Kaupapa Alignment
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {taxonomyLinks.map((link: any) => {
                  const cat = (taxonomyCategories || []).find((c: any) => c.id === link.taxonomyId);
                  const TAXONOMY_BADGE_COLORS: Record<string, string> = {
                    green: "bg-green-500/15 text-green-700 dark:text-green-300",
                    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                    purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
                    orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
                    pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
                    red: "bg-red-500/15 text-red-700 dark:text-red-300",
                    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
                  };
                  const color = cat?.color || "blue";
                  const badgeColor = TAXONOMY_BADGE_COLORS[color] || TAXONOMY_BADGE_COLORS.blue;
                  return (
                    <Badge
                      key={link.id}
                      className={`text-xs ${badgeColor}`}
                      title={link.reasoning || undefined}
                      data-testid={`badge-kaupapa-${link.taxonomyId}`}
                    >
                      {cat?.name || `Category #${link.taxonomyId}`}
                      {link.confidence && <span className="ml-1 opacity-60">{link.confidence}%</span>}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members ({members?.length || 0})
              </h3>
              <Popover open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-member">
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Add Member
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <div className="p-3 border-b space-y-2">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-member-role">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBER_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Command>
                    <CommandInput
                      placeholder="Search contacts..."
                      value={memberSearch}
                      onValueChange={setMemberSearch}
                      data-testid="input-search-member"
                    />
                    <CommandList>
                      <CommandEmpty>No contacts found</CommandEmpty>
                      <CommandGroup>
                        {filteredAvailable.slice(0, 20).map((c: any) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => handleAddMember(c.id)}
                            data-testid={`item-add-member-${c.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {c.name[0]}
                              </div>
                              <div>
                                <span className="text-sm">{c.name}</span>
                                {c.role && <span className="text-xs text-muted-foreground ml-1.5">{c.role}</span>}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {membersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (members || []).length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p>No members yet</p>
                <p className="text-xs mt-1">Add community members to this group</p>
              </div>
            ) : (
              <div className="space-y-1">
                {(members || []).map((member: GroupMember) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                    data-testid={`row-member-${member.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {getContactName(member.contactId)[0]}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{getContactName(member.contactId)}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{member.role || "Member"}</Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ visibility: "visible" }}
                      onClick={() => handleRemoveMember(member)}
                      data-testid={`button-remove-member-${member.id}`}
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {group.notes && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{group.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
