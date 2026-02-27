import { Button } from "@/components/ui/beautiful-button";
import { useContacts, useCreateContact, useDeleteContact } from "@/hooks/use-contacts";
import { Plus, Search, Filter, Loader2, User, Upload, FileUp, AlertCircle, CheckCircle2, X, Check, MessageSquare, FileText, Users, TrendingUp, UserCheck, UserX, MoreVertical, Trash2, ArrowRightLeft, Edit3, Tag, Link2, Building2, Merge, List, Table, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ContactFormValues = Record<string, any>;

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
  const [viewMode, setViewMode] = useState<"community" | "all">("community");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [bulkRoleValue, setBulkRoleValue] = useState("");
  const [bulkRelationshipOpen, setBulkRelationshipOpen] = useState(false);
  const [bulkRelationshipValue, setBulkRelationshipValue] = useState("");
  const [linkGroupOpen, setLinkGroupOpen] = useState(false);
  const [linkGroupContactId, setLinkGroupContactId] = useState<number | null>(null);
  const [linkGroupSearch, setLinkGroupSearch] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);
  const [layoutView, setLayoutView] = useState<"list" | "table">("list");

  const { data: allGroups } = useQuery<any[]>({ queryKey: ["/api/groups"] });

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

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(search.toLowerCase()) || 
                          contact.businessName?.toLowerCase().includes(search.toLowerCase()) ||
                          contact.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;
    const matchesView = viewMode === "all" || (contact as any).isCommunityMember === true;
    return matchesSearch && matchesRole && matchesView;
  });

  const analytics = useMemo(() => {
    if (!contacts || contacts.length === 0) return null;
    const communityContacts = (contacts as any[]).filter(c => c.isCommunityMember);
    const pool = viewMode === "community" ? communityContacts : (contacts as any[]);
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
                {viewMode === "community" && (
                  <Button variant="outline" onClick={() => bulkMoveMutation.mutate({ contactIds: Array.from(selectedContacts), isCommunityMember: false })} disabled={bulkMoveMutation.isPending} data-testid="button-bulk-move-all">
                    {bulkMoveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                    Move to All
                  </Button>
                )}
                {viewMode === "all" && (
                  <Button variant="outline" onClick={() => bulkMoveMutation.mutate({ contactIds: Array.from(selectedContacts), isCommunityMember: true })} disabled={bulkMoveMutation.isPending} data-testid="button-bulk-mark-community">
                    {bulkMoveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
                    Mark Community
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

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold">Community</h1>
              <p className="text-muted-foreground mt-1">Manage your mentees and network.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {!editMode && (
                <>
                  <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-mode">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
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

          <Dialog open={bulkRoleOpen} onOpenChange={(v) => { setBulkRoleOpen(v); if (!v) setBulkRoleValue(""); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle data-testid="text-bulk-role-title">Update Role for {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Select value={bulkRoleValue} onValueChange={setBulkRoleValue}>
                  <SelectTrigger data-testid="select-bulk-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Innovator">Innovator</SelectItem>
                    <SelectItem value="Want-trepreneur">Want-trepreneur</SelectItem>
                    <SelectItem value="Rangatahi">Rangatahi</SelectItem>
                    <SelectItem value="Business Owner">Business Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkRoleOpen(false); setBulkRoleValue(""); }} data-testid="button-bulk-role-cancel">
                  Cancel
                </Button>
                <Button
                  onClick={() => bulkUpdateMutation.mutate({ contactIds: Array.from(selectedContacts), updates: { role: bulkRoleValue } })}
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
                        <Badge variant="outline" className="text-[10px]">{g.type || 'Organisation'}</Badge>
                      </button>
                    ))}
                  {(allGroups || []).filter((g: any) => g.name.toLowerCase().includes(linkGroupSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No groups found</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
                      <p className="text-xs text-muted-foreground mt-0.5">Total Community</p>
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

          {/* View Toggle + Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2" data-testid="view-toggle">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "community" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("community")}
                  data-testid="button-view-community"
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  Community
                </Button>
                <Button
                  variant={viewMode === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("all")}
                  data-testid="button-view-all"
                >
                  All Contacts
                </Button>
              </div>
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
                    <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Innovator">Innovator</SelectItem>
                    <SelectItem value="Want-trepreneur">Want-trepreneur</SelectItem>
                    <SelectItem value="Rangatahi">Rangatahi</SelectItem>
                    <SelectItem value="Business Owner">Business Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <Button onClick={() => setOpen(true)} variant="outline" data-testid="button-add-member-empty">Add Member</Button>
            </div>
          ) : layoutView === "table" ? (
            <ContactsTableView contacts={filteredContacts || []} allContacts={(contacts as any[]) || []} editMode={editMode} selectedContacts={selectedContacts} toggleContactSelection={toggleContactSelection} toggleSelectAll={toggleSelectAll} onToggleCommunity={(id, isCommunityMember) => communityStatusMutation.mutate({ id, isCommunityMember })} />
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
                      {contact.role && (
                        <Badge variant="outline" className="text-[10px] h-5 px-2 shrink-0 hidden sm:inline-flex" data-testid={`badge-role-side-${contact.id}`}>
                          {contact.role}
                        </Badge>
                      )}
                      {(contact.linkedGroupName || contact.businessName) && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-full" data-testid={`text-group-link-${contact.id}`}>
                          <Building2 className="w-3 h-3 shrink-0" />
                          {contact.linkedGroupName || contact.businessName}
                        </span>
                      )}
                    </div>
                  </Link>

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

const TABLE_ETHNICITY_OPTIONS = [
  { group: "Polynesian", options: ["Samoan", "Tongan", "Cook Islands Māori", "Niuean", "Tokelauan", "Fijian", "Hawaiian", "Tahitian", "Māori", "Other Polynesian"] },
  { group: "Pacific", options: ["Micronesian", "Melanesian"] },
  { group: "European", options: ["NZ European/Pākehā", "Other European"] },
  { group: "Asian", options: ["Chinese", "Indian", "Other Asian"] },
  { group: "Other", options: ["Middle Eastern", "Latin American", "African", "Other"] },
];

function InlineTextCell({ contactId, field, value, placeholder }: { contactId: number; field: string; value: string; placeholder: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setText(value || "");
  }, [value, contactId, editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed === (value || "")) return;
    try {
      const body: Record<string, any> = { [field]: trimmed || null };
      if (field === "age") {
        const parsed = parseInt(trimmed);
        body[field] = trimmed && !isNaN(parsed) ? parsed : null;
      }
      await apiRequest("PATCH", `/api/contacts/${contactId}`, body);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: `${field.charAt(0).toUpperCase() + field.slice(1)} updated` });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
      setText(value || "");
    }
  };

  if (!editing) {
    return (
      <button
        className="text-left w-full px-2 py-1 rounded hover:bg-muted/60 transition-colors text-sm truncate cursor-pointer"
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        data-testid={`table-cell-${field}-${contactId}`}
      >
        {value || <span className="text-muted-foreground/50">{placeholder}</span>}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setText(value || ""); setEditing(false); } }}
      className="h-7 text-sm px-2"
      data-testid={`table-input-${field}-${contactId}`}
    />
  );
}

function InlineEthnicityCell({ contactId, ethnicities, ethnicityCounts }: { contactId: number; ethnicities: string[]; ethnicityCounts: Record<string, number> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(ethnicities || []);
  const [saving, setSaving] = useState(false);

  const toggle = (eth: string) => {
    setSelected(prev => prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { ethnicity: selected });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Ethnicity updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update ethnicity", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSelected(ethnicities || []); }}>
      <PopoverTrigger asChild>
        <button
          className="text-left w-full px-2 py-1 rounded hover:bg-muted/60 transition-colors text-sm truncate cursor-pointer group flex items-center gap-1"
          data-testid={`table-cell-ethnicity-${contactId}`}
        >
          {ethnicities?.length > 0 ? (
            <span className="truncate">{ethnicities.join(", ")}</span>
          ) : (
            <span className="text-muted-foreground/50">+ Add</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {TABLE_ETHNICITY_OPTIONS
            .map((group) => ({
              ...group,
              options: [...group.options].sort((a, b) => (ethnicityCounts[b] || 0) - (ethnicityCounts[a] || 0)),
              maxCount: Math.max(...group.options.map(o => ethnicityCounts[o] || 0)),
            }))
            .sort((a, b) => b.maxCount - a.maxCount)
            .map((group) => (
            <div key={group.group}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{group.group}</p>
              <div className="space-y-1">
                {group.options.map((eth) => (
                  <label
                    key={eth}
                    className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5"
                    data-testid={`table-ethnicity-opt-${eth.toLowerCase().replace(/[\s/]+/g, '-')}-${contactId}`}
                  >
                    <Checkbox
                      checked={selected.includes(eth)}
                      onCheckedChange={() => toggle(eth)}
                    />
                    {eth}
                    {(ethnicityCounts[eth] || 0) > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-auto">{ethnicityCounts[eth]}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} data-testid={`table-ethnicity-cancel-${contactId}`}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid={`table-ethnicity-save-${contactId}`}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type SortField = "name" | "role" | "ethnicity" | "age" | "suburb" | "lastActive" | "community";
type SortDir = "asc" | "desc";

function SortHeader({ label, field, activeField, dir, onSort, className }: { label: string; field: SortField; activeField: SortField | null; dir: SortDir; onSort: (f: SortField) => void; className?: string }) {
  const isActive = activeField === field;
  return (
    <th className={`text-left py-3 font-medium text-muted-foreground whitespace-nowrap ${className || ""}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={() => onSort(field)}
        data-testid={`sort-${field}`}
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function ContactsTableView({ contacts, allContacts, editMode, selectedContacts, toggleContactSelection, toggleSelectAll, onToggleCommunity }: { contacts: any[]; allContacts: any[]; editMode: boolean; selectedContacts: Set<number>; toggleContactSelection: (id: number) => void; toggleSelectAll: () => void; onToggleCommunity: (id: number, isCommunityMember: boolean) => void }) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); }
    } else {
      setSortField(field);
      setSortDir("asc");
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
              <SortHeader label="Role" field="role" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
              <SortHeader label="Ethnicity" field="ethnicity" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 min-w-[160px]" />
              <SortHeader label="Age" field="age" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 w-20" />
              <SortHeader label="Suburb" field="suburb" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
              <SortHeader label="Last Active" field="lastActive" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3" />
              <SortHeader label="Community" field="community" activeField={sortField} dir={sortDir} onSort={handleSort} className="px-3 w-28" />
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
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px] h-5 px-2" data-testid={`table-role-${contact.id}`}>
                    {contact.role || "—"}
                  </Badge>
                </td>
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
                <td className="px-3 py-2">
                  {contact.isCommunityMember ? (
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
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ETHNIC_GROUPS = [
  "European",
  "Māori",
  "Pacific Peoples",
  "Asian",
  "Middle Eastern/Latin American/African",
  "Other"
];

const REVENUE_BANDS = [
  "Pre-revenue",
  "$0-10k",
  "$10k-50k",
  "$50k-100k",
  "$100k+",
];

function CreateContactDialogContent({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateContact();
  const [metricScores, setMetricScores] = useState<{
    confidenceScore?: number;
    systemsInPlace?: number;
    fundingReadiness?: number;
    networkStrength?: number;
  }>({});
  const formSchema = insertContactSchema.extend({
    age: z.union([z.number().int().positive(), z.nan(), z.undefined()]).optional().transform(v => (typeof v === 'number' && !Number.isNaN(v)) ? v : undefined),
    email: z.string().optional().transform(v => v === '' ? undefined : v),
    businessName: z.string().optional().transform(v => v === '' ? undefined : v),
    location: z.string().optional().transform(v => v === '' ? undefined : v),
    revenueBand: z.string().optional().transform(v => v === '' ? undefined : v),
  });
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "temp",
      name: "",
      businessName: "",
      email: "",
      age: undefined,
      ethnicity: [],
      location: "",
      role: "Entrepreneur",
      revenueBand: "",
      tags: [],
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    const payload = {
      ...data,
      metrics: { ...metricScores },
    };
    mutate(payload, {
      onSuccess: () => {
        form.reset();
        setMetricScores({});
        onSuccess();
      },
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add New Community Member</DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.error("Form validation errors:", errors))} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto px-1">
        {Object.keys(form.formState.errors).length > 0 && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3" data-testid="form-errors">
            Please fix the following: {Object.entries(form.formState.errors).map(([key, err]) => (
              <span key={key} className="block">{key}: {String((err as any)?.message || "invalid")}</span>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" data-testid="input-contact-name" {...form.register("name")} placeholder="e.g. Jane Doe" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{String((form.formState.errors.name as any)?.message || "Required")}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="businessName">Group</Label>
            <Link href="/groups" className="text-xs text-primary/80 hover:text-primary transition-colors" data-testid="link-manage-groups">
              Manage Groups
            </Link>
          </div>
          <Input id="businessName" data-testid="input-contact-business" {...form.register("businessName")} placeholder="e.g. organisation, collective, brand" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...form.register("email")} placeholder="jane@example.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" {...form.register("age", { valueAsNumber: true })} type="number" placeholder="30" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ethnicity (Select all that apply)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2 bg-muted/30 p-3 rounded-lg border border-border">
            {ETHNIC_GROUPS.map((group) => (
              <label key={group} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  value={group}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  onChange={(e) => {
                    const currentValues = form.getValues("ethnicity") || [];
                    if (e.target.checked) {
                      form.setValue("ethnicity", [...currentValues, group]);
                    } else {
                      form.setValue("ethnicity", currentValues.filter((v: string) => v !== group));
                    }
                  }}
                />
                <span>{group}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...form.register("location")} placeholder="e.g. Auckland Central" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select 
            id="role" 
            {...form.register("role")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="Entrepreneur">Entrepreneur</option>
            <option value="Professional">Professional</option>
            <option value="Innovator">Innovator</option>
            <option value="Want-trepreneur">Want-trepreneur</option>
            <option value="Rangatahi">Rangatahi</option>
            <option value="Business Owner">Business Owner</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="revenueBand">Revenue Band</Label>
          <select
            id="revenueBand"
            {...form.register("revenueBand")}
            data-testid="select-revenue-band"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Not set</option>
            {REVENUE_BANDS.map(band => (
              <option key={band} value={band}>{band}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Baseline Scores (1-10)</Label>
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
            <div className="space-y-1">
              <Label htmlFor="confidenceScore" className="text-xs text-muted-foreground">Confidence Score</Label>
              <Input
                id="confidenceScore"
                type="number"
                min={1}
                max={10}
                data-testid="input-confidence-score"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, confidenceScore: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="systemsInPlace" className="text-xs text-muted-foreground">Systems in Place</Label>
              <Input
                id="systemsInPlace"
                type="number"
                min={1}
                max={10}
                data-testid="input-systems-in-place"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, systemsInPlace: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fundingReadiness" className="text-xs text-muted-foreground">Funding Readiness</Label>
              <Input
                id="fundingReadiness"
                type="number"
                min={1}
                max={10}
                data-testid="input-funding-readiness"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, fundingReadiness: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="networkStrength" className="text-xs text-muted-foreground">Network Strength</Label>
              <Input
                id="networkStrength"
                type="number"
                min={1}
                max={10}
                data-testid="input-network-strength"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, networkStrength: val }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input 
            id="tags" 
            placeholder="javascript, startup, leadership" 
            onChange={(e) => {
              const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
              form.setValue('tags', tags);
            }}
          />
        </div>

        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-contact">
            {isPending ? <><Loader2 className="animate-spin" /> Adding...</> : "Add to Community"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function parseCSVFields(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let fields: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        fields.push(current.trim());
        if (fields.some(f => f !== "")) rows.push(fields);
        fields = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  if (fields.some(f => f !== "")) rows.push(fields);
  return rows;
}

function parseCSV(text: string): Record<string, string>[] {
  const allRows = parseCSVFields(text);
  if (allRows.length < 2) return [];
  const rawHeaders = allRows[0];
  const headerMap: Record<number, string> = {};
  for (let idx = 0; idx < rawHeaders.length; idx++) {
    const h = rawHeaders[idx];
    const lower = h.toLowerCase().replace(/[^a-z]/g, "");
    if (lower.includes("name") && !lower.includes("business")) headerMap[idx] = "name";
    else if (lower.includes("business") || lower.includes("brand") || lower.includes("company")) headerMap[idx] = "businessName";
    else if (lower.includes("email")) headerMap[idx] = "email";
    else if (lower.includes("phone") || lower.includes("mobile")) headerMap[idx] = "phone";
    else if (lower.includes("role") || lower.includes("type")) headerMap[idx] = "role";
    else if (lower.includes("age")) headerMap[idx] = "age";
    else if (lower.includes("ethnic")) headerMap[idx] = "ethnicity";
    else if (lower.includes("location") || lower.includes("city") || lower.includes("region")) headerMap[idx] = "location";
    else if (lower.includes("tag")) headerMap[idx] = "tags";
    else if (lower.includes("note")) headerMap[idx] = "notes";
  }

  return allRows.slice(1).map(fields => {
    const row: Record<string, string> = {};
    fields.forEach((val, i) => {
      const key = headerMap[i] || rawHeaders[i];
      if (val && key) row[key] = val;
    });
    return row;
  }).filter(r => r.name);
}

function BulkUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: async (contacts: Record<string, string>[]) => {
      const res = await apiRequest("POST", "/api/contacts/bulk", { contacts });
      return res.json();
    },
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (result.created > 0) {
        toast({ title: `${result.created} contacts imported` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }, []);

  const handleUpload = () => {
    if (parsedRows.length === 0) return;
    bulkMutation.mutate(parsedRows);
  };

  const handleClose = () => {
    onOpenChange(false);
    setParsedRows([]);
    setFileName("");
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Contacts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Upload a CSV file with your contacts. Need a starting point?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const template = [
                  "Name,Email,Phone,Role,Business Name,Age,Ethnicity,Location,Tags,Notes",
                  "Jane Doe,jane@example.com,021 123 4567,Entrepreneur,Doe Designs,28,Māori,Auckland Central,\"startup, design\",First session completed",
                  "John Smith,john@example.com,022 987 6543,Business Owner,Smith & Co,35,\"European, Pacific Peoples\",Mount Wellington,leadership,Referred by Ra",
                ].join("\n");
                const blob = new Blob([template], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "contacts_template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              data-testid="button-download-template"
            >
              <FileUp className="w-3.5 h-3.5 mr-1.5" />
              Download CSV Template
            </Button>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/50"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-csv"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-csv-file"
            />
            <FileUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            {fileName ? (
              <p className="text-sm font-medium text-foreground">{fileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
            )}
          </div>

          {parsedRows.length > 0 && !uploadResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium" data-testid="text-preview-count">
                  {parsedRows.length} contact{parsedRows.length !== 1 ? "s" : ""} found
                </p>
                <Badge variant="secondary">{fileName}</Badge>
              </div>
              <div className="max-h-48 overflow-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Role</th>
                      <th className="text-left p-2 font-medium">Email</th>
                      <th className="text-left p-2 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border/50" data-testid={`row-preview-${i}`}>
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.role || "Entrepreneur"}</td>
                        <td className="p-2 text-muted-foreground">{row.email || "-"}</td>
                        <td className="p-2 text-muted-foreground">{row.location || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ...and {parsedRows.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-700" data-testid="text-upload-success">
                  {uploadResult.created} contact{uploadResult.created !== 1 ? "s" : ""} imported successfully
                </span>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {uploadResult.errors.length} row{uploadResult.errors.length !== 1 ? "s" : ""} had errors
                  </div>
                  <div className="max-h-32 overflow-auto text-xs space-y-1">
                    {uploadResult.errors.map((err, i) => (
                      <p key={i} className="text-muted-foreground" data-testid={`text-upload-error-${i}`}>
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-bulk">
            {uploadResult ? "Done" : "Cancel"}
          </Button>
          {!uploadResult && (
            <Button
              onClick={handleUpload}
              disabled={parsedRows.length === 0 || bulkMutation.isPending}
              data-testid="button-import-contacts"
            >
              {bulkMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Import {parsedRows.length} Contact{parsedRows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CleanUpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [junkContacts, setJunkContacts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchJunk = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/contacts/community/junk-scan", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to scan for junk contacts");
      const data = await res.json();
      const contacts = data.junkContacts || data || [];
      setJunkContacts(contacts);
      setSelectedIds(new Set(contacts.map((c: any) => c.id)));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-delete", { contactIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Cleaned Up", description: `${data.deleted ?? selectedIds.size} contacts removed.` });
      onOpenChange(false);
      setJunkContacts([]);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      fetchJunk();
    } else {
      setJunkContacts([]);
      setSelectedIds(new Set());
    }
  };

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === junkContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(junkContacts.map((c: any) => c.id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Clean Up Junk Contacts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : junkContacts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
              <p className="text-sm font-medium" data-testid="text-no-junk">No junk contacts found</p>
              <p className="text-xs text-muted-foreground mt-1">Your contact list looks clean.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground" data-testid="text-junk-count">
                  {junkContacts.length} junk contact{junkContacts.length !== 1 ? "s" : ""} found
                </p>
                <Button variant="ghost" size="sm" onClick={toggleAll} data-testid="button-toggle-all-junk">
                  {selectedIds.size === junkContacts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-64 overflow-auto border border-border rounded-lg">
                {junkContacts.map((contact: any) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 border-b border-border/50 last:border-b-0"
                    data-testid={`junk-contact-${contact.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleId(contact.id)}
                      data-testid={`checkbox-junk-${contact.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{contact.email || contact.reason || "No email"}</p>
                    </div>
                    {contact.reason && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{contact.reason}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)} data-testid="button-cancel-cleanup">
            Cancel
          </Button>
          {junkContacts.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
              data-testid="button-delete-selected"
            >
              {bulkDeleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

