import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Star, Coffee } from "lucide-react";
import { formatRelativeDate } from "./ecosystem-views";

const STAGE_COLORS: Record<string, string> = {
  kakano: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  tipu: "bg-green-500/15 text-green-700 dark:text-green-300",
  ora: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  inactive: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

const CONNECTION_DOTS: Record<string, number> = {
  known: 1, connected: 2, engaged: 3, embedded: 4, partnering: 5,
};

export function ContactCardsView({ contacts, catchUpContactIds }: {
  contacts: any[];
  catchUpContactIds?: Set<number>;
}) {
  if (contacts.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="contact-cards-view">
      {contacts.map(contact => {
        const stage = contact.relationshipStage || contact.stage;
        const connLevel = CONNECTION_DOTS[contact.connectionStrength] || 0;
        const onCatchUp = catchUpContactIds?.has(contact.id);

        return (
          <Link key={contact.id} href={`/contacts/${contact.id}`} className="block">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-card/80 transition-all active:scale-[0.99]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold truncate">{contact.name}</span>
                  {contact.isVip && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                  {onCatchUp && <Coffee className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                  {contact.isRangatahi && (
                    <span className="text-[10px] font-bold text-emerald-600 border border-emerald-500/40 rounded px-0.5 leading-tight">R</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {contact.role && (
                    <span className="text-[11px] text-muted-foreground">{contact.role}</span>
                  )}
                  {stage && (
                    <Badge variant="outline" className={`text-[10px] h-4 px-1 ${STAGE_COLORS[stage] || ""}`}>
                      {stage.charAt(0).toUpperCase() + stage.slice(1)}
                    </Badge>
                  )}
                  {connLevel > 0 && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`w-2 h-1.5 rounded-sm ${i <= connLevel ? "bg-primary" : "bg-muted-foreground/15"}`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatRelativeDate(contact.lastActiveDate || contact.lastInteractionDate || null)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
