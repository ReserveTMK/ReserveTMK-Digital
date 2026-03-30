import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeSlot } from "@/lib/utils";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useProgrammes, useCreateProgramme, useUpdateProgramme, useDeleteProgramme } from "@/hooks/use-programmes";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback } from "react";
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
  Copy,
  CheckCircle2,
  AlertCircle,
  Ban,
  CircleDashed,
  Zap,
  LayoutList,
  Columns3,
  GripVertical,
  BarChart3,
  ClipboardList,
  Download,
  ExternalLink,
  Link2,
  Mail,
  FileText,
  Send,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { PROGRAMME_CLASSIFICATIONS, PROGRAMME_STATUSES, PROGRAMME_LOCATION_TYPES, type Programme, type Contact } from "@shared/schema";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { MetricCard } from "@/components/ui/metric-card";

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Community Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/15 text-green-700 dark:text-green-300",
};

const STATUS_CARD_COLORS: Record<string, string> = {
  planned: "bg-gray-50/50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
  active: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  completed: "bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-900/20 opacity-70",
  cancelled: "bg-gray-100/30 dark:bg-gray-900/10 border-gray-100 dark:border-gray-900/20 opacity-70",
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

  const { data: regCounts } = useQuery<Record<number, number>>({
    queryKey: ["/api/programmes/registration-counts"],
  });

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProgramme, setEditProgramme] = useState<Programme | null>(null);
  const [registrationsProgramme, setRegistrationsProgramme] = useState<Programme | null>(null);
  const [wixContentProgramme, setWixContentProgramme] = useState<Programme | null>(null);
  const [reminderProgramme, setReminderProgramme] = useState<Programme | null>(null);
  const [surveyProgramme, setSurveyProgramme] = useState<Programme | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "monthly">("kanban");

  const getAttendeeCount = (p: Programme) => {
    const internal = p.attendees?.length || 0;
    const external = regCounts?.[p.id] || 0;
    return internal + external;
  };

  const sendReminderMutation = useMutation({
    mutationFn: async (programmeId: number) => {
      const res = await apiRequest("POST", `/api/programmes/${programmeId}/send-reminder`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Reminders sent", description: `${data.sent} reminder${data.sent !== 1 ? "s" : ""} sent successfully` });
      setReminderProgramme(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendSurveyMutation = useMutation({
    mutationFn: async (programmeId: number) => {
      const res = await apiRequest("POST", `/api/programmes/${programmeId}/send-survey`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Surveys sent", description: `${data.sent} survey${data.sent !== 1 ? "s" : ""} sent successfully` });
      setSurveyProgramme(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

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

  const getAttendeeNames = (p: Programme) => {
    if (!p.attendees?.length || !contacts) return [];
    return p.attendees
      .map((id) => contacts.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];
  };

  const formatDateTime = (p: Programme) => {
    if (p.tbcMonth && p.tbcYear) {
      return { date: `TBC - ${p.tbcMonth} ${p.tbcYear}`, time: null };
    }
    if (!p.startDate) return null;
    const dateStr = format(new Date(p.startDate), "d MMM yyyy");
    const hasEndDate = p.endDate && format(new Date(p.endDate), "yyyy-MM-dd") !== format(new Date(p.startDate), "yyyy-MM-dd");
    const timeStr = p.startTime
      ? p.endTime
        ? `${formatTimeSlot(p.startTime)} - ${formatTimeSlot(p.endTime)}`
        : formatTimeSlot(p.startTime)
      : null;

    if (hasEndDate) {
      const endDateStr = format(new Date(p.endDate!), "d MMM yyyy");
      return { date: `${dateStr} - ${endDateStr}`, time: timeStr };
    }
    return { date: dateStr, time: timeStr };
  };

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    if (!PROGRAMME_STATUSES.includes(newStatus as any)) return;
    const programmeId = parseInt(result.draggableId);
    const programme = programmes?.find(p => p.id === programmeId);
    if (!programme || programme.status === newStatus) return;
    try {
      await updateMutation.mutateAsync({ id: programmeId, data: { status: newStatus } });
      toast({ title: "Status updated", description: `"${programme.name}" moved to ${STATUS_LABELS[newStatus]}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    }
  }, [programmes, updateMutation, toast]);

  const budgetTracker = useMemo(() => {
    if (!programmes) return { budgetTagged: 0, budgetSpent: 0, yearCount: 0, monthCount: 0 };
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const yearProgrammes = programmes.filter(p => {
      if (p.status === "cancelled") return false;
      if (p.startDate) return new Date(p.startDate).getFullYear() === currentYear;
      if (p.tbcYear) return parseInt(p.tbcYear) === currentYear;
      return false;
    });
    const monthProgrammes = yearProgrammes.filter(p => {
      if (p.startDate) return new Date(p.startDate).getMonth() === currentMonth;
      if (p.tbcMonth) {
        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        return monthNames.indexOf(p.tbcMonth) === currentMonth;
      }
      return false;
    });
    let budgetTagged = 0;
    let budgetSpent = 0;
    yearProgrammes.forEach(p => {
      const cost = parseFloat(p.facilitatorCost || "0") + parseFloat(p.cateringCost || "0") + parseFloat(p.promoCost || "0");
      budgetTagged += cost;
      if (p.status === "completed") {
        budgetSpent += cost;
      }
    });
    return { budgetTagged, budgetSpent, yearCount: yearProgrammes.length, monthCount: monthProgrammes.length };
  }, [programmes]);

  const kanbanColumns = useMemo(() => {
    const columns: Record<string, Programme[]> = {
      planned: [],
      active: [],
      completed: [],
      cancelled: [],
    };
    filtered?.forEach(p => {
      if (columns[p.status]) columns[p.status].push(p);
    });
    return columns;
  }, [filtered]);

  const monthlyGroups = useMemo(() => {
    const source = filtered || [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const groups: { month: string; monthIndex: number; programmes: Programme[] }[] = monthNames.map((m, i) => ({
      month: m,
      monthIndex: i,
      programmes: [],
    }));
    const yearProgrammes = source.filter(p => {
      if (p.startDate) return new Date(p.startDate).getFullYear() === currentYear;
      if (p.tbcYear) return parseInt(p.tbcYear) === currentYear;
      return false;
    });
    yearProgrammes.forEach(p => {
      let monthIdx = -1;
      if (p.startDate) {
        monthIdx = new Date(p.startDate).getMonth();
      } else if (p.tbcMonth) {
        monthIdx = monthNames.indexOf(p.tbcMonth);
      }
      if (monthIdx >= 0 && monthIdx < 12) {
        groups[monthIdx].programmes.push(p);
      }
    });
    return groups;
  }, [filtered]);

  const handleDuplicate = async (p: Programme) => {
    try {
      await createMutation.mutateAsync({
        name: `${p.name} (Copy)`,
        description: p.description || undefined,
        classification: p.classification,
        status: "planned",
        startDate: p.startDate || undefined,
        endDate: p.endDate || undefined,
        startTime: p.startTime || undefined,
        endTime: p.endTime || undefined,
        location: p.location || undefined,
        locationType: p.locationType || undefined,
        customDirections: p.customDirections || undefined,
        facilitatorCost: p.facilitatorCost || "0",
        cateringCost: p.cateringCost || "0",
        promoCost: p.promoCost || "0",
        facilitators: p.facilitators || undefined,
        attendees: p.attendees || undefined,
        notes: p.notes || undefined,
      });
      toast({ title: "Duplicated", description: `"${p.name}" has been duplicated` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to duplicate", variant: "destructive" });
    }
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
    <>
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className={`${viewMode === "kanban" ? "max-w-[1600px]" : "max-w-6xl"} mx-auto space-y-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-programmes-title">Programmes</h1>
              <p className="text-muted-foreground mt-1">Manage internal events and activations.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border rounded-lg overflow-hidden" data-testid="view-toggle">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                  data-testid="button-kanban-view"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  Board
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                  data-testid="button-list-view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  List
                </button>
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${viewMode === "monthly" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                  data-testid="button-monthly-view"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Monthly
                </button>
              </div>
              <Button className="shadow-lg" onClick={() => setCreateOpen(true)} data-testid="button-create-programme">
                <Plus className="w-4 h-4 mr-2" />
                New Programme
              </Button>
            </div>
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
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-classification-filter">
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
              <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300" data-testid="stat-targets">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-muted-foreground">{new Date().getFullYear()} Targets</p>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">This Month</span>
                    <span className="text-sm tabular-nums">
                      <span className="font-bold text-foreground">{budgetTracker.monthCount}</span>
                      <span className="text-muted-foreground"> / 2</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${budgetTracker.monthCount >= 2 ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min((budgetTracker.monthCount / 2) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {budgetTracker.monthCount >= 2 ? "Target reached" : `${2 - budgetTracker.monthCount} more to go`}
                  </p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">This Year</span>
                    <span className="text-sm tabular-nums">
                      <span className="font-bold text-foreground">{budgetTracker.yearCount}</span>
                      <span className="text-muted-foreground"> / 24</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${budgetTracker.yearCount >= 24 ? "bg-emerald-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min((budgetTracker.yearCount / 24) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {budgetTracker.yearCount >= 24 ? "Yearly target reached" : `${24 - budgetTracker.yearCount} more to reach target`}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300" data-testid="stat-budget">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-muted-foreground">{new Date().getFullYear()} Budget</p>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Tagged</span>
                    <span className="text-2xl font-bold font-display tracking-tight text-foreground">${budgetTracker.budgetTagged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total budget across {budgetTracker.yearCount} programmes</p>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Spent</span>
                    <span className="text-2xl font-bold font-display tracking-tight text-emerald-600 dark:text-emerald-400">${budgetTracker.budgetSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {budgetTracker.budgetTagged > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min((budgetTracker.budgetSpent / budgetTracker.budgetTagged) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round((budgetTracker.budgetSpent / budgetTracker.budgetTagged) * 100)}% of tagged budget spent
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !programmes?.length ? (
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
          ) : viewMode === "kanban" ? (
            filtered?.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No programmes match your filters.</p>
              </Card>
            ) : (
              <KanbanBoard
                columns={kanbanColumns}
                onDragEnd={handleDragEnd}
                onEdit={setEditProgramme}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onRegistrations={setRegistrationsProgramme}
                onWixContent={setWixContentProgramme}
                onReminder={setReminderProgramme}
                onSurvey={setSurveyProgramme}
                formatDateTime={formatDateTime}
                getFacilitatorNames={getFacilitatorNames}
                getTotalBudget={getTotalBudget}
                getAttendeeCount={getAttendeeCount}
                contacts={contacts}
              />
            )
          ) : viewMode === "monthly" ? (
            <MonthlyView
              monthlyGroups={monthlyGroups}
              onEdit={setEditProgramme}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onRegistrations={setRegistrationsProgramme}
              onWixContent={setWixContentProgramme}
              onReminder={setReminderProgramme}
              onSurvey={setSurveyProgramme}
              formatDateTime={formatDateTime}
              getFacilitatorNames={getFacilitatorNames}
              getTotalBudget={getTotalBudget}
              getAttendeeCount={getAttendeeCount}
            />
          ) : (
            <div className="space-y-3">
              {!filtered?.length ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No programmes match your filters.</p>
                </Card>
              ) : filtered.map((programme) => {
                const dateTime = formatDateTime(programme);
                const facNames = getFacilitatorNames(programme);
                const attNames = getAttendeeNames(programme);
                const isCompleted = programme.status === "completed";
                const isCancelled = programme.status === "cancelled";

                return (
                  <Card 
                    key={programme.id} 
                    className={`p-4 hover-elevate transition-all ${STATUS_CARD_COLORS[programme.status] || ""}`} 
                    data-testid={`card-programme-${programme.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="shrink-0 mt-0.5" data-testid={`status-icon-${programme.id}`}>
                          {isCancelled ? (
                            <Ban className="w-5 h-5 text-muted-foreground/60" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : programme.status === "active" ? (
                            <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                          ) : (
                            <CircleDashed className="w-5 h-5 text-muted-foreground/50 animate-[spin_8s_linear_infinite]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={`font-semibold text-base truncate ${isCancelled ? "line-through text-muted-foreground" : ""}`} data-testid={`text-programme-name-${programme.id}`}>
                            {programme.name}
                          </h3>
                          <Badge className={CLASSIFICATION_COLORS[programme.classification] || ""} data-testid={`badge-classification-${programme.id}`}>
                            {programme.classification}
                          </Badge>
                        </div>
                        {programme.description && (
                          <p className={`text-sm text-muted-foreground line-clamp-2 mb-2 ${isCancelled ? "line-through" : ""}`}>{programme.description}</p>
                        )}
                        <div className={`flex items-center gap-4 text-xs text-muted-foreground flex-wrap ${isCancelled ? "line-through" : ""}`}>
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
                          {getAttendeeCount(programme) > 0 && (
                            <span className="flex items-center gap-1" data-testid={`text-attendee-count-${programme.id}`}>
                              <Users className="w-3 h-3" />
                              {getAttendeeCount(programme)} attendee{getAttendeeCount(programme) !== 1 ? "s" : ""}
                            </span>
                          )}
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
                        {attNames.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap" data-testid={`text-attendees-${programme.id}`}>
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Attendees:</span>
                            {attNames.map((name, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-background/50">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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
                          {programme.publicRegistrations && (
                            <DropdownMenuItem onClick={() => setRegistrationsProgramme(programme)} data-testid={`button-registrations-${programme.id}`}>
                              <ClipboardList className="w-4 h-4 mr-2" />
                              Registrations
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setWixContentProgramme(programme)} data-testid={`button-wix-content-${programme.id}`}>
                            <FileText className="w-4 h-4 mr-2" />
                            Generate for Wix
                          </DropdownMenuItem>
                          {programme.publicRegistrations && (
                            <DropdownMenuItem onClick={() => setReminderProgramme(programme)} data-testid={`button-send-reminder-${programme.id}`}>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                          )}
                          {programme.publicRegistrations && (
                            <DropdownMenuItem onClick={() => setSurveyProgramme(programme)} data-testid={`button-send-survey-${programme.id}`}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Send Survey
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicate(programme)} data-testid={`button-duplicate-programme-${programme.id}`}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
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

      {registrationsProgramme && (
        <RegistrationsDialog
          programme={registrationsProgramme}
          open={!!registrationsProgramme}
          onOpenChange={(open) => { if (!open) setRegistrationsProgramme(null); }}
        />
      )}

      {wixContentProgramme && (
        <WixContentDialog
          programme={wixContentProgramme}
          open={!!wixContentProgramme}
          onOpenChange={(open) => { if (!open) setWixContentProgramme(null); }}
          formatDateTime={formatDateTime}
          getFacilitatorNames={getFacilitatorNames}
        />
      )}

      <Dialog open={!!reminderProgramme} onOpenChange={(open) => { if (!open) setReminderProgramme(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-reminder-dialog-title">Send Reminder Emails</DialogTitle>
            <DialogDescription>
              Send a reminder email to all registered attendees for "{reminderProgramme?.name}".
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send an email with event details and directions to everyone who registered for this programme.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderProgramme(null)} data-testid="button-cancel-reminder">
              Cancel
            </Button>
            <Button
              onClick={() => reminderProgramme && sendReminderMutation.mutate(reminderProgramme.id)}
              disabled={sendReminderMutation.isPending}
              data-testid="button-confirm-reminder"
            >
              {sendReminderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send Reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!surveyProgramme} onOpenChange={(open) => { if (!open) setSurveyProgramme(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-survey-dialog-title">Send Post-Event Survey</DialogTitle>
            <DialogDescription>
              Send a feedback survey to all registered attendees for "{surveyProgramme?.name}".
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Each attendee will receive a unique survey link via email. The survey includes a rating, feedback questions, and a newsletter opt-in.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSurveyProgramme(null)} data-testid="button-cancel-survey">
              Cancel
            </Button>
            <Button
              onClick={() => surveyProgramme && sendSurveyMutation.mutate(surveyProgramme.id)}
              disabled={sendSurveyMutation.isPending}
              data-testid="button-confirm-survey"
            >
              {sendSurveyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send Surveys
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RegistrationsDialog({ programme, open, onOpenChange }: { programme: Programme; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [linkCopied, setLinkCopied] = useState(false);
  const [showAdminReg, setShowAdminReg] = useState(false);
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regOrg, setRegOrg] = useState("");

  const adminRegMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/programmes/${programme.id}/admin-register`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programmes', programme.id, 'registrations'] });
      toast({ title: "Registered successfully" });
      setShowAdminReg(false);
      setRegFirstName(""); setRegLastName(""); setRegEmail(""); setRegPhone(""); setRegOrg("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data, isLoading, refetch } = useQuery<{ registrations: any[]; count: number; capacity: number | null }>({
    queryKey: ['/api/programmes', programme.id, 'registrations'],
    queryFn: async () => {
      const res = await fetch(`/api/programmes/${programme.id}/registrations`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: open,
  });

  const registrationUrl = programme.slug ? `${window.location.origin}/register/${programme.slug}` : "";

  const toggleAttendanceMutation = useMutation({
    mutationFn: async ({ regId, attended }: { regId: number; attended: boolean }) => {
      const res = await fetch(`/api/programmes/${programme.id}/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attended }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programmes', programme.id, 'registrations'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (regId: number) => {
      const res = await fetch(`/api/programmes/${programme.id}/registrations/${regId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programmes', programme.id, 'registrations'] });
      toast({ title: "Registration removed" });
    },
  });

  const handleExport = () => {
    window.open(`/api/programmes/${programme.id}/registrations/export`, '_blank');
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector('[data-testid="qr-registrations-dialog"]');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const a = document.createElement('a');
      a.download = `${programme.name.replace(/[^a-zA-Z0-9]/g, '_')}_QR.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const registrations = data?.registrations || [];
  const count = data?.count || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-registrations-title">Registrations - {programme.name}</DialogTitle>
          <DialogDescription>
            {data?.capacity ? `${count} registered / ${data.capacity} capacity` : `${count} registered`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {registrationUrl && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Registration Link</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      navigator.clipboard.writeText(registrationUrl);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    data-testid="button-copy-reg-link-dialog"
                  >
                    {linkCopied ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {linkCopied ? "Copied" : "Copy Link"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => window.open(registrationUrl, '_blank')}
                    data-testid="button-open-reg-link"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open
                  </Button>
                </div>
              </div>
              <code className="text-xs bg-background rounded px-2 py-1 block truncate border" data-testid="text-reg-url-dialog">
                {registrationUrl}
              </code>
              <div className="flex items-end gap-4">
                <div className="flex justify-center">
                  <QRCodeSVG value={registrationUrl} size={120} data-testid="qr-registrations-dialog" />
                </div>
                <Button size="sm" variant="outline" className="h-7" onClick={handleDownloadQR} data-testid="button-download-qr">
                  <Download className="w-3 h-3 mr-1" />
                  Download QR
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium" data-testid="text-registration-count">
              {count} registration{count !== 1 ? 's' : ''}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdminReg(!showAdminReg)} data-testid="button-admin-register">
                <UserPlus className="w-3 h-3 mr-1" />
                Register Someone
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport} disabled={!registrations.length} data-testid="button-export-csv">
                <Download className="w-3 h-3 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>

          {showAdminReg && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">First Name *</Label>
                  <Input value={regFirstName} onChange={e => setRegFirstName(e.target.value)} placeholder="First name" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Last Name *</Label>
                  <Input value={regLastName} onChange={e => setRegLastName(e.target.value)} placeholder="Last name" className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="email@example.com" type="email" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="Phone" className="h-8 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Organisation</Label>
                <Input value={regOrg} onChange={e => setRegOrg(e.target.value)} placeholder="Organisation" className="h-8 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowAdminReg(false)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={!regFirstName || !regLastName || !regEmail || adminRegMutation.isPending}
                  onClick={() => adminRegMutation.mutate({
                    firstName: regFirstName,
                    lastName: regLastName,
                    email: regEmail,
                    phone: regPhone || null,
                    organization: regOrg || null,
                  })}
                  data-testid="button-submit-admin-reg"
                >
                  {adminRegMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Register
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-registrations">
              No registrations yet. Share the registration link to get started.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Organisation</th>
                    <th className="px-3 py-2 text-center font-medium">Attended</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg: any) => (
                    <tr key={reg.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <span className="font-medium" data-testid={`text-reg-name-${reg.id}`}>{reg.firstName} {reg.lastName}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" data-testid={`text-reg-email-${reg.id}`}>{reg.email}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{reg.organization || "-"}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={reg.attended || false}
                          onChange={(e) => toggleAttendanceMutation.mutate({ regId: reg.id, attended: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid={`checkbox-attended-${reg.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => cancelMutation.mutate(reg.id)}
                          data-testid={`button-cancel-reg-${reg.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WixContentDialog({
  programme,
  open,
  onOpenChange,
  formatDateTime,
  getFacilitatorNames,
}: {
  programme: Programme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatDateTime: (p: Programme) => { date: string; time: string | null } | null;
  getFacilitatorNames: (p: Programme) => string[];
}) {
  const [copied, setCopied] = useState(false);
  const dt = formatDateTime(programme);
  const facNames = getFacilitatorNames(programme);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const content = [
    `<h2>${esc(programme.name)}</h2>`,
    programme.description ? `<p>${esc(programme.description)}</p>` : "",
    `<h3>Details</h3>`,
    `<ul>`,
    dt ? `<li><strong>Date:</strong> ${esc(dt.date)}</li>` : "",
    dt?.time ? `<li><strong>Time:</strong> ${esc(dt.time)}</li>` : "",
    programme.location ? `<li><strong>Location:</strong> ${esc(programme.location)}</li>` : "",
    facNames.length > 0 ? `<li><strong>Facilitator${facNames.length > 1 ? "s" : ""}:</strong> ${esc(facNames.join(", "))}</li>` : "",
    programme.capacity ? `<li><strong>Capacity:</strong> ${programme.capacity} spots</li>` : "",
    `</ul>`,
    programme.publicRegistrations && programme.slug
      ? `<p><a href="${window.location.origin}/register/${programme.slug}">Register Now</a></p>`
      : "",
  ].filter(Boolean).join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-wix-content-title">Wix Content - {programme.name}</DialogTitle>
          <DialogDescription>Copy this HTML to paste into your Wix website editor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono overflow-x-auto" data-testid="text-wix-content">
              {content}
            </pre>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Preview</h4>
            <div className="space-y-2">
              <h3 className="text-lg font-bold">{programme.name}</h3>
              {programme.description && <p className="text-sm text-muted-foreground">{programme.description}</p>}
              <div className="text-sm space-y-1">
                {dt && <div><span className="font-medium">Date:</span> {dt.date}</div>}
                {dt?.time && <div><span className="font-medium">Time:</span> {dt.time}</div>}
                {programme.location && <div><span className="font-medium">Location:</span> {programme.location}</div>}
                {facNames.length > 0 && <div><span className="font-medium">Facilitator{facNames.length > 1 ? "s" : ""}:</span> {facNames.join(", ")}</div>}
                {programme.capacity && <div><span className="font-medium">Capacity:</span> {programme.capacity} spots</div>}
              </div>
              {programme.publicRegistrations && programme.slug && (
                <p className="text-primary underline text-sm">Register Now</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-wix">
            Close
          </Button>
          <Button onClick={handleCopy} data-testid="button-copy-wix">
            {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy HTML"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const COLUMN_STYLES: Record<string, { header: string; dot: string; bg: string }> = {
  planned: {
    header: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
    bg: "bg-slate-50/50 dark:bg-slate-900/20",
  },
  active: {
    header: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    bg: "bg-amber-50/30 dark:bg-amber-900/10",
  },
  completed: {
    header: "text-green-700 dark:text-green-300",
    dot: "bg-green-500",
    bg: "bg-green-50/30 dark:bg-green-900/10",
  },
  cancelled: {
    header: "text-gray-500 dark:text-gray-400",
    dot: "bg-gray-400",
    bg: "bg-gray-50/30 dark:bg-gray-900/10",
  },
};

function MonthlyView({
  monthlyGroups,
  onEdit,
  onDuplicate,
  onDelete,
  onRegistrations,
  onWixContent,
  onReminder,
  onSurvey,
  formatDateTime,
  getFacilitatorNames,
  getTotalBudget,
  getAttendeeCount,
}: {
  monthlyGroups: { month: string; monthIndex: number; programmes: Programme[] }[];
  onEdit: (p: Programme) => void;
  onDuplicate: (p: Programme) => void;
  onDelete: (id: number) => void;
  onRegistrations: (p: Programme) => void;
  onWixContent: (p: Programme) => void;
  onReminder: (p: Programme) => void;
  onSurvey: (p: Programme) => void;
  formatDateTime: (p: Programme) => { date: string; time: string | null } | null;
  getFacilitatorNames: (p: Programme) => string[];
  getTotalBudget: (p: Programme) => number;
  getAttendeeCount: (p: Programme) => number;
}) {
  const currentMonth = new Date().getMonth();

  return (
    <div className="space-y-3" data-testid="monthly-view">
      {monthlyGroups.map((group) => {
        const isCurrentMonth = group.monthIndex === currentMonth;
        const monthBudget = group.programmes.reduce((sum, p) => sum + getTotalBudget(p), 0);
        const hasTarget = group.programmes.length >= 2;

        return (
          <div
            key={group.month}
            className={`rounded-2xl border transition-all ${
              isCurrentMonth
                ? "border-primary/30 bg-primary/[0.02] shadow-sm"
                : group.programmes.length > 0
                ? "border-border bg-card shadow-sm"
                : "border-border/50 bg-card/50"
            }`}
            data-testid={`monthly-group-${group.monthIndex}`}
          >
            <div className={`flex items-center justify-between px-5 py-3 ${group.programmes.length > 0 ? "border-b border-border/50" : ""}`}>
              <div className="flex items-center gap-3">
                <h3 className={`font-semibold text-sm ${isCurrentMonth ? "text-primary" : group.programmes.length > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {group.month}
                </h3>
                {isCurrentMonth && (
                  <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">Now</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {group.programmes.length} programme{group.programmes.length !== 1 ? "s" : ""}
                </span>
                {hasTarget && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              {monthBudget > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  ${monthBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            {group.programmes.length > 0 && (
              <div className="p-3 space-y-2">
                {group.programmes.map((programme) => {
                  const dateTime = formatDateTime(programme);
                  const facNames = getFacilitatorNames(programme);
                  const budget = getTotalBudget(programme);

                  return (
                    <div
                      key={programme.id}
                      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-all hover:shadow-sm ${STATUS_CARD_COLORS[programme.status] || "border-border"}`}
                      data-testid={`monthly-programme-${programme.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">
                          {programme.status === "cancelled" ? (
                            <Ban className="w-4 h-4 text-muted-foreground/60" />
                          ) : programme.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : programme.status === "active" ? (
                            <Zap className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CircleDashed className="w-4 h-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm truncate ${programme.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                              {programme.name}
                            </span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${CLASSIFICATION_COLORS[programme.classification] || ""}`}>
                              {programme.classification}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {dateTime && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {dateTime.date}
                              </span>
                            )}
                            {facNames.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {facNames.join(", ")}
                              </span>
                            )}
                            {budget > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${budget.toFixed(2)}
                              </span>
                            )}
                            {getAttendeeCount(programme) > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {getAttendeeCount(programme)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`button-monthly-menu-${programme.id}`}>
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(programme)} data-testid={`button-monthly-edit-${programme.id}`}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {programme.publicRegistrations && (
                            <DropdownMenuItem onClick={() => onRegistrations(programme)} data-testid={`button-monthly-registrations-${programme.id}`}>
                              <ClipboardList className="w-3.5 h-3.5 mr-2" />
                              Registrations
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onWixContent(programme)} data-testid={`button-monthly-wix-${programme.id}`}>
                            <FileText className="w-3.5 h-3.5 mr-2" />
                            Generate for Wix
                          </DropdownMenuItem>
                          {programme.publicRegistrations && (
                            <DropdownMenuItem onClick={() => onReminder(programme)} data-testid={`button-monthly-reminder-${programme.id}`}>
                              <Mail className="w-3.5 h-3.5 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                          )}
                          {programme.publicRegistrations && (
                            <DropdownMenuItem onClick={() => onSurvey(programme)} data-testid={`button-monthly-survey-${programme.id}`}>
                              <MessageSquare className="w-3.5 h-3.5 mr-2" />
                              Send Survey
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onDuplicate(programme)} data-testid={`button-monthly-duplicate-${programme.id}`}>
                            <Copy className="w-3.5 h-3.5 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(programme.id)} className="text-destructive" data-testid={`button-monthly-delete-${programme.id}`}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KanbanBoard({
  columns,
  onDragEnd,
  onEdit,
  onDuplicate,
  onDelete,
  onRegistrations,
  onWixContent,
  onReminder,
  onSurvey,
  formatDateTime,
  getFacilitatorNames,
  getTotalBudget,
  getAttendeeCount,
  contacts,
}: {
  columns: Record<string, Programme[]>;
  onDragEnd: (result: DropResult) => void;
  onEdit: (p: Programme) => void;
  onDuplicate: (p: Programme) => void;
  onDelete: (id: number) => void;
  onRegistrations: (p: Programme) => void;
  onWixContent: (p: Programme) => void;
  onReminder: (p: Programme) => void;
  onSurvey: (p: Programme) => void;
  formatDateTime: (p: Programme) => { date: string; time: string | null } | null;
  getFacilitatorNames: (p: Programme) => string[];
  getTotalBudget: (p: Programme) => number;
  getAttendeeCount: (p: Programme) => number;
  contacts?: Contact[];
}) {
  const columnOrder = ["planned", "active", "completed", "cancelled"];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kanban-board">
        {columnOrder.map((status) => {
          const items = columns[status] || [];
          const style = COLUMN_STYLES[status];

          return (
            <div key={status} className={`rounded-xl border border-border/50 ${style.bg} flex flex-col min-h-[200px]`} data-testid={`kanban-column-${status}`}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                <h3 className={`text-sm font-semibold ${style.header}`}>{STATUS_LABELS[status]}</h3>
                <Badge variant="secondary" className="ml-auto text-xs h-5 min-w-[20px] justify-center" data-testid={`kanban-count-${status}`}>
                  {items.length}
                </Badge>
              </div>
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                  >
                    {items.map((programme, index) => (
                      <Draggable key={programme.id} draggableId={String(programme.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`group bg-card border border-border/60 rounded-lg shadow-sm transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : "hover:shadow-md"}`}
                            data-testid={`kanban-card-${programme.id}`}
                          >
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5" data-testid={`drag-handle-${programme.id}`}>
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>
                                  <h4 className={`text-sm font-medium truncate ${status === "cancelled" ? "line-through text-muted-foreground" : ""}`} data-testid={`kanban-name-${programme.id}`}>
                                    {programme.name}
                                  </h4>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted shrink-0" data-testid={`kanban-menu-${programme.id}`}>
                                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem onClick={() => onEdit(programme)} data-testid={`kanban-edit-${programme.id}`}>
                                      <Pencil className="w-3.5 h-3.5 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    {programme.publicRegistrations && (
                                      <DropdownMenuItem onClick={() => onRegistrations(programme)} data-testid={`kanban-registrations-${programme.id}`}>
                                        <ClipboardList className="w-3.5 h-3.5 mr-2" />
                                        Registrations
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => onWixContent(programme)} data-testid={`kanban-wix-${programme.id}`}>
                                      <FileText className="w-3.5 h-3.5 mr-2" />
                                      Generate for Wix
                                    </DropdownMenuItem>
                                    {programme.publicRegistrations && (
                                      <DropdownMenuItem onClick={() => onReminder(programme)} data-testid={`kanban-reminder-${programme.id}`}>
                                        <Mail className="w-3.5 h-3.5 mr-2" />
                                        Send Reminder
                                      </DropdownMenuItem>
                                    )}
                                    {programme.publicRegistrations && (
                                      <DropdownMenuItem onClick={() => onSurvey(programme)} data-testid={`kanban-survey-${programme.id}`}>
                                        <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                        Send Survey
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => onDuplicate(programme)} data-testid={`kanban-duplicate-${programme.id}`}>
                                      <Copy className="w-3.5 h-3.5 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDelete(programme.id)} className="text-destructive focus:text-destructive" data-testid={`kanban-delete-${programme.id}`}>
                                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <Badge className={`mt-1.5 text-[10px] ${CLASSIFICATION_COLORS[programme.classification] || ""}`} data-testid={`kanban-badge-${programme.id}`}>
                                {programme.classification}
                              </Badge>

                              {programme.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{programme.description}</p>
                              )}

                              <div className="flex flex-col gap-1 mt-2 text-[11px] text-muted-foreground">
                                {formatDateTime(programme) && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    {formatDateTime(programme)!.date}
                                  </span>
                                )}
                                {programme.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{programme.location}</span>
                                  </span>
                                )}
                              </div>

                              {(getTotalBudget(programme) > 0 || getFacilitatorNames(programme).length > 0 || getAttendeeCount(programme) > 0) && (
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                                  {getTotalBudget(programme) > 0 && (
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                      <DollarSign className="w-3 h-3" />
                                      {getTotalBudget(programme).toFixed(2)}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-2 ml-auto">
                                    {getAttendeeCount(programme) > 0 && (
                                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                        <ClipboardList className="w-3 h-3" />
                                        {getAttendeeCount(programme)}
                                      </span>
                                    )}
                                    {getFacilitatorNames(programme).length > 0 && (
                                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                        <Users className="w-3 h-3" />
                                        {getFacilitatorNames(programme).length}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {items.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
                        Drop here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
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
  const [tbcMonth, setTbcMonth] = useState(programme?.tbcMonth || "");
  const [tbcYear, setTbcYear] = useState(programme?.tbcYear || new Date().getFullYear().toString());
  const [isTBC, setIsTBC] = useState(!!(programme?.tbcMonth || programme?.tbcYear));
  const [location, setLocation] = useState(programme?.location || "");
  const [locationType, setLocationType] = useState(programme?.locationType || (programme?.location ? "Other" : ""));
  const [customDirections, setCustomDirections] = useState(programme?.customDirections || "");

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() + i).toString());
  const [facilitatorCost, setFacilitatorCost] = useState(programme?.facilitatorCost || "0");
  const [cateringCost, setCateringCost] = useState(programme?.cateringCost || "0");
  const [promoCost, setPromoCost] = useState(programme?.promoCost || "0");
  const [notes, setNotes] = useState(programme?.notes || "");
  const [selectedFacilitators, setSelectedFacilitators] = useState<number[]>(programme?.facilitators || []);
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>(programme?.attendees || []);
  const [facilitatorSearch, setFacilitatorSearch] = useState("");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [showNewPersonDialog, setShowNewPersonDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [funderTags, setFunderTags] = useState<string[]>(programme?.funderTags || []);
  const [funderTagInput, setFunderTagInput] = useState("");
  const [publicRegistrations, setPublicRegistrations] = useState(programme?.publicRegistrations || false);
  const [capacity, setCapacity] = useState(programme?.capacity?.toString() || "");
  const [slug, setSlug] = useState(programme?.slug || "");
  const [linkCopied, setLinkCopied] = useState(false);

  const generateSlug = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  };

  const handleTogglePublicRegistrations = (checked: boolean) => {
    setPublicRegistrations(checked);
    if (checked && !slug && name) {
      setSlug(generateSlug(name));
    }
  };

  const registrationUrl = slug ? `${window.location.origin}/register/${slug}` : "";

  const totalBudget = parseFloat(facilitatorCost || "0") + parseFloat(cateringCost || "0") + parseFloat(promoCost || "0");

  const filteredFacilitatorContacts = useMemo(() => {
    if (!contacts || !facilitatorSearch.trim()) return [];
    const term = facilitatorSearch.toLowerCase();
    return contacts
      .filter((c) => c.name.toLowerCase().includes(term) && !selectedFacilitators.includes(c.id))
      .slice(0, 8);
  }, [contacts, facilitatorSearch, selectedFacilitators]);

  const filteredAttendeeContacts = useMemo(() => {
    if (!contacts || !attendeeSearch.trim()) return [];
    const term = attendeeSearch.toLowerCase();
    return contacts
      .filter((c) => c.name.toLowerCase().includes(term) && !selectedAttendees.includes(c.id))
      .slice(0, 8);
  }, [contacts, attendeeSearch, selectedAttendees]);

  const handleAddFacilitator = (contact: Contact) => {
    setSelectedFacilitators((prev) => [...prev, contact.id]);
    setFacilitatorSearch("");
  };

  const handleRemoveFacilitator = (contactId: number) => {
    setSelectedFacilitators((prev) => prev.filter((id) => id !== contactId));
  };

  const handleAddAttendee = (contact: Contact) => {
    setSelectedAttendees((prev) => [...prev, contact.id]);
    setAttendeeSearch("");
  };

  const handleRemoveAttendee = (contactId: number) => {
    setSelectedAttendees((prev) => prev.filter((id) => id !== contactId));
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
      startDate: !isTBC && startDate ? new Date(startDate).toISOString() : null,
      endDate: !isTBC && (isSingleDay
        ? (startDate ? new Date(startDate).toISOString() : null)
        : (endDate ? new Date(endDate).toISOString() : null)) || null,
      startTime: !isTBC && startTime ? startTime : null,
      endTime: !isTBC && endTime ? endTime : null,
      tbcMonth: isTBC ? tbcMonth : null,
      tbcYear: isTBC ? tbcYear : null,
      location: location.trim() || undefined,
      locationType: locationType || null,
      customDirections: locationType === "Other" ? (customDirections.trim() || null) : null,
      facilitatorCost: facilitatorCost || "0",
      cateringCost: cateringCost || "0",
      promoCost: promoCost || "0",
      facilitators: selectedFacilitators.length > 0 ? selectedFacilitators : undefined,
      attendees: selectedAttendees.length > 0 ? selectedAttendees : undefined,
      notes: notes.trim() || undefined,
      funderTags: funderTags.length > 0 ? funderTags : [],
      publicRegistrations,
      slug: publicRegistrations ? (slug || generateSlug(name)) : null,
      capacity: capacity ? parseInt(capacity) : null,
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="tbc-toggle">TBC (Month Only)</Label>
                    <Switch
                      id="tbc-toggle"
                      checked={isTBC}
                      onCheckedChange={setIsTBC}
                      data-testid="switch-tbc"
                    />
                  </div>
                  {!isTBC && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="single-day-toggle">Single day</Label>
                      <Switch
                        id="single-day-toggle"
                        checked={isSingleDay}
                        onCheckedChange={setIsSingleDay}
                        data-testid="switch-single-day"
                      />
                    </div>
                  )}
                </div>
              </div>

              {isTBC ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Month</Label>
                    <Select value={tbcMonth} onValueChange={setTbcMonth}>
                      <SelectTrigger data-testid="select-tbc-month">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Select value={tbcYear} onValueChange={setTbcYear}>
                      <SelectTrigger data-testid="select-tbc-year">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : isSingleDay ? (
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
              <Label>Location Type</Label>
              <Select value={locationType} onValueChange={(val) => {
                setLocationType(val);
                if (val !== "Other") {
                  setLocation(val);
                  setCustomDirections("");
                } else {
                  setLocation("");
                }
              }}>
                <SelectTrigger data-testid="select-programme-location-type">
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMME_LOCATION_TYPES.map((lt) => (
                    <SelectItem key={lt} value={lt}>{lt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {locationType === "Other" && (
              <>
                <div>
                  <Label>Location Name</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Venue name or address"
                    data-testid="input-programme-location"
                  />
                </div>
                <div>
                  <Label>Directions</Label>
                  <Textarea
                    value={customDirections}
                    onChange={(e) => setCustomDirections(e.target.value)}
                    placeholder="How to find the venue, parking info, etc."
                    rows={3}
                    data-testid="input-programme-custom-directions"
                  />
                </div>
              </>
            )}

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
                    onClick={async () => {
                      try {
                        const newContact = await createContactMutation.mutateAsync({ name: facilitatorSearch.trim() });
                        setSelectedFacilitators((prev) => [...prev, newContact.id]);
                        setFacilitatorSearch("");
                      } catch (err: any) {}
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between text-primary"
                    data-testid="button-create-new-facilitator"
                  >
                    <span>Create "{facilitatorSearch.trim()}" as new contact</span>
                    <UserPlus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Community Members (Attendees)</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setShowNewPersonDialog(true)}
                  type="button"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Add New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Search community members..."
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                />
                {attendeeSearch.trim() && (
                  <Card className="absolute z-50 w-full mt-1 p-1 shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm">
                    {filteredAttendeeContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-2 hover:bg-accent rounded-sm cursor-pointer transition-colors"
                        onClick={() => handleAddAttendee(contact)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{contact.name}</span>
                          <span className="text-[10px] text-muted-foreground">{contact.role}</span>
                        </div>
                        <Plus className="w-3 h-3 text-primary" />
                      </div>
                    ))}
                    <div
                      className="flex items-center justify-between p-2 hover:bg-accent rounded-sm cursor-pointer transition-colors text-primary"
                      onClick={async () => {
                        try {
                          const newContact = await createContactMutation.mutateAsync({ name: attendeeSearch.trim() });
                          setSelectedAttendees((prev) => [...prev, newContact.id]);
                          setAttendeeSearch("");
                        } catch (err: any) {}
                      }}
                      data-testid="button-create-new-attendee"
                    >
                      <span className="text-sm font-medium">Create "{attendeeSearch.trim()}" as new contact</span>
                      <UserPlus className="w-3 h-3" />
                    </div>
                  </Card>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[2rem] p-2 bg-muted/30 rounded-md border border-dashed">
                {selectedAttendees.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground italic">No members tagged yet</span>
                ) : (
                  selectedAttendees.map((id) => {
                    const contact = contacts?.find((c) => c.id === id);
                    if (!contact) return null;
                    return (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1 pl-1.5 pr-1 py-0 h-6 text-[10px]">
                        {contact.name}
                        <button
                          onClick={() => handleRemoveAttendee(id)}
                          className="hover:bg-background/50 rounded-full p-0.5 transition-colors"
                          type="button"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </Badge>
                    );
                  })
                )}
              </div>
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

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Funder Tags</Label>
              {funderTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {funderTags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-funder-tag-${i}`}>
                      {tag}
                      <button
                        onClick={() => setFunderTags(funderTags.filter(t => t !== tag))}
                        className="ml-0.5 transition-colors"
                        type="button"
                        data-testid={`button-remove-funder-tag-${i}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={funderTagInput}
                  onChange={(e) => setFunderTagInput(e.target.value)}
                  placeholder="Add funder tag..."
                  className="flex-1"
                  data-testid="input-funder-tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (funderTagInput.trim() && !funderTags.includes(funderTagInput.trim())) {
                        setFunderTags([...funderTags, funderTagInput.trim()]);
                        setFunderTagInput("");
                      }
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => {
                    if (funderTagInput.trim() && !funderTags.includes(funderTagInput.trim())) {
                      setFunderTags([...funderTags, funderTagInput.trim()]);
                      setFunderTagInput("");
                    }
                  }}
                  data-testid="button-add-funder-tag"
                >
                  <Plus className="w-4 h-4" />
                </Button>
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

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Public Registrations</Label>
                  <p className="text-xs text-muted-foreground">Allow people to register via a public link</p>
                </div>
                <Switch
                  checked={publicRegistrations}
                  onCheckedChange={handleTogglePublicRegistrations}
                  data-testid="switch-public-registrations"
                />
              </div>

              {publicRegistrations && (
                <div className="space-y-3 pl-0">
                  <div>
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="Leave empty for unlimited"
                      data-testid="input-programme-capacity"
                    />
                  </div>
                  <div>
                    <Label>URL Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="auto-generated-from-name"
                      data-testid="input-programme-slug"
                    />
                  </div>
                  {registrationUrl && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <Label className="text-xs text-muted-foreground">Registration Link</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background rounded px-2 py-1 flex-1 truncate border" data-testid="text-registration-url">
                          {registrationUrl}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-7"
                          onClick={() => {
                            navigator.clipboard.writeText(registrationUrl);
                            setLinkCopied(true);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          data-testid="button-copy-registration-link"
                        >
                          {linkCopied ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          {linkCopied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <div className="flex justify-center pt-2">
                        <QRCodeSVG value={registrationUrl} size={120} data-testid="qr-registration" />
                      </div>
                    </div>
                  )}
                </div>
              )}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
