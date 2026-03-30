import { Button } from "@/components/ui/beautiful-button";
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, useGroupMembers, useAddGroupMember, useRemoveGroupMember, useEnrichGroup, useGroupTaxonomyLinks, useSaveGroupTaxonomyLinks, useGroupAssociations, useAddGroupAssociation, useRemoveGroupAssociation, useAllGroupAssociations } from "@/hooks/use-groups";
import { useContacts } from "@/hooks/use-contacts";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { Plus, Search, Loader2, Building2, Users, X, Trash2, UserPlus, ChevronRight, Mail, Phone, MapPin, Sparkles, Check, Globe, Target, Pencil, Edit3, CheckSquare, UserCheck, Merge, List, Table, ArrowUp, ArrowDown, ArrowUpDown, Lightbulb, MoreVertical, Star, Link2, Network } from "lucide-react";
import { ConnectionManagementPanel } from "@/components/community/ecosystem-views";
import { Link } from "wouter";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { GROUP_TYPES, ENGAGEMENT_LEVELS, type Group, type GroupMember } from "@shared/schema";
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
  "Business": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Social Enterprise": "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "Creative / Arts": "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  "Community Organisation": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Iwi / Hapū": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Government / Council": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Education / Training": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "Health / Social Services": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "Funder": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Corporate / Sponsor": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Resident Company": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "NGO": "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  "Uncategorised": "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const ENGAGEMENT_COLORS: Record<string, string> = {
  "Active": "bg-green-500/10 text-green-700 dark:text-green-300",
  "Occasional": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  "Dormant": "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

function displayGroupType(group: { type: string }): string {
  return group.type;
}

const MEMBER_ROLES = ["Lead Contact", "Representative", "Member", "Coordinator", "Director", "Trustee"] as const;

export default function Groups() {
  const { data: groups, isLoading } = useGroups();
  const { data: contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"community" | "innovators" | "all" | "vip">("all");
  const [layoutView, setLayoutView] = useState<"list" | "table">("list");


  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [bulkTypeOpen, setBulkTypeOpen] = useState(false);
  const [bulkTypeValue, setBulkTypeValue] = useState<string>("");
  const [vipReasonDialogOpen, setVipReasonDialogOpen] = useState(false);
  const [vipReasonGroupId, setVipReasonGroupId] = useState<number | null>(null);
  const [vipReasonText, setVipReasonText] = useState("");
  const { toast } = useToast();

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const { data: communityDensity } = useQuery<Record<number, { communityCount: number; totalMembers: number }>>({
    queryKey: ['/api/groups/community-density'],
  });
  const { data: allAssociations } = useAllGroupAssociations();

  const { data: suggestedDuplicates } = useQuery<{ reason: string; groups: any[] }[]>({
    queryKey: ['/api/groups/suggested-duplicates'],
  });

  const dismissDuplicateMutation = useMutation({
    mutationFn: async ({ id1, id2 }: { id1: number; id2: number }) => {
      const res = await apiRequest("POST", "/api/groups/dismiss-duplicate", { id1, id2 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/suggested-duplicates"] });
    },
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


  const bulkTypeMutation = useMutation({
    mutationFn: async ({ groupIds, type }: { groupIds: number[]; type: string }) => {
      const res = await apiRequest('POST', '/api/groups/bulk-update-type', { groupIds, type });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      toast({ title: "Types updated", description: `${data.updated || selectedGroups.size} group(s) updated` });
      setSelectedGroups(new Set());
      setBulkTypeOpen(false);
      setBulkTypeValue("");

    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: number; name: string; currentType: string; suggestedType: string; currentEngagement: string; suggestedEngagement: string; accepted: boolean }>>([]);

  const aiPreviewMutation = useMutation({
    mutationFn: async (payload: { groupIds?: number[]; autoTarget?: boolean }) => {
      const res = await apiRequest('POST', '/api/groups/ai-recategorise/preview', payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      const suggestions = (data.suggestions || []).map((s: any) => ({ ...s, accepted: true }));
      setAiSuggestions(suggestions);
      setAiPreviewOpen(true);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const aiApplyMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; type: string; engagementLevel: string }>) => {
      const res = await apiRequest('POST', '/api/groups/ai-recategorise/apply', { updates });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      toast({ title: "Recategorised", description: `${data.updated || 0} group(s) updated` });
      setAiPreviewOpen(false);
      setAiSuggestions([]);
      setSelectedGroups(new Set());
      setEditMode(false);
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

  const promoteMutation = useMutation({
    mutationFn: async ({ groupId, vipReason }: { groupId: number; vipReason?: string }) => {
      const group = groups?.find((g: Group) => g.id === groupId);
      if (!group) throw new Error("Group not found");
      if (viewMode === "innovators") {
        const res = await apiRequest("POST", `/api/groups/${groupId}/promote-vip`, vipReason ? { vipReason } : undefined);
        return res.json();
      }
      const data: Record<string, any> = {};
      if (viewMode === "all") {
        data.isCommunity = true;
        data.movedToCommunityAt = new Date().toISOString();
      } else if (viewMode === "community") {
        data.isInnovator = true;
        data.movedToInnovatorsAt = new Date().toISOString();
      }
      const res = await apiRequest("PATCH", `/api/groups/${groupId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecosystem/vip'] });
      const label = viewMode === "all" ? "Added to Our Community" : viewMode === "community" ? "Added to Our Innovators" : "Marked as VIP";
      toast({ title: "Done", description: label });
      setVipReasonDialogOpen(false);
      setVipReasonGroupId(null);
      setVipReasonText("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleGroupPromote = (groupId: number) => {
    if (viewMode === "innovators") {
      setVipReasonGroupId(groupId);
      setVipReasonText("");
      setVipReasonDialogOpen(true);
    } else {
      promoteMutation.mutate({ groupId });
    }
  };

  const confirmGroupVipPromotion = () => {
    if (!vipReasonGroupId) return;
    promoteMutation.mutate({ groupId: vipReasonGroupId, vipReason: vipReasonText.trim() || undefined });
  };

  const demoteMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const group = groups?.find((g: Group) => g.id === groupId);
      if (!group) throw new Error("Group not found");
      if (viewMode === "vip") {
        return apiRequest("POST", `/api/groups/${groupId}/demote-vip`);
      }
      const data: Record<string, any> = {};
      if (viewMode === "innovators") {
        data.isInnovator = false;
        data.movedToInnovatorsAt = null;
      } else if (viewMode === "community") {
        data.isCommunity = false;
        data.movedToCommunityAt = null;
      }
      const res = await apiRequest("PATCH", `/api/groups/${groupId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecosystem/vip'] });
      toast({ title: "Group demoted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkPromoteMutation = useMutation({
    mutationFn: async (groupIds: number[]) => {
      const promises = groupIds.map(async (id) => {
        if (viewMode === "innovators") {
          return apiRequest("POST", `/api/groups/${id}/promote-vip`);
        }
        const data: Record<string, any> = {};
        if (viewMode === "all") {
          data.isCommunity = true;
          data.movedToCommunityAt = new Date().toISOString();
        } else if (viewMode === "community") {
          data.isInnovator = true;
          data.movedToInnovatorsAt = new Date().toISOString();
        }
        return apiRequest("PATCH", `/api/groups/${id}`, data);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecosystem/vip'] });
      toast({ title: "Done", description: `${selectedGroups.size} group(s) updated` });
      setSelectedGroups(new Set());
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDemoteMutation = useMutation({
    mutationFn: async (groupIds: number[]) => {
      const promises = groupIds.map(async (id) => {
        if (viewMode === "vip") {
          return apiRequest("POST", `/api/groups/${id}/demote-vip`);
        }
        const data: Record<string, any> = {};
        if (viewMode === "innovators") {
          data.isInnovator = false;
          data.movedToInnovatorsAt = null;
        } else if (viewMode === "community") {
          data.isCommunity = false;
          data.movedToCommunityAt = null;
        }
        return apiRequest("PATCH", `/api/groups/${id}`, data);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecosystem/vip'] });
      toast({ title: "Groups demoted", description: `${selectedGroups.size} group(s) demoted` });
      setSelectedGroups(new Set());
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const innovatorCount = useMemo(() => {
    if (!groups) return 0;
    return groups.filter((g: Group) => g.isInnovator === true).length;
  }, [groups]);

  const communityCount = useMemo(() => {
    if (!groups) return 0;
    return groups.filter((g: Group) => g.isCommunity === true).length;
  }, [groups]);

  const allCount = useMemo(() => {
    if (!groups) return 0;
    return groups.length;
  }, [groups]);

  const vipCount = useMemo(() => {
    if (!groups) return 0;
    return groups.filter((g: Group) => (g as any).isVip === true).length;
  }, [groups]);

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
      const matchesEngagement = engagementFilter === "all" || (g.engagementLevel || "Active") === engagementFilter;
      return matchesSearch && matchesType && matchesEngagement;
    });
  }, [groups, search, typeFilter, engagementFilter]);

  const displayGroups = useMemo(() => {
    let result = filteredGroups;
    if (viewMode === "innovators") {
      result = result.filter((g: Group) => g.isInnovator === true);
    } else if (viewMode === "community") {
      result = result.filter((g: Group) => g.isCommunity === true);
    } else if (viewMode === "vip") {
      result = result.filter((g: Group) => (g as any).isVip === true);
    }
    result.sort((a: Group, b: Group) => {
      const aCount = communityDensity?.[a.id]?.communityCount || 0;
      const bCount = communityDensity?.[b.id]?.communityCount || 0;
      return bCount - aCount;
    });
    return result;
  }, [filteredGroups, communityDensity, viewMode]);

  const parentMap = useMemo(() => {
    const map: Record<number, { parentId: number; parentName: string }> = {};
    if (!allAssociations || !groups) return map;
    const assocs = allAssociations as any[];
    const groupList = groups as Group[];
    for (const a of assocs) {
      if (a.relationshipType === "parent") {
        const parentGroup = groupList.find(g => g.id === a.groupId);
        if (parentGroup) {
          map[a.associatedGroupId] = { parentId: a.groupId, parentName: parentGroup.name };
        }
      }
    }
    return map;
  }, [allAssociations, groups]);

  const [connectionPanelGroupId, setConnectionPanelGroupId] = useState<number | null>(null);

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
      viewMode={viewMode}
      onPromote={() => handleGroupPromote(group.id)}
      isPromoting={promoteMutation.isPending}
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
                {(viewMode === "all" || viewMode === "community" || viewMode === "innovators") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkPromoteMutation.mutate(Array.from(selectedGroups))}
                    disabled={bulkPromoteMutation.isPending}
                    data-testid="button-bulk-promote-groups"
                  >
                    {bulkPromoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUp className="w-4 h-4 mr-2" />}
                    {viewMode === "all" ? "Add to Community" : viewMode === "community" ? "Add to Innovators" : "Mark as VIP"} ({selectedGroups.size})
                  </Button>
                )}
                {(viewMode === "community" || viewMode === "innovators") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkDemoteMutation.mutate(Array.from(selectedGroups))}
                    disabled={bulkDemoteMutation.isPending}
                    data-testid="button-bulk-demote-groups"
                  >
                    {bulkDemoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                    Demote ({selectedGroups.size})
                  </Button>
                )}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkTypeOpen(true)}
                  data-testid="button-bulk-set-type"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Set Type ({selectedGroups.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiPreviewMutation.mutate({ groupIds: Array.from(selectedGroups) })}
                  disabled={aiPreviewMutation.isPending}
                  data-testid="button-ai-recategorise"
                >
                  {aiPreviewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {aiPreviewMutation.isPending ? "Analysing..." : `AI Categorise (${selectedGroups.size})`}
                </Button>
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

          <nav className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="breadcrumb-groups">
            <Link href="/community" className="hover:text-foreground transition-colors" data-testid="breadcrumb-community">Community</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium" data-testid="breadcrumb-current">Groups</span>
          </nav>

          {/* Ecosystem summary strip */}
          {groups && (groups as any[]).length > 0 && (() => {
            const activeGroups = (groups as any[]).filter((g: any) => g.active !== false);
            const maoriCount = activeGroups.filter((g: any) => g.isMaori).length;
            const pasifikaCount = activeGroups.filter((g: any) => g.isPasifika).length;
            const typeCount = new Set(activeGroups.map((g: any) => g.type).filter(Boolean)).size;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Orgs", value: activeGroups.length },
                  { label: "Māori-led", value: maoriCount },
                  { label: "Pasifika-led", value: pasifikaCount },
                  { label: "Org Types", value: typeCount },
                ].map((s) => (
                  <div key={s.label} className="bg-card border rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold">{s.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-groups-title">
                Organisations
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage organisations, collectives and community groups
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!editMode && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => aiPreviewMutation.mutate({ autoTarget: true })}
                    disabled={aiPreviewMutation.isPending}
                    data-testid="button-ai-recategorise-all"
                  >
                    {aiPreviewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {aiPreviewMutation.isPending ? "Analysing..." : "AI Recategorise"}
                  </Button>
                  <Button variant="outline" onClick={toggleEditMode} data-testid="button-toggle-edit-mode">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  {suggestedDuplicates && suggestedDuplicates.length > 0 && (
                    <Button variant="outline" onClick={() => setDuplicatesOpen(true)} data-testid="button-duplicates-groups">
                      <Merge className="w-4 h-4 mr-2" />
                      Duplicates ({suggestedDuplicates.length})
                    </Button>
                  )}
                  <Button onClick={openCreateDialog} data-testid="button-create-group">
                    <Plus className="w-4 h-4 mr-2" />
                    New Group
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* View Toggle + Search */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2" data-testid="view-toggle">
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <Button
                  variant={viewMode === "innovators" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("innovators")}
                  data-testid="button-view-innovators"
                >
                  <Lightbulb className="w-4 h-4 mr-1.5" />
                  Our Innovators ({innovatorCount})
                </Button>
                <Button
                  variant={viewMode === "community" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("community")}
                  data-testid="button-view-community"
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  Our Community ({communityCount})
                </Button>
                <Button
                  variant={viewMode === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("all")}
                  data-testid="button-view-all"
                >
                  All Groups ({allCount})
                </Button>
                <Button
                  variant={viewMode === "vip" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("vip")}
                  data-testid="button-view-vip"
                >
                  <Star className="w-4 h-4 mr-1.5" />
                  VIP ({vipCount})
                </Button>
              </div>
              <div className="flex items-center gap-1 border rounded-lg p-0.5" data-testid="layout-toggle">
                <Button
                  variant={layoutView === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setLayoutView("list")}
                  data-testid="button-layout-list"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={layoutView === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setLayoutView("table")}
                  data-testid="button-layout-table"
                >
                  <Table className="w-4 h-4" />
                </Button>
              </div>
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
                  <SelectItem value="all">All types ({groups?.length || 0})</SelectItem>
                  {GROUP_TYPES.map((t) => {
                    const count = groups?.filter((g: Group) => g.type === t).length || 0;
                    if (count === 0) return null;
                    return (
                      <SelectItem key={t} value={t}>{t} ({count})</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={engagementFilter} onValueChange={setEngagementFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-engagement-filter">
                  <SelectValue placeholder="All engagement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All engagement</SelectItem>
                  {ENGAGEMENT_LEVELS.map((level) => {
                    const count = groups?.filter((g: any) => (g.engagementLevel || "Active") === level).length || 0;
                    return (
                      <SelectItem key={level} value={level}>{level} ({count})</SelectItem>
                    );
                  })}
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
          ) : layoutView === "table" ? (
            <GroupsTableView
              groups={displayGroups}
              communityDensity={communityDensity || {}}
              editMode={editMode}
              selectedGroups={selectedGroups}
              toggleGroupSelection={toggleGroupSelection}
              toggleSelectAll={() => {
                if (selectedGroups.size === displayGroups.length) {
                  setSelectedGroups(new Set());
                } else {
                  setSelectedGroups(new Set(displayGroups.map((g: Group) => g.id)));
                }
              }}
              onSelect={(group) => setSelectedGroup(group)}
              onEdit={(group) => openEditDialog(group)}
              onDelete={(groupId) => setDeleteConfirmId(groupId)}
              viewMode={viewMode}
              onPromote={(groupId) => handleGroupPromote(groupId)}
              isPromoting={promoteMutation.isPending}
            />
          ) : (
            <div className="space-y-1">
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

        {connectionPanelGroupId && (
          <ConnectionManagementPanel
            groupId={connectionPanelGroupId}
            allGroups={(groups as Group[]) || []}
            associations={(allAssociations as any[]) || []}
            onClose={() => setConnectionPanelGroupId(null)}
          />
        )}

        {selectedGroup && (
          <GroupDetailDialog
            group={selectedGroup}
            open={!!selectedGroup}
            onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}
            contacts={contacts || []}
            onEdit={() => { setSelectedGroup(null); openEditDialog(selectedGroup); }}
            allGroups={groups || []}
          />
        )}

        <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete Group</DialogTitle>
              <DialogDescription className="sr-only">Confirm group deletion</DialogDescription>
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
              <DialogDescription className="sr-only">Confirm bulk group deletion</DialogDescription>
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

        <Dialog open={mergeDialogOpen} onOpenChange={(v) => { setMergeDialogOpen(v); if (!v) setPrimaryMergeId(null); }}>
          <DialogContent data-testid="dialog-merge-groups">
            <DialogHeader>
              <DialogTitle data-testid="text-merge-groups-title">Merge {selectedGroups.size} Groups</DialogTitle>
              <DialogDescription className="sr-only">Merge selected groups into one</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Choose the primary group to keep. Members, taxonomy links, and associations from the other groups will transfer to it.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto py-2">
              {Array.from(selectedGroups).map(id => {
                const g = groups?.find((gr: any) => gr.id === id);
                if (!g) return null;
                const density = communityDensity?.[id];
                const memberCount = density?.totalMembers || 0;
                const commCount = density?.communityCount || 0;
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
                        {g.type}{memberCount > 0 ? ` · ${memberCount} member${memberCount !== 1 ? "s" : ""}` : ""}{commCount > 0 ? ` (${commCount} community)` : ""}
                      </p>
                    </div>
                    {primaryMergeId === id && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                  </div>
                );
              })}
              {primaryMergeId && (
                <div className="mt-2 p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  {(() => {
                    const otherIds = Array.from(selectedGroups).filter(id => id !== primaryMergeId);
                    const totalTransfer = otherIds.reduce((sum, id) => sum + (communityDensity?.[id]?.totalMembers || 0), 0);
                    return totalTransfer > 0
                      ? `${totalTransfer} member${totalTransfer !== 1 ? "s" : ""} will transfer to the primary group.`
                      : "No members to transfer.";
                  })()}
                </div>
              )}
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

        <Dialog open={bulkTypeOpen} onOpenChange={(v) => { setBulkTypeOpen(v); if (!v) setBulkTypeValue(""); }}>
          <DialogContent className="sm:max-w-[400px]" data-testid="dialog-bulk-set-type">
            <DialogHeader>
              <DialogTitle data-testid="text-bulk-type-title">Set Organization Type for {selectedGroups.size} group(s)</DialogTitle>
              <DialogDescription className="sr-only">Set organization type for selected groups</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={bulkTypeValue} onValueChange={setBulkTypeValue}>
                <SelectTrigger data-testid="select-bulk-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setBulkTypeOpen(false); setBulkTypeValue(""); }} data-testid="button-cancel-bulk-type">
                Cancel
              </Button>
              <Button
                onClick={() => bulkTypeMutation.mutate({ groupIds: Array.from(selectedGroups), type: bulkTypeValue })}
                disabled={!bulkTypeValue || bulkTypeMutation.isPending}
                data-testid="button-confirm-bulk-type"
              >
                {bulkTypeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-duplicates-groups">
            <DialogHeader>
              <DialogTitle data-testid="text-duplicates-groups-title">Suggested Duplicates</DialogTitle>
              <DialogDescription className="sr-only">Review and manage duplicate groups</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">These groups may be duplicates based on name or email similarity. Review and merge or dismiss.</p>
            {suggestedDuplicates && suggestedDuplicates.length > 0 ? (
              <div className="space-y-4 py-2">
                {suggestedDuplicates.map((cluster, idx) => (
                  <div key={idx} className="border rounded-lg p-4 space-y-3" data-testid={`duplicate-group-cluster-${idx}`}>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs" data-testid={`duplicate-group-reason-${idx}`}>{cluster.reason}</Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const ids = cluster.groups.map((g: any) => g.id);
                            setSelectedGroups(new Set(ids));
                            setPrimaryMergeId(ids[0]);
                            setEditMode(true);
                            setMergeDialogOpen(true);
                            setDuplicatesOpen(false);
                          }}
                          data-testid={`duplicate-group-merge-${idx}`}
                        >
                          <Merge className="w-3 h-3 mr-1" />
                          Merge
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissDuplicateMutation.mutate({ id1: cluster.groups[0].id, id2: cluster.groups[1].id })}
                          disabled={dismissDuplicateMutation.isPending}
                          data-testid={`duplicate-group-dismiss-${idx}`}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {cluster.groups.map((g: any) => {
                        const density = communityDensity?.[g.id];
                        return (
                          <div key={g.id} className="border rounded-md p-3 bg-muted/30 space-y-1" data-testid={`duplicate-group-${g.id}`}>
                            <p className="font-medium text-sm truncate">{g.name}</p>
                            <Badge variant="outline" className="text-[10px] h-4">{g.type}</Badge>
                            {g.contactEmail && <p className="text-xs text-muted-foreground truncate">{g.contactEmail}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              {density && <span className="text-[10px] text-muted-foreground"><Users className="w-3 h-3 inline mr-0.5" />{density.totalMembers} members</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-8" data-testid="text-no-group-duplicates">No suggested duplicates found.</p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={vipReasonDialogOpen} onOpenChange={(v) => { setVipReasonDialogOpen(v); if (!v) { setVipReasonGroupId(null); setVipReasonText(""); } }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Mark as VIP
              </DialogTitle>
              <DialogDescription className="sr-only">Mark group as VIP</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Why is this group being flagged as a VIP priority conversation?
              </p>
              <Textarea
                value={vipReasonText}
                onChange={(e) => setVipReasonText(e.target.value)}
                placeholder="e.g. Key funding partner, strategic collaboration opportunity..."
                className="resize-none"
                rows={3}
                data-testid="input-vip-reason-group"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setVipReasonDialogOpen(false); setVipReasonGroupId(null); setVipReasonText(""); }} data-testid="button-cancel-vip-reason-group">
                Cancel
              </Button>
              <Button onClick={confirmGroupVipPromotion} disabled={promoteMutation.isPending} data-testid="button-confirm-vip-promote-group">
                {promoteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Mark as VIP
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={aiPreviewOpen} onOpenChange={(v) => { setAiPreviewOpen(v); if (!v) setAiSuggestions([]); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-ai-recategorise">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Category Suggestions
              </DialogTitle>
              <DialogDescription className="sr-only">Review AI category suggestions</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Review the suggested categories below. Uncheck any you want to skip, then apply.</p>
            {aiSuggestions.length > 0 ? (
              <div className="space-y-2 py-2">
                {aiSuggestions.map((s, idx) => {
                  const typeChanged = s.suggestedType !== s.currentType;
                  const engChanged = s.suggestedEngagement !== s.currentEngagement;
                  if (!typeChanged && !engChanged) return null;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${s.accepted ? 'border-primary/30 bg-primary/5' : 'border-border opacity-50'}`}
                      data-testid={`ai-suggestion-${s.id}`}
                    >
                      <Checkbox
                        checked={s.accepted}
                        onCheckedChange={(checked) => {
                          const updated = [...aiSuggestions];
                          updated[idx] = { ...updated[idx], accepted: !!checked };
                          setAiSuggestions(updated);
                        }}
                        className="mt-1 shrink-0"
                        data-testid={`ai-suggestion-checkbox-${s.id}`}
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{s.currentType}</Badge>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <Select
                            value={s.suggestedType}
                            onValueChange={(val) => {
                              const updated = [...aiSuggestions];
                              updated[idx] = { ...updated[idx], suggestedType: val };
                              setAiSuggestions(updated);
                            }}
                          >
                            <SelectTrigger className="h-6 w-auto min-w-[120px] text-[11px] px-2" data-testid={`ai-suggestion-type-${s.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GROUP_TYPES.map(t => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{s.currentEngagement}</Badge>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <Select
                            value={s.suggestedEngagement}
                            onValueChange={(val) => {
                              const updated = [...aiSuggestions];
                              updated[idx] = { ...updated[idx], suggestedEngagement: val };
                              setAiSuggestions(updated);
                            }}
                          >
                            <SelectTrigger className="h-6 w-auto min-w-[100px] text-[11px] px-2" data-testid={`ai-suggestion-engagement-${s.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ENGAGEMENT_LEVELS.map(e => (
                                <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {aiSuggestions.every(s => s.suggestedType === s.currentType && s.suggestedEngagement === s.currentEngagement) && (
                  <p className="text-sm text-center text-muted-foreground py-4">All groups are already correctly categorised.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-4">No suggestions generated.</p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setAiPreviewOpen(false); setAiSuggestions([]); }} data-testid="button-cancel-ai-recategorise">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const accepted = aiSuggestions
                    .filter(s => s.accepted && (s.suggestedType !== s.currentType || s.suggestedEngagement !== s.currentEngagement))
                    .map(s => ({ id: s.id, type: s.suggestedType, engagementLevel: s.suggestedEngagement }));
                  if (accepted.length > 0) {
                    aiApplyMutation.mutate(accepted);
                  } else {
                    setAiPreviewOpen(false);
                    setAiSuggestions([]);
                  }
                }}
                disabled={aiApplyMutation.isPending || aiSuggestions.filter(s => s.accepted).length === 0}
                data-testid="button-apply-ai-recategorise"
              >
                {aiApplyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {aiApplyMutation.isPending ? "Applying..." : `Apply (${aiSuggestions.filter(s => s.accepted && (s.suggestedType !== s.currentType || s.suggestedEngagement !== s.currentEngagement)).length})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
  );
}

type GroupSortField = "name" | "type" | "members" | "contact";
type GroupSortDir = "asc" | "desc";

function GroupSortHeader({ label, field, activeField, dir, onSort, className }: { label: string; field: GroupSortField; activeField: GroupSortField | null; dir: GroupSortDir; onSort: (f: GroupSortField) => void; className?: string }) {
  const isActive = activeField === field;
  return (
    <th className={`text-left text-xs font-medium text-muted-foreground ${className || ""}`}>
      <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort(field)} data-testid={`sort-${field}`}>
        {label}
        {isActive ? (dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}


function GroupsTableView({ groups, communityDensity, editMode, selectedGroups, toggleGroupSelection, toggleSelectAll, onSelect, onEdit, onDelete, viewMode, onPromote, isPromoting }: {
  groups: Group[];
  communityDensity: Record<number, { communityCount: number; totalMembers: number }>;
  editMode: boolean;
  selectedGroups: Set<number>;
  toggleGroupSelection: (id: number) => void;
  toggleSelectAll: () => void;
  onSelect: (group: Group) => void;
  onEdit: (group: Group) => void;
  onDelete: (groupId: number) => void;
  viewMode?: string | null;
  onPromote?: (groupId: number) => void;
  isPromoting?: boolean;
}) {
  const [sortField, setSortField] = useState<GroupSortField | null>(null);
  const [sortDir, setSortDir] = useState<GroupSortDir>("asc");
  const { toast } = useToast();

  const communityToggleMutation = useMutation({
    mutationFn: async ({ groupId, isCommunity }: { groupId: number; isCommunity: boolean }) => {
      const res = await apiRequest("PATCH", `/api/groups/${groupId}/community-status`, { isCommunity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSort = (field: GroupSortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedGroups = useMemo(() => {
    if (!sortField) return groups;
    const sorted = [...groups].sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case "name":
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
          break;
        case "type":
          av = (a.type || "").toLowerCase();
          bv = (b.type || "").toLowerCase();
          break;
        case "members":
          av = communityDensity[a.id]?.totalMembers || 0;
          bv = communityDensity[b.id]?.totalMembers || 0;
          return sortDir === "asc" ? av - bv : bv - av;
        case "contact":
          av = (a.contactEmail || "").toLowerCase();
          bv = (b.contactEmail || "").toLowerCase();
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [groups, sortField, sortDir, communityDensity]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="groups-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {editMode && (
                <th className="px-3 py-3 w-10">
                  <Checkbox
                    checked={groups.length > 0 && selectedGroups.size === groups.length}
                    onCheckedChange={toggleSelectAll}
                    data-testid="table-checkbox-select-all-groups"
                  />
                </th>
              )}
              <GroupSortHeader label="Name" field="name" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-4" />
              <GroupSortHeader label="Type" field="type" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
              <th className="px-3 py-3 text-xs font-medium text-muted-foreground text-left">Community</th>
              <GroupSortHeader label="Members" field="members" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
              <GroupSortHeader label="Contact" field="contact" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
              <th className="px-3 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => {
              const density = communityDensity[group.id];
              const totalMembers = density?.totalMembers || 0;
              const commCount = density?.communityCount || 0;
              return (
                <tr
                  key={group.id}
                  className={`border-b last:border-b-0 hover:bg-muted/20 transition-colors ${editMode && selectedGroups.has(group.id) ? "bg-primary/5" : ""}`}
                  data-testid={`table-row-group-${group.id}`}
                >
                  {editMode && (
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selectedGroups.has(group.id)}
                        onCheckedChange={() => toggleGroupSelection(group.id)}
                        data-testid={`table-checkbox-group-${group.id}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <button
                      className="flex items-center gap-2 transition-colors hover:text-primary text-left"
                      onClick={() => onSelect(group)}
                      data-testid={`table-link-group-${group.id}`}
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium truncate max-w-[200px]">{group.name}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] h-5 px-2 ${GROUP_TYPE_COLORS[group.type] || ""}`} data-testid={`table-type-group-${group.id}`}>
                        {displayGroupType(group)}
                      </Badge>
                      {group.engagementLevel && group.engagementLevel !== "Active" && (
                        <Badge className={`text-[9px] h-4 px-1.5 ${ENGAGEMENT_COLORS[group.engagementLevel] || ""}`} data-testid={`table-engagement-${group.id}`}>
                          {group.engagementLevel}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {group.isCommunity ? (
                      <Badge
                        className="text-[10px] h-5 px-2 bg-purple-500/15 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-500/25 transition-colors"
                        onClick={() => communityToggleMutation.mutate({ groupId: group.id, isCommunity: false })}
                        data-testid={`table-community-yes-${group.id}`}
                      >
                        <UserCheck className="w-3 h-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 px-2 cursor-pointer hover:bg-purple-500/10 hover:text-purple-700 hover:border-purple-300 dark:hover:text-purple-300 transition-colors"
                        onClick={() => communityToggleMutation.mutate({ groupId: group.id, isCommunity: true })}
                        data-testid={`table-community-add-${group.id}`}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Add
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs flex items-center gap-1" data-testid={`table-members-group-${group.id}`}>
                        <Users className="w-3 h-3 text-muted-foreground" />
                        {totalMembers}
                      </span>
                      {commCount > 0 && (
                        <Badge className="text-[9px] h-4 px-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-300" data-testid={`table-community-count-${group.id}`}>
                          <UserCheck className="w-2.5 h-2.5 mr-0.5" />
                          {commCount}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {group.contactEmail ? (
                      <span className="truncate max-w-[160px] block" title={group.contactEmail} data-testid={`table-email-group-${group.id}`}>
                        {group.contactEmail}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {viewMode && viewMode !== "innovators" && onPromote && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onPromote(group.id)}
                          disabled={isPromoting}
                          title={viewMode === "all" ? "Add to Our Community" : "Add to Our Innovators"}
                          data-testid={`table-promote-group-${group.id}`}
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => onEdit(group)} title="Edit" data-testid={`table-edit-group-${group.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => onDelete(group.id)} title="Delete" data-testid={`table-delete-group-${group.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupCard({ group, onSelect, onEdit, onDelete, editMode, isSelected, onToggleSelect, communityCount, viewMode, onPromote, isPromoting }: {
  group: Group;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  communityCount: number;
  viewMode?: string | null;
  onPromote?: () => void;
  isPromoting?: boolean;
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

  const promoteIcon = viewMode === "all" ? <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> :
    viewMode === "community" ? <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> :
    viewMode === "innovators" ? <Star className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" /> : null;

  const promoteTitle = viewMode === "all" ? "Add to Our Community" :
    viewMode === "community" ? "Add to Our Innovators" :
    viewMode === "innovators" ? "Mark as VIP" : "";

  const showPromote = viewMode === "all" ? !group.isCommunity :
    viewMode === "community" ? !group.isInnovator :
    viewMode === "innovators" ? !group.isVip : false;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover-elevate cursor-pointer transition-colors ${editMode && isSelected ? "ring-2 ring-primary bg-primary/5" : "bg-card"}`}
      onClick={handleClick}
      data-testid={`card-group-${group.id}`}
    >
      {editMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect()}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
          data-testid={`checkbox-group-${group.id}`}
        />
      )}
      <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
        <Building2 className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate" data-testid={`text-group-name-${group.id}`}>{group.name}</h3>
      </div>
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Badge className={`text-[10px] ${GROUP_TYPE_COLORS[group.type] || ""}`}>
          {displayGroupType(group)}
        </Badge>
        {group.engagementLevel && group.engagementLevel !== "Active" && (
          <Badge className={`text-[9px] ${ENGAGEMENT_COLORS[group.engagementLevel] || ""}`} data-testid={`badge-engagement-card-${group.id}`}>
            {group.engagementLevel}
          </Badge>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-members-${group.id}`}>
          <Users className="w-3 h-3" />
          {memberCount}
        </span>
        {communityCount > 0 && (
          <Badge className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300" data-testid={`badge-community-${group.id}`}>
            <UserCheck className="w-3 h-3 mr-0.5" />
            {communityCount}
          </Badge>
        )}
        {!editMode && showPromote && onPromote && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onPromote}
            disabled={isPromoting}
            title={promoteTitle}
            data-testid={`button-promote-group-${group.id}`}
          >
            {promoteIcon}
          </Button>
        )}
        {!editMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-menu-group-${group.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/community/people?group=${group.id}`}>
                  <Users className="w-4 h-4 mr-2" />
                  View Members
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} data-testid={`menu-edit-group-${group.id}`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`menu-delete-group-${group.id}`}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
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
  const [type, setType] = useState<string>("Uncategorised");
  const [engagementLevel, setEngagementLevel] = useState<string>("Active");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [isMaori, setIsMaori] = useState(false);
  const [isPasifika, setIsPasifika] = useState(false);

  const resetForm = () => {
    setName(group?.name || "");
    setType(group?.type || "Uncategorised");
    setEngagementLevel(group?.engagementLevel || "Active");
    setDescription(group?.description || "");
    setContactEmail(group?.contactEmail || "");
    setContactPhone(group?.contactPhone || "");
    setAddress(group?.address || "");
    setWebsite(group?.website || "");
    setNotes(group?.notes || "");
    setIsMaori(group?.isMaori ?? false);
    setIsPasifika(group?.isPasifika ?? false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data: Record<string, any> = {
      name: name.trim(),
      type,
      engagementLevel,
      description: description.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
      isMaori,
      isPasifika,
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
          <DialogDescription className="sr-only">{group ? "Edit group details" : "Create a new group"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Creative Collective NZ" data-testid="input-group-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Engagement</Label>
              <Select value={engagementLevel} onValueChange={setEngagementLevel}>
                <SelectTrigger data-testid="select-group-engagement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="isMaori" checked={isMaori} onCheckedChange={(v) => setIsMaori(v === true)} data-testid="checkbox-is-maori" />
              <Label htmlFor="isMaori" className="text-sm font-normal cursor-pointer">Maori-led</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="isPasifika" checked={isPasifika} onCheckedChange={(v) => setIsPasifika(v === true)} data-testid="checkbox-is-pasifika" />
              <Label htmlFor="isPasifika" className="text-sm font-normal cursor-pointer">Pasifika-led</Label>
            </div>
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

function GroupDetailDialog({ group, open, onOpenChange, contacts, onEdit, allGroups }: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[];
  onEdit: () => void;
  allGroups: Group[];
}) {
  const { data: members, isLoading: membersLoading } = useGroupMembers(group.id);
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const enrichGroup = useEnrichGroup();
  const updateGroup = useUpdateGroup();
  const saveTaxonomyLinks = useSaveGroupTaxonomyLinks();
  const { data: taxonomyLinks } = useGroupTaxonomyLinks(group.id);
  const { data: taxonomyCategories } = useTaxonomy();
  const { data: associations } = useGroupAssociations(group.id);
  const addAssociation = useAddGroupAssociation();
  const removeAssociation = useRemoveGroupAssociation();
  const [assocSearch, setAssocSearch] = useState("");
  const [assocPopoverOpen, setAssocPopoverOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("Member");
  const [enrichData, setEnrichData] = useState<Record<string, any> | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [selectedKaupapa, setSelectedKaupapa] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const pushToCommunityMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-move", { contactIds, isCommunityMember: true });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      toast({ title: "Pushed to Community", description: `${data.updated || 0} members marked as community` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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
            <DialogDescription className="sr-only">Group details and management</DialogDescription>
            <div className="flex items-center gap-2">
              <Badge className={GROUP_TYPE_COLORS[group.type] || ""}>{displayGroupType(group)}</Badge>
              {group.engagementLevel && (
                <Badge className={ENGAGEMENT_COLORS[group.engagementLevel] || ""} data-testid="badge-engagement-level">
                  {group.engagementLevel}
                </Badge>
              )}
              {group.isMaori && <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">Maori-led</Badge>}
              {group.isPasifika && <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">Pasifika-led</Badge>}
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
                <Link2 className="w-4 h-4" />
                Associated Groups ({(() => {
                  const assocIds = new Set<number>();
                  (associations || []).forEach((a: any) => {
                    if (a.groupId === group.id) assocIds.add(a.associatedGroupId);
                    else assocIds.add(a.groupId);
                  });
                  return assocIds.size;
                })()})
              </h3>
              <Popover open={assocPopoverOpen} onOpenChange={setAssocPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-association">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Link Group
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Search groups..."
                      value={assocSearch}
                      onValueChange={setAssocSearch}
                      data-testid="input-search-association"
                    />
                    <CommandList>
                      <CommandEmpty>No groups found</CommandEmpty>
                      <CommandGroup>
                        {(() => {
                          const linkedIds = new Set<number>([group.id]);
                          (associations || []).forEach((a: any) => {
                            linkedIds.add(a.groupId);
                            linkedIds.add(a.associatedGroupId);
                          });
                          return allGroups
                            .filter((g) => !linkedIds.has(g.id) && g.name.toLowerCase().includes(assocSearch.toLowerCase()))
                            .slice(0, 20)
                            .map((g) => (
                              <CommandItem
                                key={g.id}
                                value={g.name}
                                onSelect={() => {
                                  addAssociation.mutate({ groupId: group.id, associatedGroupId: g.id });
                                  setAssocPopoverOpen(false);
                                  setAssocSearch("");
                                }}
                                data-testid={`item-add-association-${g.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm">{g.name}</span>
                                  <Badge variant="secondary" className="text-[9px] ml-auto">{g.type}</Badge>
                                </div>
                              </CommandItem>
                            ));
                        })()}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {(() => {
              const assocEntries: { id: number; linkedGroup: Group; relType: string }[] = [];
              (associations || []).forEach((a: any) => {
                const otherId = a.groupId === group.id ? a.associatedGroupId : a.groupId;
                const other = allGroups.find((g) => g.id === otherId);
                let relType = "peer";
                if (a.relationshipType === "parent") {
                  relType = a.associatedGroupId === group.id ? "parent" : "child";
                }
                if (other) assocEntries.push({ id: a.id, linkedGroup: other, relType });
              });
              if (assocEntries.length === 0) {
                return (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Link2 className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                    <p>No associated groups yet</p>
                  </div>
                );
              }
              return (
                <div className="space-y-1">
                  {assocEntries.map(({ id, linkedGroup, relType }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                      data-testid={`row-association-${id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {linkedGroup.name[0]}
                        </div>
                        <span className="text-sm font-medium truncate">{linkedGroup.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{linkedGroup.type}</Badge>
                        {relType !== "peer" && (
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${relType === "parent" ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" : "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"}`}>
                            {relType}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ visibility: "visible" }}
                        onClick={() => removeAssociation.mutate({ groupId: group.id, associationId: id })}
                        data-testid={`button-remove-association-${id}`}
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members ({members?.length || 0})
                {(() => {
                  const memberContactIds = (members || []).map((m: GroupMember) => m.contactId);
                  const nonCommunityIds = memberContactIds.filter((cid: number) => {
                    const c = contacts.find((ct: any) => ct.id === cid);
                    return c && !c.isCommunityMember;
                  });
                  if (nonCommunityIds.length === 0) return null;
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                      onClick={() => pushToCommunityMutation.mutate(nonCommunityIds)}
                      disabled={pushToCommunityMutation.isPending}
                      data-testid="button-push-all-community"
                    >
                      {pushToCommunityMutation.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3 mr-1" />
                      )}
                      Push {nonCommunityIds.length} to Community
                    </Button>
                  );
                })()}
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
                {(members || []).map((member: GroupMember) => {
                  const memberContact = contacts.find((c: any) => c.id === member.contactId);
                  const isCommunity = memberContact?.isCommunityMember;
                  return (
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
                        {isCommunity ? (
                          <Badge className="text-[9px] h-4 px-1.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20 shrink-0" data-testid={`badge-member-community-${member.id}`}>
                            <UserCheck className="w-2.5 h-2.5" />
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 cursor-pointer hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-300 transition-colors shrink-0"
                            onClick={() => pushToCommunityMutation.mutate([member.contactId])}
                            data-testid={`button-push-member-community-${member.id}`}
                          >
                            <UserCheck className="w-2.5 h-2.5" />
                          </Badge>
                        )}
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
                  );
                })}
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
