import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import {
  Pencil,
  Trash2,
  MoreVertical,
  Eye,
  FileText,
  AlertCircle,
  Clock,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow, isPast } from "date-fns";
import type { Funder } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  active_funder: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  in_conversation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pending_eoi: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  applied: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  radar: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  active_funder: "Active",
  in_conversation: "In Conversation",
  pending_eoi: "Pending EOI",
  applied: "Applied",
  radar: "Radar",
  completed: "Completed",
};

const FIT_TAG_COLORS: Record<string, string> = {
  maori: "bg-orange-100 text-orange-700",
  youth: "bg-pink-100 text-pink-700",
  enterprise: "bg-blue-100 text-blue-700",
  arts: "bg-purple-100 text-purple-700",
  placemaking: "bg-teal-100 text-teal-700",
  community: "bg-green-100 text-green-700",
  pasifika: "bg-cyan-100 text-cyan-700",
  innovation: "bg-indigo-100 text-indigo-700",
};

const OUTCOME_FOCUS_LABELS: Record<string, { label: string; description: string }> = {
  economic: { label: "Economic", description: "Jobs, revenue, businesses" },
  wellbeing: { label: "Wellbeing", description: "Growth, confidence, mindset" },
  cultural: { label: "Cultural", description: "Te reo, tikanga, whanaungatanga" },
  community: { label: "Community", description: "Connections, network, engagement" },
};

const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  adhoc: "Ad Hoc",
  on_completion: "On Completion",
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
  return `$${amount}`;
}

export function FunderCard({
  funder,
  onView,
  onEdit,
  onDelete,
  onGenerateReport,
}: {
  funder: Funder;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGenerateReport: () => void;
}) {
  const deadlineWarning = funder.nextDeadline && isPast(new Date(funder.nextDeadline));

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow cursor-pointer border"
      onClick={onView}
      data-testid={`card-funder-${funder.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
            {funder.isDefault && (
              <Badge variant="outline" className="text-xs shrink-0">Default</Badge>
            )}
          </div>
          {funder.organisation && funder.organisation.toLowerCase() !== funder.name.toLowerCase() && (
            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={STATUS_COLORS[funder.status] || STATUS_COLORS.in_conversation} data-testid={`badge-status-${funder.id}`}>
              {STATUS_LABELS[funder.status] || funder.status}
            </Badge>
            {funder.reportingCadence && (
              <span className="text-xs text-muted-foreground">
                {CADENCE_LABELS[funder.reportingCadence] || funder.reportingCadence}
              </span>
            )}
            {funder.outcomeFocus && Array.isArray(funder.outcomeFocus) && funder.outcomeFocus.length > 0 && funder.outcomeFocus.map(f => (
              <Badge key={f} variant="outline" className="text-xs" data-testid={`badge-outcome-${f}-${funder.id}`}>
                {OUTCOME_FOCUS_LABELS[f]?.label || f}
              </Badge>
            ))}
            {funder.outcomeFocus && typeof funder.outcomeFocus === "string" && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={funder.outcomeFocus}>
                {funder.outcomeFocus.split("\n")[0].substring(0, 60)}{funder.outcomeFocus.length > 60 ? "..." : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {funder.nextDeadline && (
            <div className={`text-xs text-right ${deadlineWarning ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              {deadlineWarning && <AlertCircle className="w-3 h-3 inline mr-1" />}
              {formatDistanceToNow(new Date(funder.nextDeadline), { addSuffix: true })}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-menu-${funder.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="w-4 h-4 mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onGenerateReport(); }}>
                <FileText className="w-4 h-4 mr-2" /> Generate Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

export function ActiveFunderCard({
  funder,
  onView,
  onEdit,
  onDelete,
  onGenerateReport,
}: {
  funder: Funder;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGenerateReport: () => void;
}) {
  const contractProgress = useMemo(() => {
    if (!funder.contractStart || !funder.contractEnd) return null;
    const start = new Date(funder.contractStart).getTime();
    const end = new Date(funder.contractEnd).getTime();
    const now = Date.now();
    const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    return Math.round(pct);
  }, [funder.contractStart, funder.contractEnd]);

  const contractPeriod = useMemo(() => {
    if (!funder.contractStart || !funder.contractEnd) return null;
    return `${format(new Date(funder.contractStart), "MMM yyyy")} — ${format(new Date(funder.contractEnd), "MMM yyyy")}`;
  }, [funder.contractStart, funder.contractEnd]);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border" onClick={onView}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
            {funder.estimatedValue && (
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{formatCurrency(funder.estimatedValue)}/yr</span>
            )}
          </div>
          {funder.organisation && funder.organisation.toLowerCase() !== funder.name.toLowerCase() && (
            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {contractPeriod && (
              <span className="text-xs text-muted-foreground">{contractPeriod}</span>
            )}
            {contractProgress !== null && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${contractProgress}%` }} />
                </div>
                <span className="text-muted-foreground">{contractProgress}%</span>
              </div>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onGenerateReport(); }}>
              <FileText className="w-4 h-4 mr-2" /> Generate Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

export function PipelineCard({
  funder,
  onView,
  onEdit,
  onDelete,
}: {
  funder: Funder;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deadlineSoon = funder.applicationDeadline && !isPast(new Date(funder.applicationDeadline));
  const deadlinePast = funder.applicationDeadline && isPast(new Date(funder.applicationDeadline));

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border" onClick={onView}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{funder.name}</h3>
            <Badge className={STATUS_COLORS[funder.status]}>{STATUS_LABELS[funder.status]}</Badge>
          </div>
          {funder.organisation && funder.organisation.toLowerCase() !== funder.name.toLowerCase() && (
            <p className="text-sm text-muted-foreground truncate">{funder.organisation}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {funder.estimatedValue && (
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                <DollarSign className="w-3 h-3 inline" />{formatCurrency(funder.estimatedValue)}
              </span>
            )}
            {deadlineSoon && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                <Clock className="w-3 h-3 inline mr-0.5" />
                Deadline {formatDistanceToNow(new Date(funder.applicationDeadline!), { addSuffix: true })}
              </span>
            )}
            {deadlinePast && (
              <span className="text-xs text-red-600">
                <AlertCircle className="w-3 h-3 inline mr-0.5" /> Deadline passed
              </span>
            )}
            {funder.fitTags && funder.fitTags.length > 0 && funder.fitTags.map(tag => (
              <Badge key={tag} className={`text-xs ${FIT_TAG_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>{tag}</Badge>
            ))}
          </div>
          {funder.nextAction && (
            <p className="text-xs text-muted-foreground mt-1.5">
              <ArrowRight className="w-3 h-3 inline mr-0.5" /> {funder.nextAction}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

export function RadarRow({
  funder,
  onView,
  onMoveToPipeline,
  onDelete,
}: {
  funder: Funder;
  onView: () => void;
  onMoveToPipeline: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-3 hover:shadow-sm transition-shadow cursor-pointer border" onClick={onView}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{funder.name}</span>
            {funder.estimatedValue && (
              <span className="text-xs text-muted-foreground">{formatCurrency(funder.estimatedValue)}</span>
            )}
            {funder.fitTags && funder.fitTags.length > 0 && funder.fitTags.map(tag => (
              <Badge key={tag} className={`text-xs ${FIT_TAG_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>{tag}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {funder.notes && (
              <p className="text-xs text-muted-foreground truncate">{funder.notes}</p>
            )}
            {funder.applicationDeadline && (
              <span className="text-xs text-muted-foreground shrink-0">
                {isPast(new Date(funder.applicationDeadline))
                  ? "Next round TBC"
                  : `Opens ${format(new Date(funder.applicationDeadline), "d MMM yyyy")}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onMoveToPipeline(); }}>
            <ArrowRight className="w-3 h-3 mr-1" /> Pipeline
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
