import { useState, useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Lightbulb, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/beautiful-button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  InlineTextCell,
  InlineEthnicityCell,
  InlineStageCell,
  InlineSupportCell,
  InlineConnectionCell,
  InlineRoleCell,
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
}

export function ContactsTableView({ contacts, allContacts, editMode, selectedContacts, toggleContactSelection, toggleSelectAll, onToggleCommunity, drilldownTier, onPromote, promotePending }: ContactsTableViewProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [backfilling, setBackfilling] = useState(false);
  const { toast } = useToast();

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
      {drilldownTier === "innovators" && (
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
                {drilldownTier !== "innovators" && (
                  <SortHeader label={drilldownTier === "community" ? "Innovator" : "Community"} field="community" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 w-28" />
                )}
                <SortHeader label="Role" field="role" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
                {drilldownTier === "innovators" ? (
                  <>
                    <SortHeader label="Stage" field="stage" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
                    <SortHeader label="Connection" field="connection" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[120px]" />
                    <SortHeader label="Support" field="support" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[120px]" />
                  </>
                ) : drilldownTier === "community" ? (
                  <SortHeader label="Connection" field="connection" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[120px]" />
                ) : null}
                <SortHeader label="Ethnicity" field="ethnicity" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[160px]" />
                <SortHeader label="Age" field="age" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 w-20" />
                <SortHeader label="Suburb" field="suburb" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
                <SortHeader label="Last Active" field="lastActive" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
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
                    <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2 transition-colors" data-testid={`table-link-${contact.id}`}>
                      <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {contact.name[0]}
                      </div>
                      <span className="font-medium truncate max-w-[180px]">{contact.name}</span>
                    </Link>
                  </td>
                  {drilldownTier !== "innovators" && (
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
                  {drilldownTier === "innovators" ? (
                    <>
                      <td className="px-3 py-2">
                        <InlineStageCell stage={contact.stage} contactId={contact.id} />
                      </td>
                      <td className="px-1 py-2">
                        <InlineConnectionCell contactId={contact.id} connectionStrength={contact.connectionStrength} />
                      </td>
                      <td className="px-1 py-2">
                        <InlineSupportCell contactId={contact.id} supportTypes={contact.supportType || []} />
                      </td>
                    </>
                  ) : drilldownTier === "community" ? (
                    <td className="px-1 py-2">
                      <InlineConnectionCell contactId={contact.id} connectionStrength={contact.connectionStrength} />
                    </td>
                  ) : null}
                  <td className="px-1 py-2">
                    <InlineEthnicityCell contactId={contact.id} ethnicities={contact.ethnicity || []} ethnicityCounts={ethnicityCounts} />
                  </td>
                  <td className="px-1 py-2">
                    <InlineTextCell contactId={contact.id} field="age" value={contact.age?.toString() || ""} placeholder="—" />
                  </td>
                  <td className="px-1 py-2">
                    <InlineTextCell contactId={contact.id} field="suburb" value={contact.suburb || ""} placeholder="—" />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap" data-testid={`table-active-${contact.id}`}>
                    {(contact.lastActiveDate || contact.lastInteractionDate)
                      ? format(new Date(contact.lastActiveDate || contact.lastInteractionDate), "MMM d, yyyy")
                      : "—"}
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
