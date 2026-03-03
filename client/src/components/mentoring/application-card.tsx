import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { MentoringApplication } from "@shared/schema";

function ApplicationReviewDialog({ open, onOpenChange, action, applicationId, contactName, onConfirm, isPending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: "accept" | "decline" | "defer";
  applicationId: number;
  contactName: string;
  onConfirm: (id: number, notes?: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState("");
  const config = {
    accept: { title: "Accept Application", desc: `Accept ${contactName}'s mentoring application? This will create an active mentoring relationship.`, button: "Accept", variant: "default" as const },
    decline: { title: "Decline Application", desc: `Decline ${contactName}'s application? You can add a reason below.`, button: "Decline", variant: "destructive" as const },
    defer: { title: "Defer Application", desc: `Defer ${contactName}'s application to review later?`, button: "Defer", variant: "outline" as const },
  }[action];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Notes (optional)</Label>
          <Textarea
            placeholder={action === "accept" ? "Any notes about the match..." : action === "decline" ? "Reason for declining..." : "Why deferring, when to revisit..."}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            data-testid={`input-review-notes-${action}`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={config.variant}
            onClick={() => { onConfirm(applicationId, notes || undefined); onOpenChange(false); setNotes(""); }}
            disabled={isPending}
            data-testid={`button-confirm-${action}`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {config.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApplicationCard({ application, contacts, onAccept, onDecline, onDefer }: {
  application: MentoringApplication;
  contacts: any[];
  onAccept: (id: number, notes?: string) => void;
  onDecline: (id: number, notes?: string) => void;
  onDefer: (id: number, notes?: string) => void;
}) {
  const [reviewAction, setReviewAction] = useState<"accept" | "decline" | "defer" | null>(null);
  const contact = contacts.find((c: any) => c.id === application.contactId);
  return (
    <>
      <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-500/5" data-testid={`application-card-${application.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{contact?.name || "Unknown"}</h4>
              <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                {application.status === "pending" ? "Pending Review" : application.status}
              </Badge>
              {application.applicationDate && (
                <span className="text-[10px] text-muted-foreground">
                  Applied {new Date(application.applicationDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
            {application.ventureDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2">{application.ventureDescription}</p>
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
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" className="text-xs h-7" onClick={() => setReviewAction("accept")} data-testid={`button-accept-${application.id}`}>
              Accept
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setReviewAction("defer")} data-testid={`button-defer-${application.id}`}>
              Defer
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setReviewAction("decline")} data-testid={`button-decline-${application.id}`}>
              Decline
            </Button>
          </div>
        </div>
      </Card>
      {reviewAction && (
        <ApplicationReviewDialog
          open={!!reviewAction}
          onOpenChange={(v) => { if (!v) setReviewAction(null); }}
          action={reviewAction}
          applicationId={application.id}
          contactName={contact?.name || "Unknown"}
          onConfirm={(id, notes) => {
            if (reviewAction === "accept") onAccept(id, notes);
            else if (reviewAction === "decline") onDecline(id, notes);
            else onDefer(id, notes);
            setReviewAction(null);
          }}
          isPending={false}
        />
      )}
    </>
  );
}
