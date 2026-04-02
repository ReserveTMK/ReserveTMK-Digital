import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useGroups, useCreateGroup } from "@/hooks/use-groups";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, X, Check } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { searchSuburbs, getLocalBoard, SUBURB_TO_LOCAL_BOARD } from "@shared/auckland-suburbs";
import { CONTACT_ROLES } from "@shared/schema";
import { ETHNICITY_OPTIONS } from "./ethnicity-quick-edit";

export interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: any;
}

export function EditContactDialog({ open, onOpenChange, contact }: EditContactDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(contact.name || "");
  const [nickname, setNickname] = useState(contact.nickname || "");
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [location, setLocation] = useState(contact.location || "");
  const [suburb, setSuburb] = useState(contact.suburb || "");
  const [suburbSearch, setSuburbSearch] = useState(contact.suburb || "");
  const [localBoard, setLocalBoard] = useState(contact.localBoard || "");
  const [showSuburbDropdown, setShowSuburbDropdown] = useState(false);
  const [businessName, setBusinessName] = useState(contact.businessName || "");
  const [businessSearch, setBusinessSearch] = useState(contact.businessName || "");
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [showQuickAddBusiness, setShowQuickAddBusiness] = useState(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [showQuickAddEmail, setShowQuickAddEmail] = useState(false);
  const [quickAddEmailName, setQuickAddEmailName] = useState("");
  const [role, setRole] = useState(contact.role || "Entrepreneur");
  const [roleOther, setRoleOther] = useState(contact.roleOther || "");
  const [ventureType, setVentureType] = useState(contact.ventureType || "");
  const [stage, setStage] = useState(contact.stage || "");
  const [whatTheyAreBuilding, setWhatTheyAreBuilding] = useState(contact.whatTheyAreBuilding || "");
  const [age, setAge] = useState(contact.age?.toString() || "");
  const [revenueBand, setRevenueBand] = useState(contact.revenueBand || "");
  const [selectedEthnicities, setSelectedEthnicities] = useState<string[]>(contact.ethnicity || []);
  const suburbRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);

  const { data: allContacts } = useContacts();
  const { data: allGroups } = useGroups();
  const createContact = useCreateContact();
  const createGroup = useCreateGroup();

  const filteredEmailContacts = useMemo(() => {
    if (!allContacts || !email.trim()) return [];
    const term = email.toLowerCase();
    return allContacts
      .filter((c: any) => c.id !== contact.id && c.email && c.email.toLowerCase().includes(term))
      .slice(0, 8);
  }, [allContacts, email, contact.id]);

  const filteredGroups = useMemo(() => {
    if (!allGroups || !businessSearch.trim()) return [];
    const term = businessSearch.toLowerCase();
    return (allGroups as any[]).filter((g: any) => g.name.toLowerCase().includes(term)).slice(0, 8);
  }, [allGroups, businessSearch]);

  const suburbResults = searchSuburbs(suburbSearch);

  useEffect(() => {
    if (open) {
      setName(contact.name || "");
      setNickname(contact.nickname || "");
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setLocation(contact.location || "");
      setSuburb(contact.suburb || "");
      setSuburbSearch(contact.suburb || "");
      setLocalBoard(contact.localBoard || "");
      setBusinessName(contact.businessName || "");
      setBusinessSearch(contact.businessName || "");
      setRole(contact.role || "Entrepreneur");
      setRoleOther(contact.roleOther || "");
      setVentureType(contact.ventureType || "");
      setStage(contact.stage || "");
      setWhatTheyAreBuilding(contact.whatTheyAreBuilding || "");
      setAge(contact.age?.toString() || "");
      setRevenueBand(contact.revenueBand || "");
      setSelectedEthnicities(contact.ethnicity || []);
      setShowEmailDropdown(false);
      setShowBusinessDropdown(false);
      setShowQuickAddEmail(false);
      setShowQuickAddBusiness(false);
      setQuickAddEmailName("");
    }
  }, [open, contact]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suburbRef.current && !suburbRef.current.contains(e.target as Node)) {
        setShowSuburbDropdown(false);
      }
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) {
        setShowEmailDropdown(false);
      }
      if (businessRef.current && !businessRef.current.contains(e.target as Node)) {
        setShowBusinessDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickAddEmailContact = async () => {
    if (!quickAddEmailName.trim() || !email.trim()) return;
    try {
      await createContact.mutateAsync({ name: quickAddEmailName.trim(), email: email.trim(), role: "Professional" });
      setShowQuickAddEmail(false);
      setQuickAddEmailName("");
    } catch (err: any) {}
  };

  const handleQuickAddGroup = async () => {
    if (!businessSearch.trim()) return;
    try {
      const newGroup = await createGroup.mutateAsync({ name: businessSearch.trim(), type: "Business" });
      setBusinessName(businessSearch.trim());
      setShowQuickAddBusiness(false);
      setShowBusinessDropdown(false);
    } catch (err: any) {}
  };

  const toggleEthnicity = (eth: string) => {
    setSelectedEthnicities(prev =>
      prev.includes(eth) ? prev.filter(e => e !== eth) : [...prev, eth]
    );
  };

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/contacts/${contact.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/:id'] });
      toast({ title: "Contact updated" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      nickname: nickname.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      location: location.trim() || null,
      suburb: suburb.trim() || null,
      localBoard: localBoard.trim() || null,
      businessName: businessName.trim() || null,
      role: role,
      roleOther: role === "Other" ? (roleOther.trim() || null) : null,
      ventureType: ventureType || null,
      stage: stage || null,
      whatTheyAreBuilding: whatTheyAreBuilding.trim() || null,
      age: age ? parseInt(age) : null,
      revenueBand: revenueBand || null,
      ethnicity: selectedEthnicities,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact Details</DialogTitle>
          <DialogDescription className="sr-only">Edit contact information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-nickname">Preferred Name / Nickname</Label>
              <Input
                id="edit-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. 'AJ' or 'Mana'"
                data-testid="input-edit-nickname"
              />
            </div>
            <div className="space-y-2" ref={emailRef}>
              <Label htmlFor="edit-email">Email</Label>
              <div className="relative">
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setShowEmailDropdown(true);
                    setShowQuickAddEmail(false);
                  }}
                  onFocus={() => email.trim() && setShowEmailDropdown(true)}
                  placeholder="Search or enter email..."
                  data-testid="input-edit-email"
                />
                {showEmailDropdown && email.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredEmailContacts.length > 0 ? (
                      filteredEmailContacts.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                          onClick={() => {
                            setEmail(c.email);
                            setShowEmailDropdown(false);
                          }}
                          data-testid={`email-option-${c.id}`}
                        >
                          <span className="truncate">{c.email}</span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">{c.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground" data-testid="text-no-email-matches">
                        <p>No matching contacts found</p>
                        {!showQuickAddEmail && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-1"
                            onClick={() => setShowQuickAddEmail(true)}
                            data-testid="button-quick-add-email-contact"
                          >
                            + Quick Add as new contact
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {showQuickAddEmail && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={quickAddEmailName}
                      onChange={(e) => setQuickAddEmailName(e.target.value)}
                      placeholder="Contact name for this email..."
                      className="flex-1"
                      data-testid="input-quick-add-email-name"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleQuickAddEmailContact}
                      disabled={!quickAddEmailName.trim() || createContact.isPending}
                      data-testid="button-save-quick-add-email"
                    >
                      {createContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowQuickAddEmail(false); setQuickAddEmailName(""); }}
                      data-testid="button-cancel-quick-add-email"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2" ref={businessRef}>
              <Label htmlFor="edit-business">Venture / Project</Label>
              <div className="relative">
                <Input
                  id="edit-business"
                  value={businessSearch}
                  onChange={(e) => {
                    setBusinessSearch(e.target.value);
                    setBusinessName(e.target.value);
                    setShowBusinessDropdown(true);
                    setShowQuickAddBusiness(false);
                  }}
                  onFocus={() => businessSearch && setShowBusinessDropdown(true)}
                  placeholder="Search or enter venture name..."
                  data-testid="input-edit-business"
                />
                {showBusinessDropdown && businessSearch.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                          onClick={() => {
                            setBusinessName(g.name);
                            setBusinessSearch(g.name);
                            setShowBusinessDropdown(false);
                          }}
                          data-testid={`business-option-${g.id}`}
                        >
                          <span className="truncate">{g.name}</span>
                          {g.type && <span className="text-xs text-muted-foreground ml-2 shrink-0">{g.type}</span>}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground" data-testid="text-no-business-matches">
                        <p>No matching groups found</p>
                        {!showQuickAddBusiness && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-1"
                            onClick={() => setShowQuickAddBusiness(true)}
                            data-testid="button-quick-add-business"
                          >
                            + Quick Add as new group
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {showQuickAddBusiness && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-muted-foreground truncate flex-1">Create "{businessSearch.trim()}"?</span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleQuickAddGroup}
                      disabled={!businessSearch.trim() || createGroup.isPending}
                      data-testid="button-save-quick-add-business"
                    >
                      {createGroup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowQuickAddBusiness(false)}
                      data-testid="button-cancel-quick-add-business"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={role} onValueChange={(v) => { setRole(v); if (v !== "Other") setRoleOther(""); }}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role === "Other" && (
                <Input
                  value={roleOther}
                  onChange={(e) => setRoleOther(e.target.value)}
                  placeholder="Describe role..."
                  data-testid="input-edit-role-other"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-venture-type">Venture Type</Label>
              <Select value={ventureType} onValueChange={setVentureType}>
                <SelectTrigger data-testid="select-edit-venture-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial_business">Commercial Business</SelectItem>
                  <SelectItem value="social_enterprise">Social Enterprise</SelectItem>
                  <SelectItem value="creative_movement">Creative / Arts</SelectItem>
                  <SelectItem value="community_initiative">Community Organisation</SelectItem>
                  <SelectItem value="exploring">Exploring</SelectItem>
                  <SelectItem value="ecosystem_partner">Ecosystem Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Journey Stage</Label>
              <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg border border-border" data-testid="venture-stage-selector">
                {[
                  { value: "kakano", label: "Kakano", desc: "Seed / Foundation" },
                  { value: "tipu", label: "Tipu", desc: "Actively Growing" },
                  { value: "ora", label: "Ora", desc: "Thriving / Sustained" },
                  { value: "inactive", label: "Inactive", desc: "Paused / Stepped back" },
                ].map((s, i, arr) => (
                  <div key={s.value} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => setStage(stage === s.value ? "" : s.value)}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md w-full transition-colors ${stage === s.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                      data-testid={`button-stage-${s.value}`}
                    >
                      <span className="text-[10px] font-semibold">{s.label}</span>
                      <span className={`text-[8px] ${stage === s.value ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{s.desc}</span>
                    </button>
                    {i < arr.length - 1 && <div className="w-2 h-px bg-border shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-what-building">What they're building</Label>
              <Textarea
                id="edit-what-building"
                value={whatTheyAreBuilding}
                onChange={(e) => setWhatTheyAreBuilding(e.target.value)}
                placeholder="Describe what this person is working on..."
                className="resize-none text-sm"
                rows={2}
                data-testid="input-what-building"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                data-testid="input-edit-location"
              />
            </div>
            <div className="space-y-2 col-span-2" ref={suburbRef}>
              <Label htmlFor="edit-suburb">Suburb</Label>
              <div className="relative">
                <Input
                  id="edit-suburb"
                  value={suburbSearch}
                  onChange={(e) => {
                    setSuburbSearch(e.target.value);
                    setShowSuburbDropdown(true);
                    if (!e.target.value.trim()) {
                      setSuburb("");
                      setLocalBoard("");
                    }
                  }}
                  onFocus={() => suburbSearch && setShowSuburbDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (suburbSearch.trim() && suburbSearch !== suburb) {
                        const board = getLocalBoard(suburbSearch.trim());
                        if (board) {
                          const matched = Object.keys(SUBURB_TO_LOCAL_BOARD).find(
                            k => k.toLowerCase() === suburbSearch.trim().toLowerCase()
                          );
                          if (matched) {
                            setSuburb(matched);
                            setSuburbSearch(matched);
                            setLocalBoard(board);
                          }
                        }
                      }
                    }, 200);
                  }}
                  placeholder="Type to search Auckland suburbs..."
                  data-testid="input-edit-suburb"
                />
                {showSuburbDropdown && suburbResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {suburbResults.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                        onClick={() => {
                          setSuburb(s);
                          setSuburbSearch(s);
                          const board = getLocalBoard(s);
                          if (board) setLocalBoard(board);
                          setShowSuburbDropdown(false);
                        }}
                        data-testid={`suburb-option-${s.toLowerCase().replace(/[\s/]+/g, '-')}`}
                      >
                        <span>{s}</span>
                        <span className="text-xs text-muted-foreground">{getLocalBoard(s)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {localBoard && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-local-board">
                  Local Board: <span className="font-medium text-foreground">{localBoard}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-age">Age</Label>
              <Input
                id="edit-age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                data-testid="input-edit-age"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-revenue">Income Band</Label>
              <Select value={revenueBand} onValueChange={setRevenueBand}>
                <SelectTrigger data-testid="select-edit-revenue">
                  <SelectValue placeholder="Select income band" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Koha / Donations">Koha / Donations</SelectItem>
                  <SelectItem value="Sponsorship">Sponsorship</SelectItem>
                  <SelectItem value="Pre-revenue">Pre-revenue</SelectItem>
                  <SelectItem value="$0-$50k">$0-$50k</SelectItem>
                  <SelectItem value="$50k-$100k">$50k-$100k</SelectItem>
                  <SelectItem value="$100k-$250k">$100k-$250k</SelectItem>
                  <SelectItem value="$250k-$500k">$250k-$500k</SelectItem>
                  <SelectItem value="$500k-$1M">$500k-$1M</SelectItem>
                  <SelectItem value="$1M+">$1M+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Ethnicity</Label>
            <div className="border border-border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
              {ETHNICITY_OPTIONS.map((group) => (
                <div key={group.group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group.group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.options.map((eth) => (
                      <label
                        key={eth}
                        className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1"
                        data-testid={`checkbox-ethnicity-${eth.toLowerCase().replace(/[\s/]+/g, '-')}`}
                      >
                        <Checkbox
                          checked={selectedEthnicities.includes(eth)}
                          onCheckedChange={() => toggleEthnicity(eth)}
                        />
                        <span className="text-sm">{eth}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {selectedEthnicities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedEthnicities.map((eth) => (
                  <Badge key={eth} variant="secondary" className="text-xs gap-1 pr-1">
                    {eth}
                    <button
                      type="button"
                      onClick={() => toggleEthnicity(eth)}
                      aria-label={`Remove ${eth}`}
                      className="inline-flex items-center justify-center rounded-full"
                      data-testid={`button-remove-ethnicity-${eth.toLowerCase().replace(/[\s/]+/g, '-')}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending} data-testid="button-save-contact">
              <Check className="w-4 h-4 mr-1" /> Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
