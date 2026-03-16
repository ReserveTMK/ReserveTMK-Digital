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
  Search, Building2, Users, User,
  Edit3, Trash2, Merge, Check, X, ChevronDown, ChevronRight,
  ExternalLink, UserCheck, Activity, AlertTriangle, Clock,
  Star, Zap, Shield, Calendar, MoreVertical
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
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { GROUP_TYPES, type Group } from "@shared/schema";

const ECOSYSTEM_ROLES = [
  { value: "funder", label: "Funders", icon: "dollar" },
  { value: "delivery_partner", label: "Delivery Partners", icon: "handshake" },
  { value: "referral_partner", label: "Referral Partners", icon: "share" },
  { value: "corporate", label: "Corporate", icon: "building" },
  { value: "government", label: "Government", icon: "landmark" },
  { value: "supplier", label: "Suppliers", icon: "package" },
  { value: "creative", label: "Creatives", icon: "palette" },
  { value: "alumni_business", label: "Alumni Businesses", icon: "graduation" },
  { value: "connector", label: "Connectors", icon: "link" },
] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  funder: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  delivery_partner: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
  referral_partner: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  corporate: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
  government: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  supplier: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800" },
  creative: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800" },
  alumni_business: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
  connector: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  funder: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  delivery_partner: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  referral_partner: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  corporate: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  government: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  supplier: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  creative: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  alumni_business: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  connector: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
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
  ecosystemRoles?: string[] | null;
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
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteGroup = useDeleteGroup();

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
      const matchesRole = roleFilter === "all" || (g.ecosystemRoles && g.ecosystemRoles.includes(roleFilter));
      return matchesSearch && matchesRole;
    });
  }, [groups, search, roleFilter]);

  const groupedByRole = useMemo(() => {
    const result: Record<string, Group[]> = {};
    for (const role of ECOSYSTEM_ROLES) {
      result[role.value] = [];
    }
    result["unassigned"] = [];
    for (const g of filtered) {
      if (!g.ecosystemRoles || g.ecosystemRoles.length === 0) {
        result["unassigned"].push(g);
      } else {
        for (const role of g.ecosystemRoles) {
          if (result[role]) {
            result[role].push(g);
          }
        }
      }
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
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-56" data-testid="select-role-filter">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ECOSYSTEM_ROLES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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

      <div className="space-y-6">
        {ECOSYSTEM_ROLES.map(role => {
          const roleGroups = groupedByRole[role.value] || [];
          if (roleGroups.length === 0 && roleFilter !== "all") return null;
          const isCollapsed = collapsedRoles[role.value];
          const colors = ROLE_COLORS[role.value] || { bg: "", text: "", border: "" };

          return (
            <div key={role.value} data-testid={`role-section-${role.value}`}>
              <button
                className="flex items-center gap-2 w-full text-left mb-2"
                onClick={() => toggleRoleCollapse(role.value)}
                data-testid={`button-toggle-role-${role.value}`}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <h2 className={`text-base font-semibold ${colors.text}`}>{role.label}</h2>
                <span className="text-sm text-muted-foreground">({roleGroups.length})</span>
              </button>

              {!isCollapsed && (
                <div className="space-y-1">
                  {roleGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground py-3 text-center">
                      No organisations with this role
                    </p>
                  )}
                  {roleGroups.map(group => (
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
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {(groupedByRole["unassigned"] || []).length > 0 && (
          <div data-testid="role-section-unassigned">
            <button
              className="flex items-center gap-2 w-full text-left mb-2"
              onClick={() => toggleRoleCollapse("unassigned")}
              data-testid="button-toggle-role-unassigned"
            >
              {collapsedRoles["unassigned"] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <h2 className="text-base font-semibold text-muted-foreground">No Role Assigned</h2>
              <span className="text-sm text-muted-foreground">({groupedByRole["unassigned"].length})</span>
            </button>

            {!collapsedRoles["unassigned"] && (
              <div className="space-y-1">
                {groupedByRole["unassigned"].map(group => (
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
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
            {!isContact && Array.isArray(item.ecosystemRoles) && item.ecosystemRoles.length > 0 && (
              item.ecosystemRoles.slice(0, 2).map(role => (
                <Badge key={role} variant="outline" className={`text-[10px] h-5 px-1.5 ${ROLE_BADGE_COLORS[role] || ''}`}>
                  {ECOSYSTEM_ROLES.find(r => r.value === role)?.label || role}
                </Badge>
              ))
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
}) {
  const typeColor = TYPE_COLORS[group.type] || "bg-gray-500/10 text-gray-700 dark:text-gray-300";
  const engagementStatus = getEngagementStatus(metrics?.lastEngagementDate || null);
  const [rolesOpen, setRolesOpen] = useState(false);

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

      <Link href="/groups" className="flex-1 min-w-0 flex items-center gap-2" data-testid={`link-eco-group-${group.id}`}>
        <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors" data-testid={`text-group-name-${group.id}`}>
          {group.name}
        </h3>
        <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${typeColor}`}>
          {group.type === "Other" && group.organizationTypeOther ? `Other - ${group.organizationTypeOther}` : group.type}
        </Badge>
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
            <DropdownMenuItem
              onClick={() => setRolesOpen(true)}
              data-testid={`menu-roles-${group.id}`}
            >
              <Zap className="w-4 h-4 mr-2" />
              Manage Roles
            </DropdownMenuItem>
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

      {rolesOpen && (
        <RolesPopover
          group={group}
          open={rolesOpen}
          onOpenChange={setRolesOpen}
          onUpdateGroup={onUpdateGroup}
        />
      )}
    </div>
  );
}

function RolesPopover({ group, open, onOpenChange, onUpdateGroup }: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateGroup: (data: Record<string, any>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>Ecosystem Roles - {group.name}</DialogTitle>
          <DialogDescription className="sr-only">Manage ecosystem roles for this group</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {ECOSYSTEM_ROLES.map(role => {
            const isSelected = group.ecosystemRoles?.includes(role.value) || false;
            return (
              <button
                key={role.value}
                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition ${
                  isSelected ? "bg-primary/10 font-medium" : "hover:bg-muted"
                }`}
                onClick={() => {
                  const current = group.ecosystemRoles || [];
                  const updated = isSelected
                    ? current.filter(r => r !== role.value)
                    : [...current, role.value];
                  onUpdateGroup({ ecosystemRoles: updated });
                  group.ecosystemRoles = updated;
                }}
                data-testid={`option-role-${role.value}-${group.id}`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                <span className={isSelected ? "" : "ml-5"}>{role.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
