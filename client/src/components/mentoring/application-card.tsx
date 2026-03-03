import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Loader2, Sprout, TreePine, Sun } from "lucide-react";
import { FREQUENCY_LABELS } from "@/components/mentoring/mentoring-hooks";
import { MENTORING_FOCUS_AREAS } from "@shared/schema";
import type { MentoringApplication } from "@shared/schema";

function ApplicationReviewDialog({ open, onOpenChange, action, applicationId, contactName, onConfirm, isPending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: "accept" | "decline" | "defer";
  applicationId: number;
  contactName: string;
  onConfirm: (id: number, notes?: string, extra?: { focusAreas?: string; sessionFrequency?: string; stage?: string }) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState("");
  const [stage, setStage] = useState("kakano");

  const toggleFocusArea = (area: string) => {
    setSelectedFocusAreas(prev => {
      if (prev.includes(area)) return prev.filter(a => a !== area);
      if (prev.length >= 3) return prev;
      return [...prev, area];
    });
  };

  const buildFocusString = () => {
    const parts = [...selectedFocusAreas];
    if (customFocus.trim()) parts.push(customFocus.trim());
    return parts.length > 0 ? parts.join(", ") : undefined;
  };

  const config = {
    accept: { title: "Accept Application", desc: `Accept ${contactName}'s mentoring application? Configure their mentoring relationship below.`, button: "Accept", variant: "default" as const },
    decline: { title: "Decline Application", desc: `Decline ${contactName}'s application? You can add a reason below.`, button: "Decline", variant: "destructive" as const },
    defer: { title: "Defer Application", desc: `Defer ${contactName}'s application to review later?`, button: "Defer", variant: "outline" as const },
  }[action];

  const stageOptions = [
    { id: "kakano", label: "Kakano", desc: "Seed", icon: Sprout, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800" },
    { id: "tipu", label: "Tipu", desc: "Growth", icon: TreePine, color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10 border-green-200 dark:border-green-800" },
    { id: "ora", label: "Ora", desc: "Thriving", icon: Sun, color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-500/10 border-sky-200 dark:border-sky-800" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={action === "accept" ? "sm:max-w-[500px] max-h-[85vh] overflow-y-auto" : "sm:max-w-[400px]"}>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {action === "accept" && (
            <>
              <div className="space-y-2">
                <Label>Journey Stage</Label>
                <div className="flex gap-2">
                  {stageOptions.map(s => {
                    const Icon = s.icon;
                    const isSelected = stage === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                          isSelected ? `${s.bg} ${s.color} border-current font-semibold` : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                        onClick={() => setStage(s.id)}
                        data-testid={`accept-stage-${s.id}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Session Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger data-testid="accept-select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Focus Areas (select up to 3)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MENTORING_FOCUS_AREAS.map(area => (
                    <button
                      key={area}
                      type="button"
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        selectedFocusAreas.includes(area)
                          ? "bg-primary text-primary-foreground border-primary"
                          : selectedFocusAreas.length >= 3
                            ? "bg-muted/50 text-muted-foreground border-border cursor-not-allowed opacity-50"
                            : "bg-background hover:bg-muted border-border"
                      }`}
                      onClick={() => toggleFocusArea(area)}
                      disabled={!selectedFocusAreas.includes(area) && selectedFocusAreas.length >= 3}
                      data-testid={`accept-focus-${area.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Other focus area (optional)"
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  className="mt-1.5"
                  data-testid="accept-input-custom-focus"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder={action === "accept" ? "Any notes about the match..." : action === "decline" ? "Reason for declining..." : "Why deferring, when to revisit..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid={`input-review-notes-${action}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={config.variant}
            onClick={() => {
              const extra = action === "accept" ? { focusAreas: buildFocusString(), sessionFrequency: frequency, stage } : undefined;
              onConfirm(applicationId, notes || undefined, extra);
              onOpenChange(false);
              setNotes("");
              setSelectedFocusAreas([]);
              setCustomFocus("");
              setFrequency("monthly");
              setStage("kakano");
            }}
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
  onAccept: (id: number, notes?: string, extra?: { focusAreas?: string; sessionFrequency?: string; stage?: string }) => void;
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
          onConfirm={(id, notes, extra) => {
            if (reviewAction === "accept") onAccept(id, notes, extra);
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
