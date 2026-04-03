import { Button } from "@/components/ui/beautiful-button";
import { useGroupMembers, useAddGroupMember, useRemoveGroupMember, useEnrichGroup, useGroupTaxonomyLinks, useSaveGroupTaxonomyLinks, useUpdateGroup, useGroupAssociations, useAddGroupAssociation, useRemoveGroupAssociation } from "@/hooks/use-groups";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { Plus, Loader2, Building2, Users, X, UserPlus, Mail, Phone, MapPin, Sparkles, Check, Globe, Target, Link2, UserCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { type Group, type GroupMember } from "@shared/schema";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GROUP_TYPE_COLORS, ENGAGEMENT_COLORS, displayGroupType, MEMBER_ROLES } from "./constants";

export interface GroupDetailDialogProps {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[];
  onEdit: () => void;
  allGroups: Group[];
}

export function GroupDetailDialog({ group, open, onOpenChange, contacts, onEdit, allGroups }: GroupDetailDialogProps) {
  const { data: members, isLoading: membersLoading } = useGroupMembers(group.id);
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const enrichGroup = useEnrichGroup();
  const updateGroup = useUpdateGroup();
  const saveTaxonomyLinks = useSaveGroupTaxonomyLinks();
  const { data: taxonomyLinks } = useGroupTaxonomyLinks(group.id);
  const { data: taxonomyCategories } = useTaxonomy();
  const { data: associations } = useGroupAssociations(group.id);
  const addAssociation = useAddGroupAssociation();
  const removeAssociation = useRemoveGroupAssociation();
  const [assocSearch, setAssocSearch] = useState("");
  const [assocPopoverOpen, setAssocPopoverOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("Member");
  const [enrichData, setEnrichData] = useState<Record<string, any> | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [selectedKaupapa, setSelectedKaupapa] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const pushToCommunityMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-move", { contactIds, isCommunityMember: true });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/community-density"] });
      toast({ title: "Pushed to Community", description: `${data.updated || 0} members marked as community` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const existingContactIds = new Set((members || []).map((m: GroupMember) => m.contactId));
  const availableContacts = contacts.filter((c) => !existingContactIds.has(c.id));
  const filteredAvailable = availableContacts.filter((c) =>
    c.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const getContactName = (contactId: number) => {
    return contacts.find((c) => c.id === contactId)?.name || `Contact #${contactId}`;
  };

  const handleAddMember = (contactId: number) => {
    addMember.mutate({ groupId: group.id, contactId, role: selectedRole }, {
      onSuccess: () => {
        setAddMemberOpen(false);
        setMemberSearch("");
        toast({ title: "Member added", description: `${getContactName(contactId)} added to ${group.name}` });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleRemoveMember = (member: GroupMember) => {
    removeMember.mutate({ groupId: group.id, memberId: member.id, contactId: member.contactId });
  };

  const handleEnrich = () => {
    enrichGroup.mutate(group.id, {
      onSuccess: (data) => {
        const nonNullFields = Object.entries(data).filter(([k, v]) => k !== "kaupapa" && v != null);
        const hasKaupapa = Array.isArray(data.kaupapa) && data.kaupapa.length > 0;
        if (nonNullFields.length === 0 && !hasKaupapa) {
          toast({ title: "No suggestions found", description: "AI couldn't find public information for this organisation" });
          return;
        }
        setEnrichData(data);
        setSelectedFields(new Set(nonNullFields.map(([k]) => k)));
        if (hasKaupapa) {
          setSelectedKaupapa(new Set(data.kaupapa.map((_: any, i: number) => i)));
        }
      },
      onError: (err) => {
        toast({ title: "Enrichment failed", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleAcceptEnrichment = () => {
    if (!enrichData) return;
    const updates: Record<string, any> = {};
    selectedFields.forEach((field) => {
      if (enrichData[field] != null) {
        updates[field] = enrichData[field];
      }
    });

    const kaupapa = enrichData.kaupapa || [];
    const selectedKaupLinks = kaupapa
      .filter((_: any, i: number) => selectedKaupapa.has(i))
      .map((k: any) => ({
        taxonomyId: k.taxonomyId,
        confidence: k.confidence,
        reasoning: k.reasoning,
      }));

    const hasFieldUpdates = Object.keys(updates).length > 0;
    const hasKaupUpdates = selectedKaupLinks.length > 0;

    if (!hasFieldUpdates && !hasKaupUpdates) {
      toast({ title: "No items selected", description: "Select at least one field or kaupapa match to apply" });
      return;
    }

    const onDone = () => {
      toast({ title: "Group updated", description: "AI suggestions applied successfully" });
      setEnrichData(null);
      setSelectedFields(new Set());
      setSelectedKaupapa(new Set());
    };

    if (hasFieldUpdates && hasKaupUpdates) {
      updateGroup.mutate({ id: group.id, data: updates }, {
        onSuccess: () => {
          saveTaxonomyLinks.mutate({ groupId: group.id, links: selectedKaupLinks }, { onSuccess: onDone });
        },
      });
    } else if (hasFieldUpdates) {
      updateGroup.mutate({ id: group.id, data: updates }, { onSuccess: onDone });
    } else {
      saveTaxonomyLinks.mutate({ groupId: group.id, links: selectedKaupLinks }, { onSuccess: onDone });
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const ENRICH_FIELD_LABELS: Record<string, { label: string; icon: any }> = {
    description: { label: "Description", icon: Building2 },
    contactEmail: { label: "Email", icon: Mail },
    contactPhone: { label: "Phone", icon: Phone },
    address: { label: "Address", icon: MapPin },
    website: { label: "Website", icon: Globe },
    notes: { label: "Notes", icon: Building2 },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setEnrichData(null); setSelectedKaupapa(new Set()); } }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {group.name}
            </DialogTitle>
            <DialogDescription className="sr-only">Group details and management</DialogDescription>
            <div className="flex items-center gap-2">
              <Badge className={GROUP_TYPE_COLORS[group.type] || ""}>{displayGroupType(group)}</Badge>
              {group.engagementLevel && (
                <Badge className={ENGAGEMENT_COLORS[group.engagementLevel] || ""} data-testid="badge-engagement-level">
                  {group.engagementLevel}
                </Badge>
              )}
              {group.isMaori && <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">Māori-led</Badge>}
              {group.servesMaori && <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400">Serves Māori</Badge>}
              {group.isPasifika && <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">Pasifika-led</Badge>}
              {group.servesPasifika && <Badge variant="outline" className="border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400">Serves Pasifika</Badge>}
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrich}
                disabled={enrichGroup.isPending}
                data-testid="button-enrich-group"
              >
                {enrichGroup.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                {enrichGroup.isPending ? "Researching..." : "Enrich"}
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit} data-testid="button-edit-from-detail">
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        {enrichData && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Suggestions
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEnrichData(null); setSelectedFields(new Set()); setSelectedKaupapa(new Set()); }}
                  data-testid="button-dismiss-enrich"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptEnrichment}
                  disabled={(selectedFields.size === 0 && selectedKaupapa.size === 0) || updateGroup.isPending || saveTaxonomyLinks.isPending}
                  data-testid="button-accept-enrich"
                >
                  {updateGroup.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Apply Selected
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(enrichData).filter(([k, v]) => k !== "kaupapa" && v != null).map(([field, value]) => {
                const meta = ENRICH_FIELD_LABELS[field];
                if (!meta) return null;
                const IconComp = meta.icon;
                const isSelected = selectedFields.has(field);
                const existingValue = (group as any)[field];
                const isOverwrite = !!existingValue && existingValue !== value;
                return (
                  <div
                    key={field}
                    className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                      isSelected ? "border-primary/50 bg-primary/10" : "border-border bg-background"
                    }`}
                    onClick={() => toggleField(field)}
                    data-testid={`enrich-field-${field}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <IconComp className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
                          {isOverwrite && (
                            <Badge variant="secondary" className="text-[9px]">overwrites existing</Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{String(value)}</p>
                        {isOverwrite && (
                          <p className="text-xs text-muted-foreground mt-1 line-through">{String(existingValue)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {Array.isArray(enrichData.kaupapa) && enrichData.kaupapa.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Kaupapa Alignment
                </h5>
                {enrichData.kaupapa.map((match: any, idx: number) => {
                  const isSelected = selectedKaupapa.has(idx);
                  const TAXONOMY_COLORS: Record<string, string> = {
                    green: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
                    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
                    purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
                    orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
                    pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
                    red: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
                    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
                  };
                  const colorClass = TAXONOMY_COLORS[match.color] || TAXONOMY_COLORS.blue;
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                        isSelected ? `${colorClass}` : "border-border bg-background"
                      }`}
                      onClick={() => {
                        setSelectedKaupapa(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      data-testid={`enrich-kaupapa-${idx}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-medium">{match.category}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {match.confidence}% match
                            </Badge>
                          </div>
                          {match.reasoning && (
                            <p className="text-xs text-muted-foreground">{match.reasoning}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {group.contactEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {group.contactEmail}
              </span>
            )}
            {group.contactPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {group.contactPhone}
              </span>
            )}
            {group.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {group.address}
              </span>
            )}
            {group.website && (
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <a href={String(group.website).startsWith("http") ? String(group.website) : `https://${group.website}`} target="_blank" rel="noopener noreferrer" className="underline">{group.website}</a>
              </span>
            )}
          </div>

          {taxonomyLinks && taxonomyLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Kaupapa Alignment
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {taxonomyLinks.map((link: any) => {
                  const cat = (taxonomyCategories || []).find((c: any) => c.id === link.taxonomyId);
                  const TAXONOMY_BADGE_COLORS: Record<string, string> = {
                    green: "bg-green-500/15 text-green-700 dark:text-green-300",
                    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                    purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
                    orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
                    pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
                    red: "bg-red-500/15 text-red-700 dark:text-red-300",
                    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
                  };
                  const color = cat?.color || "blue";
                  const badgeColor = TAXONOMY_BADGE_COLORS[color] || TAXONOMY_BADGE_COLORS.blue;
                  return (
                    <Badge
                      key={link.id}
                      className={`text-xs ${badgeColor}`}
                      title={link.reasoning || undefined}
                      data-testid={`badge-kaupapa-${link.taxonomyId}`}
                    >
                      {cat?.name || `Category #${link.taxonomyId}`}
                      {link.confidence && <span className="ml-1 opacity-60">{link.confidence}%</span>}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Associated Groups ({(() => {
                  const assocIds = new Set<number>();
                  (associations || []).forEach((a: any) => {
                    if (a.groupId === group.id) assocIds.add(a.associatedGroupId);
                    else assocIds.add(a.groupId);
                  });
                  return assocIds.size;
                })()})
              </h3>
              <Popover open={assocPopoverOpen} onOpenChange={setAssocPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-association">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Link Group
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Search groups..."
                      value={assocSearch}
                      onValueChange={setAssocSearch}
                      data-testid="input-search-association"
                    />
                    <CommandList>
                      <CommandEmpty>No groups found</CommandEmpty>
                      <CommandGroup>
                        {(() => {
                          const linkedIds = new Set<number>([group.id]);
                          (associations || []).forEach((a: any) => {
                            linkedIds.add(a.groupId);
                            linkedIds.add(a.associatedGroupId);
                          });
                          return allGroups
                            .filter((g) => !linkedIds.has(g.id) && g.name.toLowerCase().includes(assocSearch.toLowerCase()))
                            .slice(0, 20)
                            .map((g) => (
                              <CommandItem
                                key={g.id}
                                value={g.name}
                                onSelect={() => {
                                  addAssociation.mutate({ groupId: group.id, associatedGroupId: g.id });
                                  setAssocPopoverOpen(false);
                                  setAssocSearch("");
                                }}
                                data-testid={`item-add-association-${g.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm">{g.name}</span>
                                  <Badge variant="secondary" className="text-[9px] ml-auto">{g.type}</Badge>
                                </div>
                              </CommandItem>
                            ));
                        })()}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {(() => {
              const assocEntries: { id: number; linkedGroup: Group; relType: string }[] = [];
              (associations || []).forEach((a: any) => {
                const otherId = a.groupId === group.id ? a.associatedGroupId : a.groupId;
                const other = allGroups.find((g) => g.id === otherId);
                let relType = "peer";
                if (a.relationshipType === "parent") {
                  relType = a.associatedGroupId === group.id ? "parent" : "child";
                }
                if (other) assocEntries.push({ id: a.id, linkedGroup: other, relType });
              });
              if (assocEntries.length === 0) {
                return (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Link2 className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                    <p>No associated groups yet</p>
                  </div>
                );
              }
              return (
                <div className="space-y-1">
                  {assocEntries.map(({ id, linkedGroup, relType }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                      data-testid={`row-association-${id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {linkedGroup.name[0]}
                        </div>
                        <span className="text-sm font-medium truncate">{linkedGroup.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{linkedGroup.type}</Badge>
                        {relType !== "peer" && (
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${relType === "parent" ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" : "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"}`}>
                            {relType}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ visibility: "visible" }}
                        onClick={() => removeAssociation.mutate({ groupId: group.id, associationId: id })}
                        data-testid={`button-remove-association-${id}`}
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members ({members?.length || 0})
                {(() => {
                  const memberContactIds = (members || []).map((m: GroupMember) => m.contactId);
                  const nonCommunityIds = memberContactIds.filter((cid: number) => {
                    const c = contacts.find((ct: any) => ct.id === cid);
                    return c && !c.isCommunityMember;
                  });
                  if (nonCommunityIds.length === 0) return null;
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                      onClick={() => pushToCommunityMutation.mutate(nonCommunityIds)}
                      disabled={pushToCommunityMutation.isPending}
                      data-testid="button-push-all-community"
                    >
                      {pushToCommunityMutation.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3 mr-1" />
                      )}
                      Push {nonCommunityIds.length} to Community
                    </Button>
                  );
                })()}
              </h3>
              <Popover open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-member">
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Add Member
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <div className="p-3 border-b space-y-2">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-member-role">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBER_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Command>
                    <CommandInput
                      placeholder="Search contacts..."
                      value={memberSearch}
                      onValueChange={setMemberSearch}
                      data-testid="input-search-member"
                    />
                    <CommandList>
                      <CommandEmpty>No contacts found</CommandEmpty>
                      <CommandGroup>
                        {filteredAvailable.slice(0, 20).map((c: any) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => handleAddMember(c.id)}
                            data-testid={`item-add-member-${c.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {c.name[0]}
                              </div>
                              <div>
                                <span className="text-sm">{c.name}</span>
                                {c.role && <span className="text-xs text-muted-foreground ml-1.5">{c.role}</span>}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {membersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (members || []).length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p>No members yet</p>
                <p className="text-xs mt-1">Add community members to this group</p>
              </div>
            ) : (
              <div className="space-y-1">
                {(members || []).map((member: GroupMember) => {
                  const memberContact = contacts.find((c: any) => c.id === member.contactId);
                  const isCommunity = memberContact?.isCommunityMember;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                      data-testid={`row-member-${member.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {getContactName(member.contactId)[0]}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium truncate block">{getContactName(member.contactId)}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{member.role || "Member"}</Badge>
                        {isCommunity ? (
                          <Badge className="text-[9px] h-4 px-1.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20 shrink-0" data-testid={`badge-member-community-${member.id}`}>
                            <UserCheck className="w-2.5 h-2.5" />
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 cursor-pointer hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-300 transition-colors shrink-0"
                            onClick={() => pushToCommunityMutation.mutate([member.contactId])}
                            data-testid={`button-push-member-community-${member.id}`}
                          >
                            <UserCheck className="w-2.5 h-2.5" />
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ visibility: "visible" }}
                        onClick={() => handleRemoveMember(member)}
                        data-testid={`button-remove-member-${member.id}`}
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {group.notes && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{group.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
