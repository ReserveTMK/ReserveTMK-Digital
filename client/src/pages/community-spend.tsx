import { Button } from "@/components/ui/beautiful-button";
import { Plus, Search, Loader2, DollarSign, Trash2, Pencil, Filter } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

const CATEGORIES = ["contracting", "goods", "services", "sponsorship", "donation", "other"] as const;
const PAYMENT_STATUSES = ["paid", "pending", "invoiced"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  contracting: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  goods: "bg-green-500/10 text-green-700 dark:text-green-300",
  services: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  sponsorship: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  donation: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  other: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-500/10 text-green-700 dark:text-green-300",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invoiced: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

type SpendItem = {
  id: number;
  amount: string;
  date: string;
  category: string;
  description: string;
  contactId: number | null;
  groupId: number | null;
  programmeId: number | null;
  bookingId: number | null;
  paymentStatus: string;
  notes: string | null;
  contactName?: string;
  groupName?: string;
  programmeName?: string;
};

type SpendSummary = {
  totalSpend: number;
  byCategory: Record<string, number>;
  byGroup: Record<string, number>;
  byMonth: Record<string, number>;
  totalEntries: number;
};

export default function CommunitySpend() {
  const { data: spendItems, isLoading } = useQuery<SpendItem[]>({ queryKey: ['/api/community-spend'] });
  const { data: summary } = useQuery<SpendSummary>({ queryKey: ['/api/community-spend/summary'] });
  const { data: contacts } = useQuery<any[]>({ queryKey: ['/api/contacts'] });
  const { data: groups } = useQuery<any[]>({ queryKey: ['/api/groups'] });
  const { data: programmes } = useQuery<any[]>({ queryKey: ['/api/programmes'] });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SpendItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest('POST', '/api/community-spend', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-spend'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community-spend/summary'] });
      toast({ title: "Spend entry created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      apiRequest('PUT', `/api/community-spend/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-spend'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community-spend/summary'] });
      toast({ title: "Spend entry updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/community-spend/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-spend'] });
      queryClient.invalidateQueries({ queryKey: ['/api/community-spend/summary'] });
      toast({ title: "Spend entry deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredItems = useMemo(() => {
    if (!spendItems) return [];
    return spendItems.filter((item) => {
      const matchesSearch = item.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || item.paymentStatus === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [spendItems, search, categoryFilter, statusFilter]);

  const topCategory = useMemo(() => {
    if (!summary?.byCategory) return "N/A";
    const entries = Object.entries(summary.byCategory);
    if (entries.length === 0) return "N/A";
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [summary]);

  const statusCounts = useMemo(() => {
    if (!spendItems) return { paid: 0, pending: 0, invoiced: 0 };
    const counts = { paid: 0, pending: 0, invoiced: 0 };
    spendItems.forEach((item) => {
      if (item.paymentStatus in counts) {
        counts[item.paymentStatus as keyof typeof counts]++;
      }
    });
    return counts;
  }, [spendItems]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEditDialog = (item: SpendItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-community-spend-title">
              Community Spend
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track and manage community spending and investments
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-spend">
            <Plus className="w-4 h-4 mr-2" />
            Add Spend
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spend</p>
                <p className="text-lg font-semibold" data-testid="text-total-spend">
                  ${(summary?.totalSpend ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Filter className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entries</p>
                <p className="text-lg font-semibold" data-testid="text-total-entries">
                  {summary?.totalEntries ?? 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top Category</p>
                <p className="text-lg font-semibold capitalize" data-testid="text-top-category">
                  {topCategory}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] ${PAYMENT_STATUS_COLORS.paid}`} data-testid="badge-paid-count">
                  Paid: {statusCounts.paid}
                </Badge>
                <Badge className={`text-[10px] ${PAYMENT_STATUS_COLORS.pending}`} data-testid="badge-pending-count">
                  Pending: {statusCounts.pending}
                </Badge>
                <Badge className={`text-[10px] ${PAYMENT_STATUS_COLORS.invoiced}`} data-testid="badge-invoiced-count">
                  Invoiced: {statusCounts.invoiced}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-spend"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold mb-2">
                {spendItems?.length === 0 ? "No spend entries yet" : "No matching entries"}
              </h3>
              <p className="text-sm mb-4">
                {spendItems?.length === 0
                  ? "Add your first community spend entry to start tracking investments"
                  : "Try adjusting your search or filters"}
              </p>
              {spendItems?.length === 0 && (
                <Button onClick={openCreateDialog} data-testid="button-create-spend-empty">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Spend
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="p-4"
                data-testid={`card-spend-${item.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground" data-testid={`text-spend-date-${item.id}`}>
                        {format(new Date(item.date), "dd MMM yyyy")}
                      </span>
                      <span className="text-sm font-semibold" data-testid={`text-spend-amount-${item.id}`}>
                        ${parseFloat(item.amount).toFixed(2)}
                      </span>
                      <Badge className={`text-[10px] capitalize ${CATEGORY_COLORS[item.category] || ""}`} data-testid={`badge-spend-category-${item.id}`}>
                        {item.category}
                      </Badge>
                      <Badge className={`text-[10px] capitalize ${PAYMENT_STATUS_COLORS[item.paymentStatus] || ""}`} data-testid={`badge-spend-status-${item.id}`}>
                        {item.paymentStatus}
                      </Badge>
                    </div>
                    <p className="text-sm" data-testid={`text-spend-description-${item.id}`}>
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      {item.contactName && (
                        <span data-testid={`text-spend-contact-${item.id}`}>Contact: {item.contactName}</span>
                      )}
                      {item.groupName && (
                        <span data-testid={`text-spend-group-${item.id}`}>Group: {item.groupName}</span>
                      )}
                      {item.programmeName && (
                        <span data-testid={`text-spend-programme-${item.id}`}>Programme: {item.programmeName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(item)}
                      title="Edit"
                      data-testid={`button-edit-spend-${item.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => setDeleteConfirmId(item.id)}
                      title="Delete"
                      data-testid={`button-delete-spend-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <SpendFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        contacts={contacts || []}
        groups={groups || []}
        programmes={programmes || []}
        onCreate={createMutation}
        onUpdate={updateMutation}
      />

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Spend Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this spend entry? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete-spend">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirmId) {
                  deleteMutation.mutate(deleteConfirmId, {
                    onSuccess: () => setDeleteConfirmId(null),
                  });
                }
              }}
              data-testid="button-confirm-delete-spend"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SpendFormDialog({ open, onOpenChange, item, contacts, groups, programmes, onCreate, onUpdate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SpendItem | null;
  contacts: any[];
  groups: any[];
  programmes: any[];
  onCreate: ReturnType<typeof useMutation<Response, Error, Record<string, any>>>;
  onUpdate: ReturnType<typeof useMutation<Response, Error, { id: number; data: Record<string, any> }>>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<string>("contracting");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [programmeId, setProgrammeId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("paid");
  const [notes, setNotes] = useState("");
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [groupSearchOpen, setGroupSearchOpen] = useState(false);

  const resetForm = () => {
    setAmount(item ? item.amount : "");
    setDate(item?.date ? format(new Date(item.date), "yyyy-MM-dd") : "");
    setCategory(item?.category || "contracting");
    setDescription(item?.description || "");
    setContactId(item?.contactId ? String(item.contactId) : "");
    setGroupId(item?.groupId ? String(item.groupId) : "");
    setProgrammeId(item?.programmeId ? String(item.programmeId) : "");
    setPaymentStatus(item?.paymentStatus || "paid");
    setNotes(item?.notes || "");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!amount || !date || !description.trim()) return;
    const data: Record<string, any> = {
      amount: parseFloat(amount),
      date: new Date(date).toISOString(),
      category,
      description: description.trim(),
      contactId: contactId ? parseInt(contactId) : null,
      groupId: groupId ? parseInt(groupId) : null,
      programmeId: programmeId ? parseInt(programmeId) : null,
      bookingId: null,
      paymentStatus,
      notes: notes.trim() || null,
    };

    if (item) {
      onUpdate.mutate({ id: item.id, data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      onCreate.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isPending = onCreate.isPending || onUpdate.isPending;

  const selectedContactName = contactId ? contacts.find((c) => c.id === parseInt(contactId))?.name : "";
  const selectedGroupName = groupId ? groups.find((g) => g.id === parseInt(groupId))?.name : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Spend Entry" : "Add Spend Entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-spend-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="input-spend-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-spend-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger data-testid="select-spend-payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this spend for?"
              data-testid="input-spend-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Contact</Label>
            <Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                  data-testid="button-select-contact"
                >
                  {selectedContactName || "Select contact..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search contacts..." />
                  <CommandList>
                    <CommandEmpty>No contacts found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setContactId("");
                          setContactSearchOpen(false);
                        }}
                      >
                        None
                      </CommandItem>
                      {contacts.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setContactId(String(c.id));
                            setContactSearchOpen(false);
                          }}
                        >
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Group</Label>
            <Popover open={groupSearchOpen} onOpenChange={setGroupSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                  data-testid="button-select-group"
                >
                  {selectedGroupName || "Select group..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search groups..." />
                  <CommandList>
                    <CommandEmpty>No groups found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setGroupId("");
                          setGroupSearchOpen(false);
                        }}
                      >
                        None
                      </CommandItem>
                      {groups.map((g) => (
                        <CommandItem
                          key={g.id}
                          value={g.name}
                          onSelect={() => {
                            setGroupId(String(g.id));
                            setGroupSearchOpen(false);
                          }}
                        >
                          {g.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Programme</Label>
            <Select value={programmeId || "none"} onValueChange={(v) => setProgrammeId(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="select-spend-programme">
                <SelectValue placeholder="Select programme..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {programmes.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              data-testid="input-spend-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-spend">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || !date || !description.trim() || isPending}
            data-testid="button-save-spend"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {item ? "Save Changes" : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
