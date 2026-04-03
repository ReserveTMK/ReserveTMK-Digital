import { Button } from "@/components/ui/beautiful-button";
import { useGroupMembers } from "@/hooks/use-groups";
import { Building2, Users, Trash2, Pencil, MoreVertical, Lightbulb, Star, UserCheck } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Group } from "@shared/schema";
import { GROUP_TYPE_COLORS, ENGAGEMENT_COLORS, displayGroupType } from "./constants";

export interface GroupCardProps {
  group: Group;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  communityCount: number;
  viewMode?: string | null;
  onPromote?: () => void;
  isPromoting?: boolean;
}

export function GroupCard({ group, onSelect, onEdit, onDelete, editMode, isSelected, onToggleSelect, communityCount, viewMode, onPromote, isPromoting }: GroupCardProps) {
  const { data: members } = useGroupMembers(group.id);
  const memberCount = members?.length || 0;

  const handleClick = () => {
    if (editMode) {
      onToggleSelect();
    } else {
      onSelect();
    }
  };

  const promoteIcon = viewMode === "all" ? <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> :
    viewMode === "community" ? <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> :
    viewMode === "innovators" ? <Star className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" /> : null;

  const promoteTitle = viewMode === "all" ? "Add to Our Community" :
    viewMode === "community" ? "Add to Our Innovators" :
    viewMode === "innovators" ? "Mark as VIP" : "";

  const showPromote = viewMode === "all" ? !group.isCommunity :
    viewMode === "community" ? !group.isInnovator :
    viewMode === "innovators" ? !group.isVip : false;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover-elevate cursor-pointer transition-colors ${editMode && isSelected ? "ring-2 ring-primary bg-primary/5" : "bg-card"}`}
      onClick={handleClick}
      data-testid={`card-group-${group.id}`}
    >
      {editMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect()}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
          data-testid={`checkbox-group-${group.id}`}
        />
      )}
      <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
        <Building2 className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate" data-testid={`text-group-name-${group.id}`}>{group.name}</h3>
      </div>
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Badge className={`text-[10px] ${GROUP_TYPE_COLORS[group.type] || ""}`}>
          {displayGroupType(group)}
        </Badge>
        {group.engagementLevel && group.engagementLevel !== "Active" && (
          <Badge className={`text-[9px] ${ENGAGEMENT_COLORS[group.engagementLevel] || ""}`} data-testid={`badge-engagement-card-${group.id}`}>
            {group.engagementLevel}
          </Badge>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-members-${group.id}`}>
          <Users className="w-3 h-3" />
          {memberCount}
        </span>
        {communityCount > 0 && (
          <Badge className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300" data-testid={`badge-community-${group.id}`}>
            <UserCheck className="w-3 h-3 mr-0.5" />
            {communityCount}
          </Badge>
        )}
        {!editMode && showPromote && onPromote && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onPromote}
            disabled={isPromoting}
            title={promoteTitle}
            data-testid={`button-promote-group-${group.id}`}
          >
            {promoteIcon}
          </Button>
        )}
        {!editMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-menu-group-${group.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/community/people?group=${group.id}`}>
                  <Users className="w-4 h-4 mr-2" />
                  View Members
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} data-testid={`menu-edit-group-${group.id}`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`menu-delete-group-${group.id}`}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
