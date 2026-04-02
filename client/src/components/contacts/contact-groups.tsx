import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, X, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";

export interface ContactGroupsProps {
  contactId: number;
  contactGroups: any[] | undefined;
  allGroups: any[] | undefined;
  addGroupMember: UseMutationResult<any, any, any, any>;
  removeGroupMember: UseMutationResult<any, any, any, any>;
  createGroupForTagging: UseMutationResult<any, any, any, any>;
}

export function ContactGroups({
  contactId,
  contactGroups,
  allGroups,
  addGroupMember,
  removeGroupMember,
  createGroupForTagging,
}: ContactGroupsProps) {
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroupRole, setSelectedGroupRole] = useState("Member");
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickAddGroupName, setQuickAddGroupName] = useState("");

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <Network className="w-4 h-4" />
          Groups & Organisations
        </h3>
        <Popover open={addGroupOpen} onOpenChange={(open) => { setAddGroupOpen(open); if (!open) { setGroupSearch(""); setShowQuickAddGroup(false); setQuickAddGroupName(""); } }}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" data-testid="button-add-group-tag">
              <span className="text-xs">+ Add</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-3 border-b">
              <Select value={selectedGroupRole} onValueChange={setSelectedGroupRole}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-group-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead Contact">Lead Contact</SelectItem>
                  <SelectItem value="Representative">Representative</SelectItem>
                  <SelectItem value="Member">Member</SelectItem>
                  <SelectItem value="Advisor">Advisor</SelectItem>
                  <SelectItem value="Volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Command>
              <CommandInput placeholder="Search groups..." value={groupSearch} onValueChange={setGroupSearch} data-testid="input-group-search" />
              <CommandList>
                <CommandEmpty>
                  {!showQuickAddGroup ? (
                    <div className="p-2 text-center">
                      <p className="text-sm text-muted-foreground mb-2">No groups found</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowQuickAddGroup(true); setQuickAddGroupName(groupSearch); }}
                        data-testid="button-quick-add-group-tag"
                      >
                        Create "{groupSearch}"
                      </Button>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      <Input
                        placeholder="Group name"
                        value={quickAddGroupName}
                        onChange={(e) => setQuickAddGroupName(e.target.value)}
                        className="h-8 text-sm"
                        data-testid="input-quick-add-group-name"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!quickAddGroupName.trim() || createGroupForTagging.isPending}
                          onClick={async () => {
                            try {
                              const newGroup = await createGroupForTagging.mutateAsync({ name: quickAddGroupName.trim(), type: "Business" });
                              addGroupMember.mutate({ groupId: newGroup.id, contactId: contactId, role: selectedGroupRole }, {
                                onSuccess: () => {
                                  setAddGroupOpen(false);
                                  setShowQuickAddGroup(false);
                                  setQuickAddGroupName("");
                                  setGroupSearch("");
                                },
                              });
                            } catch {}
                          }}
                          data-testid="button-confirm-quick-add-group"
                        >
                          {createGroupForTagging.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create & Add"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowQuickAddGroup(false)} data-testid="button-cancel-quick-add-group">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {(() => {
                    const existingGroupIds = new Set((contactGroups || []).map((gm: any) => gm.groupId));
                    const filtered = (allGroups || []).filter((g: any) =>
                      !existingGroupIds.has(g.id) &&
                      g.name.toLowerCase().includes(groupSearch.toLowerCase())
                    );
                    return filtered.map((g: any) => (
                      <CommandItem
                        key={g.id}
                        value={g.name}
                        onSelect={() => {
                          addGroupMember.mutate({ groupId: g.id, contactId: contactId, role: selectedGroupRole }, {
                            onSuccess: () => {
                              setAddGroupOpen(false);
                              setGroupSearch("");
                            },
                          });
                        }}
                        className="cursor-pointer"
                        data-testid={`item-group-${g.id}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{g.name}</span>
                          {g.type && <span className="text-xs text-muted-foreground">{g.type}</span>}
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
      {contactGroups && contactGroups.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {contactGroups.map((gm: any) => (
            <Badge key={gm.id} className="cursor-pointer group pr-1 flex items-center gap-1" data-testid={`badge-group-membership-${gm.id}`}>
              <Link href="/community/groups">
                <span>
                  {gm.groupName || `Group #${gm.groupId}`}
                  {gm.role && <span className="ml-1 opacity-70">({gm.role})</span>}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeGroupMember.mutate({ groupId: gm.groupId, memberId: gm.id, contactId: contactId });
                }}
                data-testid={`button-remove-group-${gm.id}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No groups tagged yet</p>
      )}
    </div>
  );
}
