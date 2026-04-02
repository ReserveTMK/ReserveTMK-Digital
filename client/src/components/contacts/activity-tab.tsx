import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Mic, Check, History, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { TimelineCard } from "./timeline-card";
import { ActivityCard } from "./activity-card";

export interface TimelineItem {
  date: Date;
  type: 'impact_log' | 'action_item' | 'interaction' | 'consent' | 'programme_registration';
  data: any;
}

export interface ActivityTabProps {
  interactions: any[] | undefined;
  interactionsLoading: boolean;
  programmeRegistrations: any[] | undefined;
  timelineItems: TimelineItem[];
  activityData: any;
  activityLoading: boolean;
}

export function ActivityTab({
  interactions,
  interactionsLoading,
  programmeRegistrations,
  timelineItems,
  activityData,
  activityLoading,
}: ActivityTabProps) {
  return (
    <>
      {/* Programme registrations */}
      {programmeRegistrations && programmeRegistrations.length > 0 && (
        <Card className="p-4" data-testid="programme-registrations-section">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
            <ClipboardList className="w-3.5 h-3.5 text-purple-500" />
            Programmes
          </h4>
          <div className="space-y-1.5">
            {programmeRegistrations.map((reg: any) => (
              <div key={reg.id} className="flex items-center gap-2 text-xs" data-testid={`programme-reg-${reg.id}`}>
                {reg.attended ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <ClipboardList className="w-3 h-3 text-purple-500 shrink-0" />}
                <span className="font-medium truncate">{reg.programmeName}</span>
                <span className="text-muted-foreground shrink-0">{format(new Date(reg.registeredAt), 'MMM d')}</span>
                <Badge variant="secondary" className={`text-[9px] shrink-0 px-1.5 py-0 ${
                  reg.attended ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  reg.status === 'cancelled' ? 'bg-red-500/15 text-red-700' :
                  'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                }`}>{reg.attended ? 'Attended' : reg.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Interactions */}
      {interactions && interactions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Mic className="w-3.5 h-3.5" />
            Interactions ({interactions.length})
          </h4>
          {interactions.map((interaction) => (
            <Card key={interaction.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{interaction.type}</span>
                  <p className="text-sm font-semibold">{format(new Date(interaction.date), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex gap-1.5">
                  {interaction.analysis?.keyInsights?.map((insight: string, i: number) => (
                    <span key={i} className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-medium">{insight}</span>
                  ))}
                </div>
              </div>
              {(interaction.summary || interaction.transcript) && (
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">{interaction.summary || interaction.transcript}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Timeline events */}
      {timelineItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <History className="w-3.5 h-3.5" />
            Timeline
          </h4>
          {timelineItems.map((item, idx) => (
            <TimelineCard key={`${item.type}-${item.data.id}-${idx}`} item={item} />
          ))}
        </div>
      )}

      {/* Cross-system activity */}
      {activityLoading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" data-testid="activity-loading" />
      ) : activityData && (activityData as any[]).length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" data-testid="activity-summary">
            {(() => {
              const counts: Record<string, number> = {};
              (activityData as any[]).forEach((item: any) => { counts[item.type] = (counts[item.type] || 0) + 1; });
              const labels: Record<string, string> = { interaction: 'Interactions', booking: 'Venue Hire', programme: 'Programmes', event: 'Events', membership: 'Memberships', mou: 'MOUs', community_spend: 'Spend', legacy_report: 'Legacy' };
              return Object.entries(counts).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-[10px]">{count} {labels[type] || type}</Badge>
              ));
            })()}
          </div>
          <div className="space-y-2">
            {(activityData as any[]).map((item: any, idx: number) => (
              <ActivityCard key={`${item.type}-${item.id}-${idx}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!interactionsLoading && (!interactions || interactions.length === 0) && timelineItems.length === 0 && (!activityData || (activityData as any[]).length === 0) && (!programmeRegistrations || programmeRegistrations.length === 0) && (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border" data-testid="activity-empty">
          No activity recorded yet.
        </div>
      )}
    </>
  );
}
