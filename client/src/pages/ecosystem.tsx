import { useState, useMemo } from "react";
import { useGroups, useDeleteGroup } from "@/hooks/use-groups";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import {
  Search, Heart, Handshake, MessageCircle, Building2, Users,
  Edit3, Trash2, Merge, Check, X, ChevronDown, ChevronRight,
  FileText, ExternalLink, Globe, UserCheck
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Group } from "@shared/schema";

const TIER_CONFIG = {
  support: {
    label: "Support",
    description: "Groups we actively help and mentor",
    icon: Heart,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  collaborate: {
    label: "Collaborate",
    description: "Ecosystem partners we work alongside",
    icon: Handshake,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  mentioned: {
    label: "Mentioned",
    description: "Loose connections and references",
    icon: MessageCircle,
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-950/30",
    border: "border-slate-200 dark:border-slate-800",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

const TYPE_COLORS: Record<string, string> = {
  "Organisation": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Community Group": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "Community Collective": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "Resident Company": "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "Business": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Partner": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Government": "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  "Iwi": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "NGO": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "Education": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
};

export default function EcosystemPage() {
  const { data: groups, isLoading } = useGroups();
  const { data: densityData } = useQuery<Record<number, { communityCount: number; totalMembers: number }>>({
    queryKey: ['/api/groups/community-density'],
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editMode, setEditMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [collapsedTiers, setCollapsedTiers] = useState<Record<string, boolean>>({});
  const [changeTierDialog, setChangeTierDialog] = useState<{ group: Group; newTier: TierKey } | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteGroup = useDeleteGroup();

  const changeTierMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: number; tier: string }) => {
      const res = await fetch(`/api/groups/${id}/relationship-tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update tier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      toast({ title: "Tier updated" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (groupIds: number[]) => {
      const res = await fetch("/api/groups/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete groups");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      setSelectedForMerge([]);
      setBulkDeleteOpen(false);
      setEditMode(false);
      toast({ title: "Deleted", description: `${data.deleted} group${data.deleted !== 1 ? 's' : ''} removed.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryId, mergeIds }: { primaryId: number; mergeIds: number[] }) => {
      const res = await fetch("/api/groups/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, mergeIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to merge groups");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      setSelectedForMerge([]);
      setMergeDialogOpen(false);
      setPrimaryMergeId(null);
      toast({ title: "Groups merged successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!groups) return [];
    return (groups as Group[]).filter((g) => {
      const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || g.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [groups, search, typeFilter]);

  const tiers: TierKey[] = ["support", "collaborate", "mentioned"];

  const groupedByTier = useMemo(() => {
    const result: Record<TierKey, Group[]> = { support: [], collaborate: [], mentioned: [] };
    filtered.forEach((g) => {
      const tier = (g.relationshipTier as TierKey) || "mentioned";
      if (result[tier]) result[tier].push(g);
      else result.mentioned.push(g);
    });
    if (densityData) {
      for (const tier of Object.keys(result) as TierKey[]) {
        result[tier].sort((a, b) => {
          const aDensity = densityData[a.id]?.communityCount || 0;
          const bDensity = densityData[b.id]?.communityCount || 0;
          return bDensity - aDensity;
        });
      }
    }
    return result;
  }, [filtered, densityData]);

  const uniqueTypes = useMemo(() => {
    if (!groups) return [];
    const types = new Set((groups as Group[]).map(g => g.type).filter(Boolean));
    return Array.from(types).sort();
  }, [groups]);

  const toggleMergeSelection = (id: number) => {
    setSelectedForMerge(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const openMergeDialog = () => {
    if (selectedForMerge.length < 2) {
      toast({ title: "Select at least 2 groups to merge", variant: "destructive" });
      return;
    }
    setPrimaryMergeId(selectedForMerge[0]);
    setMergeDialogOpen(true);
  };

  const handleMerge = () => {
    if (!primaryMergeId) return;
    const mergeIds = selectedForMerge.filter(id => id !== primaryMergeId);
    mergeMutation.mutate({ primaryId: primaryMergeId, mergeIds });
  };

  const toggleTierCollapse = (tier: string) => {
    setCollapsedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  const handleTierChange = (group: Group, newTier: TierKey) => {
    if (group.relationshipTier === newTier) return;
    setChangeTierDialog({ group, newTier });
  };

  const confirmTierChange = () => {
    if (!changeTierDialog) return;
    changeTierMutation.mutate(
      { id: changeTierDialog.group.id, tier: changeTierDialog.newTier },
      { onSuccess: () => setChangeTierDialog(null) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalGroups = groups?.length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" data-testid="ecosystem-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Ecosystem</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalGroups} organisations across your network
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setEditMode(!editMode); setSelectedForMerge([]); }}
            data-testid="button-toggle-edit"
          >
            <Edit3 className="w-4 h-4 mr-1" />
            {editMode ? "Done" : "Edit"}
          </Button>
          {editMode && selectedForMerge.length >= 2 && (
            <Button size="sm" onClick={openMergeDialog} data-testid="button-merge">
              <Merge className="w-4 h-4 mr-1" />
              Merge ({selectedForMerge.length})
            </Button>
          )}
          {editMode && selectedForMerge.length >= 1 && (
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} data-testid="button-bulk-delete">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete ({selectedForMerge.length})
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search organisations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {uniqueTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tiers.map(tier => {
          const config = TIER_CONFIG[tier];
          const Icon = config.icon;
          const count = groupedByTier[tier].length;
          return (
            <Card key={tier} className={`p-3 ${config.bg} border ${config.border}`} data-testid={`stat-tier-${tier}`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${config.color}`} />
                <div>
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{config.label}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="space-y-6">
        {tiers.map(tier => {
          const config = TIER_CONFIG[tier];
          const Icon = config.icon;
          const tierGroups = groupedByTier[tier];
          const isCollapsed = collapsedTiers[tier];

          return (
            <div key={tier} data-testid={`tier-section-${tier}`}>
              <button
                className="flex items-center gap-2 w-full text-left mb-3"
                onClick={() => toggleTierCollapse(tier)}
                data-testid={`button-toggle-tier-${tier}`}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Icon className={`w-5 h-5 ${config.color}`} />
                <h2 className="text-lg font-semibold">{config.label}</h2>
                <span className="text-sm text-muted-foreground">({tierGroups.length})</span>
                <span className="text-xs text-muted-foreground ml-2">{config.description}</span>
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tierGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
                      No organisations in this tier
                    </p>
                  )}
                  {tierGroups.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      tier={tier}
                      editMode={editMode}
                      isSelectedForMerge={selectedForMerge.includes(group.id)}
                      onToggleMerge={() => toggleMergeSelection(group.id)}
                      onDelete={() => setDeleteConfirmId(group.id)}
                      onChangeTier={(newTier) => handleTierChange(group, newTier)}
                      onNavigate={() => setLocation("/groups")}
                      communityCount={densityData?.[group.id]?.communityCount || 0}
                      totalMembers={densityData?.[group.id]?.totalMembers || 0}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent data-testid="dialog-merge">
          <DialogHeader>
            <DialogTitle>Merge Groups</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Select the primary group to keep. All members and taxonomy links from the other groups will be transferred here.
          </p>
          <div className="space-y-2">
            {selectedForMerge.map(id => {
              const g = (groups as Group[])?.find(x => x.id === id);
              if (!g) return null;
              return (
                <label
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    primaryMergeId === id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`merge-option-${id}`}
                >
                  <input
                    type="radio"
                    name="primaryMerge"
                    checked={primaryMergeId === id}
                    onChange={() => setPrimaryMergeId(id)}
                    className="accent-primary"
                  />
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.type}</div>
                  </div>
                  {primaryMergeId === id && (
                    <Badge className="ml-auto text-xs">Primary</Badge>
                  )}
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} data-testid="button-cancel-merge">
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!primaryMergeId || mergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeMutation.isPending ? "Merging..." : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure? This will remove the group, its members, and taxonomy links permanently.
          </p>
          <DialogFooter>
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

      <Dialog open={changeTierDialog !== null} onOpenChange={() => setChangeTierDialog(null)}>
        <DialogContent data-testid="dialog-change-tier">
          <DialogHeader>
            <DialogTitle>Change Relationship Tier</DialogTitle>
          </DialogHeader>
          {changeTierDialog && (
            <p className="text-sm text-muted-foreground">
              Move <strong>{changeTierDialog.group.name}</strong> from{" "}
              <strong>{TIER_CONFIG[(changeTierDialog.group.relationshipTier as TierKey) || "mentioned"].label}</strong> to{" "}
              <strong>{TIER_CONFIG[changeTierDialog.newTier].label}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeTierDialog(null)} data-testid="button-cancel-tier-change">
              Cancel
            </Button>
            <Button
              onClick={confirmTierChange}
              disabled={changeTierMutation.isPending}
              data-testid="button-confirm-tier-change"
            >
              {changeTierMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle>Delete {selectedForMerge.length} Group{selectedForMerge.length !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the selected groups, their member links, and taxonomy links permanently. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} data-testid="button-cancel-bulk-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(selectedForMerge)}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({
  group,
  tier,
  editMode,
  isSelectedForMerge,
  onToggleMerge,
  onDelete,
  onChangeTier,
  onNavigate,
  communityCount,
  totalMembers,
}: {
  group: Group;
  tier: TierKey;
  editMode: boolean;
  isSelectedForMerge: boolean;
  onToggleMerge: () => void;
  onDelete: () => void;
  onChangeTier: (tier: TierKey) => void;
  onNavigate: () => void;
  communityCount: number;
  totalMembers: number;
}) {
  const config = TIER_CONFIG[tier];
  const typeColor = TYPE_COLORS[group.type] || "bg-gray-500/10 text-gray-700 dark:text-gray-300";

  return (
    <Card
      className={`p-4 transition hover:shadow-md ${editMode && isSelectedForMerge ? "ring-2 ring-primary" : ""}`}
      data-testid={`card-group-${group.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate" data-testid={`text-group-name-${group.id}`}>
              {group.name}
            </h3>
            <Badge variant="outline" className={`text-[10px] px-1.5 ${typeColor}`}>
              {group.type}
            </Badge>
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{group.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {communityCount > 0 && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20" data-testid={`badge-community-count-${group.id}`}>
                <UserCheck className="w-3 h-3" />
                {communityCount} community
              </Badge>
            )}
            {group.importSource && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileText className="w-3 h-3" />
                {group.importSource.replace("Imported from legacy report ", "")}
              </Badge>
            )}
            {group.website && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Globe className="w-3 h-3" />
                Web
              </Badge>
            )}
          </div>
        </div>

        {editMode && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              className={`w-6 h-6 rounded border flex items-center justify-center transition ${
                isSelectedForMerge ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"
              }`}
              onClick={onToggleMerge}
              title="Select for merge"
              data-testid={`button-select-merge-${group.id}`}
            >
              {isSelectedForMerge && <Check className="w-3 h-3" />}
            </button>
            <button
              className="w-6 h-6 rounded border border-border flex items-center justify-center hover:border-destructive hover:text-destructive transition"
              onClick={onDelete}
              title="Delete"
              data-testid={`button-delete-${group.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {!editMode && (
        <div className="flex items-center gap-1 mt-3">
          {(["support", "collaborate", "mentioned"] as TierKey[]).map(t => {
            const TierIcon = TIER_CONFIG[t].icon;
            const isActive = tier === t;
            return (
              <button
                key={t}
                className={`p-1 rounded transition ${
                  isActive
                    ? `${TIER_CONFIG[t].badge}`
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
                onClick={() => onChangeTier(t)}
                title={`Move to ${TIER_CONFIG[t].label}`}
                data-testid={`button-tier-${t}-${group.id}`}
              >
                <TierIcon className="w-3.5 h-3.5" />
              </button>
            );
          })}
          <button
            className="ml-auto p-1 text-muted-foreground hover:text-foreground transition"
            onClick={onNavigate}
            title="View in Groups"
            data-testid={`button-view-group-${group.id}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </Card>
  );
}
