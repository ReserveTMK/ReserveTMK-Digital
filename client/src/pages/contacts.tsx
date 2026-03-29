import { Button } from "@/components/ui/beautiful-button";
import { useContacts, useArchiveContact, useRestoreContact } from "@/hooks/use-contacts";
import { Plus, Search, Filter, Loader2, X, Check, MessageSquare, FileText, Users, UserCheck, MoreVertical, Trash2, ArrowRightLeft, Edit3, Tag, Link2, Building2, Merge, List, Table, Pencil, ArrowUp, ArrowDown, Lightbulb, ChevronRight, Upload, Star, BookUser, Sprout, Leaf, Sun, Ban, Mail, Archive, ArchiveRestore, AlertCircle, Coffee } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useMemo, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ContactsTableView } from "@/components/community/contacts-table";
import { CreateContactDialogContent, BulkUploadDialog, CleanUpDialog } from "@/components/community/contact-dialogs";
import { ContactFilterBar, type ContactFilters, EMPTY_FILTERS, hasActiveFilters } from "@/components/community/filter-bar";
import { ContactCardsView } from "@/components/community/contact-cards";
import { CONTACT_ROLES } from "@shared/schema";

function getCircleBadge(circle: string | null | undefined) {
  if (!circle) return null;
  switch (circle) {
    case "inner_circle":
      return <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20" data-testid="badge-inner-circle">Inner Circle</Badge>;
    case "active_network":
      return <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20" data-testid="badge-active-network">Active</Badge>;
    case "wider_community":
      return <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-muted text-muted-foreground" data-testid="badge-wider-community">Wider</Badge>;
    default:
      return null;
  }
}

export default function Contacts() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: contacts, isLoading } = useContacts(showArchived);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"community" | "innovators" | "all">("community");
  const [vipOnly, setVipOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [bulkRoleValue, setBulkRoleValue] = useState("");
  const [bulkRoleOther, setBulkRoleOther] = useState("");
  const [bulkRelationshipOpen, setBulkRelationshipOpen] = useState(false);
  const [bulkRelationshipValue, setBulkRelationshipValue] = useState("");
  const [linkGroupOpen, setLinkGroupOpen] = useState(false);
  const [linkGroupContactId, setLinkGroupContactId] = useState<number | null>(null);
  const [linkGroupSearch, setLinkGroupSearch] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const [layoutView, setLayoutView] = useState<"list" | "table">("list");
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [vipReasonDialogOpen, setVipReasonDialogOpen] = useState(false);
  const [vipReasonContactId, setVipReasonContactId] = useState<number | null>(null);
  const [vipReasonText, setVipReasonText] = useState("");
  const [advFilters, setAdvFilters] = useState<ContactFilters>(EMPTY_FILTERS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { data: catchUpItems } = useQuery<{ id: number; contactId: number }[]>({ queryKey: ["/api/catch-up-list"] });
  const { data: catchUpSuggestions } = useQuery<{ id: number; name: string; role: string; daysSinceLastInteraction: number | null; urgency: string }[]>({
    queryKey: ["/api/contacts/catch-up-suggestions"],
  });

  useEffect(() => {
    if (isMobile) {
      setLayoutView("list");
    }
  }, [isMobile]);



  const { data: allGroups } = useQuery<any[]>({ queryKey: ["/api/groups"] });
  const { data: suggestedDuplicates } = useQuery<{ reason: string; contacts: any[] }[]>({ queryKey: ["/api/contacts/suggested-duplicates"] });
  const { data: lastEngaged } = useQuery<Record<number, string>>({ queryKey: ["/api/contacts/last-engaged"] });

  const dismissDuplicateMutation = useMutation({
    mutationFn: async ({ id1, id2 }: { id1: number; id2: number }) => {
      const res = await apiRequest("POST", "/api/contacts/dismiss-duplicate", { id1, id2 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/suggested-duplicates"] });
    },
  });

  const archiveContact = useArchiveContact();
  const restoreContact = useRestoreContact();

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-delete", { contactIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Success", description: `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} archived successfully` });
      setSelectedContacts(new Set());
      setBulkDeleteConfirmOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ contactIds, isCommunityMember }: { contactIds: number[]; isCommunityMember: boolean }) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-move", { contactIds, isCommunityMember });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      const groupMsg = data?.groupsUpdated ? ` (${data.groupsUpdated} linked group${data.groupsUpdated !== 1 ? 's' : ''} updated)` : '';
      toast({ title: "Success", description: `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} moved successfully${groupMsg}` });
      setSelectedContacts(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ contactIds, updates }: { contactIds: number[]; updates: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-update", { contactIds, updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Success", description: `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} updated successfully` });
      setSelectedContacts(new Set());
      setBulkRoleOpen(false);
      setBulkRoleValue("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkRelationshipMutation = useMutation({
    mutationFn: async ({ contactIds, relationshipCircle }: { contactIds: number[]; relationshipCircle: string }) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-update", {
        contactIds,
        updates: { relationshipCircle, relationshipCircleOverride: true },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Success", description: `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} relationship updated` });
      setSelectedContacts(new Set());
      setBulkRelationshipOpen(false);
      setBulkRelationshipValue("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryId, mergeIds }: { primaryId: number; mergeIds: number[] }) => {
      const res = await apiRequest("POST", "/api/contacts/merge", { primaryId, mergeIds });
      if (!res.ok) throw new Error("Failed to merge contacts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contacts merged successfully" });
      setSelectedContacts(new Set());
      setMergeDialogOpen(false);
      setPrimaryMergeId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openMergeDialog = () => {
    if (selectedContacts.size < 2) {
      toast({ title: "Select at least 2 contacts to merge", variant: "destructive" });
      return;
    }
    setPrimaryMergeId(Array.from(selectedContacts)[0]);
    setMergeDialogOpen(true);
  };

  const confirmMerge = () => {
    if (!primaryMergeId) return;
    const mergeIds = Array.from(selectedContacts).filter(id => id !== primaryMergeId);
    mergeMutation.mutate({ primaryId: primaryMergeId, mergeIds });
  };

  const autoLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contacts/auto-link-groups");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Auto-Link Complete", description: data.linked > 0 ? `${data.linked} contact${data.linked !== 1 ? 's' : ''} linked to groups` : "No new links found" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const linkGroupMutation = useMutation({
    mutationFn: async ({ contactId, groupId }: { contactId: number; groupId: number }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/link-group`, { groupId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Success", description: "Contact linked to group" });
      setLinkGroupOpen(false);
      setLinkGroupContactId(null);
      setLinkGroupSearch("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const unlinkGroupMutation = useMutation({
    mutationFn: async ({ contactId, groupId }: { contactId: number; groupId: number }) => {
      const res = await apiRequest("DELETE", `/api/contacts/${contactId}/unlink-group/${groupId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Success", description: "Contact unlinked from group" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ id, vipReason }: { id: number; vipReason?: string }) => {
      const body = vipReason ? { vipReason } : undefined;
      const res = await apiRequest("POST", `/api/contacts/${id}/promote`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/vip"] });
      const tierLabel = data.newTier === "vip" ? "VIP" : data.newTier === "our_innovators" ? "Our Innovators" : "Our Community";
      const groupMsg = data.groupsUpdated ? ` (${data.groupsUpdated} group${data.groupsUpdated !== 1 ? 's' : ''} updated)` : '';
      toast({ title: "Done", description: `Added to ${tierLabel}${groupMsg}` });
      setVipReasonDialogOpen(false);
      setVipReasonContactId(null);
      setVipReasonText("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePromote = (contactId: number) => {
    promoteMutation.mutate({ id: contactId });
  };

  const confirmVipPromotion = () => {
    if (!vipReasonContactId) return;
    toggleVipMutation.mutate({ id: vipReasonContactId, vipReason: vipReasonText.trim() || undefined });
  };

  const demoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/contacts/${id}/demote`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/vip"] });
      const tierLabel = data.newTier === "our_innovators" ? "Our Innovators" : data.newTier === "our_community" ? "Our Community" : "All Contacts";
      const groupMsg = data.groupsUpdated ? ` (${data.groupsUpdated} group${data.groupsUpdated !== 1 ? 's' : ''} updated)` : '';
      toast({ title: "Done", description: `Moved to ${tierLabel}${groupMsg}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleVipMutation = useMutation({
    mutationFn: async ({ id, vipReason }: { id: number; vipReason?: string }) => {
      const body = vipReason ? { vipReason } : undefined;
      const res = await apiRequest("POST", `/api/contacts/${id}/toggle-vip`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/vip"] });
      toast({ title: data.isVip ? "Marked as VIP" : "VIP removed", description: data.isVip ? "Contact flagged as VIP." : "VIP status removed." });
      setVipReasonDialogOpen(false);
      setVipReasonContactId(null);
      setVipReasonText("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleToggleVip = (contactId: number) => {
    const contact = contacts?.find((c: any) => c.id === contactId);
    if (contact && !contact.isVip) {
      setVipReasonContactId(contactId);
      setVipReasonText("");
      setVipReasonDialogOpen(true);
    } else {
      toggleVipMutation.mutate({ id: contactId });
    }
  };

  const toggleContactSelection = (id: number) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredContacts) return;
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c: any) => c.id)));
    }
  };

  const handleExitEditMode = () => {
    setEditMode(false);
    setSelectedContacts(new Set());
  };

  const communityStatusMutation = useMutation({
    mutationFn: async ({ id, isCommunityMember }: { id: number; isCommunityMember: boolean }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}/community-status`, { isCommunityMember });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Success", description: "Community status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const innovatorToggleMutation = useMutation({
    mutationFn: async ({ id, isInnovator }: { id: number; isInnovator: boolean }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, { isInnovator });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Success", description: "Innovator status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const catchUpContactIds = useMemo(() => new Set((catchUpItems || []).map(i => i.contactId)), [catchUpItems]);

  const availableSuburbs = useMemo(() => {
    if (!contacts) return [];
    const set = new Set<string>();
    for (const c of contacts as any[]) {
      if (c.suburb) set.add(c.suburb);
    }
    return Array.from(set).sort();
  }, [contacts]);

  const filteredContacts = contacts?.filter(contact => {
    const c = contact as any;
    const matchesSearch = contact.name.toLowerCase().includes(search.toLowerCase()) ||
                          contact.businessName?.toLowerCase().includes(search.toLowerCase()) ||
                          contact.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;
    const matchesView = viewMode === "all" || (viewMode === "community" && c.isCommunityMember === true) || (viewMode === "innovators" && c.isInnovator === true);
    const matchesVip = !vipOnly || c.isVip === true;

    const f = advFilters;
    const matchesEthnicity = f.ethnicities.length === 0 || (c.ethnicity && f.ethnicities.some((e: string) => c.ethnicity.includes(e)));
    const matchesSuburb = f.suburbs.length === 0 || f.suburbs.includes(c.suburb);
    const matchesSupport = f.supportTypes.length === 0 || (c.supportType && f.supportTypes.some((s: string) => c.supportType.includes(s)));
    const matchesConnection = f.connectionStrengths.length === 0 || f.connectionStrengths.includes(c.connectionStrength);
    const matchesVenture = f.ventureTypes.length === 0 || f.ventureTypes.includes(c.ventureType);
    const matchesStage = f.stages.length === 0 || f.stages.includes(c.relationshipStage || c.stage);
    const matchesCatchUp = !f.onCatchUpList || catchUpContactIds.has(contact.id);

    return matchesSearch && matchesRole && matchesView && matchesVip &&
      matchesEthnicity && matchesSuburb && matchesSupport && matchesConnection &&
      matchesVenture && matchesStage && matchesCatchUp;
  });

  const roleCounts = useMemo(() => {
    if (!contacts) return {} as Record<string, number>;
    let pool = viewMode === "community" ? (contacts as any[]).filter(c => c.isCommunityMember) : viewMode === "innovators" ? (contacts as any[]).filter(c => c.isInnovator) : (contacts as any[]);
    if (vipOnly) pool = pool.filter(c => c.isVip);
    const counts: Record<string, number> = {};
    for (const c of pool) {
      const r = c.role || "Unknown";
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [contacts, viewMode, vipOnly]);

  const tierCounts = useMemo(() => {
    if (!contacts) return { innovators: 0, community: 0, all: 0, vip: 0 };
    const innovators = (contacts as any[]).filter(c => c.isInnovator).length;
    const community = (contacts as any[]).filter(c => c.isCommunityMember).length;
    const vip = (contacts as any[]).filter(c => c.isVip).length;
    return { innovators, community, all: contacts.length, vip };
  }, [contacts]);

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      {editMode && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-md px-4 md:px-8 py-3" data-testid="edit-toolbar-contacts">
          <div className="max-w-6xl mx-auto w-full flex items-center gap-2 flex-wrap">
            {selectedContacts.size > 0 && (
              <>
                <Button variant="destructive" onClick={() => setBulkDeleteConfirmOpen(true)} data-testid="button-bulk-delete">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isMobile ? selectedContacts.size : `Delete (${selectedContacts.size})`}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-bulk-actions">
                      <MoreVertical className="w-4 h-4 mr-1" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(viewMode === "all" || viewMode === "community" || viewMode === "innovators") && (
                      <DropdownMenuItem onClick={async () => {
                        for (const id of Array.from(selectedContacts)) {
                          await promoteMutation.mutateAsync({ id });
                        }
                        setSelectedContacts(new Set());
                      }} disabled={promoteMutation.isPending} data-testid="menu-bulk-promote">
                        <ArrowUp className="w-4 h-4 mr-2" />
                        {viewMode === "all" ? "Add to Community" : viewMode === "community" ? "Add to Innovators" : "Mark as VIP"} ({selectedContacts.size})
                      </DropdownMenuItem>
                    )}
                    {(viewMode === "community" || viewMode === "innovators") && (
                      <DropdownMenuItem onClick={async () => {
                        for (const id of Array.from(selectedContacts)) {
                          await demoteMutation.mutateAsync(id);
                        }
                        setSelectedContacts(new Set());
                      }} disabled={demoteMutation.isPending} data-testid="menu-bulk-demote">
                        <ArrowDown className="w-4 h-4 mr-2" />
                        Demote ({selectedContacts.size})
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setBulkRoleOpen(true)} data-testid="menu-bulk-update-role">
                      <Tag className="w-4 h-4 mr-2" />
                      Update Role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBulkRelationshipOpen(true)} data-testid="menu-bulk-update-relationship">
                      <Users className="w-4 h-4 mr-2" />
                      Update Relationship
                    </DropdownMenuItem>
                    {selectedContacts.size >= 2 && (
                      <DropdownMenuItem onClick={openMergeDialog} data-testid="menu-merge-contacts">
                        <Merge className="w-4 h-4 mr-2" />
                        Merge ({selectedContacts.size})
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {filteredContacts && filteredContacts.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={filteredContacts.length > 0 && selectedContacts.size === filteredContacts.length}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            )}
            <Button variant="outline" onClick={handleExitEditMode} data-testid="button-edit-mode">
              <Check className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        </div>
      )}
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="breadcrumb-people">
            <Link href="/community/people" className="hover:text-foreground transition-colors" data-testid="breadcrumb-community">Community</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium" data-testid="breadcrumb-current">People</span>
          </nav>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">People</h1>
              <p className="text-muted-foreground mt-1">The people in your community</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {!editMode && (
                <>
                  {isMobile ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" data-testid="button-more-actions-mobile">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditMode(true)} data-testid="menu-edit-mode">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {suggestedDuplicates && suggestedDuplicates.length > 0 && (
                          <DropdownMenuItem onClick={() => setDuplicatesOpen(true)} data-testid="menu-duplicates-contacts">
                            <Merge className="w-4 h-4 mr-2" />
                            Duplicates ({suggestedDuplicates.length})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => autoLinkMutation.mutate()} disabled={autoLinkMutation.isPending} data-testid="menu-auto-link">
                          <Link2 className="w-4 h-4 mr-2" />
                          Auto-Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkOpen(true)} data-testid="menu-bulk-upload">
                          <Upload className="w-4 h-4 mr-2" />
                          Bulk Upload
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild data-testid="menu-gmail-import">
                          <Link href="/gmail-import" className="flex items-center">
                            <Mail className="w-4 h-4 mr-2" />
                            Gmail Import
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-mode">
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      {suggestedDuplicates && suggestedDuplicates.length > 0 && (
                        <Button variant="outline" onClick={() => setDuplicatesOpen(true)} data-testid="button-duplicates-contacts">
                          <Merge className="w-4 h-4 mr-2" />
                          Duplicates ({suggestedDuplicates.length})
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => autoLinkMutation.mutate()} disabled={autoLinkMutation.isPending} data-testid="button-auto-link">
                        {autoLinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                        Auto-Link
                      </Button>
                      <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-upload">
                        <Upload className="w-4 h-4 mr-2" />
                        Bulk Upload
                      </Button>
                      <Link href="/gmail-import">
                        <Button variant="outline" data-testid="button-gmail-import">
                          <Mail className="w-4 h-4 mr-2" />
                          Gmail Import
                        </Button>
                      </Link>
                    </>
                  )}
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button className="shadow-lg" data-testid="button-add-member">
                        <Plus className="w-4 h-4 mr-2" />
                        {isMobile ? "Add" : "Add Member"}
                      </Button>
                    </DialogTrigger>
                    <CreateContactDialogContent onSuccess={() => setOpen(false)} />
                  </Dialog>
                </>
              )}
            </div>
          </div>

          <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} />

          <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-delete-title">Delete {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}?</DialogTitle>
                <DialogDescription className="sr-only">Confirm bulk contact deletion</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground" data-testid="text-bulk-delete-description">
                Delete {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}? This cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDeleteConfirmOpen(false)} data-testid="button-bulk-delete-cancel">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedContacts))}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-bulk-delete-confirm"
                >
                  {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={bulkRoleOpen} onOpenChange={(v) => { setBulkRoleOpen(v); if (!v) { setBulkRoleValue(""); setBulkRoleOther(""); } }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-role-title">Update Role for {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}</DialogTitle>
                <DialogDescription className="sr-only">Update role for selected contacts</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                <Select value={bulkRoleValue} onValueChange={(v) => { setBulkRoleValue(v); if (v !== "Other") setBulkRoleOther(""); }}>
                  <SelectTrigger data-testid="select-bulk-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ROLES.map((r: string) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bulkRoleValue === "Other" && (
                  <Input
                    value={bulkRoleOther}
                    onChange={(e) => setBulkRoleOther(e.target.value)}
                    placeholder="Describe role..."
                    data-testid="input-bulk-role-other"
                  />
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkRoleOpen(false); setBulkRoleValue(""); setBulkRoleOther(""); }} data-testid="button-bulk-role-cancel">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const updates: Record<string, any> = { role: bulkRoleValue };
                    if (bulkRoleValue === "Other") {
                      updates.roleOther = bulkRoleOther.trim() || null;
                    } else {
                      updates.roleOther = null;
                    }
                    bulkUpdateMutation.mutate({ contactIds: Array.from(selectedContacts), updates });
                  }}
                  disabled={!bulkRoleValue || bulkUpdateMutation.isPending}
                  data-testid="button-bulk-role-confirm"
                >
                  {bulkUpdateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Apply Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={bulkRelationshipOpen} onOpenChange={(v) => { setBulkRelationshipOpen(v); if (!v) setBulkRelationshipValue(""); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-relationship-title">Update Relationship for {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}</DialogTitle>
                <DialogDescription className="sr-only">Update relationship stage for selected contacts</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select value={bulkRelationshipValue} onValueChange={setBulkRelationshipValue}>
                  <SelectTrigger data-testid="select-bulk-relationship">
                    <SelectValue placeholder="Select relationship circle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inner_circle">Inner Circle</SelectItem>
                    <SelectItem value="active_network">Active Network</SelectItem>
                    <SelectItem value="wider_community">Wider Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkRelationshipOpen(false); setBulkRelationshipValue(""); }} data-testid="button-bulk-relationship-cancel">
                  Cancel
                </Button>
                <Button
                  onClick={() => bulkRelationshipMutation.mutate({ contactIds: Array.from(selectedContacts), relationshipCircle: bulkRelationshipValue })}
                  disabled={!bulkRelationshipValue || bulkRelationshipMutation.isPending}
                  data-testid="button-bulk-relationship-confirm"
                >
                  {bulkRelationshipMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={mergeDialogOpen} onOpenChange={(v) => { setMergeDialogOpen(v); if (!v) setPrimaryMergeId(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="dialog-merge-contacts">
              <DialogHeader>
                <DialogTitle data-testid="text-merge-title">Merge {selectedContacts.size} Contacts</DialogTitle>
                <DialogDescription className="sr-only">Merge selected contacts into one</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Choose the primary contact to keep. All data from the other contacts will be merged into it, and the duplicates will be removed.</p>
              <div className="space-y-2 max-h-60 overflow-y-auto py-2">
                {Array.from(selectedContacts).map(id => {
                  const c = contacts?.find((ct: any) => ct.id === id);
                  if (!c) return null;
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${primaryMergeId === id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                      onClick={() => setPrimaryMergeId(id)}
                      data-testid={`merge-option-${id}`}
                    >
                      <input type="radio" checked={primaryMergeId === id} onChange={() => setPrimaryMergeId(id)} className="accent-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.role, c.email, c.businessName].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {primaryMergeId === id && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMergeDialogOpen(false)} data-testid="button-cancel-merge">
                  Cancel
                </Button>
                <Button
                  onClick={confirmMerge}
                  disabled={!primaryMergeId || mergeMutation.isPending}
                  data-testid="button-confirm-merge"
                >
                  {mergeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
                  {mergeMutation.isPending ? "Merging..." : "Merge"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-duplicates-contacts">
              <DialogHeader>
                <DialogTitle data-testid="text-duplicates-title">Suggested Duplicates</DialogTitle>
                <DialogDescription className="sr-only">Review and manage duplicate contacts</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">These contacts may be duplicates based on name, email, or phone similarity. Review and merge or dismiss.</p>
              {suggestedDuplicates && suggestedDuplicates.length > 0 ? (
                <div className="space-y-4 py-2">
                  {suggestedDuplicates.map((cluster, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3" data-testid={`duplicate-cluster-${idx}`}>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs" data-testid={`duplicate-reason-${idx}`}>{cluster.reason}</Badge>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const ids = cluster.contacts.map((c: any) => c.id);
                              setSelectedContacts(new Set(ids));
                              setPrimaryMergeId(ids[0]);
                              setEditMode(true);
                              setMergeDialogOpen(true);
                              setDuplicatesOpen(false);
                            }}
                            data-testid={`duplicate-merge-${idx}`}
                          >
                            <Merge className="w-3 h-3 mr-1" />
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissDuplicateMutation.mutate({ id1: cluster.contacts[0].id, id2: cluster.contacts[1].id })}
                            disabled={dismissDuplicateMutation.isPending}
                            data-testid={`duplicate-dismiss-${idx}`}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {cluster.contacts.map((c: any) => (
                          <div key={c.id} className="border rounded-md p-3 bg-muted/30 space-y-1" data-testid={`duplicate-contact-${c.id}`}>
                            <p className="font-medium text-sm truncate">{c.name}</p>
                            {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                            {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                            {c.role && <Badge variant="outline" className="text-[10px] h-4 mt-1">{c.role}</Badge>}
                            {c.businessName && <p className="text-[10px] text-muted-foreground mt-1">{c.businessName}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center text-muted-foreground py-8" data-testid="text-no-duplicates">No suggested duplicates found.</p>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={linkGroupOpen} onOpenChange={(v) => { setLinkGroupOpen(v); if (!v) { setLinkGroupContactId(null); setLinkGroupSearch(""); } }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-link-group-title">Link to Group</DialogTitle>
                <DialogDescription className="sr-only">Link selected contacts to a group</DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-3">
                <Input
                  placeholder="Search groups..."
                  value={linkGroupSearch}
                  onChange={(e) => setLinkGroupSearch(e.target.value)}
                  data-testid="input-link-group-search"
                />
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {(allGroups || [])
                    .filter((g: any) => g.name.toLowerCase().includes(linkGroupSearch.toLowerCase()))
                    .slice(0, 20)
                    .map((g: any) => (
                      <button
                        key={g.id}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm flex items-center justify-between"
                        onClick={() => linkGroupContactId && linkGroupMutation.mutate({ contactId: linkGroupContactId, groupId: g.id })}
                        disabled={linkGroupMutation.isPending}
                        data-testid={`button-link-group-${g.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>{g.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{g.type || 'Business'}</Badge>
                      </button>
                    ))}
                  {(allGroups || []).filter((g: any) => g.name.toLowerCase().includes(linkGroupSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No groups found</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Toggle */}
          <div className="flex items-center justify-between gap-2" data-testid="view-toggle">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "community" | "innovators" | "all")} className="min-w-0 flex-1">
              <TabsList className="overflow-x-auto flex-nowrap w-full justify-start">
                <TabsTrigger value="innovators" className="shrink-0" data-testid="button-view-innovators">
                  <Lightbulb className="w-4 h-4 mr-1.5" />
                  Innovators ({tierCounts.innovators})
                </TabsTrigger>
                <TabsTrigger value="community" className="shrink-0" data-testid="button-view-community">
                  <Users className="w-4 h-4 mr-1.5" />
                  Community ({tierCounts.community})
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
              <Button
                variant={showArchived ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                data-testid="button-toggle-archived"
                title={showArchived ? "Showing all including archived" : "Show archived contacts"}
              >
                <Archive className="w-4 h-4" />
                {showArchived && <span className="ml-1 text-xs">Archived</span>}
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

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-10 h-11 bg-card rounded-xl border-border/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-contacts"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-card border-border/60" data-testid="select-role-filter">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Role" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {CONTACT_ROLES.map((r: string) => {
                    const count = roleCounts[r] || 0;
                    return (
                      <SelectItem key={r} value={r}>{r}{count > 0 ? ` (${count})` : ""}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ContactFilterBar
            filters={advFilters}
            onChange={setAdvFilters}
            availableSuburbs={availableSuburbs}
            catchUpCount={catchUpContactIds.size}
          />

          {catchUpSuggestions && catchUpSuggestions.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <button
                className="flex items-center gap-2 w-full text-left text-sm font-medium text-amber-700 dark:text-amber-300"
                onClick={() => setShowSuggestions(!showSuggestions)}
              >
                <AlertCircle className="w-4 h-4" />
                {catchUpSuggestions.length} contact{catchUpSuggestions.length !== 1 ? "s" : ""} need{catchUpSuggestions.length === 1 ? "s" : ""} attention
                <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${showSuggestions ? "rotate-90" : ""}`} />
              </button>
              {showSuggestions && (
                <div className="mt-2 space-y-1">
                  {catchUpSuggestions.slice(0, 10).map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/20">
                      <Link href={`/contacts/${s.id}`} className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.role && <span className="text-xs text-muted-foreground ml-2">{s.role}</span>}
                      </Link>
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 shrink-0">
                        {s.daysSinceLastInteraction === null ? "Never contacted" : `${s.daysSinceLastInteraction}d ago`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

              {/* Contacts List / Table */}
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredContacts?.length === 0 ? (
                <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No community members found</h3>
                  <p className="text-muted-foreground mb-6">Try adjusting your filters or add a new member.</p>
                  <div className="flex items-center justify-center gap-3">
                    {(search || roleFilter !== "all" || hasActiveFilters(advFilters)) && (
                      <Button
                        variant="outline"
                        onClick={() => { setSearch(""); setRoleFilter("all"); setAdvFilters(EMPTY_FILTERS); }}
                        data-testid="button-clear-filters"
                      >
                        <X className="w-4 h-4 mr-1.5" />
                        Clear Filters
                      </Button>
                    )}
                    <Button onClick={() => setOpen(true)} variant="outline" data-testid="button-add-member-empty">Add Member</Button>
                  </div>
                </div>
              ) : isMobile ? (
                <ContactCardsView contacts={filteredContacts || []} catchUpContactIds={catchUpContactIds} />
              ) : layoutView === "table" ? (
                <ContactsTableView contacts={filteredContacts || []} allContacts={(contacts as any[]) || []} editMode={editMode} selectedContacts={selectedContacts} toggleContactSelection={toggleContactSelection} toggleSelectAll={toggleSelectAll} onToggleCommunity={(id, isCommunityMember) => communityStatusMutation.mutate({ id, isCommunityMember })} drilldownTier={viewMode} onPromote={(id) => handlePromote(id)} promotePending={promoteMutation.isPending} onToggleVip={(id) => handleToggleVip(id)} toggleVipPending={toggleVipMutation.isPending} />
              ) : (
            <div className="space-y-2">
              {(filteredContacts || []).map((contact: any) => (
                <div key={contact.id} className="group bg-card hover:bg-card/80 border border-border rounded-xl px-4 py-3 transition-all duration-200 hover:shadow-md flex items-center gap-3" data-testid={`card-contact-${contact.id}`}>
                  {editMode && (
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleContactSelection(contact.id)}
                      className="shrink-0"
                      data-testid={`checkbox-contact-${contact.id}`}
                    />
                  )}
                  <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" data-testid={`link-contact-${contact.id}`}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                      {contact.name[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-bold font-display truncate group-hover:text-primary transition-colors ${contact.isArchived ? 'text-muted-foreground' : 'text-foreground'}`} data-testid={`text-name-${contact.id}`}>
                        {contact.name}
                        {contact.isArchived && <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5 bg-muted text-muted-foreground" data-testid={`badge-archived-${contact.id}`}>Archived</Badge>}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                        {(contact.linkedGroupName || contact.businessName) && (
                          <span className="flex items-center gap-1 truncate" data-testid={`text-group-link-${contact.id}`}>
                            <Building2 className="w-3 h-3 shrink-0" />
                            {contact.linkedGroupName || contact.businessName}
                          </span>
                        )}
                        {lastEngaged?.[contact.id] && (() => {
                          const days = Math.floor((Date.now() - new Date(lastEngaged[contact.id]).getTime()) / 86400000);
                          if (days > 60) return <span className="text-red-500 text-[10px]">{days}d ago</span>;
                          if (days > 30) return <span className="text-amber-500 text-[10px]">{days}d ago</span>;
                          return null;
                        })()}
                      </div>
                    </div>

                    {viewMode === "innovators" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {contact.stage && (
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${
                            contact.stage === "kakano" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" :
                            contact.stage === "tipu" ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-700" :
                            contact.stage === "ora" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700" :
                            "bg-muted text-muted-foreground"
                          }`} data-testid={`badge-stage-${contact.id}`}>
                            {contact.stage === "kakano" && <Sprout className="w-3 h-3 mr-0.5" />}
                            {contact.stage === "tipu" && <Leaf className="w-3 h-3 mr-0.5" />}
                            {contact.stage === "ora" && <Sun className="w-3 h-3 mr-0.5" />}
                            {contact.stage === "inactive" && <Ban className="w-3 h-3 mr-0.5" />}
                            {contact.stage.charAt(0).toUpperCase() + contact.stage.slice(1)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </Link>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleVip(contact.id); }}
                    disabled={toggleVipMutation.isPending}
                    title={contact.isVip ? "Remove VIP" : "Mark as VIP"}
                    data-testid={`button-toggle-vip-${contact.id}`}
                  >
                    <Star className={`w-4 h-4 ${contact.isVip ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                  </Button>

                  {viewMode === "community" && !contact.isInnovator && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => handlePromote(contact.id)}
                      disabled={promoteMutation.isPending}
                      title="Add to Our Innovators"
                      data-testid={`button-promote-innovator-${contact.id}`}
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                    </Button>
                  )}

                  {viewMode === "all" && !contact.isCommunityMember && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => communityStatusMutation.mutate({ id: contact.id, isCommunityMember: true })}
                      disabled={communityStatusMutation.isPending}
                      title="Add to Community"
                      data-testid={`button-add-community-${contact.id}`}
                    >
                      <Users className="w-4 h-4 text-primary" />
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="shrink-0" data-testid={`button-contact-menu-${contact.id}`}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {contact.isCommunityMember && (
                        <DropdownMenuItem
                          onClick={() => communityStatusMutation.mutate({ id: contact.id, isCommunityMember: false })}
                          data-testid={`menu-move-business-${contact.id}`}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          Move to All Contacts
                        </DropdownMenuItem>
                      )}
                      {viewMode === "all" && !contact.isCommunityMember && (
                        <DropdownMenuItem
                          onClick={() => communityStatusMutation.mutate({ id: contact.id, isCommunityMember: true })}
                          data-testid={`menu-mark-community-${contact.id}`}
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Mark as Community Member
                        </DropdownMenuItem>
                      )}
                      {!contact.isInnovator && (
                        <DropdownMenuItem
                          onClick={() => innovatorToggleMutation.mutate({ id: contact.id, isInnovator: true })}
                          data-testid={`menu-add-innovator-${contact.id}`}
                        >
                          <Lightbulb className="w-4 h-4 mr-2" />
                          Add to Our Innovators
                        </DropdownMenuItem>
                      )}
                      {contact.isInnovator && (
                        <DropdownMenuItem
                          onClick={() => innovatorToggleMutation.mutate({ id: contact.id, isInnovator: false })}
                          data-testid={`menu-remove-innovator-${contact.id}`}
                        >
                          <Lightbulb className="w-4 h-4 mr-2" />
                          Remove from Innovators
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => { setLinkGroupContactId(contact.id); setLinkGroupOpen(true); }}
                        data-testid={`menu-link-group-${contact.id}`}
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        {contact.linkedGroupId ? "Change Group" : "Link to Group"}
                      </DropdownMenuItem>
                      {contact.linkedGroupId && (
                        <DropdownMenuItem
                          onClick={() => unlinkGroupMutation.mutate({ contactId: contact.id, groupId: contact.linkedGroupId })}
                          data-testid={`menu-unlink-group-${contact.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Unlink from {contact.linkedGroupName}
                        </DropdownMenuItem>
                      )}
                      {contact.isArchived ? (
                        <DropdownMenuItem
                          onClick={() => restoreContact.mutate(contact.id)}
                          data-testid={`menu-restore-${contact.id}`}
                        >
                          <ArchiveRestore className="w-4 h-4 mr-2" />
                          Restore Contact
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => archiveContact.mutate(contact.id)}
                          data-testid={`menu-archive-${contact.id}`}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive Contact
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>

      <Dialog open={vipReasonDialogOpen} onOpenChange={(v) => { setVipReasonDialogOpen(v); if (!v) { setVipReasonContactId(null); setVipReasonText(""); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Mark as VIP
            </DialogTitle>
            <DialogDescription className="sr-only">Mark contact as VIP</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Why is this person being flagged as a VIP priority conversation?
            </p>
            <Textarea
              value={vipReasonText}
              onChange={(e: any) => setVipReasonText(e.target.value)}
              placeholder="e.g. Needs follow-up on funding application, key partnership discussion..."
              className="resize-none"
              rows={3}
              data-testid="input-vip-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVipReasonDialogOpen(false); setVipReasonContactId(null); setVipReasonText(""); }} data-testid="button-cancel-vip-reason">
              Cancel
            </Button>
            <Button onClick={confirmVipPromotion} disabled={toggleVipMutation.isPending} data-testid="button-confirm-vip-promote">
              {toggleVipMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark as VIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </main>
  );
}
