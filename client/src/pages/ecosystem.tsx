import { useState, useMemo } from "react";
import { useGroups, useDeleteGroup, useAllGroupAssociations, useAddGroupAssociation, useRemoveGroupAssociation, useUpdateGroupAssociation } from "@/hooks/use-groups";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import {
  Search, Building2, Users, User,
  Edit3, Trash2, Merge, Check, X, ChevronDown, ChevronRight,
  ExternalLink, UserCheck, Activity, AlertTriangle, Clock,
  Star, Shield, Calendar, MoreVertical, Network, Link2, Plus, CornerDownRight
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { GROUP_TYPES, type Group, type GroupAssociation } from "@shared/schema";

const CATEGORY_SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Business": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  "Social Enterprise": { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800" },
  "Creative / Arts": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800" },
  "Community Organisation": { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800" },
  "Iwi / Hapū": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
  "Government / Council": { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
  "Education / Training": { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800" },
  "Health / Social Services": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800" },
  "Funder": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  "Corporate / Sponsor": { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
  "Resident Company": { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  "NGO": { bg: "bg-lime-50 dark:bg-lime-950/30", text: "text-lime-700 dark:text-lime-400", border: "border-lime-200 dark:border-lime-800" },
  "Uncategorised": { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-400", border: "border-slate-200 dark:border-slate-800" },
};

const TYPE_COLORS: Record<string, string> = {
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

type EngagementMetrics = {
  totalEvents: number;
  totalProgrammes: number;
  totalBookings: number;
  totalSpendEntries: number;
  totalImpactLogs: number;
  totalAgreements: number;
  totalCollaborations: number;
  lastEngagementDate: string | null;
};

type HealthSummary = {
  total: number;
  active: number;
  dormant: number;
  atRisk: number;
};

type VipItem = {
  id: number;
  type: "contact" | "group";
  name: string;
  email?: string;
  businessName?: string;
  linkedGroupName?: string;
  groupType?: string;
  vipReason?: string | null;
  movedToVipAt?: string | null;
  stage?: string | null;
  supportType?: string[] | null;
  role?: string | null;
  engagementLevel?: string | null;
  memberCount?: number;
};

function getEngagementStatus(lastDate: string | null): "active" | "recent" | "dormant" {
  if (!lastDate) return "dormant";
  const d = new Date(lastDate);
  const now = new Date();
  const daysDiff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 90) return "active";
  if (daysDiff <= 180) return "recent";
  return "dormant";
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const d = new Date(dateStr);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff === 0) return "Today";
  if (daysDiff === 1) return "Yesterday";
  if (daysDiff < 7) return `${daysDiff}d ago`;
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)}w ago`;
  if (daysDiff < 365) return `${Math.floor(daysDiff / 30)}mo ago`;
  return `${Math.floor(daysDiff / 365)}y ago`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function EcosystemPage() {
  const { data: groups, isLoading } = useGroups();
  const { data: densityData } = useQuery<Record<number, { communityCount: number; totalMembers: number }>>({
    queryKey: ['/api/groups/community-density'],
  });
  const { data: engagementData } = useQuery<Record<number, EngagementMetrics>>({
    queryKey: ['/api/groups/engagement-metrics'],
  });
  const { data: healthData } = useQuery<HealthSummary>({
    queryKey: ['/api/groups/ecosystem-health'],
  });
  const { data: vipItems } = useQuery<VipItem[]>({
    queryKey: ['/api/ecosystem/vip'],
  });
  const { data: allAssociations } = useAllGroupAssociations();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editMode, setEditMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [collapsedRoles, setCollapsedRoles] = useState<Record<string, boolean>>({});
  const [bulkTierOpen, setBulkTierOpen] = useState(false);
  const [bulkTierValue, setBulkTierValue] = useState<string>("");
  const [viewMode, setViewMode] = useState<"categories" | "connections">("categories");
  const [connectionPanelGroupId, setConnectionPanelGroupId] = useState<number | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Record<number | string, boolean>>({});
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteGroup = useDeleteGroup();

  const parentMap = useMemo(() => {
    const map: Record<number, { parentId: number; parentName: string }> = {};
    if (!allAssociations || !groups) return map;
    const assocs = allAssociations as GroupAssociation[];
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
      queryClient.invalidateQueries({ queryKey: ['/api/groups/engagement-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/ecosystem-health'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecosystem/vip'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/groups/engagement-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/ecosystem-health'] });
      setSelectedForMerge([]);
      setMergeDialogOpen(false);
      setPrimaryMergeId(null);
      toast({ title: "Groups merged successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/groups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/ecosystem-health'] });
    },
  });

  const filtered = useMemo(() => {
    if (!groups) return [];
    return (groups as Group[]).filter((g) => {
      const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType = roleFilter === "all" || g.type === roleFilter;
      return matchesSearch && matchesType;
    });
  }, [groups, search, roleFilter]);

  const groupedByType = useMemo(() => {
    const result: Record<string, Group[]> = {};
    for (const t of GROUP_TYPES) {
      result[t] = [];
    }
    for (const g of filtered) {
      const key = g.type || "Uncategorised";
      if (!result[key]) result[key] = [];
      result[key].push(g);
    }
    if (densityData) {
      for (const key of Object.keys(result)) {
        result[key].sort((a, b) => {
          const aDensity = densityData[a.id]?.communityCount || 0;
          const bDensity = densityData[b.id]?.communityCount || 0;
          return bDensity - aDensity;
        });
      }
    }
    return result;
  }, [filtered, densityData]);

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

  const toggleRoleCollapse = (role: string) => {
    setCollapsedRoles(prev => ({ ...prev, [role]: !prev[role] }));
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
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="breadcrumb-ecosystems">
        <Link href="/community/people" className="hover:text-foreground transition-colors">Community</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">Ecosystem</span>
      </nav>

      {editMode && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-md px-4 md:px-8 py-3" data-testid="edit-toolbar-ecosystem">
          <div className="max-w-7xl mx-auto w-full flex items-center gap-2 flex-wrap">
            {selectedForMerge.length >= 1 && (
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} data-testid="button-bulk-delete">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedForMerge.length})
              </Button>
            )}
            {selectedForMerge.length >= 2 && (
              <Button size="sm" onClick={openMergeDialog} data-testid="button-merge">
                <Merge className="w-4 h-4 mr-1" />
                Merge ({selectedForMerge.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditMode(false); setSelectedForMerge([]); }}
              data-testid="button-toggle-edit"
            >
              <Check className="w-4 h-4 mr-1" />
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Ecosystem</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your network across {totalGroups} organisations
          </p>
        </div>
        <div className="flex gap-2">
          {!editMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditMode(true); setSelectedForMerge([]); }}
              data-testid="button-toggle-edit"
            >
              <Edit3 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="health-summary">
        <Card className="p-4 border" data-testid="stat-total">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-total-count">{healthData?.total ?? totalGroups}</div>
              <div className="text-xs text-muted-foreground">Total Orgs</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" data-testid="stat-active">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-active-count">{healthData?.active ?? 0}</div>
              <div className="text-xs text-muted-foreground">Active (90d)</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20" data-testid="stat-dormant">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Clock className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-600 dark:text-slate-400" data-testid="text-dormant-count">{healthData?.dormant ?? 0}</div>
              <div className="text-xs text-muted-foreground">Dormant (6mo+)</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" data-testid="stat-at-risk">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-at-risk-count">{healthData?.atRisk ?? 0}</div>
              <div className="text-xs text-muted-foreground">At Risk</div>
            </div>
          </div>
        </Card>
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
        <div className="flex items-center gap-1 border rounded-lg p-0.5" data-testid="view-toggle">
          <Button
            size="sm"
            variant={viewMode === "categories" ? "default" : "ghost"}
            className="h-8 text-xs"
            onClick={() => setViewMode("categories")}
            data-testid="button-view-categories"
          >
            <Building2 className="w-3.5 h-3.5 mr-1" />
            Categories
          </Button>
          <Button
            size="sm"
            variant={viewMode === "connections" ? "default" : "ghost"}
            className="h-8 text-xs"
            onClick={() => setViewMode("connections")}
            data-testid="button-view-connections"
          >
            <Network className="w-3.5 h-3.5 mr-1" />
            Connections
          </Button>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-56" data-testid="select-role-filter">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {GROUP_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {vipItems && vipItems.length > 0 && (
        <div data-testid="vip-section">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Priority Conversations</h2>
            <span className="text-sm text-muted-foreground">({vipItems.length})</span>
          </div>
          <div className="space-y-1">
            {vipItems.map(item => (
              <VipCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {viewMode === "categories" && (
        <div className="space-y-6">
          {GROUP_TYPES.map(categoryType => {
            const typeGroups = groupedByType[categoryType] || [];
            if (typeGroups.length === 0) return null;
            const isCollapsed = collapsedRoles[categoryType];
            const colors = CATEGORY_SECTION_COLORS[categoryType] || { bg: "", text: "", border: "" };

            return (
              <div key={categoryType} data-testid={`role-section-${categoryType}`}>
                <button
                  className="flex items-center gap-2 w-full text-left mb-2"
                  onClick={() => toggleRoleCollapse(categoryType)}
                  data-testid={`button-toggle-role-${categoryType}`}
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <h2 className={`text-base font-semibold ${colors.text}`}>{categoryType}</h2>
                  <span className="text-sm text-muted-foreground">({typeGroups.length})</span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {typeGroups.map(group => (
                      <EcoGroupCard
                        key={group.id}
                        group={group}
                        editMode={editMode}
                        isSelected={selectedForMerge.includes(group.id)}
                        onToggleSelect={() => toggleMergeSelection(group.id)}
                        onDelete={() => setDeleteConfirmId(group.id)}
                        communityCount={densityData?.[group.id]?.communityCount || 0}
                        totalMembers={densityData?.[group.id]?.totalMembers || 0}
                        metrics={engagementData?.[group.id]}
                        onUpdateGroup={(data) => updateGroupMutation.mutate({ id: group.id, data })}
                        parentName={parentMap[group.id]?.parentName}
                        onManageConnections={() => setConnectionPanelGroupId(group.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "connections" && (
        <ConnectionsView
          groups={filtered}
          allGroups={(groups as Group[]) || []}
          associations={(allAssociations as GroupAssociation[]) || []}
          densityData={densityData}
          engagementData={engagementData}
          editMode={editMode}
          selectedForMerge={selectedForMerge}
          onToggleSelect={toggleMergeSelection}
          onDelete={(id) => setDeleteConfirmId(id)}
          onUpdateGroup={(id, data) => updateGroupMutation.mutate({ id, data })}
          onManageConnections={(id) => setConnectionPanelGroupId(id)}
          parentMap={parentMap}
          collapsedParents={collapsedParents}
          onToggleParent={(id) => setCollapsedParents(prev => ({ ...prev, [id]: !prev[id] }))}
        />
      )}

      {connectionPanelGroupId && (
        <ConnectionManagementPanel
          groupId={connectionPanelGroupId}
          allGroups={(groups as Group[]) || []}
          associations={(allAssociations as GroupAssociation[]) || []}
          onClose={() => setConnectionPanelGroupId(null)}
        />
      )}

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent data-testid="dialog-merge">
          <DialogHeader>
            <DialogTitle>Merge Groups</DialogTitle>
            <DialogDescription className="sr-only">Merge selected groups</DialogDescription>
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
            <DialogDescription className="sr-only">Confirm group deletion</DialogDescription>
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

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle>Delete {selectedForMerge.length} Group{selectedForMerge.length !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription className="sr-only">Confirm bulk group deletion</DialogDescription>
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

function VipCard({ item }: { item: VipItem }) {
  const days = daysSince(item.movedToVipAt || null);
  const isStale = days !== null && days > 30;
  const isContact = item.type === "contact";

  return (
    <Link
      href={isContact ? `/contacts/${item.id}` : `/groups`}
      className="block"
      data-testid={`vip-card-${item.type}-${item.id}`}
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-md ${
        isStale ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : "border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-950/10"
      }`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isContact ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"
        }`}>
          {isContact ? (
            <User className="w-5 h-5" />
          ) : (
            <Building2 className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold truncate">{item.name}</h3>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
              <Star className="w-3 h-3 mr-0.5" />
              VIP
            </Badge>
            {isContact && item.role && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{item.role}</Badge>
            )}
            {!isContact && item.groupType && (
              <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${TYPE_COLORS[item.groupType] || ""}`}>
                {item.groupType}
              </Badge>
            )}
            {!isContact && item.engagementLevel && item.engagementLevel !== "Active" && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {item.engagementLevel}
              </Badge>
            )}
          </div>
          {item.vipReason && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate" data-testid={`text-vip-reason-${item.type}-${item.id}`}>
              {item.vipReason}
            </p>
          )}
          {!item.vipReason && (isContact ? (item.linkedGroupName || item.businessName) : null) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {item.linkedGroupName || item.businessName}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isContact && typeof item.memberCount === "number" && item.memberCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              {item.memberCount}
            </span>
          )}
          {days !== null && (
            <span className={`text-[11px] ${isStale ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
              {days === 0 ? "Today" : `${days}d`}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

function EcoGroupCard({
  group,
  editMode,
  isSelected,
  onToggleSelect,
  onDelete,
  communityCount,
  totalMembers,
  metrics,
  onUpdateGroup,
  parentName,
  onManageConnections,
}: {
  group: Group;
  editMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  communityCount: number;
  totalMembers: number;
  metrics?: EngagementMetrics;
  onUpdateGroup: (data: Record<string, any>) => void;
  parentName?: string;
  onManageConnections?: () => void;
}) {
  const typeColor = TYPE_COLORS[group.type] || "bg-gray-500/10 text-gray-700 dark:text-gray-300";
  const engagementStatus = getEngagementStatus(metrics?.lastEngagementDate || null);
  const statusIndicator = {
    active: { color: "bg-emerald-500", label: "Active" },
    recent: { color: "bg-amber-400", label: "Recent" },
    dormant: { color: "bg-slate-300 dark:bg-slate-600", label: "Dormant" },
  }[engagementStatus];

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-card hover:bg-card/80 transition-all hover:shadow-sm ${
        editMode && isSelected ? "ring-2 ring-primary" : ""
      }`}
      data-testid={`card-eco-group-${group.id}`}
    >
      {editMode && (
        <button
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition ${
            isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"
          }`}
          onClick={onToggleSelect}
          data-testid={`button-select-merge-${group.id}`}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>
      )}

      <div className={`w-2 h-2 rounded-full shrink-0 ${statusIndicator.color}`} title={statusIndicator.label} />

      <Link href="/groups" className="flex-1 min-w-0 flex flex-col gap-0.5" data-testid={`link-eco-group-${group.id}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors" data-testid={`text-group-name-${group.id}`}>
            {group.name}
          </h3>
          <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${typeColor}`}>
            {group.type === "Other" && group.organizationTypeOther ? `Other - ${group.organizationTypeOther}` : group.type}
          </Badge>
        </div>
        {parentName && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1" data-testid={`text-parent-indicator-${group.id}`}>
            <CornerDownRight className="w-3 h-3" />
            {parentName}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
        {communityCount > 0 && (
          <span className="flex items-center gap-1" data-testid={`badge-community-count-${group.id}`}>
            <UserCheck className="w-3 h-3 text-violet-500" />
            {communityCount}
          </span>
        )}
        {totalMembers > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {totalMembers}
          </span>
        )}
        <span className="flex items-center gap-1" data-testid={`text-last-engagement-${group.id}`}>
          <Calendar className="w-3 h-3" />
          {formatRelativeDate(metrics?.lastEngagementDate || null)}
        </span>
      </div>

      {!editMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="shrink-0" data-testid={`button-eco-menu-${group.id}`}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onManageConnections && (
              <DropdownMenuItem onClick={onManageConnections} data-testid={`menu-connections-${group.id}`}>
                <Link2 className="w-4 h-4 mr-2" />
                Manage Connections
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
              data-testid={`menu-delete-${group.id}`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {editMode && (
        <button
          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:border-destructive hover:text-destructive transition shrink-0"
          onClick={onDelete}
          title="Delete"
          data-testid={`button-delete-${group.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

    </div>
  );
}

function ConnectionsView({
  groups,
  allGroups,
  associations,
  densityData,
  engagementData,
  editMode,
  selectedForMerge,
  onToggleSelect,
  onDelete,
  onUpdateGroup,
  onManageConnections,
  parentMap,
  collapsedParents,
  onToggleParent,
}: {
  groups: Group[];
  allGroups: Group[];
  associations: GroupAssociation[];
  densityData?: Record<number, { communityCount: number; totalMembers: number }>;
  engagementData?: Record<number, EngagementMetrics>;
  editMode: boolean;
  selectedForMerge: number[];
  onToggleSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateGroup: (id: number, data: Record<string, any>) => void;
  onManageConnections: (id: number) => void;
  parentMap: Record<number, { parentId: number; parentName: string }>;
  collapsedParents: Record<number | string, boolean>;
  onToggleParent: (id: number | string) => void;
}) {
  const filteredIds = new Set(groups.map(g => g.id));

  const parentSections = useMemo(() => {
    const parentChildMap: Record<number, number[]> = {};
    const childIds = new Set<number>();

    for (const a of associations) {
      if (a.relationshipType === "parent") {
        if (!parentChildMap[a.groupId]) parentChildMap[a.groupId] = [];
        parentChildMap[a.groupId].push(a.associatedGroupId);
        childIds.add(a.associatedGroupId);
      }
    }

    const sections: { parentId: number | null; parentGroup: Group | null; children: Group[] }[] = [];

    for (const [parentIdStr, childGroupIds] of Object.entries(parentChildMap)) {
      const parentId = Number(parentIdStr);
      const parentGroup = allGroups.find(g => g.id === parentId) || null;
      const children = childGroupIds
        .map(cid => allGroups.find(g => g.id === cid))
        .filter((g): g is Group => !!g && filteredIds.has(g.id));
      if (children.length > 0 || (parentGroup && filteredIds.has(parentId))) {
        sections.push({ parentId, parentGroup, children });
      }
    }

    const orphans = groups.filter(g => !childIds.has(g.id) && !parentChildMap[g.id]);
    if (orphans.length > 0) {
      sections.push({ parentId: null, parentGroup: null, children: orphans });
    }

    return sections;
  }, [groups, allGroups, associations, filteredIds]);

  if (parentSections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Network className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p>No connections found. Use the group menu to set up parent-child relationships.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="connections-view">
      {parentSections.map((section) => {
        const sectionKey = section.parentId ?? "independent";
        const isCollapsed = collapsedParents[sectionKey];

        return (
          <div key={sectionKey} className="border rounded-lg overflow-hidden" data-testid={`connection-section-${sectionKey}`}>
            <button
              className="flex items-center gap-3 w-full text-left px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={() => onToggleParent(sectionKey)}
              data-testid={`button-toggle-parent-${sectionKey}`}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              {section.parentGroup ? (
                <>
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">{section.parentGroup.name}</span>
                  <Badge variant="outline" className="text-[10px]">{section.parentGroup.type}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {section.children.length} {section.children.length === 1 ? "child" : "children"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-sm text-muted-foreground">Independent Organisations</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    ({section.children.length})
                  </span>
                </>
              )}
            </button>

            {!isCollapsed && (
              <div className="space-y-1 p-2">
                {section.parentGroup && filteredIds.has(section.parentGroup.id) && (
                  <EcoGroupCard
                    group={section.parentGroup}
                    editMode={editMode}
                    isSelected={selectedForMerge.includes(section.parentGroup.id)}
                    onToggleSelect={() => onToggleSelect(section.parentGroup!.id)}
                    onDelete={() => onDelete(section.parentGroup!.id)}
                    communityCount={densityData?.[section.parentGroup.id]?.communityCount || 0}
                    totalMembers={densityData?.[section.parentGroup.id]?.totalMembers || 0}
                    metrics={engagementData?.[section.parentGroup.id]}
                    onUpdateGroup={(data) => onUpdateGroup(section.parentGroup!.id, data)}
                    onManageConnections={() => onManageConnections(section.parentGroup!.id)}
                  />
                )}
                {section.children.map(child => (
                  <div key={child.id} className={section.parentGroup ? "ml-6" : ""}>
                    <EcoGroupCard
                      group={child}
                      editMode={editMode}
                      isSelected={selectedForMerge.includes(child.id)}
                      onToggleSelect={() => onToggleSelect(child.id)}
                      onDelete={() => onDelete(child.id)}
                      communityCount={densityData?.[child.id]?.communityCount || 0}
                      totalMembers={densityData?.[child.id]?.totalMembers || 0}
                      metrics={engagementData?.[child.id]}
                      onUpdateGroup={(data) => onUpdateGroup(child.id, data)}
                      parentName={parentMap[child.id]?.parentName}
                      onManageConnections={() => onManageConnections(child.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConnectionManagementPanel({
  groupId,
  allGroups,
  associations,
  onClose,
}: {
  groupId: number;
  allGroups: Group[];
  associations: GroupAssociation[];
  onClose: () => void;
}) {
  const [searchVal, setSearchVal] = useState("");
  const [newRelType, setNewRelType] = useState<string>("peer");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();
  const addAssociation = useAddGroupAssociation();
  const removeAssociation = useRemoveGroupAssociation();
  const updateAssociation = useUpdateGroupAssociation();

  const group = allGroups.find(g => g.id === groupId);
  if (!group) return null;

  const groupAssocs = associations.filter(
    a => a.groupId === groupId || a.associatedGroupId === groupId
  );

  const connectedEntries = groupAssocs.map(a => {
    const otherId = a.groupId === groupId ? a.associatedGroupId : a.groupId;
    const otherGroup = allGroups.find(g => g.id === otherId);
    let relType: string;
    if (a.relationshipType === "parent") {
      relType = a.associatedGroupId === groupId ? "parent" : "child";
    } else {
      relType = "peer";
    }
    return { assocId: a.id, otherGroup, relType };
  }).filter(e => e.otherGroup);

  const linkedIds = new Set<number>([groupId, ...connectedEntries.map(e => e.otherGroup!.id)]);
  const availableGroups = allGroups.filter(
    g => !linkedIds.has(g.id) && g.name.toLowerCase().includes(searchVal.toLowerCase())
  ).slice(0, 20);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-manage-connections">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Connections — {group.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Manage connections for {group.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2" data-testid="add-connection-section">
            <Select value={newRelType} onValueChange={setNewRelType}>
              <SelectTrigger className="w-28" data-testid="select-relationship-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="peer">Peer</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1" data-testid="button-add-connection">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Connection
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="end">
                <Command>
                  <CommandInput
                    placeholder="Search groups..."
                    value={searchVal}
                    onValueChange={setSearchVal}
                    data-testid="input-search-connection"
                  />
                  <CommandList>
                    <CommandEmpty>No groups found</CommandEmpty>
                    <CommandGroup>
                      {availableGroups.map(g => (
                        <CommandItem
                          key={g.id}
                          value={g.name}
                          onSelect={() => {
                            addAssociation.mutate(
                              { groupId, associatedGroupId: g.id, relationshipType: newRelType },
                              {
                                onSuccess: () => {
                                  toast({ title: "Connection added" });
                                  setPopoverOpen(false);
                                  setSearchVal("");
                                },
                                onError: (err: any) => {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                },
                              }
                            );
                          }}
                          data-testid={`item-add-connection-${g.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">{g.name}</span>
                            <Badge variant="secondary" className="text-[9px] ml-auto">{g.type}</Badge>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {connectedEntries.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Link2 className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
              <p>No connections yet</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {connectedEntries.map(({ assocId, otherGroup, relType }) => (
                <div
                  key={assocId}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                  data-testid={`row-connection-${assocId}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {otherGroup!.name[0]}
                    </div>
                    <span className="text-sm font-medium truncate">{otherGroup!.name}</span>
                    <Select
                      value={relType}
                      onValueChange={(val) => {
                        updateAssociation.mutate(
                          { groupId, associationId: assocId, relationshipType: val },
                          {
                            onSuccess: () => toast({ title: "Connection updated" }),
                            onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                          }
                        );
                      }}
                    >
                      <SelectTrigger className="h-6 w-20 text-[10px]" data-testid={`select-rel-type-${assocId}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="peer">Peer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={() => removeAssociation.mutate(
                      { groupId, associationId: assocId },
                      {
                        onSuccess: () => toast({ title: "Connection removed" }),
                        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                      }
                    )}
                    data-testid={`button-remove-connection-${assocId}`}
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
