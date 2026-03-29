import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  AlertCircle,
  Target,
  GripVertical,
  Plus,
  Loader2,
  Sprout,
  TreePine,
  Sun,
} from "lucide-react";
import {
  type EnrichedRelationship,
  JOURNEY_STAGE_CONFIG,
  isOverdue,
} from "@/components/mentoring/mentoring-hooks";
import type { MentoringApplication, Meeting } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type ColumnId = "discovery" | "active" | "on_hold" | "graduated";

interface KanbanCard {
  id: string;
  type: "application" | "relationship";
  applicationId?: number;
  relationshipId?: number;
  contactId: number;
  contactName: string;
  ventureSummary?: string;
  stage?: string;
  sessionCount: number;
  isOverdue: boolean;
  discoveryBadge?: "New" | "Session Booked" | "Discovery Done";
  status: string;
}

const COLUMN_CONFIG: { id: ColumnId; title: string; color: string; bgClass: string }[] = [
  { id: "discovery", title: "Discovery", color: "text-blue-700 dark:text-blue-400", bgClass: "bg-blue-500/5 border-blue-200 dark:border-blue-800" },
  { id: "active", title: "Active", color: "text-green-700 dark:text-green-400", bgClass: "bg-green-500/5 border-green-200 dark:border-green-800" },
  { id: "on_hold", title: "On Hold", color: "text-amber-700 dark:text-amber-400", bgClass: "bg-amber-500/5 border-amber-200 dark:border-amber-800" },
  { id: "graduated", title: "Graduated", color: "text-purple-700 dark:text-purple-400", bgClass: "bg-purple-500/5 border-purple-200 dark:border-purple-800" },
];

function PipelineCard({ card, onClick }: { card: KanbanCard; onClick: () => void }) {
  const stageConfig = card.stage ? JOURNEY_STAGE_CONFIG[card.stage] : null;

  return (
    <Card
      className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-background"
      onClick={onClick}
      data-testid={`pipeline-card-${card.id}`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-sm truncate flex-1">{card.contactName}</h4>
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-50" />
        </div>

        {card.ventureSummary && (
          <p className="text-xs text-muted-foreground line-clamp-2">{card.ventureSummary}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {stageConfig && (
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${stageConfig.bgColor} ${stageConfig.color}`}>
              {stageConfig.label}
            </Badge>
          )}
          {card.discoveryBadge && (
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${
              card.discoveryBadge === "Discovery Done"
                ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                : card.discoveryBadge === "Session Booked"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
            }`}>
              {card.discoveryBadge}
            </Badge>
          )}
          {card.sessionCount > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Target className="w-3 h-3" /> {card.sessionCount}
            </span>
          )}
          {card.isOverdue && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700">
              <AlertCircle className="w-3 h-3 mr-0.5" /> Overdue
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

const STAGE_OPTIONS = [
  { value: "kakano", label: "Kakano", icon: Sprout, desc: "Seed stage" },
  { value: "tipu", label: "Tipu", icon: TreePine, desc: "Growing" },
  { value: "ora", label: "Ora", icon: Sun, desc: "Thriving" },
] as const;

function QuickAddMenteeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState("kakano");
  const [whatBuilding, setWhatBuilding] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setStage("kakano");
    setWhatBuilding("");
  };

  const createContact = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
  });

  const createRelationship = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/mentoring-relationships", data);
      return res.json();
    },
  });

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      const contact = await createContact.mutateAsync({
        name: name.trim(),
        email: email.trim() || null,
        role: "entrepreneur",
        isCommunityMember: true,
        stage,
        whatTheyAreBuilding: whatBuilding.trim() || null,
      });
      await createRelationship.mutateAsync({
        contactId: contact.id,
        status: "application",
        startDate: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Mentee added to pipeline" });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to add mentee", description: err.message, variant: "destructive" });
    }
  };

  const isSubmitting = createContact.isPending || createRelationship.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Quick Add Mentee</DialogTitle>
          <DialogDescription>Add someone to the discovery pipeline</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Name *</Label>
            <Input id="qa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-email">Email</Label>
            <Input id="qa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <div className="flex gap-2">
              {STAGE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={stage === value ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => setStage(value)}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-building">What they're building</Label>
            <Input id="qa-building" value={whatBuilding} onChange={(e) => setWhatBuilding(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Adding...</> : "Add to Pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KanbanColumn({ column, cards, onCardClick, onQuickAdd }: {
  column: typeof COLUMN_CONFIG[number];
  cards: KanbanCard[];
  onCardClick: (card: KanbanCard) => void;
  onQuickAdd?: () => void;
}) {
  return (
    <div className="flex flex-col min-w-[260px] w-full md:w-[280px] lg:w-[300px] shrink-0" data-testid={`kanban-column-${column.id}`}>
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${column.bgClass}`}>
        <span className={`text-sm font-semibold ${column.color}`}>{column.title}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{cards.length}</Badge>
          {onQuickAdd && (
            <button
              onClick={onQuickAdd}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Quick add mentee"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 rounded-b-lg border border-t-0 min-h-[120px] transition-colors ${
              snapshot.isDraggingOver ? "bg-accent/50" : "bg-muted/20"
            }`}
          >
            {cards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={dragSnapshot.isDragging ? "opacity-90 rotate-1" : ""}
                  >
                    <PipelineCard card={card} onClick={() => onCardClick(card)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {cards.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-muted-foreground text-center py-4 italic">No mentees</p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function PipelineKanban({
  relationships,
  applications,
  contacts,
  meetings,
  onCardClick,
  onAcceptApplication,
  onUpdateRelationshipStatus,
}: {
  relationships: EnrichedRelationship[];
  applications: MentoringApplication[];
  contacts: any[];
  meetings: Meeting[];
  onCardClick: (card: KanbanCard) => void;
  onAcceptApplication: (appId: number, contactId?: number, contactName?: string) => void;
  onUpdateRelationshipStatus: (relationshipId: number, newStatus: string, notes?: string) => void;
}) {
  const { toast } = useToast();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [confirmDrag, setConfirmDrag] = useState<{
    card: KanbanCard;
    from: ColumnId;
    to: ColumnId;
  } | null>(null);

  const columns = useMemo(() => {
    const result: Record<ColumnId, KanbanCard[]> = {
      discovery: [],
      active: [],
      on_hold: [],
      graduated: [],
    };

    const pendingApps = applications.filter(a => a.status === "pending");
    for (const app of pendingApps) {
      const contact = contacts.find((c: any) => c.id === app.contactId);
      const discoveryMeeting = meetings?.find(
        (m) => m.contactId === app.contactId && (m.status === "completed" || m.status === "confirmed" || m.status === "scheduled")
      );
      const hasCompletedSession = discoveryMeeting && discoveryMeeting.status === "completed";

      result.discovery.push({
        id: `app-${app.id}`,
        type: "application",
        applicationId: app.id,
        contactId: app.contactId,
        contactName: contact?.name || "Unknown",
        ventureSummary: app.ventureDescription || undefined,
        stage: contact?.stage || undefined,
        sessionCount: 0,
        isOverdue: false,
        discoveryBadge: hasCompletedSession ? "Discovery Done" : discoveryMeeting ? "Session Booked" : "New",
        status: "pending",
      });
    }

    for (const rel of relationships) {
      let discoveryBadge: KanbanCard["discoveryBadge"] = undefined;
      if (rel.status === "application") {
        const discoveryMeeting = meetings?.find(
          (m) => m.contactId === rel.contactId && (m.status === "completed" || m.status === "confirmed" || m.status === "scheduled")
        );
        const hasCompletedSession = discoveryMeeting && discoveryMeeting.status === "completed";
        discoveryBadge = hasCompletedSession ? "Discovery Done" : discoveryMeeting ? "Session Booked" : "New";
      }

      const card: KanbanCard = {
        id: `rel-${rel.id}`,
        type: "relationship",
        relationshipId: rel.id,
        contactId: rel.contactId,
        contactName: rel.contactName,
        ventureSummary: rel.whatTheyAreBuilding || rel.ventureDescription || undefined,
        stage: rel.stage || undefined,
        sessionCount: rel.completedSessionCount || 0,
        isOverdue: isOverdue(rel),
        discoveryBadge,
        status: rel.status,
      };

      if (rel.status === "application") {
        result.discovery.push(card);
      } else if (rel.status === "active") {
        result.active.push(card);
      } else if (rel.status === "on_hold") {
        result.on_hold.push(card);
      } else if (rel.status === "graduated") {
        result.graduated.push(card);
      }
    }

    result.active.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return 0;
    });

    return result;
  }, [relationships, applications, contacts, meetings]);

  const ALLOWED_TRANSITIONS: Record<string, Record<ColumnId, ColumnId[]>> = {
    application: {
      discovery: ["active"],
      active: [],
      on_hold: [],
      graduated: [],
    },
    relationship: {
      discovery: ["active"],
      active: ["on_hold", "graduated"],
      on_hold: ["active", "graduated"],
      graduated: ["active"],
    },
  };

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.droppableId as ColumnId;
    const to = result.destination.droppableId as ColumnId;
    if (from === to) return;

    const cardId = result.draggableId;
    const allCards = [...columns.discovery, ...columns.active, ...columns.on_hold, ...columns.graduated];
    const card = allCards.find(c => c.id === cardId);
    if (!card) return;

    const allowed = ALLOWED_TRANSITIONS[card.type]?.[from] || [];
    if (!allowed.includes(to)) {
      const colName = COLUMN_CONFIG.find(c => c.id === to)?.title || to;
      toast({ title: "Invalid move", description: `Cannot move ${card.type === "application" ? "applications" : "mentees"} to ${colName} from here`, variant: "destructive" });
      return;
    }

    if (card.type === "application" && to === "active") {
      setConfirmDrag({ card, from, to });
      return;
    }

    if (to === "graduated") {
      setConfirmDrag({ card, from, to });
      return;
    }

    if (from === "graduated" && to === "active") {
      setConfirmDrag({ card, from, to });
      return;
    }

    if (card.type === "relationship" && card.relationshipId) {
      onUpdateRelationshipStatus(card.relationshipId, to);
    }
  }, [columns, onUpdateRelationshipStatus, toast]);

  const confirmMove = () => {
    if (!confirmDrag) return;
    const { card, to } = confirmDrag;

    if (card.type === "application" && card.applicationId && to === "active") {
      onAcceptApplication(card.applicationId, card.contactId, card.contactName);
    } else if (card.type === "relationship" && card.relationshipId) {
      onUpdateRelationshipStatus(card.relationshipId, to);
    }
    setConfirmDrag(null);
  };

  const getConfirmMessage = () => {
    if (!confirmDrag) return { title: "", description: "" };
    const { card, from, to } = confirmDrag;

    if (card.type === "application" && to === "active") {
      return {
        title: "Accept & Onboard",
        description: `Accept ${card.contactName}'s application and create an active mentoring relationship?`,
      };
    }
    if (to === "graduated") {
      return {
        title: "Graduate Mentee",
        description: `Mark ${card.contactName} as graduated? This will end the active mentoring relationship.`,
      };
    }
    if (from === "graduated" && to === "active") {
      return {
        title: "Re-activate Mentee",
        description: `Re-start mentoring with ${card.contactName}? They'll move back to Kakano with a fresh start date.`,
      };
    }
    return {
      title: "Move Mentee",
      description: `Move ${card.contactName} to ${COLUMN_CONFIG.find(c => c.id === to)?.title}?`,
    };
  };

  const confirmMsg = getConfirmMessage();

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory md:snap-none" data-testid="pipeline-kanban">
          {COLUMN_CONFIG.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              cards={columns[col.id]}
              onCardClick={onCardClick}
              onQuickAdd={col.id === "discovery" ? () => setQuickAddOpen(true) : undefined}
            />
          ))}
        </div>
      </DragDropContext>

      <Dialog open={!!confirmDrag} onOpenChange={(v) => { if (!v) setConfirmDrag(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{confirmMsg.title}</DialogTitle>
            <DialogDescription>{confirmMsg.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDrag(null)} data-testid="button-cancel-move">Cancel</Button>
            <Button onClick={confirmMove} data-testid="button-confirm-move">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddMenteeDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </>
  );
}
