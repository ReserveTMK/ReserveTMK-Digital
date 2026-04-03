import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  X,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Contact } from "@shared/schema";
import { ACTIVITY_TYPES } from "./calendar-constants";

export interface LogActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Form state
  activityName: string;
  onActivityNameChange: (value: string) => void;
  activityType: string;
  onActivityTypeChange: (value: string) => void;
  activityDate: string;
  onActivityDateChange: (value: string) => void;
  activityPurpose: string;
  onActivityPurposeChange: (value: string) => void;
  activityOutcome: string;
  onActivityOutcomeChange: (value: string) => void;
  // Contacts
  activityContactSearch: string;
  onActivityContactSearchChange: (value: string) => void;
  activitySelectedContacts: Contact[];
  onRemoveContact: (id: number) => void;
  filteredActivityContacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  // Groups
  activityGroupSearch: string;
  onActivityGroupSearchChange: (value: string) => void;
  activitySelectedGroups: { id: number; name: string }[];
  onRemoveGroup: (id: number) => void;
  filteredActivityGroups: { id: number; name: string }[];
  onSelectGroup: (group: { id: number; name: string }) => void;
  // Actions
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function LogActivityDialog({
  open,
  onOpenChange,
  activityName,
  onActivityNameChange,
  activityType,
  onActivityTypeChange,
  activityDate,
  onActivityDateChange,
  activityPurpose,
  onActivityPurposeChange,
  activityOutcome,
  onActivityOutcomeChange,
  activityContactSearch,
  onActivityContactSearchChange,
  activitySelectedContacts,
  onRemoveContact,
  filteredActivityContacts,
  onSelectContact,
  activityGroupSearch,
  onActivityGroupSearchChange,
  activitySelectedGroups,
  onRemoveGroup,
  filteredActivityGroups,
  onSelectGroup,
  onSave,
  onCancel,
  isPending,
}: LogActivityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription>Record something that happened. It will appear on your calendar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="activity-date">Date</Label>
            <Input
              id="activity-date"
              type="date"
              value={activityDate}
              onChange={(e) => onActivityDateChange(e.target.value)}
              data-testid="input-activity-date"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-name">What happened <span className="text-destructive">*</span></Label>
            <Input
              id="activity-name"
              value={activityName}
              onChange={(e) => onActivityNameChange(e.target.value)}
              placeholder="e.g. Morning drop-in session, Community catch up..."
              data-testid="input-activity-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={activityType} onValueChange={onActivityTypeChange}>
              <SelectTrigger data-testid="trigger-activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t} value={t} data-testid={`option-activity-type-${t.toLowerCase().replace(/\s+/g, "-")}`}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tagged people</Label>
            {activitySelectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {activitySelectedContacts.map(c => (
                  <Badge key={c.id} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-activity-contact-${c.id}`}>
                    {c.name}
                    <button
                      onClick={() => onRemoveContact(c.id)}
                      className="ml-0.5"
                      data-testid={`button-remove-activity-contact-${c.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={activityContactSearch}
                onChange={(e) => onActivityContactSearchChange(e.target.value)}
                placeholder="Search people..."
                className="pl-8"
                data-testid="input-activity-contact-search"
              />
            </div>
            {filteredActivityContacts.length > 0 && (
              <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                {filteredActivityContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onSelectContact(c)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    data-testid={`button-select-activity-contact-${c.id}`}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.email && <span className="text-xs text-muted-foreground ml-2">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tagged groups</Label>
            {activitySelectedGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {activitySelectedGroups.map(g => (
                  <Badge key={g.id} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-activity-group-${g.id}`}>
                    {g.name}
                    <button
                      onClick={() => onRemoveGroup(g.id)}
                      className="ml-0.5"
                      data-testid={`button-remove-activity-group-${g.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={activityGroupSearch}
                onChange={(e) => onActivityGroupSearchChange(e.target.value)}
                placeholder="Search groups..."
                className="pl-8"
                data-testid="input-activity-group-search"
              />
            </div>
            {filteredActivityGroups.length > 0 && (
              <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                {filteredActivityGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => onSelectGroup(g)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    data-testid={`button-select-activity-group-${g.id}`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-purpose">Why / purpose</Label>
            <Textarea
              id="activity-purpose"
              value={activityPurpose}
              onChange={(e) => onActivityPurposeChange(e.target.value)}
              placeholder="What was the purpose of this activity?"
              className="resize-none"
              rows={2}
              data-testid="input-activity-purpose"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-outcome">Outcome / notes</Label>
            <Textarea
              id="activity-outcome"
              value={activityOutcome}
              onChange={(e) => onActivityOutcomeChange(e.target.value)}
              placeholder="What was the result? Any notes or follow-ups?"
              className="resize-none"
              rows={2}
              data-testid="input-activity-outcome"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-activity">
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!activityName.trim() || isPending}
            data-testid="button-save-activity"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
