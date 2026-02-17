import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProgrammes, useCreateProgramme, useUpdateProgramme, useDeleteProgramme } from "@/hooks/use-programmes";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
  MapPin,
  MoreVertical,
  Clock,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { PROGRAMME_CLASSIFICATIONS, PROGRAMME_STATUSES, type Programme, type Contact } from "@shared/schema";

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Community Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/15 text-green-700 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function Programmes() {
  const { data: programmes, isLoading } = useProgrammes();
  const { data: contacts } = useContacts();
  const createMutation = useCreateProgramme();
  const updateMutation = useUpdateProgramme();
  const deleteMutation = useDeleteProgramme();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProgramme, setEditProgramme] = useState<Programme | null>(null);

  const filtered = programmes?.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === "all" || p.classification === classFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const getTotalBudget = (p: Programme) => {
    return (
      parseFloat(p.facilitatorCost || "0") +
      parseFloat(p.cateringCost || "0") +
      parseFloat(p.promoCost || "0")
    );
  };

  const getFacilitatorNames = (p: Programme) => {
    if (!p.facilitators?.length || !contacts) return [];
    return p.facilitators
      .map((id) => contacts.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];
  };

  const formatDateTime = (p: Programme) => {
    if (!p.startDate) return null;
    const dateStr = format(new Date(p.startDate), "d MMM yyyy");
    const hasEndDate = p.endDate && format(new Date(p.endDate), "yyyy-MM-dd") !== format(new Date(p.startDate), "yyyy-MM-dd");
    const timeStr = p.startTime
      ? p.endTime
        ? `${p.startTime} - ${p.endTime}`
        : p.startTime
      : null;

    if (hasEndDate) {
      const endDateStr = format(new Date(p.endDate!), "d MMM yyyy");
      return { date: `${dateStr} - ${endDateStr}`, time: timeStr };
    }
    return { date: dateStr, time: timeStr };
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Programme removed successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-programmes-title">Programmes</h1>
              <p className="text-muted-foreground mt-1">Manage internal events and activations.</p>
            </div>
            <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-create-programme">
              <Plus className="w-4 h-4 mr-2" />
              New Programme
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search programmes..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-programmes"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-classification-filter">
                <SelectValue placeholder="Classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PROGRAMME_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {PROGRAMME_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !filtered?.length ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-programmes">No programmes yet</h3>
              <p className="text-muted-foreground mb-4">Create your first programme to start tracking internal events and budgets.</p>
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-programme-empty">
                <Plus className="w-4 h-4 mr-2" />
                Create Programme
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((programme) => {
                const dateTime = formatDateTime(programme);
                const facNames = getFacilitatorNames(programme);
                return (
                  <Card key={programme.id} className="p-4 hover-elevate" data-testid={`card-programme-${programme.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-base truncate" data-testid={`text-programme-name-${programme.id}`}>
                            {programme.name}
                          </h3>
                          <Badge className={CLASSIFICATION_COLORS[programme.classification] || ""} data-testid={`badge-classification-${programme.id}`}>
                            {programme.classification}
                          </Badge>
                          <Badge className={STATUS_COLORS[programme.status] || ""} data-testid={`badge-status-${programme.id}`}>
                            {STATUS_LABELS[programme.status] || programme.status}
                          </Badge>
                        </div>
                        {programme.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{programme.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {dateTime && (
                            <span className="flex items-center gap-1" data-testid={`text-date-${programme.id}`}>
                              <Calendar className="w-3 h-3" />
                              {dateTime.date}
                            </span>
                          )}
                          {dateTime?.time && (
                            <span className="flex items-center gap-1" data-testid={`text-time-${programme.id}`}>
                              <Clock className="w-3 h-3" />
                              {dateTime.time}
                            </span>
                          )}
                          {programme.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {programme.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1" data-testid={`text-budget-${programme.id}`}>
                            <DollarSign className="w-3 h-3" />
                            Budget: ${getTotalBudget(programme).toFixed(2)}
                          </span>
                        </div>
                        {facNames.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap" data-testid={`text-facilitators-${programme.id}`}>
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Facilitators:</span>
                            {facNames.map((name, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-programme-menu-${programme.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditProgramme(programme)} data-testid={`button-edit-programme-${programme.id}`}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(programme.id)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-delete-programme-${programme.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {(parseFloat(programme.facilitatorCost || "0") > 0 ||
                      parseFloat(programme.cateringCost || "0") > 0 ||
                      parseFloat(programme.promoCost || "0") > 0) && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                          <span className="text-muted-foreground">
                            Facilitator/Talent: <span className="text-foreground font-medium">${parseFloat(programme.facilitatorCost || "0").toFixed(2)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Catering: <span className="text-foreground font-medium">${parseFloat(programme.cateringCost || "0").toFixed(2)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Promo: <span className="text-foreground font-medium">${parseFloat(programme.promoCost || "0").toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ProgrammeFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (data) => {
          try {
            await createMutation.mutateAsync(data);
            setCreateOpen(false);
            toast({ title: "Created", description: "Programme created successfully" });
          } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to create", variant: "destructive" });
          }
        }}
        isPending={createMutation.isPending}
      />

      {editProgramme && (
        <ProgrammeFormDialog
          open={!!editProgramme}
          onOpenChange={(open) => { if (!open) setEditProgramme(null); }}
          programme={editProgramme}
          onSubmit={async (data) => {
            try {
              await updateMutation.mutateAsync({ id: editProgramme.id, data });
              setEditProgramme(null);
              toast({ title: "Updated", description: "Programme updated successfully" });
            } catch (err: any) {
              toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
            }
          }}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function ProgrammeFormDialog({
  open,
  onOpenChange,
  programme,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programme?: Programme;
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
}) {
  const { data: contacts } = useContacts();
  const createContactMutation = useCreateContact();

  const isSingleDayInit = programme
    ? !programme.endDate || format(new Date(programme.startDate || new Date()), "yyyy-MM-dd") === format(new Date(programme.endDate), "yyyy-MM-dd")
    : true;

  const [name, setName] = useState(programme?.name || "");
  const [description, setDescription] = useState(programme?.description || "");
  const [classification, setClassification] = useState(programme?.classification || "");
  const [status, setStatus] = useState(programme?.status || "planned");
  const [isSingleDay, setIsSingleDay] = useState(isSingleDayInit);
  const [startDate, setStartDate] = useState(
    programme?.startDate ? format(new Date(programme.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    programme?.endDate ? format(new Date(programme.endDate), "yyyy-MM-dd") : ""
  );
  const [startTime, setStartTime] = useState(programme?.startTime || "");
  const [endTime, setEndTime] = useState(programme?.endTime || "");
  const [location, setLocation] = useState(programme?.location || "");
  const [facilitatorCost, setFacilitatorCost] = useState(programme?.facilitatorCost || "0");
  const [cateringCost, setCateringCost] = useState(programme?.cateringCost || "0");
  const [promoCost, setPromoCost] = useState(programme?.promoCost || "0");
  const [notes, setNotes] = useState(programme?.notes || "");
  const [selectedFacilitators, setSelectedFacilitators] = useState<number[]>(programme?.facilitators || []);
  const [facilitatorSearch, setFacilitatorSearch] = useState("");
  const [showNewPersonDialog, setShowNewPersonDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");

  const totalBudget = parseFloat(facilitatorCost || "0") + parseFloat(cateringCost || "0") + parseFloat(promoCost || "0");

  const filteredFacilitatorContacts = useMemo(() => {
    if (!contacts || !facilitatorSearch.trim()) return [];
    const term = facilitatorSearch.toLowerCase();
    return contacts
      .filter((c) => c.name.toLowerCase().includes(term) && !selectedFacilitators.includes(c.id))
      .slice(0, 8);
  }, [contacts, facilitatorSearch, selectedFacilitators]);

  const handleAddFacilitator = (contact: Contact) => {
    setSelectedFacilitators((prev) => [...prev, contact.id]);
    setFacilitatorSearch("");
  };

  const handleRemoveFacilitator = (contactId: number) => {
    setSelectedFacilitators((prev) => prev.filter((id) => id !== contactId));
  };

  const handleSubmit = () => {
    if (!name.trim() || !classification) return;
    if (!isSingleDay && startDate && endDate && endDate < startDate) return;
    if (startTime && endTime && isSingleDay && endTime < startTime) return;
    const data: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      classification,
      status,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: isSingleDay
        ? (startDate ? new Date(startDate).toISOString() : undefined)
        : (endDate ? new Date(endDate).toISOString() : undefined),
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
      facilitatorCost: facilitatorCost || "0",
      cateringCost: cateringCost || "0",
      promoCost: promoCost || "0",
      facilitators: selectedFacilitators.length > 0 ? selectedFacilitators : undefined,
      notes: notes.trim() || undefined,
    };
    onSubmit(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-programme-dialog-title">
              {programme ? "Edit Programme" : "New Programme"}
            </DialogTitle>
            <DialogDescription>
              {programme ? "Update programme details, schedule, facilitators, and budget." : "Set up a new programme with schedule, facilitators, and budget."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Programme name"
                data-testid="input-programme-name"
              />
            </div>

            <div>
              <Label>Classification *</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger data-testid="select-programme-classification">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMME_CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-programme-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMME_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this programme about?"
                data-testid="input-programme-description"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Date & Time</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="single-day-toggle">Single day</Label>
                  <Switch
                    id="single-day-toggle"
                    checked={isSingleDay}
                    onCheckedChange={setIsSingleDay}
                    data-testid="switch-single-day"
                  />
                </div>
              </div>

              {isSingleDay ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-programme-start-date"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start Time</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        data-testid="input-programme-start-time"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End Time</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        data-testid="input-programme-end-time"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        data-testid="input-programme-start-date"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End Date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        data-testid="input-programme-end-date"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start Time (optional)</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        data-testid="input-programme-start-time"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End Time (optional)</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        data-testid="input-programme-end-time"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Venue or address"
                data-testid="input-programme-location"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Facilitators</Label>
              {selectedFacilitators.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedFacilitators.map((id) => {
                    const contact = contacts?.find((c) => c.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-facilitator-${id}`}>
                        {contact?.name || `Contact #${id}`}
                        <button
                          onClick={() => handleRemoveFacilitator(id)}
                          className="ml-0.5 hover:text-destructive transition-colors"
                          data-testid={`button-remove-facilitator-${id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={facilitatorSearch}
                  onChange={(e) => setFacilitatorSearch(e.target.value)}
                  placeholder="Search community members..."
                  className="h-8 text-xs pl-7"
                  data-testid="input-search-facilitators"
                />
              </div>
              {facilitatorSearch.trim() && (
                <div className="border border-border rounded-md divide-y divide-border/50 max-h-[150px] overflow-y-auto">
                  {filteredFacilitatorContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleAddFacilitator(c)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                      data-testid={`button-add-facilitator-${c.id}`}
                    >
                      <span>{c.name}</span>
                      <UserPlus className="w-3 h-3 text-muted-foreground" />
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setNewPersonName(facilitatorSearch.trim());
                      setShowNewPersonDialog(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between text-primary"
                    data-testid="button-create-new-facilitator"
                  >
                    <span>Add "{facilitatorSearch.trim()}" as new person</span>
                    <UserPlus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Budget</Label>
                <span className="text-sm text-muted-foreground">
                  Total: <span className="font-medium text-foreground">${totalBudget.toFixed(2)}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Facilitator / Talent</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={facilitatorCost}
                    onChange={(e) => setFacilitatorCost(e.target.value)}
                    data-testid="input-facilitator-cost"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Catering</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cateringCost}
                    onChange={(e) => setCateringCost(e.target.value)}
                    data-testid="input-catering-cost"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Promo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={promoCost}
                    onChange={(e) => setPromoCost(e.target.value)}
                    data-testid="input-promo-cost"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                data-testid="input-programme-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-programme">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !name.trim() || !classification}
              data-testid="button-save-programme"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {programme ? "Save Changes" : "Create Programme"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPersonDialog} onOpenChange={setShowNewPersonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-new-person-dialog-title">Add New Person</DialogTitle>
            <DialogDescription>Create a new community member to add as a facilitator.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Name *</Label>
              <Input
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Full name"
                data-testid="input-new-facilitator-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Email (optional)</Label>
              <Input
                value={newPersonEmail}
                onChange={(e) => setNewPersonEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
                data-testid="input-new-facilitator-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Phone (optional)</Label>
              <Input
                value={newPersonPhone}
                onChange={(e) => setNewPersonPhone(e.target.value)}
                placeholder="Phone number"
                type="tel"
                data-testid="input-new-facilitator-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPersonDialog(false)} data-testid="button-cancel-new-facilitator">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const newContact = await createContactMutation.mutateAsync({
                    name: newPersonName.trim(),
                    role: "Facilitator",
                    email: newPersonEmail.trim() || undefined,
                    phone: newPersonPhone.trim() || undefined,
                  });
                  if (newContact && typeof newContact === 'object' && 'id' in newContact) {
                    setSelectedFacilitators((prev) => [...prev, (newContact as any).id]);
                  }
                  setShowNewPersonDialog(false);
                  setFacilitatorSearch("");
                  setNewPersonName("");
                  setNewPersonEmail("");
                  setNewPersonPhone("");
                } catch (err) {
                }
              }}
              disabled={!newPersonName.trim() || createContactMutation.isPending}
              data-testid="button-save-new-facilitator"
            >
              {createContactMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
