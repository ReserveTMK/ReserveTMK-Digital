import { Button } from "@/components/ui/beautiful-button";
import { useContacts, useDeleteContact } from "@/hooks/use-contacts";
import { Plus, Search, Filter, Loader2, X, Check, MessageSquare, FileText, Users, TrendingUp, UserCheck, UserX, MoreVertical, Trash2, ArrowRightLeft, Edit3, Tag, Link2, Building2, Merge, List, Table, Pencil, ArrowUp, ArrowDown, Lightbulb, ChevronRight, Upload } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ContactsTableView } from "@/components/community/contacts-table";
import { CreateContactDialogContent, BulkUploadDialog, CleanUpDialog } from "@/components/community/contact-dialogs";
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
  const { data: contacts, isLoading } = useContacts();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"community" | "innovators" | "all">("community");
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



  const { data: allGroups } = useQuery<any[]>({ queryKey: ["/api/groups"] });
  const { data: suggestedDuplicates } = useQuery<{ reason: string; contacts: any[] }[]>({ queryKey: ["/api/contacts/suggested-duplicates"] });

  const dismissDuplicateMutation = useMutation({
    mutationFn: async ({ id1, id2 }: { id1: number; id2: number }) => {
      const res = await apiRequest("POST", "/api/contacts/dismiss-duplicate", { id1, id2 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/suggested-duplicates"] });
    },
  });

  const deleteContact = useDeleteContact();

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-delete", { contactIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Success", description: `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} deleted successfully` });
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
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/contacts/${id}/promote`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      const tierLabel = data.newTier === "our_innovators" ? "Our Innovators" : "Our Community";
      const groupMsg = data.groupsUpdated ? ` (${data.groupsUpdated} group${data.groupsUpdated !== 1 ? 's' : ''} updated)` : '';
      toast({ title: "Promoted", description: `Moved to ${tierLabel}${groupMsg}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/contacts/${id}/demote`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      const tierLabel = data.newTier === "our_community" ? "Our Community" : "All Contacts";
      const groupMsg = data.groupsUpdated ? ` (${data.groupsUpdated} group${data.groupsUpdated !== 1 ? 's' : ''} updated)` : '';
      toast({ title: "Demoted", description: `Moved to ${tierLabel}${groupMsg}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

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

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(search.toLowerCase()) || 
                          contact.businessName?.toLowerCase().includes(search.toLowerCase()) ||
                          contact.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;
    const matchesView = viewMode === "all" || (viewMode === "community" && (contact as any).isCommunityMember === true) || (viewMode === "innovators" && (contact as any).isInnovator === true);
    return matchesSearch && matchesRole && matchesView;
  });

  const roleCounts = useMemo(() => {
    if (!contacts) return {} as Record<string, number>;
    const pool = viewMode === "community" ? (contacts as any[]).filter(c => c.isCommunityMember) : viewMode === "innovators" ? (contacts as any[]).filter(c => c.isInnovator) : (contacts as any[]);
    const counts: Record<string, number> = {};
    for (const c of pool) {
      const r = c.role || "Unknown";
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [contacts, viewMode]);

  const tierCounts = useMemo(() => {
    if (!contacts) return { innovators: 0, community: 0, all: 0 };
    const innovators = (contacts as any[]).filter(c => c.isInnovator).length;
    const community = (contacts as any[]).filter(c => c.isCommunityMember).length;
    return { innovators, community, all: contacts.length };
  }, [contacts]);

  const analytics = useMemo(() => {
    if (!contacts || contacts.length === 0) return null;
    const communityContacts = (contacts as any[]).filter(c => c.isCommunityMember);
    const innovatorContacts = (contacts as any[]).filter(c => c.isInnovator);
    const pool = viewMode === "community" ? communityContacts : viewMode === "innovators" ? innovatorContacts : (contacts as any[]);
    if (pool.length === 0) return null;

    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    let active = 0;
    let inactive = 0;
    let totalInteractions = 0;
    let totalDebriefs = 0;
    const roleCounts: Record<string, number> = {};

    for (const c of pool) {
      const lastActive = c.lastActiveDate ? new Date(c.lastActiveDate).getTime() : (c.lastInteractionDate ? new Date(c.lastInteractionDate).getTime() : 0);
      if (lastActive >= ninetyDaysAgo) active++;
      else inactive++;
      totalInteractions += (c.interactionCount || 0) + (c.eventCount || 0);
      totalDebriefs += c.debriefCount || 0;
      const role = c.role || "Unknown";
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }

    const topRoles = Object.entries(roleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { total: pool.length, active, inactive, totalInteractions, totalDebriefs, topRoles };
  }, [contacts, viewMode]);

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      {editMode && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-md px-4 md:px-8 py-3" data-testid="edit-toolbar-contacts">
          <div className="max-w-6xl mx-auto w-full flex items-center gap-2 flex-wrap">
            {selectedContacts.size > 0 && (
              <>
                <Button variant="destructive" onClick={() => setBulkDeleteConfirmOpen(true)} data-testid="button-bulk-delete">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedContacts.size})
                </Button>
                {(viewMode === "all" || viewMode === "community") && (
                  <Button variant="outline" onClick={async () => {
                    for (const id of Array.from(selectedContacts)) {
                      await promoteMutation.mutateAsync(id);
                    }
                    setSelectedContacts(new Set());
                  }} disabled={promoteMutation.isPending} data-testid="button-bulk-promote">
                    {promoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUp className="w-4 h-4 mr-2" />}
                    Promote ({selectedContacts.size})
                  </Button>
                )}
                {(viewMode === "community" || viewMode === "innovators") && (
                  <Button variant="outline" onClick={async () => {
                    for (const id of Array.from(selectedContacts)) {
                      await demoteMutation.mutateAsync(id);
                    }
                    setSelectedContacts(new Set());
                  }} disabled={demoteMutation.isPending} data-testid="button-bulk-demote">
                    {demoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                    Demote ({selectedContacts.size})
                  </Button>
                )}
                <Button variant="outline" onClick={() => setBulkRoleOpen(true)} data-testid="button-bulk-update-role">
                  <Tag className="w-4 h-4 mr-2" />
                  Update Role
                </Button>
                <Button variant="outline" onClick={() => setBulkRelationshipOpen(true)} data-testid="button-bulk-update-relationship">
                  <Users className="w-4 h-4 mr-2" />
                  Update Relationship
                </Button>
                {selectedContacts.size >= 2 && (
                  <Button variant="outline" onClick={openMergeDialog} data-testid="button-merge-contacts">
                    <Merge className="w-4 h-4 mr-2" />
                    Merge ({selectedContacts.size})
                  </Button>
                )}
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
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button className="shadow-lg" data-testid="button-add-member">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Member
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-delete-title">Delete {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}?</DialogTitle>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-role-title">Update Role for {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}</DialogTitle>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-relationship-title">Update Relationship for {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}</DialogTitle>
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
            <DialogContent data-testid="dialog-merge-contacts">
              <DialogHeader>
                <DialogTitle data-testid="text-merge-title">Merge {selectedContacts.size} Contacts</DialogTitle>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle data-testid="text-link-group-title">Link to Group</DialogTitle>
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
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "community" | "innovators" | "all")}>
              <TabsList>
                <TabsTrigger value="innovators" data-testid="button-view-innovators">
                  <Lightbulb className="w-4 h-4 mr-1.5" />
                  Our Innovators ({tierCounts.innovators})
                </TabsTrigger>
                <TabsTrigger value="community" data-testid="button-view-community">
                  <Users className="w-4 h-4 mr-1.5" />
                  Our Community ({tierCounts.community})
                </TabsTrigger>
                <TabsTrigger value="all" data-testid="button-view-all">
                  All Contacts ({tierCounts.all})
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

              {analytics && (
                <div className="space-y-3" data-testid="community-analytics">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="p-4" data-testid="stat-total-members">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-bold font-display leading-none">{analytics.total}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4" data-testid="stat-active">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-bold font-display leading-none">{analytics.active}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Active (90d)</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4" data-testid="stat-inactive">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                          <UserX className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-bold font-display leading-none">{analytics.inactive}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Inactive (90d+)</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4" data-testid="stat-ytd-interactions">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-bold font-display leading-none">{analytics.totalInteractions}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Interactions</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {analytics.topRoles.map(([role, count]) => (
                      <Badge key={role} variant="secondary" className="text-xs" data-testid={`stat-role-${role.toLowerCase().replace(/\s+/g, '-')}`}>
                        {role}: {count}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground ml-1" data-testid="stat-total-debriefs">
                      {analytics.totalDebriefs} debrief{analytics.totalDebriefs !== 1 ? 's' : ''} logged
                    </span>
                  </div>
                </div>
              )}

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
                    {(search || roleFilter !== "all") && (
                      <Button
                        variant="outline"
                        onClick={() => { setSearch(""); setRoleFilter("all"); }}
                        data-testid="button-clear-filters"
                      >
                        <X className="w-4 h-4 mr-1.5" />
                        Clear Filters
                      </Button>
                    )}
                    <Button onClick={() => setOpen(true)} variant="outline" data-testid="button-add-member-empty">Add Member</Button>
                  </div>
                </div>
              ) : layoutView === "table" ? (
                <ContactsTableView contacts={filteredContacts || []} allContacts={(contacts as any[]) || []} editMode={editMode} selectedContacts={selectedContacts} toggleContactSelection={toggleContactSelection} toggleSelectAll={toggleSelectAll} onToggleCommunity={(id, isCommunityMember) => communityStatusMutation.mutate({ id, isCommunityMember })} drilldownTier={viewMode} onPromote={(id) => promoteMutation.mutate(id)} promotePending={promoteMutation.isPending} />
              ) : (
            <div className="space-y-3">
              {(filteredContacts || []).map((contact: any) => (
                <div key={contact.id} className="group bg-card hover:bg-card/80 border border-border rounded-xl p-4 transition-all duration-200 hover:shadow-md flex items-center gap-4" data-testid={`card-contact-${contact.id}`}>
                  {editMode && (
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleContactSelection(contact.id)}
                      className="shrink-0"
                      data-testid={`checkbox-contact-${contact.id}`}
                    />
                  )}
                  <Link href={`/contacts/${contact.id}`} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" data-testid={`link-contact-${contact.id}`}>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                      {contact.name[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="text-base font-bold font-display text-foreground truncate group-hover:text-primary transition-colors" data-testid={`text-name-${contact.id}`}>
                          {contact.name}
                        </h3>
                        {contact.isInnovator && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" data-testid={`badge-innovator-${contact.id}`}>
                            <Lightbulb className="w-3 h-3 mr-0.5" />
                            Innovator
                          </Badge>
                        )}
                        {getCircleBadge(contact.relationshipCircle)}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <p className="text-xs text-muted-foreground truncate" data-testid={`text-email-${contact.id}`}>
                          {contact.email || "No email"}
                        </p>
                        <p className="text-xs text-primary/80 font-medium" data-testid={`text-last-active-${contact.id}`}>
                          {(contact.lastActiveDate || contact.lastInteractionDate)
                            ? `Last active: ${format(new Date(contact.lastActiveDate || contact.lastInteractionDate), "MMM d, yyyy")}`
                            : `Added: ${format(new Date(contact.createdAt || Date.now()), "MMM d, yyyy")}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {(() => {
                          const total = (contact.interactionCount || 0) + (contact.eventCount || 0);
                          if (total > 0) return (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`stat-interactions-${contact.id}`}>
                              <MessageSquare className="w-3 h-3" />
                              {total} interaction{total !== 1 ? 's' : ''}
                            </span>
                          );
                          return null;
                        })()}
                        {(contact.debriefCount || 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`stat-debriefs-${contact.id}`}>
                            <FileText className="w-3 h-3" />
                            {contact.debriefCount} debrief{contact.debriefCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {(contact.interactionCount || 0) + (contact.eventCount || 0) === 0 && !(contact.debriefCount || 0) && contact.importSource && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`stat-source-${contact.id}`}>
                            <Users className="w-3 h-3" />
                            via {contact.importSource === 'gmail' ? 'Gmail' : contact.importSource === 'legacy_report' ? 'Legacy Report' : contact.importSource}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 max-w-[200px] shrink-0">
                      <div className="flex items-center gap-1">
                        {contact.ventureType && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0 hidden sm:inline-flex capitalize" data-testid={`badge-venture-type-${contact.id}`}>
                            {({
                              commercial_business: "Commercial Business",
                              social_enterprise: "Social Enterprise",
                              creative_movement: "Creative Movement",
                              community_initiative: "Community Initiative",
                              exploring: "Exploring",
                              ecosystem_partner: "Ecosystem Partner",
                            } as Record<string, string>)[contact.ventureType] || contact.ventureType.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {contact.role && (
                          <Badge variant="outline" className="text-[10px] h-5 px-2 shrink-0 hidden sm:inline-flex" data-testid={`badge-role-side-${contact.id}`}>
                            {contact.role === "Other" && contact.roleOther ? `Other - ${contact.roleOther}` : contact.role}
                          </Badge>
                        )}
                      </div>
                      {(contact.linkedGroupName || contact.businessName) && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-full" data-testid={`text-group-link-${contact.id}`}>
                          <Building2 className="w-3 h-3 shrink-0" />
                          {contact.linkedGroupName || contact.businessName}
                        </span>
                      )}
                    </div>
                  </Link>

                  {viewMode === "community" && !contact.isInnovator && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => promoteMutation.mutate(contact.id)}
                      disabled={promoteMutation.isPending}
                      title="Promote to Our Innovators"
                      data-testid={`button-promote-innovator-${contact.id}`}
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500" />
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
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteContact.mutate(contact.id)}
                        data-testid={`menu-delete-${contact.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
  );
}
