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
  ExternalLink, UserCheck, Activity, AlertTriangle, Clock,
  Star, Zap, Shield, TrendingUp, Calendar
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
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
    label: "Noted",
    description: "Logged in the network for reference",
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

const ECOSYSTEM_ROLES = [
  { value: "funder", label: "Funder" },
  { value: "delivery_partner", label: "Delivery Partner" },
  { value: "referral_partner", label: "Referral Partner" },
  { value: "corporate", label: "Corporate" },
  { value: "government", label: "Government" },
  { value: "supplier", label: "Supplier" },
  { value: "creative", label: "Creative" },
  { value: "alumni_business", label: "Alumni Business" },
  { value: "connector", label: "Connector" },
] as const;

const ROLE_COLORS: Record<string, string> = {
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

const IMPORTANCE_CONFIG = {
  high: { label: "High", color: "text-red-600", bg: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  low: { label: "Low", color: "text-slate-500", bg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
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

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [importanceFilter, setImportanceFilter] = useState<string>("all");
  const [strengthFilter, setStrengthFilter] = useState<string>("all");
  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [editMode, setEditMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [collapsedTiers, setCollapsedTiers] = useState<Record<string, boolean>>({});
  const [changeTierDialog, setChangeTierDialog] = useState<{ group: Group; newTier: TierKey } | null>(null);
  const [bulkTierOpen, setBulkTierOpen] = useState(false);
  const [bulkTierValue, setBulkTierValue] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ['/api/groups/ecosystem-health'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/groups/engagement-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/ecosystem-health'] });
      setSelectedForMerge([]);
      setBulkDeleteOpen(false);
      setEditMode(false);
      toast({ title: "Deleted", description: `${data.deleted} group${data.deleted !== 1 ? 's' : ''} removed.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkTierMutation = useMutation({
    mutationFn: async ({ groupIds, tier }: { groupIds: number[]; tier: string }) => {
      const res = await fetch("/api/groups/bulk-update-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds, tier }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update tiers");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/community-density'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/ecosystem-health'] });
      setSelectedForMerge([]);
      setBulkTierOpen(false);
      setBulkTierValue("");
      setEditMode(false);
      toast({ title: "Tiers updated", description: `${data.updated} group${data.updated !== 1 ? 's' : ''} updated.` });
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

  const hasActiveFilters = roleFilter !== "all" || importanceFilter !== "all" || strengthFilter !== "all" || engagementFilter !== "all";

  const filtered = useMemo(() => {
    if (!groups) return [];
    return (groups as Group[]).filter((g) => {
      const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || g.type === typeFilter;
      const matchesRole = roleFilter === "all" || (g.ecosystemRoles && g.ecosystemRoles.includes(roleFilter));
      const matchesImportance = importanceFilter === "all" || g.strategicImportance === importanceFilter;
      const matchesStrength = strengthFilter === "all" || String(g.relationshipStrength) === strengthFilter;
      const matchesEngagement = (() => {
        if (engagementFilter === "all") return true;
        const metrics = engagementData?.[g.id];
        const status = getEngagementStatus(metrics?.lastEngagementDate || null);
        if (engagementFilter === "active") return status === "active";
        if (engagementFilter === "dormant") return status === "dormant";
        if (engagementFilter === "recent") return status === "recent";
        return true;
      })();
      return matchesSearch && matchesType && matchesRole && matchesImportance && matchesStrength && matchesEngagement;
    });
  }, [groups, search, typeFilter, roleFilter, importanceFilter, strengthFilter, engagementFilter, engagementData]);

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
      {editMode && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-md px-4 md:px-8 py-3" data-testid="edit-toolbar-ecosystem">
          <div className="max-w-7xl mx-auto w-full flex items-center gap-2 flex-wrap">
            {selectedForMerge.length >= 1 && (
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} data-testid="button-bulk-delete">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedForMerge.length})
              </Button>
            )}
            {selectedForMerge.length >= 1 && (
              <Button size="sm" variant="outline" onClick={() => setBulkTierOpen(true)} data-testid="button-bulk-tier">
                <Heart className="w-4 h-4 mr-1" />
                Change Tier ({selectedForMerge.length})
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
            Network intelligence across {totalGroups} organisations
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

      {/* Health Summary */}
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

      {/* Search & Filters */}
      <div className="space-y-3">
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
          <Button
            variant={showFilters || hasActiveFilters ? "default" : "outline"}
            size="sm"
            className="h-10"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                {[roleFilter, importanceFilter, strengthFilter, engagementFilter].filter(f => f !== "all").length}
              </Badge>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border bg-muted/30" data-testid="filter-panel">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ecosystem Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9" data-testid="select-role-filter">
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Strategic Importance</label>
              <Select value={importanceFilter} onValueChange={setImportanceFilter}>
                <SelectTrigger className="h-9" data-testid="select-importance-filter">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Relationship Strength</label>
              <Select value={strengthFilter} onValueChange={setStrengthFilter}>
                <SelectTrigger className="h-9" data-testid="select-strength-filter">
                  <SelectValue placeholder="Any strength" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any strength</SelectItem>
                  <SelectItem value="5">5 - Very Strong</SelectItem>
                  <SelectItem value="4">4 - Strong</SelectItem>
                  <SelectItem value="3">3 - Moderate</SelectItem>
                  <SelectItem value="2">2 - Weak</SelectItem>
                  <SelectItem value="1">1 - Very Weak</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Engagement Status</label>
              <Select value={engagementFilter} onValueChange={setEngagementFilter}>
                <SelectTrigger className="h-9" data-testid="select-engagement-filter">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="active">Active (90d)</SelectItem>
                  <SelectItem value="recent">Recent (3-6mo)</SelectItem>
                  <SelectItem value="dormant">Dormant (6mo+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2 md:col-span-4 text-xs"
                onClick={() => { setRoleFilter("all"); setImportanceFilter("all"); setStrengthFilter("all"); setEngagementFilter("all"); }}
                data-testid="button-clear-filters"
              >
                <X className="w-3 h-3 mr-1" /> Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tier Sections */}
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
                      metrics={engagementData?.[group.id]}
                      onUpdateGroup={(data) => updateGroupMutation.mutate({ id: group.id, data })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
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

      <Dialog open={bulkTierOpen} onOpenChange={setBulkTierOpen}>
        <DialogContent data-testid="dialog-bulk-tier">
          <DialogHeader>
            <DialogTitle>Change Tier for {selectedForMerge.length} Group{selectedForMerge.length !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move the selected groups to a new relationship tier.
          </p>
          <Select value={bulkTierValue} onValueChange={setBulkTierValue}>
            <SelectTrigger data-testid="select-bulk-tier">
              <SelectValue placeholder="Select tier..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="collaborate">Collaborate</SelectItem>
              <SelectItem value="mentioned">Noted</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkTierOpen(false); setBulkTierValue(""); }} data-testid="button-cancel-bulk-tier">
              Cancel
            </Button>
            <Button
              onClick={() => bulkTierMutation.mutate({ groupIds: selectedForMerge, tier: bulkTierValue })}
              disabled={!bulkTierValue || bulkTierMutation.isPending}
              data-testid="button-confirm-bulk-tier"
            >
              {bulkTierMutation.isPending ? "Updating..." : "Update Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StrengthDots({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5" data-testid="strength-dots">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            n <= (value || 0)
              ? "bg-primary scale-110"
              : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
          }`}
          onClick={(e) => { e.stopPropagation(); onChange(n); }}
          title={`Strength ${n}/5`}
          data-testid={`strength-dot-${n}`}
        />
      ))}
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
  metrics,
  onUpdateGroup,
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
  metrics?: EngagementMetrics;
  onUpdateGroup: (data: Record<string, any>) => void;
}) {
  const config = TIER_CONFIG[tier];
  const typeColor = TYPE_COLORS[group.type] || "bg-gray-500/10 text-gray-700 dark:text-gray-300";
  const engagementStatus = getEngagementStatus(metrics?.lastEngagementDate || null);
  const [rolesOpen, setRolesOpen] = useState(false);

  const statusIndicator = {
    active: { color: "bg-emerald-500", label: "Active" },
    recent: { color: "bg-amber-400", label: "Recent" },
    dormant: { color: "bg-slate-300 dark:bg-slate-600", label: "Dormant" },
  }[engagementStatus];

  const totalActivity = metrics ? metrics.totalCollaborations + metrics.totalImpactLogs + metrics.totalSpendEntries : 0;

  return (
    <Card
      className={`p-4 transition hover:shadow-md ${editMode && isSelectedForMerge ? "ring-2 ring-primary" : ""}`}
      data-testid={`card-group-${group.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`w-2 h-2 rounded-full shrink-0 ${statusIndicator.color}`} title={statusIndicator.label} />
            <h3 className="font-semibold text-sm truncate" data-testid={`text-group-name-${group.id}`}>
              {group.name}
            </h3>
            <Badge variant="outline" className={`text-[10px] px-1.5 ${typeColor}`}>
              {group.type}
            </Badge>
          </div>

          {group.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{group.description}</p>
          )}

          {/* Strategic Info Row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {group.strategicImportance && (
              <Badge variant="outline" className={`text-[10px] px-1.5 ${IMPORTANCE_CONFIG[group.strategicImportance as keyof typeof IMPORTANCE_CONFIG]?.bg || ''}`} data-testid={`badge-importance-${group.id}`}>
                <Shield className="w-2.5 h-2.5 mr-0.5" />
                {IMPORTANCE_CONFIG[group.strategicImportance as keyof typeof IMPORTANCE_CONFIG]?.label}
              </Badge>
            )}
            {group.ecosystemRoles && group.ecosystemRoles.length > 0 && (
              group.ecosystemRoles.slice(0, 2).map(role => (
                <Badge key={role} variant="outline" className={`text-[10px] px-1.5 ${ROLE_COLORS[role] || ''}`} data-testid={`badge-role-${role}-${group.id}`}>
                  {ECOSYSTEM_ROLES.find(r => r.value === role)?.label || role}
                </Badge>
              ))
            )}
            {group.ecosystemRoles && group.ecosystemRoles.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5">+{group.ecosystemRoles.length - 2}</Badge>
            )}
          </div>

          {/* Metrics Row */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
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
            {totalActivity > 0 && (
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-500" />
                {totalActivity}
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto" data-testid={`text-last-engagement-${group.id}`}>
              <Calendar className="w-3 h-3" />
              {formatRelativeDate(metrics?.lastEngagementDate || null)}
            </span>
          </div>

          {/* Strength dots */}
          <div className="mt-2">
            <StrengthDots
              value={group.relationshipStrength ?? null}
              onChange={(v) => onUpdateGroup({ relationshipStrength: v })}
            />
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
        <div className="flex items-center gap-1 mt-3 pt-2 border-t">
          <div className="flex items-center gap-1">
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
          </div>

          {/* Inline importance toggle */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1 rounded text-muted-foreground/60 hover:text-muted-foreground transition ml-1" title="Strategic importance" data-testid={`button-importance-${group.id}`}>
                <Shield className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {(["high", "medium", "low"] as const).map(level => (
                <button
                  key={level}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded transition ${
                    group.strategicImportance === level ? "bg-primary/10 font-medium" : "hover:bg-muted"
                  }`}
                  onClick={() => onUpdateGroup({ strategicImportance: level })}
                  data-testid={`option-importance-${level}-${group.id}`}
                >
                  {IMPORTANCE_CONFIG[level].label}
                </button>
              ))}
              {group.strategicImportance && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded text-muted-foreground hover:bg-muted transition"
                  onClick={() => onUpdateGroup({ strategicImportance: null })}
                  data-testid={`option-importance-clear-${group.id}`}
                >
                  Clear
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* Inline roles toggle */}
          <Popover open={rolesOpen} onOpenChange={setRolesOpen}>
            <PopoverTrigger asChild>
              <button className="p-1 rounded text-muted-foreground/60 hover:text-muted-foreground transition" title="Ecosystem roles" data-testid={`button-roles-${group.id}`}>
                <Zap className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {ECOSYSTEM_ROLES.map(role => {
                const isSelected = group.ecosystemRoles?.includes(role.value) || false;
                return (
                  <button
                    key={role.value}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded flex items-center gap-2 transition ${
                      isSelected ? "bg-primary/10 font-medium" : "hover:bg-muted"
                    }`}
                    onClick={() => {
                      const current = group.ecosystemRoles || [];
                      const updated = isSelected
                        ? current.filter(r => r !== role.value)
                        : [...current, role.value];
                      onUpdateGroup({ ecosystemRoles: updated });
                    }}
                    data-testid={`option-role-${role.value}-${group.id}`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                    <span className={isSelected ? "" : "ml-5"}>{role.label}</span>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          <button
            className="ml-auto p-1 text-muted-foreground hover:text-foreground transition"
            onClick={onNavigate}
            title="View in Groups"
            data-testid={`button-navigate-${group.id}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </Card>
  );
}
