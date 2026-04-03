import { Button } from "@/components/ui/beautiful-button";
import { useCreateGroup, useUpdateGroup } from "@/hooks/use-groups";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GROUP_TYPES, ENGAGEMENT_LEVELS, type Group } from "@shared/schema";

export interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  onCreate: ReturnType<typeof useCreateGroup>;
  onUpdate: ReturnType<typeof useUpdateGroup>;
}

export function GroupFormDialog({ open, onOpenChange, group, onCreate, onUpdate }: GroupFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("Uncategorised");
  const [engagementLevel, setEngagementLevel] = useState<string>("Active");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [isMaori, setIsMaori] = useState(false);
  const [isPasifika, setIsPasifika] = useState(false);
  const [servesMaori, setServesMaori] = useState(false);
  const [servesPasifika, setServesPasifika] = useState(false);

  const resetForm = () => {
    setName(group?.name || "");
    setType(group?.type || "Uncategorised");
    setEngagementLevel(group?.engagementLevel || "Active");
    setDescription(group?.description || "");
    setContactEmail(group?.contactEmail || "");
    setContactPhone(group?.contactPhone || "");
    setAddress(group?.address || "");
    setWebsite(group?.website || "");
    setNotes(group?.notes || "");
    setIsMaori(group?.isMaori ?? false);
    setIsPasifika(group?.isPasifika ?? false);
    setServesMaori(group?.servesMaori ?? false);
    setServesPasifika(group?.servesPasifika ?? false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data: Record<string, any> = {
      name: name.trim(),
      type,
      engagementLevel,
      description: description.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
      isMaori,
      isPasifika,
      servesMaori,
      servesPasifika,
    };

    if (group) {
      onUpdate.mutate({ id: group.id, data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      onCreate.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isPending = onCreate.isPending || onUpdate.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{group ? "Edit Group" : "New Group"}</DialogTitle>
          <DialogDescription className="sr-only">{group ? "Edit group details" : "Create a new group"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Creative Collective NZ" data-testid="input-group-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-group-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Engagement</Label>
              <Select value={engagementLevel} onValueChange={setEngagementLevel}>
                <SelectTrigger data-testid="select-group-engagement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." data-testid="input-group-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="info@org.co.nz" data-testid="input-group-email" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+64..." data-testid="input-group-phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" data-testid="input-group-address" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.org.co.nz" data-testid="input-group-website" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." data-testid="input-group-notes" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Community Connection</Label>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div />
              <span className="text-xs text-muted-foreground font-medium">Māori</span>
              <span className="text-xs text-muted-foreground font-medium">Pasifika</span>
              <span className="text-xs text-muted-foreground">Led by</span>
              <Checkbox id="isMaori" checked={isMaori} onCheckedChange={(v) => setIsMaori(v === true)} data-testid="checkbox-is-maori" />
              <Checkbox id="isPasifika" checked={isPasifika} onCheckedChange={(v) => setIsPasifika(v === true)} data-testid="checkbox-is-pasifika" />
              <span className="text-xs text-muted-foreground">Serves</span>
              <Checkbox id="servesMaori" checked={servesMaori} onCheckedChange={(v) => setServesMaori(v === true)} data-testid="checkbox-serves-maori" />
              <Checkbox id="servesPasifika" checked={servesPasifika} onCheckedChange={(v) => setServesPasifika(v === true)} data-testid="checkbox-serves-pasifika" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-group">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending} data-testid="button-save-group">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {group ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
