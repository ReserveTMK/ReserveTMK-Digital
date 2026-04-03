import { Button } from "@/components/ui/beautiful-button";
import { Users, Trash2, Pencil, ArrowUp, ArrowDown, ArrowUpDown, UserPlus, UserCheck, Loader2, Building2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { GROUP_TYPES, ENGAGEMENT_LEVELS, type Group } from "@shared/schema";
import { ENGAGEMENT_COLORS } from "./constants";

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

export interface GroupsTableViewProps {
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
}

export function GroupsTableView({ groups, communityDensity, editMode, selectedGroups, toggleGroupSelection, toggleSelectAll, onSelect, onEdit, onDelete, viewMode, onPromote, isPromoting }: GroupsTableViewProps) {
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

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ groupId, data }: { groupId: number; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/groups/${groupId}`, data);
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
              <th className="px-1.5 py-3 text-[10px] font-medium text-muted-foreground text-center" title="Māori-led">Māori Led</th>
              <th className="px-1.5 py-3 text-[10px] font-medium text-muted-foreground text-center" title="Serves Māori">Serves M</th>
              <th className="px-1.5 py-3 text-[10px] font-medium text-muted-foreground text-center" title="Pasifika-led">Pasifika Led</th>
              <th className="px-1.5 py-3 text-[10px] font-medium text-muted-foreground text-center" title="Serves Pasifika">Serves P</th>
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
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="text-[11px] font-medium bg-transparent border border-transparent hover:border-border rounded px-1.5 py-0.5 cursor-pointer transition-colors focus:border-primary focus:outline-none"
                      value={group.type || ""}
                      onChange={(e) => inlineUpdateMutation.mutate({ groupId: group.id, data: { type: e.target.value } })}
                      data-testid={`table-type-group-${group.id}`}
                    >
                      {GROUP_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {group.engagementLevel && group.engagementLevel !== "Active" && (
                      <Badge className={`text-[9px] h-4 px-1.5 ml-1 ${ENGAGEMENT_COLORS[group.engagementLevel] || ""}`} data-testid={`table-engagement-${group.id}`}>
                        {group.engagementLevel}
                      </Badge>
                    )}
                  </td>
                  <td className="px-1.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={group.isMaori || false}
                      onCheckedChange={(v) => inlineUpdateMutation.mutate({ groupId: group.id, data: { isMaori: v === true } })}
                      className="mx-auto"
                      data-testid={`table-maori-${group.id}`}
                    />
                  </td>
                  <td className="px-1.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={group.servesMaori || false}
                      onCheckedChange={(v) => inlineUpdateMutation.mutate({ groupId: group.id, data: { servesMaori: v === true } })}
                      className="mx-auto"
                      data-testid={`table-serves-maori-${group.id}`}
                    />
                  </td>
                  <td className="px-1.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={group.isPasifika || false}
                      onCheckedChange={(v) => inlineUpdateMutation.mutate({ groupId: group.id, data: { isPasifika: v === true } })}
                      className="mx-auto"
                      data-testid={`table-pasifika-${group.id}`}
                    />
                  </td>
                  <td className="px-1.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={group.servesPasifika || false}
                      onCheckedChange={(v) => inlineUpdateMutation.mutate({ groupId: group.id, data: { servesPasifika: v === true } })}
                      className="mx-auto"
                      data-testid={`table-serves-pasifika-${group.id}`}
                    />
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
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="email"
                      className="text-xs text-muted-foreground bg-transparent border border-transparent hover:border-border rounded px-1.5 py-0.5 w-full max-w-[180px] transition-colors focus:border-primary focus:outline-none focus:text-foreground"
                      defaultValue={group.contactEmail || ""}
                      placeholder="—"
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (group.contactEmail || "")) {
                          inlineUpdateMutation.mutate({ groupId: group.id, data: { contactEmail: val || null } });
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      data-testid={`table-email-group-${group.id}`}
                    />
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
