import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RelationshipStageSelector } from "@/components/relationship-stage-selector";
import { normalizeStage } from "@shared/schema";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  ArrowLeft, Pencil, Rocket, Users, Star, ChevronDown,
  Coffee, Check, Trash2, Plus, MoreVertical, ArrowUp, ArrowDown,
  Loader2, Mic, DollarSign,
} from "lucide-react";
import { StagePrompt } from "./stage-prompt";
import { InlineNotes } from "./inline-notes";
import { EthnicityQuickEdit } from "./ethnicity-quick-edit";
import { DetailConnectionEditor } from "./detail-connection-editor";
import { DetailSupportEditor } from "./detail-support-editor";
import { LogInteractionDialog } from "./log-interaction-dialog";

import type { UseMutationResult } from "@tanstack/react-query";

export interface ContactHeaderProps {
  contact: any;
  id: number;
  interactions: any[] | undefined;
  currentTier: string;
  isMobile: boolean;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  editDialogOpen: boolean;
  setEditDialogOpen: (v: boolean) => void;
  stageMutation: UseMutationResult<any, any, string, any>;
  promoteMutation: UseMutationResult<any, any, void, any>;
  demoteMutation: UseMutationResult<any, any, void, any>;
  toggleVipMutation: UseMutationResult<any, any, void, any>;
  toggleRangatahiMutation: UseMutationResult<any, any, void, any>;
  catchUpItem: any;
  catchUpPopoverOpen: boolean;
  setCatchUpPopoverOpen: (v: boolean) => void;
  catchUpNote: string;
  setCatchUpNote: (v: string) => void;
  catchUpPriority: string;
  setCatchUpPriority: (v: string) => void;
  addToCatchUpMutation: UseMutationResult<any, any, { contactId: number; note: string; priority: string }, any>;
  dismissCatchUpMutation: UseMutationResult<any, any, number, any>;
  removeCatchUpMutation: UseMutationResult<any, any, number, any>;
}

export function ContactHeader({
  contact,
  id,
  interactions,
  currentTier,
  isMobile,
  showDetails,
  setShowDetails,
  setEditDialogOpen,
  stageMutation,
  promoteMutation,
  demoteMutation,
  toggleVipMutation,
  toggleRangatahiMutation,
  catchUpItem,
  catchUpPopoverOpen,
  setCatchUpPopoverOpen,
  catchUpNote,
  setCatchUpNote,
  catchUpPriority,
  setCatchUpPriority,
  addToCatchUpMutation,
  dismissCatchUpMutation,
  removeCatchUpMutation,
}: ContactHeaderProps) {
  return (
    <div className="space-y-4">
      <Link href="/community/people" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Community
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-4xl shadow-inner">
            {contact.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground">
                {contact.name}
                {contact.nickname && (
                  <span className="text-muted-foreground ml-2 text-xl font-normal">({contact.nickname})</span>
                )}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditDialogOpen(true)}
                data-testid="button-edit-contact"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
            {contact.businessName && (
              <p className="text-muted-foreground/80 text-base" data-testid="text-business-name">{contact.businessName}</p>
            )}
            {/* Identity line */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground text-sm" data-testid="text-contact-role">{contact.role === "Other" && contact.roleOther ? `Other - ${contact.roleOther}` : contact.role}</span>
              <Badge variant={currentTier === "innovator" ? "default" : currentTier === "community" ? "secondary" : "outline"} className={cn("text-[10px] capitalize", currentTier === "innovator" && "bg-amber-500/15 text-amber-700 dark:text-amber-300")} data-testid="badge-tier">
                {currentTier === "innovator" ? <><Rocket className="w-3 h-3 mr-0.5" /> Innovator</> : currentTier === "community" ? <><Users className="w-3 h-3 mr-0.5" /> Community</> : "All"}
              </Badge>
              {contact.stage && (
                <Badge variant="secondary" className="text-[10px] capitalize" data-testid="badge-venture-stage">
                  {({ kakano: "Kakano", tipu: "Tipu", ora: "Ora", inactive: "Inactive" } as Record<string, string>)[contact.stage] || contact.stage}
                </Badge>
              )}
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => toggleVipMutation.mutate()} disabled={toggleVipMutation.isPending} title={contact.isVip ? "Remove VIP" : "Mark as VIP"} data-testid="button-toggle-vip-detail">
                <Star className={`w-3.5 h-3.5 ${contact.isVip ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
              </Button>
              {contact.isRangatahi && <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300">Rangatahi</Badge>}
            </div>

            {/* Stage selector + expand toggle */}
            <div className="flex items-center gap-3 mt-2">
              <RelationshipStageSelector
                currentStage={normalizeStage(contact.relationshipStage)}
                onStageChange={(stage) => stageMutation.mutate(stage)}
                disabled={stageMutation.isPending}
              />
              <StagePrompt
                stage={normalizeStage(contact.relationshipStage)}
                interactionCount={interactions?.length || 0}
                connectionStrength={contact.connectionStrength}
                contactId={contact.id}
                onPromote={(stage) => stageMutation.mutate(stage)}
              />
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={() => setShowDetails(!showDetails)} data-testid="button-toggle-details">
                {showDetails ? "Less" : "More"}
                <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </Button>
            </div>

            {/* Demographics + details -- collapsed by default */}
            {showDetails && (
              <div className="space-y-2 mt-2 pt-2 border-t border-border/50">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {contact.age && <span>{contact.age} years old</span>}
                  <EthnicityQuickEdit contact={contact} />
                  {contact.suburb && <span>{contact.suburb}</span>}
                  {contact.localBoard && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded text-[10px] font-medium">{contact.localBoard}</span>
                  )}
                  {contact.location && <span>{contact.location}</span>}
                  {contact.revenueBand && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-medium"><DollarSign className="w-3 h-3" /> {contact.revenueBand}</span>
                  )}
                  {contact.ventureType && (
                    <span className="text-[10px] capitalize">{({ commercial_business: "Commercial Business", social_enterprise: "Social Enterprise", creative_movement: "Creative / Arts", community_initiative: "Community Org", exploring: "Exploring", ecosystem_partner: "Ecosystem Partner" } as Record<string, string>)[contact.ventureType] || contact.ventureType.replace(/_/g, ' ')}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DetailConnectionEditor contactId={contact.id} connectionStrength={contact.connectionStrength} />
                  {contact.isInnovator && <DetailSupportEditor contactId={contact.id} supportTypes={contact.supportType || []} />}
                  <Button size="sm" variant="ghost" className="h-5 px-1.5" onClick={() => toggleRangatahiMutation.mutate()} disabled={toggleRangatahiMutation.isPending} title={contact.isRangatahi ? "Remove Rangatahi flag" : "Mark as Rangatahi"} data-testid="button-toggle-rangatahi-detail">
                    <span className={`text-[10px] font-bold ${contact.isRangatahi ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>Rangatahi {contact.isRangatahi ? "\u2713" : "+"}</span>
                  </Button>
                </div>
                {contact.whatTheyAreBuilding && (
                  <p className="text-xs text-muted-foreground" data-testid="text-what-building">{contact.whatTheyAreBuilding}</p>
                )}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-secondary rounded text-[10px] font-medium text-secondary-foreground">#{tag}</span>
                    ))}
                  </div>
                )}
                <InlineNotes contactId={contact.id} notes={contact.notes} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end shrink-0">
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                {isMobile ? (
                  <Button size="icon" className="shadow-lg shadow-primary/20" data-testid="button-log-interaction">
                    <Mic className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="lg" className="shadow-lg shadow-primary/20" data-testid="button-log-interaction">
                    <Mic className="w-4 h-4 mr-2" /> Log Interaction
                  </Button>
                )}
              </DialogTrigger>
              <LogInteractionDialog contactId={id} />
            </Dialog>
            {isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-more-actions">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!catchUpItem && (
                    <DropdownMenuItem
                      onClick={() => setCatchUpPopoverOpen(true)}
                      data-testid="menu-add-catch-up"
                    >
                      <Coffee className="w-4 h-4 mr-2" />
                      Add to Catch Up
                    </DropdownMenuItem>
                  )}
                  {catchUpItem && (
                    <>
                      <DropdownMenuItem
                        onClick={() => dismissCatchUpMutation.mutate(catchUpItem.id)}
                        disabled={dismissCatchUpMutation.isPending}
                        data-testid="menu-catch-up-done"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Mark Catch Up Done
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => removeCatchUpMutation.mutate(catchUpItem.id)}
                        disabled={removeCatchUpMutation.isPending}
                        data-testid="menu-catch-up-remove"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove from Catch Up
                      </DropdownMenuItem>
                    </>
                  )}
                  {currentTier !== "innovator" && (
                    <DropdownMenuItem
                      onClick={() => promoteMutation.mutate()}
                      disabled={promoteMutation.isPending}
                      data-testid="menu-promote-contact"
                    >
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Promote to {currentTier === "all" ? "Community" : "Innovator"}
                    </DropdownMenuItem>
                  )}
                  {currentTier !== "all" && (
                    <DropdownMenuItem
                      onClick={() => demoteMutation.mutate()}
                      disabled={demoteMutation.isPending}
                      data-testid="menu-demote-contact"
                    >
                      <ArrowDown className="w-4 h-4 mr-2" />
                      Demote to {currentTier === "innovator" ? "Community" : "All"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {!isMobile && (
            <>
              {catchUpItem ? (
                <div className="flex items-center gap-2" data-testid="catch-up-status">
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20">
                    <Coffee className="w-3 h-3 mr-1" />
                    On Catch Up List
                    {catchUpItem.priority && (
                      <span className="ml-1 opacity-70">
                        ({catchUpItem.priority})
                      </span>
                    )}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dismissCatchUpMutation.mutate(catchUpItem.id)}
                    disabled={dismissCatchUpMutation.isPending}
                    data-testid="button-catch-up-done"
                  >
                    {dismissCatchUpMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Done
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCatchUpMutation.mutate(catchUpItem.id)}
                    disabled={removeCatchUpMutation.isPending}
                    data-testid="button-catch-up-remove"
                  >
                    {removeCatchUpMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <Popover open={catchUpPopoverOpen} onOpenChange={setCatchUpPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-add-catch-up">
                      <Coffee className="w-4 h-4 mr-1" />
                      Add to Catch Up
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Add to Catch Up List</h4>
                      <div className="space-y-2">
                        <Label className="text-xs">Priority</Label>
                        <Select value={catchUpPriority} onValueChange={setCatchUpPriority}>
                          <SelectTrigger data-testid="select-catch-up-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="soon">Soon</SelectItem>
                            <SelectItem value="whenever">Whenever</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Note (optional)</Label>
                        <Input
                          value={catchUpNote}
                          onChange={(e) => setCatchUpNote(e.target.value)}
                          placeholder="Why catch up?"
                          data-testid="input-catch-up-note"
                        />
                      </div>
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={addToCatchUpMutation.isPending}
                        onClick={() => addToCatchUpMutation.mutate({ contactId: id, note: catchUpNote, priority: catchUpPriority })}
                        data-testid="button-confirm-catch-up"
                      >
                        {addToCatchUpMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-1" />
                        )}
                        Add
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <div className="flex items-center gap-2">
                {currentTier !== "innovator" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => promoteMutation.mutate()}
                    disabled={promoteMutation.isPending}
                    data-testid="button-promote-contact"
                  >
                    {promoteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    )}
                    Promote to {currentTier === "all" ? "Community" : "Innovator"}
                  </Button>
                )}
                {currentTier !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => demoteMutation.mutate()}
                    disabled={demoteMutation.isPending}
                    data-testid="button-demote-contact"
                  >
                    {demoteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <ArrowDown className="w-4 h-4 mr-1" />
                    )}
                    Demote to {currentTier === "innovator" ? "Community" : "All"}
                  </Button>
                )}
              </div>
            </>
          )}
          {isMobile && catchUpItem && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" data-testid="catch-up-status-mobile">
              <Coffee className="w-3 h-3 mr-1" />
              On Catch Up List
            </Badge>
          )}
          {isMobile && !catchUpItem && (
            <Dialog open={catchUpPopoverOpen} onOpenChange={setCatchUpPopoverOpen}>
              <DialogContent className="sm:max-w-[340px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add to Catch Up List</DialogTitle>
                  <DialogDescription className="sr-only">Add contact to catch up list</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Priority</Label>
                    <Select value={catchUpPriority} onValueChange={setCatchUpPriority}>
                      <SelectTrigger data-testid="select-catch-up-priority-mobile">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="soon">Soon</SelectItem>
                        <SelectItem value="whenever">Whenever</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Note (optional)</Label>
                    <Input
                      value={catchUpNote}
                      onChange={(e) => setCatchUpNote(e.target.value)}
                      placeholder="Why catch up?"
                      data-testid="input-catch-up-note-mobile"
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={addToCatchUpMutation.isPending}
                    onClick={() => addToCatchUpMutation.mutate({ contactId: id, note: catchUpNote, priority: catchUpPriority })}
                    data-testid="button-confirm-catch-up-mobile"
                  >
                    {addToCatchUpMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-1" />
                    )}
                    Add
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
