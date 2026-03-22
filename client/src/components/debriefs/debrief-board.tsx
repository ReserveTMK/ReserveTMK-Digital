import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Skeleton } from "@/components/ui/skeleton";

import { useImpactLogs } from "@/hooks/use-impact-logs";
import { format, formatDistanceToNow } from "date-fns";
import {
  Mic,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Users,
  Calendar,
  ChevronRight,
} from "lucide-react";
import type { QueueItem } from "./shared";
import type { ImpactLog } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Column config ────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    id: "to_debrief",
    label: "To Debrief",
    icon: Mic,
    color: "border-t-orange-500",
    badgeColor: "bg-orange-500/15 text-orange-700",
    description: "Events waiting to be debriefed",
  },
  {
    id: "in_progress",
    label: "Recorded & Reviewing",
    icon: Clock,
    color: "border-t-blue-500",
    badgeColor: "bg-blue-500/15 text-blue-700",
    description: "Audio recorded, awaiting review",
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "border-t-green-500",
    badgeColor: "bg-green-500/15 text-green-700",
    description: "Reviewed, linked, confirmed",
  },
];

// ── Board ────────────────────────────────────────────────────────────────────

export function DebriefBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: queueItems, isLoading: queueLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/debrief-queue"],
  });

  const { data: allLogs, isLoading: logsLoading } = useImpactLogs() as { data: ImpactLog[] | undefined; isLoading: boolean };

  const isLoading = queueLoading || logsLoading;

  // Column 1: Events with no debrief or skipped
  const toDebrief = (queueItems || []).filter(
    (q) => !q.existingDebriefId && q.queueStatus !== "in_progress"
  );

  // Column 2: Events with draft/pending_review debrief
  const inProgress = (queueItems || []).filter(
    (q) => q.existingDebriefId &&
      (q.existingDebriefStatus === "draft" || q.existingDebriefStatus === "pending_review")
  ).concat(
    // Also include logs not linked to events that are draft/pending
    (allLogs || [])
      .filter(l => !l.eventId && (l.status === "draft" || l.status === "pending_review"))
      .map(l => ({
        id: l.id,
        name: l.title,
        type: "manual",
        startTime: l.createdAt?.toString() || "",
        endTime: l.createdAt?.toString() || "",
        location: null,
        attendeeCount: null,
        description: null,
        linkedProgrammeId: null,
        calendarAttendees: null,
        queueStatus: "in_progress" as const,
        existingDebriefId: l.id,
        existingDebriefStatus: l.status,
      }))
  );

  // Column 3: Confirmed debriefs (recent 20)
  const completed = (allLogs || [])
    .filter(l => l.status === "confirmed")
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 20);

  const handleSkip = async (eventId: number) => {
    try {
      await apiRequest("POST", `/api/events/${eventId}/skip-debrief`, { reason: "Completed/not required" });
      queryClient.invalidateQueries({ queryKey: ["/api/debrief-queue"] });
      toast({ title: "Dismissed", description: "Event removed from queue." });
    } catch {
      toast({ title: "Error", description: "Failed to dismiss", variant: "destructive" });
    }
  };

  const handleStartDebrief = (eventId: number) => {
    setLocation(`/debriefs?tab=queue&reconcile=${eventId}`);
  };

  const handleOpenDebrief = (debriefId: number) => {
    setLocation(`/debriefs/${debriefId}`);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div key={col.id} className="space-y-3">
            <Skeleton className="h-8 w-32" />
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ))}
      </div>
    );
  }

  const columnData = [toDebrief, inProgress, completed];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col, idx) => {
        const items = columnData[idx];
        const Icon = col.icon;
        return (
          <div key={col.id} className="flex flex-col gap-3">
            {/* Column header */}
            <div className="flex items-center gap-2 pb-1">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{col.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {items.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className={`rounded-lg border-t-2 ${col.color} bg-muted/30 p-3 space-y-2 min-h-[200px]`}>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {idx === 0 ? "All caught up 🎉" : idx === 1 ? "Nothing in review" : "No completed debriefs yet"}
                </p>
              )}

              {/* Column 1 — To Debrief */}
              {idx === 0 && (toDebrief as QueueItem[]).map(item => (
                <EventCard
                  key={item.id}
                  item={item}
                  onStart={() => handleStartDebrief(item.id)}
                  onSkip={() => handleSkip(item.id)}
                />
              ))}

              {/* Column 2 — In Progress */}
              {idx === 1 && inProgress.map(item => (
                <InProgressCard
                  key={`${item.id}-${item.existingDebriefId}`}
                  item={item}
                  onOpen={() => item.existingDebriefId && handleOpenDebrief(item.existingDebriefId)}
                />
              ))}

              {/* Column 3 — Completed */}
              {idx === 2 && completed.map(log => (
                <CompletedCard
                  key={log.id}
                  log={log}
                  onOpen={() => handleOpenDebrief(log.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Event card (column 1) ────────────────────────────────────────────────────

function EventCard({ item, onStart, onSkip }: {
  item: QueueItem;
  onStart: () => void;
  onSkip: () => void;
}) {
  const isOverdue = item.queueStatus === "overdue";
  const dateStr = format(new Date(item.startTime), "EEE d MMM");
  const daysAgo = formatDistanceToNow(new Date(item.startTime), { addSuffix: true });

  return (
    <Card className={`p-3 space-y-2 border-l-2 ${isOverdue ? "border-l-red-500" : "border-l-orange-400"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">
                Overdue
              </Badge>
            )}
          </div>
        </div>
      </div>
      {item.attendeeCount && item.attendeeCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{item.attendeeCount} attendees</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={onStart}>
          <Mic className="w-3 h-3 mr-1" />
          Debrief
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </Card>
  );
}

// ── In progress card (column 2) ──────────────────────────────────────────────

function InProgressCard({ item, onOpen }: {
  item: any;
  onOpen: () => void;
}) {
  const statusLabel = item.existingDebriefStatus === "pending_review" ? "Pending Review" : "Draft";
  const statusColor = item.existingDebriefStatus === "pending_review"
    ? "bg-blue-500/15 text-blue-700"
    : "bg-gray-500/15 text-gray-700";

  return (
    <Card className="p-3 space-y-2 border-l-2 border-l-blue-400 cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
              {statusLabel}
            </Badge>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <p className="text-xs text-muted-foreground">Tap to review and confirm →</p>
    </Card>
  );
}

// ── Completed card (column 3) ────────────────────────────────────────────────

function CompletedCard({ log, onOpen }: {
  log: ImpactLog;
  onOpen: () => void;
}) {
  const dateStr = log.createdAt ? format(new Date(log.createdAt), "d MMM") : "";

  return (
    <Card className="p-3 space-y-1 border-l-2 border-l-green-500 cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium truncate flex-1">{log.title}</p>
        <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-green-600" />
        <span className="text-xs text-green-700">Confirmed</span>
      </div>
    </Card>
  );
}
