import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import {
  Building2, Users, User, Check, ChevronDown, ChevronRight,
  UserCheck, Activity, AlertTriangle, Clock, Star, Calendar,
  MoreVertical, Network, Link2, Trash2, CornerDownRight, Plus, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAddGroupAssociation, useRemoveGroupAssociation, useUpdateGroupAssociation } from "@/hooks/use-groups";
import { Link } from "wouter";
import { GROUP_TYPES, type Group, type GroupAssociation } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────

export type EngagementMetrics = {
  totalEvents: number;
  totalProgrammes: number;
  totalBookings: number;
  totalSpendEntries: number;
  totalImpactLogs: number;
  totalAgreements: number;
  totalCollaborations: number;
  lastEngagementDate: string | null;
};

export type HealthSummary = {
  total: number;
  active: number;
  dormant: number;
  atRisk: number;
};

export type VipItem = {
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

// ── Helpers ────────────────────────────────────────────────────────

export function getEngagementStatus(lastDate: string | null): "active" | "recent" | "dormant" {
  if (!lastDate) return "dormant";
  const d = new Date(lastDate);
  const now = new Date();
  const daysDiff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 90) return "active";
  if (daysDiff <= 180) return "recent";
  return "dormant";
}

export function formatRelativeDate(dateStr: string | null): string {
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

// ── Colour maps ────────────────────────────────────────────────────

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

// ── Health Summary Cards ───────────────────────────────────────────

export function HealthSummaryCards({ healthData, totalGroups }: { healthData?: HealthSummary; totalGroups: number }) {
  return (
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
  );
}

// ── VIP Card ───────────────────────────────────────────────────────

export function VipCard({ item }: { item: VipItem }) {
  const days = daysSince(item.movedToVipAt || null);
  const isStale = days !== null && days > 30;
  const isContact = item.type === "contact";

  return (
    <Link
      href={isContact ? `/contacts/${item.id}` : `/community/groups`}
      className="block"
      data-testid={`vip-card-${item.type}-${item.id}`}
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-md ${
        isStale ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : "border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-950/10"
      }`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isContact ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"
        }`}>
          {isContact ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
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
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{item.engagementLevel}</Badge>
            )}
          </div>
          {item.vipReason && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.vipReason}</p>
          )}
          {!item.vipReason && (isContact ? (item.linkedGroupName || item.businessName) : null) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.linkedGroupName || item.businessName}</p>
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

// ── VIP Section ────────────────────────────────────────────────────

export function VipSection({ vipItems }: { vipItems: VipItem[] }) {
  if (!vipItems || vipItems.length === 0) return null;
  return (
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
  );
}

// ── Eco Group Card ─────────────────────────────────────────────────

export function EcoGroupCard({
  group, editMode, isSelected, onToggleSelect, onDelete,
  communityCount, totalMembers, metrics, parentName, onManageConnections,
}: {
  group: Group;
  editMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  communityCount: number;
  totalMembers: number;
  metrics?: EngagementMetrics;
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
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>
      )}

      <div className={`w-2 h-2 rounded-full shrink-0 ${statusIndicator.color}`} title={statusIndicator.label} />

      <Link href="/community/groups" className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {group.name}
          </h3>
          <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${typeColor}`}>
            {group.type === "Other" && group.organizationTypeOther ? `Other - ${group.organizationTypeOther}` : group.type}
          </Badge>
        </div>
        {parentName && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CornerDownRight className="w-3 h-3" />
            {parentName}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
        {communityCount > 0 && (
          <span className="flex items-center gap-1">
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
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatRelativeDate(metrics?.lastEngagementDate || null)}
        </span>
      </div>

      {!editMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onManageConnections && (
              <DropdownMenuItem onClick={onManageConnections}>
                <Link2 className="w-4 h-4 mr-2" />
                Manage Connections
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
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
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Categories View ────────────────────────────────────────────────

export function CategoriesView({
  groupedByType, densityData, engagementData, editMode, selectedIds,
  onToggleSelect, onDelete, onManageConnections, parentMap,
}: {
  groupedByType: Record<string, Group[]>;
  densityData?: Record<number, { communityCount: number; totalMembers: number }>;
  engagementData?: Record<number, EngagementMetrics>;
  editMode: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onManageConnections: (id: number) => void;
  parentMap: Record<number, { parentId: number; parentName: string }>;
}) {
  const [collapsedRoles, setCollapsedRoles] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      {GROUP_TYPES.map(categoryType => {
        const typeGroups = groupedByType[categoryType] || [];
        if (typeGroups.length === 0) return null;
        const isCollapsed = collapsedRoles[categoryType];
        const colors = CATEGORY_SECTION_COLORS[categoryType] || { bg: "", text: "", border: "" };

        return (
          <div key={categoryType}>
            <button
              className="flex items-center gap-2 w-full text-left mb-2"
              onClick={() => setCollapsedRoles(prev => ({ ...prev, [categoryType]: !prev[categoryType] }))}
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
                    isSelected={selectedIds.includes(group.id)}
                    onToggleSelect={() => onToggleSelect(group.id)}
                    onDelete={() => onDelete(group.id)}
                    communityCount={densityData?.[group.id]?.communityCount || 0}
                    totalMembers={densityData?.[group.id]?.totalMembers || 0}
                    metrics={engagementData?.[group.id]}
                    parentName={parentMap[group.id]?.parentName}
                    onManageConnections={() => onManageConnections(group.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Connections View ───────────────────────────────────────────────

export function ConnectionsView({
  groups, allGroups, associations, densityData, engagementData,
  editMode, selectedIds, onToggleSelect, onDelete, onManageConnections, parentMap,
}: {
  groups: Group[];
  allGroups: Group[];
  associations: GroupAssociation[];
  densityData?: Record<number, { communityCount: number; totalMembers: number }>;
  engagementData?: Record<number, EngagementMetrics>;
  editMode: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onManageConnections: (id: number) => void;
  parentMap: Record<number, { parentId: number; parentName: string }>;
}) {
  const [collapsedParents, setCollapsedParents] = useState<Record<number | string, boolean>>({});
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
          <div key={sectionKey} className="border rounded-lg overflow-hidden">
            <button
              className="flex items-center gap-3 w-full text-left px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={() => setCollapsedParents(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
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
                  <span className="text-xs text-muted-foreground ml-auto">({section.children.length})</span>
                </>
              )}
            </button>

            {!isCollapsed && (
              <div className="space-y-1 p-2">
                {section.parentGroup && filteredIds.has(section.parentGroup.id) && (
                  <EcoGroupCard
                    group={section.parentGroup}
                    editMode={editMode}
                    isSelected={selectedIds.includes(section.parentGroup.id)}
                    onToggleSelect={() => onToggleSelect(section.parentGroup!.id)}
                    onDelete={() => onDelete(section.parentGroup!.id)}
                    communityCount={densityData?.[section.parentGroup.id]?.communityCount || 0}
                    totalMembers={densityData?.[section.parentGroup.id]?.totalMembers || 0}
                    metrics={engagementData?.[section.parentGroup.id]}
                    onManageConnections={() => onManageConnections(section.parentGroup!.id)}
                  />
                )}
                {section.children.map(child => (
                  <div key={child.id} className={section.parentGroup ? "ml-6" : ""}>
                    <EcoGroupCard
                      group={child}
                      editMode={editMode}
                      isSelected={selectedIds.includes(child.id)}
                      onToggleSelect={() => onToggleSelect(child.id)}
                      onDelete={() => onDelete(child.id)}
                      communityCount={densityData?.[child.id]?.communityCount || 0}
                      totalMembers={densityData?.[child.id]?.totalMembers || 0}
                      metrics={engagementData?.[child.id]}
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

// ── Connection Management Panel ────────────────────────────────────

export function ConnectionManagementPanel({
  groupId, allGroups, associations, onClose,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Connections — {group.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Manage connections for {group.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={newRelType} onValueChange={setNewRelType}>
              <SelectTrigger className="w-28">
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
                <Button size="sm" variant="outline" className="flex-1">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Connection
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search groups..." value={searchVal} onValueChange={setSearchVal} />
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
                                onSuccess: () => { toast({ title: "Connection added" }); setPopoverOpen(false); setSearchVal(""); },
                                onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
                              }
                            );
                          }}
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
                <div key={assocId} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group">
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
                      <SelectTrigger className="h-6 w-20 text-[10px]">
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
