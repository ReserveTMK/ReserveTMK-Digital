import { useState, useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Lightbulb, UserCheck, Loader2, Coffee, Star } from "lucide-react";
import { Button } from "@/components/ui/beautiful-button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  InlineTextCell,
  InlineNameCell,
  InlineEthnicityCell,
  InlineStageCell,
  InlineSupportCell,
  InlineConnectionCell,
  InlineRoleCell,
  InlineGroupCell,
  InlineAreaCell,
  SortHeader,
} from "@/components/community/inline-cells";
import type { SortField, SortDir } from "@/components/community/inline-cells";

interface ContactsTableViewProps {
  contacts: any[];
  allContacts: any[];
  editMode: boolean;
  selectedContacts: Set<number>;
  toggleContactSelection: (id: number) => void;
  toggleSelectAll: () => void;
  onToggleCommunity: (id: number, isCommunityMember: boolean) => void;
  drilldownTier?: string | null;
  onPromote?: (id: number) => void;
  promotePending?: boolean;
  onToggleVip?: (id: number) => void;
  toggleVipPending?: boolean;
}

type CatchUpItemData = {
  id: number;
  contactId: number;
  priority: string | null;
};

export function ContactsTableView({ contacts, allContacts, editMode, selectedContacts, toggleContactSelection, toggleSelectAll, onToggleCommunity, drilldownTier, onPromote, promotePending, onToggleVip, toggleVipPending }: ContactsTableViewProps) {
  const [sortField, setSortField] = useState<SortField | null>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [backfilling, setBackfilling] = useState(false);
  const { toast } = useToast();

  const { data: catchUpItems } = useQuery<CatchUpItemData[]>({
    queryKey: ["/api/catch-up-list"],
  });

  const { data: engagementScores } = useQuery<Record<number, { interactions: number; debriefs: number; events: number; total: number }>>({
    queryKey: ["/api/contacts/engagement-scores"],
    enabled: !drilldownTier, // only fetch for All Contacts view
    staleTime: 60000,
  });

  const { data: allGroupMemberships } = useQuery<{ id: number; groupId: number; contactId: number; name: string; type: string }[]>({
    queryKey: ["/api/group-memberships/all"],
  });

  const { data: allGroups } = useQuery<{ id: number; name: string; type: string }[]>({
    queryKey: ["/api/groups"],
  });

  const contactGroupsMap = useMemo(() => {
    const map = new Map<number, { id: number; groupId: number; name: string }[]>();
    (allGroupMemberships || []).forEach((m) => {
      const list = map.get(m.contactId) || [];
      list.push({ id: m.id, groupId: m.groupId, name: m.name });
      map.set(m.contactId, list);
    });
    return map;
  }, [allGroupMemberships]);

  const catchUpContactIds = useMemo(() => {
    const map = new Map<number, CatchUpItemData>();
    (catchUpItems || []).forEach((item) => map.set(item.contactId, item));
    return map;
  }, [catchUpItems]);

  const addToCatchUpMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest("POST", "/api/catch-up-list", { contactId, note: "", priority: "soon" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      toast({ title: "Added to catch-up list" });
    },
  });

  const removeCatchUpMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/catch-up-list/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catch-up-list"] });
      toast({ title: "Removed from catch-up list" });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await apiRequest("POST", "/api/mentoring-relationships/backfill-from-support-type");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Backfill complete", description: `Created ${data.createdCount} mentoring relationships.` });
    } catch (err: any) {
      toast({ title: "Backfill failed", variant: "destructive", description: err.message });
    } finally {
      setBackfilling(false);
    }
  };

  const ethnicityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of allContacts) {
      if (c.ethnicity) {
        for (const eth of c.ethnicity) {
          counts[eth] = (counts[eth] || 0) + 1;
        }
      }
    }
    return counts;
  }, [allContacts]);

  const sortedContacts = useMemo(() => {
    if (!sortField) return contacts;
    const sorted = [...contacts].sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case "name":
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
          break;
        case "role":
          av = (a.role || "").toLowerCase();
          bv = (b.role || "").toLowerCase();
          break;
        case "group":
          av = (contactGroupsMap.get(a.id) || []).map((g: any) => g.name).join(", ").toLowerCase();
          bv = (contactGroupsMap.get(b.id) || []).map((g: any) => g.name).join(", ").toLowerCase();
          break;
        case "stage": {
          const stageOrder = ["kakano", "tipu", "ora", "inactive"];
          av = stageOrder.indexOf(a.stage || "");
          bv = stageOrder.indexOf(b.stage || "");
          if (av === -1) av = 99;
          if (bv === -1) bv = 99;
          return sortDir === "asc" ? av - bv : bv - av;
        }
        case "connection":
          const connOrder = ["known", "connected", "engaged", "embedded", "partnering"];
          av = connOrder.indexOf(a.connectionStrength || "");
          bv = connOrder.indexOf(b.connectionStrength || "");
          return sortDir === "asc" ? av - bv : bv - av;
        case "support":
          av = (a.supportType || []).length;
          bv = (b.supportType || []).length;
          return sortDir === "asc" ? av - bv : bv - av;
        case "ethnicity":
          av = (a.ethnicity || []).join(", ").toLowerCase();
          bv = (b.ethnicity || []).join(", ").toLowerCase();
          break;
        case "age":
          av = a.age ?? -1;
          bv = b.age ?? -1;
          return sortDir === "asc" ? av - bv : bv - av;
        case "suburb":
          av = (a.suburb || "").toLowerCase();
          bv = (b.suburb || "").toLowerCase();
          break;
        case "area":
          av = a.area || "";
          bv = b.area || "";
          break;
        case "lastActive":
          av = a.lastActiveDate || a.lastInteractionDate || "";
          bv = b.lastActiveDate || b.lastInteractionDate || "";
          break;
        case "community":
          av = a.isCommunityMember ? 1 : 0;
          bv = b.isCommunityMember ? 1 : 0;
          return sortDir === "asc" ? av - bv : bv - av;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [contacts, sortField, sortDir]);

  return (
    <div className="space-y-4">
      {(drilldownTier === "innovators" || drilldownTier === "vip") && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleBackfill} disabled={backfilling}>
            {backfilling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sync Mentoring Relationships
          </Button>
        </div>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="contacts-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {editMode && (
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="table-checkbox-select-all"
                    />
                  </th>
                )}
                <SortHeader label="Name" field="name" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-4" />
                {drilldownTier !== "innovators" && drilldownTier !== "vip" && (
                  <SortHeader label={drilldownTier === "community" ? "Innovator" : "Community"} field="community" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 w-28" />
                )}
                <SortHeader label="Role" field="role" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
                <SortHeader label="Group" field="group" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[130px]" />
                {(drilldownTier === "innovators" || drilldownTier === "vip") && (
                  <SortHeader label="Stage" field="stage" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
                )}
                {drilldownTier === "innovators" && (
                  <SortHeader label="Support" field="support" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[120px]" />
                )}
                <SortHeader label="Ethnicity" field="ethnicity" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[160px]" />
                <SortHeader label="Suburb" field="suburb" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
                {drilldownTier === "innovators" && (
                  <SortHeader label="Area" field="area" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 w-20" />
                )}
                <SortHeader label="Connection" field="connection" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[120px]" />
              </tr>
            </thead>
            <tbody>
              {sortedContacts.map((contact) => (
                <tr key={contact.id} className={`border-b last:border-b-0 hover:bg-muted/20 transition-colors ${editMode && selectedContacts.has(contact.id) ? 'bg-primary/5' : ''}`} data-testid={`table-row-${contact.id}`}>
                  {editMode && (
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                        data-testid={`table-checkbox-${contact.id}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <InlineNameCell contactId={contact.id} name={contact.name} />
                      <Link href={`/contacts/${contact.id}`} className="hidden" data-testid={`table-link-${contact.id}`} />
                      {!drilldownTier && engagementScores && (() => {
                        const score = engagementScores[contact.id];
                        const total = score?.total || 0;
                        const color = total >= 4 ? "bg-green-500" : total >= 1 ? "bg-yellow-400" : "bg-red-400";
                        const label = `${score?.interactions || 0} interactions · ${score?.debriefs || 0} debrief mentions · ${score?.events || 0} events`;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      <button
                        className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                        onClick={() => onToggleVip?.(contact.id)}
                        disabled={toggleVipPending}
                        title={contact.isVip ? "Remove VIP" : "Mark as VIP"}
                        data-testid={`button-toggle-vip-${contact.id}`}
                      >
                        <Star className={`w-3.5 h-3.5 ${contact.isVip ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/40"}`} />
                      </button>
                      {contact.isRangatahi && (
                        <span
                          className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 rounded px-0.5 leading-tight"
                          title="Rangatahi"
                          data-testid={`badge-rangatahi-${contact.id}`}
                        >
                          R
                        </span>
                      )}
                    </div>
                  </td>
                  {drilldownTier !== "innovators" && drilldownTier !== "vip" && (
                    <td className="px-3 py-2">
                      {drilldownTier === "community" ? (
                        contact.isInnovator ? (
                          <Badge
                            className="text-[10px] h-5 px-2 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                            data-testid={`badge-innovator-${contact.id}`}
                          >
                            <Lightbulb className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-2 cursor-pointer hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                            onClick={() => onPromote?.(contact.id)}
                            data-testid={`button-promote-innovator-${contact.id}`}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Badge>
                        )
                      ) : (
                        contact.isCommunityMember ? (
                          <Badge
                            className="text-[10px] h-5 px-2 bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20 cursor-pointer hover:bg-purple-500/25 transition-colors"
                            onClick={() => onToggleCommunity(contact.id, false)}
                            data-testid={`badge-community-${contact.id}`}
                          >
                            <UserCheck className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-2 cursor-pointer hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                            onClick={() => onToggleCommunity(contact.id, true)}
                            data-testid={`button-add-community-${contact.id}`}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Badge>
                        )
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <InlineRoleCell role={contact.role} roleOther={contact.roleOther} contactId={contact.id} />
                  </td>
                  <td className="px-3 py-2">
                    <InlineGroupCell
                      contactId={contact.id}
                      groups={contactGroupsMap.get(contact.id) || []}
                      allGroups={(allGroups || []) as { id: number; name: string; type: string }[]}
                    />
                  </td>
                  {(drilldownTier === "innovators" || drilldownTier === "vip") && (
                    <td className="px-3 py-2">
                      <InlineStageCell stage={contact.stage} contactId={contact.id} />
                    </td>
                  )}
                  {drilldownTier === "innovators" && (
                    <td className="px-1 py-2">
                      <InlineSupportCell contactId={contact.id} supportTypes={contact.supportType || []} />
                    </td>
                  )}
                  <td className="px-1 py-2">
                    <InlineEthnicityCell contactId={contact.id} ethnicities={contact.ethnicity || []} ethnicityCounts={ethnicityCounts} />
                  </td>
                  <td className="px-1 py-2">
                    <InlineTextCell contactId={contact.id} field="suburb" value={contact.suburb || ""} placeholder="—" />
                  </td>
                  {drilldownTier === "innovators" && (
                    <td className="px-1 py-2">
                      <InlineAreaCell contactId={contact.id} area={contact.area} />
                    </td>
                  )}
                  <td className="px-1 py-2">
                    <InlineConnectionCell contactId={contact.id} connectionStrength={contact.connectionStrength} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
