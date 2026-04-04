import { Button } from "@/components/ui/beautiful-button";
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, useAllGroupAssociations } from "@/hooks/use-groups";
import { useContacts } from "@/hooks/use-contacts";
import { Plus, Search, Loader2, Building2, Users, X, Trash2, ChevronRight, Sparkles, Check, Edit3, CheckSquare, Merge, List, Table, ArrowUp, ArrowDown, Handshake, Network as NetworkIcon, Star, BookUser } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GROUP_TYPES, ENGAGEMENT_LEVELS, type Group } from "@shared/schema";

import { GroupCard } from "@/components/groups/GroupCard";
import { GroupsTableView } from "@/components/groups/GroupsTableView";
import { GroupFormDialog } from "@/components/groups/GroupFormDialog";
import { GroupDetailDialog } from "@/components/groups/GroupDetailDialog";

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
  const [viewMode, setViewMode] = useState<"working" | "network" | "all">("working");
  const [layoutView, setLayoutView] = useState<"list" | "table">("list");
  const [vipOnly, setVipOnly] = useState(false);
  const [connectionFilter, setConnectionFilter] = useState<string>("all");


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
  const { data: deliveryDepths } = useQuery<Record<number, { depth: string; active: boolean; signals: string[] }>>({
    queryKey: ['/api/groups/delivery-depth'],
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
      if (viewMode === "network") {
        const res = await apiRequest("POST", `/api/groups/${groupId}/promote-vip`, vipReason ? { vipReason } : undefined);
        return res.json();
      }
      // From all or working tab → add to Network
      const data: Record<string, any> = {
        isCommunity: true,
        movedToCommunityAt: new Date().toISOString(),
      };
      const res = await apiRequest("PATCH", `/api/groups/${groupId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecosystem/vip'] });
      const label = viewMode === "network" ? "Marked as VIP" : "Added to Network";
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
    if (viewMode === "network") {
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
      // Remove from Network
      const data: Record<string, any> = {
        isCommunity: false,
        movedToCommunityAt: null,
      };
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
        if (viewMode === "network") {
          return apiRequest("POST", `/api/groups/${id}/promote-vip`);
        }
        return apiRequest("PATCH", `/api/groups/${id}`, {
          isCommunity: true,
          movedToCommunityAt: new Date().toISOString(),
        });
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
        return apiRequest("PATCH", `/api/groups/${id}`, {
          isCommunity: false,
          movedToCommunityAt: null,
        });
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

  const tierCounts = useMemo(() => {
    if (!groups) return { working: 0, network: 0, all: 0, vip: 0 };
    const all = groups.length;
    const working = groups.filter((g: Group) => {
      const dd = deliveryDepths?.[g.id];
      return dd && dd.depth !== "none";
    }).length;
    const network = groups.filter((g: Group) => g.isCommunity === true).length;
    const vip = groups.filter((g: Group) => (g as any).isVip === true).length;
    return { working, network, all, vip };
  }, [groups, deliveryDepths]);

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
      const matchesConnection = connectionFilter === "all" || (g as any).connectionStrength === connectionFilter;
      return matchesSearch && matchesType && matchesEngagement && matchesConnection;
    });
  }, [groups, search, typeFilter, engagementFilter, connectionFilter]);

  const displayGroups = useMemo(() => {
    let result = filteredGroups;
    if (viewMode === "working") {
      result = result.filter((g: Group) => {
        const dd = deliveryDepths?.[g.id];
        return dd && dd.depth !== "none";
      });
    } else if (viewMode === "network") {
      result = result.filter((g: Group) => g.isCommunity === true);
    }
    if (vipOnly) {
      result = result.filter((g: Group) => (g as any).isVip === true);
    }
    result.sort((a: Group, b: Group) => {
      const aCount = communityDensity?.[a.id]?.communityCount || 0;
      const bCount = communityDensity?.[b.id]?.communityCount || 0;
      return bCount - aCount;
    });
    return result;
  }, [filteredGroups, communityDensity, viewMode, deliveryDepths, vipOnly]);

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
                {(viewMode === "all" || viewMode === "working") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkPromoteMutation.mutate(Array.from(selectedGroups))}
                    disabled={bulkPromoteMutation.isPending}
                    data-testid="button-bulk-promote-groups"
                  >
                    {bulkPromoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUp className="w-4 h-4 mr-2" />}
                    Add to Network ({selectedGroups.size})
                  </Button>
                )}
                {viewMode === "network" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bulkPromoteMutation.mutate(Array.from(selectedGroups))}
                      disabled={bulkPromoteMutation.isPending}
                      data-testid="button-bulk-promote-vip-groups"
                    >
                      {bulkPromoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
                      Mark VIP ({selectedGroups.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bulkDemoteMutation.mutate(Array.from(selectedGroups))}
                      disabled={bulkDemoteMutation.isPending}
                      data-testid="button-bulk-demote-groups"
                    >
                      {bulkDemoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                      Remove from Network ({selectedGroups.size})
                    </Button>
                  </>
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
            const maoriLedCount = activeGroups.filter((g: any) => g.isMaori).length;
            const servesMaoriCount = activeGroups.filter((g: any) => g.servesMaori).length;
            const pasifikaLedCount = activeGroups.filter((g: any) => g.isPasifika).length;
            const servesPasifikaCount = activeGroups.filter((g: any) => g.servesPasifika).length;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Total Orgs", value: activeGroups.length },
                  { label: "Māori-led", value: maoriLedCount },
                  { label: "Serves Māori", value: servesMaoriCount },
                  { label: "Pasifika-led", value: pasifikaLedCount },
                  { label: "Serves Pasifika", value: servesPasifikaCount },
                  { label: "Māori reach", value: activeGroups.filter((g: any) => g.isMaori || g.servesMaori).length },
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
                Groups
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Organisations, collectives and community groups
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

          {/* Tabs + Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2" data-testid="view-toggle">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "working" | "network" | "all")} className="min-w-0 flex-1">
                <TabsList className="overflow-x-auto flex-nowrap w-full justify-start">
                  <TabsTrigger value="working" className="shrink-0" data-testid="button-view-working">
                    <Handshake className="w-4 h-4 mr-1.5" />
                    Working With ({tierCounts.working})
                  </TabsTrigger>
                  <TabsTrigger value="network" className="shrink-0" data-testid="button-view-network">
                    <NetworkIcon className="w-4 h-4 mr-1.5" />
                    Network ({tierCounts.network})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="shrink-0" data-testid="button-view-all">
                    <BookUser className="w-4 h-4 mr-1.5" />
                    All ({tierCounts.all})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <Button
                  variant={vipOnly ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setVipOnly(!vipOnly)}
                  data-testid="button-toggle-vip"
                  title={vipOnly ? "Showing VIP only" : "Filter to VIP"}
                >
                  <Star className={`w-4 h-4 ${vipOnly ? "text-yellow-500 fill-yellow-500" : ""}`} />
                  {vipOnly && <span className="ml-1 text-xs">{tierCounts.vip}</span>}
                </Button>
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
              <Select value={connectionFilter} onValueChange={setConnectionFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-connection-filter">
                  <SelectValue placeholder="All connections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All connections</SelectItem>
                  {["aware", "connected", "trusted", "woven"].map((level) => {
                    const count = groups?.filter((g: any) => g.connectionStrength === level).length || 0;
                    return (
                      <SelectItem key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)} ({count})</SelectItem>
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
