import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MessageSquare, Calendar, Rocket, Shield, FileText, DollarSign, History } from "lucide-react";
import { format } from "date-fns";

export interface ActivityCardProps {
  item: { type: string; subType: string; date: string; title: string; details?: string; id: number };
}

export function ActivityCard({ item }: ActivityCardProps) {
  const iconMap: Record<string, { icon: any; color: string; bg: string }> = {
    interaction: { icon: MessageSquare, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    booking: { icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    programme: { icon: Rocket, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
    event: { icon: Calendar, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    membership: { icon: Shield, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
    mou: { icon: FileText, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
    community_spend: { icon: DollarSign, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    legacy_report: { icon: History, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  };

  const config = iconMap[item.type] || iconMap.interaction;
  const Icon = config.icon;

  return (
    <Card className="p-4" data-testid={`activity-item-${item.type}-${item.id}`}>
      <div className="flex gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-xs text-muted-foreground font-medium" data-testid={`activity-date-${item.id}`}>
              {format(new Date(item.date), 'MMM d, yyyy')}
            </p>
            {item.subType && (
              <Badge variant="secondary" className="text-xs" data-testid={`activity-subtype-${item.id}`}>
                {item.subType}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-sm" data-testid={`activity-title-${item.id}`}>{item.title}</p>
          {item.details && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`activity-details-${item.id}`}>{item.details}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
