import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import type { Meeting, MentoringApplication } from "@shared/schema";

export function ApplicationCard({ application, contacts, meetings, onAccept, onDecline, isPending }: {
  application: MentoringApplication;
  contacts: any[];
  meetings?: Meeting[];
  onAccept: (id: number, notes?: string, extra?: { focusAreas?: string; sessionFrequency?: string; stage?: string }) => void;
  onDecline: (id: number, notes?: string) => void;
  isPending?: boolean;
}) {
  const contact = contacts.find((c: any) => c.id === application.contactId);

  const discoveryMeeting = meetings?.find(
    (m) => m.contactId === application.contactId && (m.status === "completed" || m.status === "confirmed" || m.status === "scheduled")
  );
  const hasCompletedSession = discoveryMeeting && discoveryMeeting.status === "completed";

  const [confirming, setConfirming] = useState<"onboard" | "decline" | null>(null);

  return (
    <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-500/5" data-testid={`application-card-${application.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{contact?.name || "Unknown"}</h4>
            <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-700 dark:text-blue-400">
              {application.status === "pending" ? "New" : application.status}
            </Badge>
            {hasCompletedSession && (
              <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                Discovery Done
              </Badge>
            )}
            {discoveryMeeting && !hasCompletedSession && (
              <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                Session Booked
              </Badge>
            )}
            {application.applicationDate && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(application.applicationDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {application.ventureDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2">{application.ventureDescription}</p>
          )}
          {application.whatNeedHelpWith && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Needs help with: </span>
              <span className="text-muted-foreground">{application.whatNeedHelpWith}</span>
            </div>
          )}
          {application.whatStuckOn && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Stuck on: </span>
              <span className="text-muted-foreground">{application.whatStuckOn}</span>
            </div>
          )}
          {application.whyMentoring && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Why mentoring: </span>
              <span className="text-muted-foreground">{application.whyMentoring}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {confirming === "onboard" ? (
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                className="text-xs h-7"
                disabled={isPending}
                onClick={() => {
                  onAccept(application.id, undefined, { stage: "kakano", sessionFrequency: "monthly" });
                }}
                data-testid={`button-confirm-onboard-${application.id}`}
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserCheck className="w-3 h-3 mr-1" />}
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setConfirming(null)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          ) : confirming === "decline" ? (
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-7"
                disabled={isPending}
                onClick={() => {
                  onDecline(application.id);
                }}
                data-testid={`button-confirm-decline-${application.id}`}
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setConfirming(null)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button size="sm" className="text-xs h-7" onClick={() => setConfirming("onboard")} data-testid={`button-onboard-${application.id}`}>
                <UserCheck className="w-3 h-3 mr-1" /> Onboard
              </Button>
              <button
                className="text-[10px] text-muted-foreground hover:text-red-600 hover:underline transition-colors text-right"
                onClick={() => setConfirming("decline")}
                data-testid={`button-not-proceeding-${application.id}`}
              >
                Not proceeding
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
