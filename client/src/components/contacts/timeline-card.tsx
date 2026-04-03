import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, CheckSquare, Calendar, Clock, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export interface TimelineCardProps {
  item: { date: Date; type: string; data: any };
}

export function TimelineCard({ item }: TimelineCardProps) {
  const iconMap: Record<string, { icon: any; color: string; label: string }> = {
    impact_log: { icon: FileText, color: "text-violet-500", label: "Impact Log" },
    action_item: { icon: CheckSquare, color: "text-blue-500", label: "Action Item" },
    interaction: { icon: Calendar, color: "text-emerald-500", label: "Interaction" },
    programme_registration: { icon: ClipboardList, color: "text-purple-500", label: "Programme" },
  };

  const config = iconMap[item.type] || iconMap.interaction;
  const Icon = config.icon;

  return (
    <Card className="p-4" data-testid={`timeline-item-${item.type}-${item.data.id}`}>
      <div className="flex gap-4">
        <div className="shrink-0 text-right min-w-[80px]">
          <p className="text-xs text-muted-foreground font-medium">
            {format(item.date, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {format(item.date, 'h:mm a')}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="w-px flex-1 bg-border mt-1" />
        </div>
        <div className="flex-1 min-w-0 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {config.label}
          </p>

          {item.type === 'impact_log' && (
            <Link href={`/debriefs?id=${item.data.id}`} className="block hover-elevate rounded-md -m-1 p-1" data-testid={`link-debrief-${item.data.id}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{item.data.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {item.data.status}
                </Badge>
                {item.data.linkRole && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.data.linkRole}
                  </Badge>
                )}
                {item.data.sentiment && (
                  <Badge variant="outline" className="text-xs">
                    {item.data.sentiment}
                  </Badge>
                )}
              </div>
              {item.data.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2">{item.data.summary}</p>
              )}
            </Link>
          )}

          {item.type === 'action_item' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{item.data.title}</span>
                <Badge variant="secondary" className={`text-xs ${
                  item.data.status === 'completed' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  item.data.status === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  ''
                }`}>
                  {item.data.status}
                </Badge>
              </div>
              {item.data.dueDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Due: {format(new Date(item.data.dueDate), 'MMM d, yyyy')}
                </p>
              )}
              {item.data.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.data.description}</p>
              )}
            </div>
          )}

          {item.type === 'interaction' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{item.data.type}</span>
              </div>
              {(item.data.summary || item.data.transcript) && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {item.data.summary || item.data.transcript}
                </p>
              )}
              {item.data.analysis && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {item.data.analysis.mindsetScore != null && (
                    <span className="text-muted-foreground">Mindset: <span className="font-semibold text-primary">{item.data.analysis.mindsetScore}</span></span>
                  )}
                  {item.data.analysis.skillScore != null && (
                    <span className="text-muted-foreground">Skill: <span className="font-semibold">{item.data.analysis.skillScore}</span></span>
                  )}
                  {item.data.analysis.confidenceScore != null && (
                    <span className="text-muted-foreground">Confidence: <span className="font-semibold text-amber-500">{item.data.analysis.confidenceScore}</span></span>
                  )}
                </div>
              )}
            </div>
          )}

          {item.type === 'consent' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="secondary" className={`text-xs ${
                  item.data.action === 'given' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  item.data.action === 'withdrawn' ? 'bg-red-500/15 text-red-700 dark:text-red-300' :
                  item.data.action === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  ''
                }`}>
                  {item.data.action}
                </Badge>
              </div>
              {item.data.notes && (
                <p className="text-sm text-muted-foreground">{item.data.notes}</p>
              )}
            </div>
          )}

          {item.type === 'programme_registration' && (
            <div>
              <p className="font-semibold text-sm" data-testid={`timeline-programme-reg-${item.data.id}`}>
                {item.data.attended ? 'Attended' : 'Registered for'} {item.data.programmeName}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge variant="secondary" className={`text-xs ${
                  item.data.attended ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  item.data.status === 'cancelled' ? 'bg-red-500/15 text-red-700 dark:text-red-300' :
                  item.data.status === 'waitlisted' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                }`}>
                  {item.data.attended ? 'Attended' : item.data.status}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
