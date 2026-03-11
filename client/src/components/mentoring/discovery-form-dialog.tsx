import { Button } from "@/components/ui/beautiful-button";
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
import { Loader2, Sprout, TreePine, Sun, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAnalyzeInteraction } from "@/hooks/use-interactions";
import { FREQUENCY_LABELS } from "@/components/mentoring/mentoring-hooks";
import { MENTORING_FOCUS_AREAS } from "@shared/schema";
import type { Meeting, MentoringApplication } from "@shared/schema";

const STAGE_OPTIONS = [
  { id: "kakano", label: "Kakano", desc: "Seed — early stage, exploring ideas", icon: Sprout, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800" },
  { id: "tipu", label: "Tipu", desc: "Growth — developing and building", icon: TreePine, color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10 border-green-200 dark:border-green-800" },
  { id: "ora", label: "Ora", desc: "Thriving — established and sustaining", icon: Sun, color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-500/10 border-sky-200 dark:border-sky-800" },
];

type Outcome = "accept" | "defer" | "decline" | null;

export function DiscoveryFormDialog({
  meeting,
  contactName,
  application,
  open,
  onOpenChange,
}: {
  meeting: Meeting;
  contactName: string;
  application: MentoringApplication;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const analyze = useAnalyzeInteraction();

  const [ventureDescription, setVentureDescription] = useState(application.ventureDescription || "");
  const [whatNeedHelp, setWhatNeedHelp] = useState(application.whatNeedHelpWith || "");
  const [stage, setStage] = useState("kakano");
  const [frequency, setFrequency] = useState("monthly");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState("");
  const [summary, setSummary] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);

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

  const debrief = useMutation({
    mutationFn: async (data: { transcript?: string; summary?: string; analysis?: any }) => {
      const res = await apiRequest("POST", `/api/meetings/${meeting.id}/debrief`, data);
      return res.json();
    },
  });

  const acceptApp = useMutation({
    mutationFn: async (data: { reviewNotes?: string; focusAreas?: string; sessionFrequency?: string; stage?: string }) => {
      const res = await apiRequest("POST", `/api/mentoring-applications/${application.id}/accept`, data);
      return res.json();
    },
  });

  const updateApp = useMutation({
    mutationFn: async (data: { status: string; reviewNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/mentoring-applications/${application.id}`, data);
      return res.json();
    },
  });

  const updateAppInfo = useMutation({
    mutationFn: async (data: { ventureDescription?: string; whatNeedHelpWith?: string }) => {
      const res = await apiRequest("PATCH", `/api/mentoring-applications/${application.id}`, data);
      return res.json();
    },
  });

  const isPending = debrief.isPending || acceptApp.isPending || updateApp.isPending || updateAppInfo.isPending || analyze.isPending;

  const handleSave = async () => {
    try {
      if (ventureDescription.trim() !== (application.ventureDescription || "") || whatNeedHelp.trim() !== (application.whatNeedHelpWith || "")) {
        await updateAppInfo.mutateAsync({
          ventureDescription: ventureDescription.trim() || undefined,
          whatNeedHelpWith: whatNeedHelp.trim() || undefined,
        });
      }

      if (summary.trim() || transcript.trim()) {
        if (transcript.trim()) {
          try {
            const analysis = await analyze.mutateAsync({ transcript, contactName } as any);
            await debrief.mutateAsync({ transcript, summary: summary || undefined, analysis });
          } catch {
            await debrief.mutateAsync({ transcript, summary: summary || undefined });
          }
        } else {
          await debrief.mutateAsync({ summary });
        }
      }

      if (outcome === "accept") {
        await acceptApp.mutateAsync({
          reviewNotes: notes || undefined,
          focusAreas: buildFocusString(),
          sessionFrequency: frequency,
          stage,
        });
        toast({ title: "Mentee accepted", description: `${contactName} has been accepted into the mentoring programme` });
      } else if (outcome === "defer") {
        await updateApp.mutateAsync({ status: "deferred", reviewNotes: notes || undefined });
        toast({ title: "Application deferred", description: `${contactName}'s application has been deferred` });
      } else if (outcome === "decline") {
        await updateApp.mutateAsync({ status: "declined", reviewNotes: notes || undefined });
        toast({ title: "Application declined", description: `${contactName}'s application has been declined` });
      } else {
        toast({ title: "Discovery notes saved", description: "You can make a decision later from the Mentees tab" });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/all-mentors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/debrief-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentoring-relationships/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discovery Session: {contactName}</DialogTitle>
          <DialogDescription>Capture what you learned and decide next steps</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">About Them</h4>
            <div className="space-y-2">
              <Label>Their venture / idea</Label>
              <Textarea
                placeholder="What are they working on or exploring?"
                value={ventureDescription}
                onChange={(e) => setVentureDescription(e.target.value)}
                rows={2}
                data-testid="input-discovery-venture"
              />
            </div>
            <div className="space-y-2">
              <Label>What they need help with</Label>
              <Textarea
                placeholder="Key areas they're looking for support..."
                value={whatNeedHelp}
                onChange={(e) => setWhatNeedHelp(e.target.value)}
                rows={2}
                data-testid="input-discovery-help"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session Notes</h4>
            <div className="space-y-2">
              <Label>Quick summary</Label>
              <Textarea
                placeholder="Brief overview of what was discussed..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                data-testid="input-discovery-summary"
              />
            </div>
            <div className="space-y-2">
              <Label>Full transcript (optional)</Label>
              <p className="text-[10px] text-muted-foreground">Paste for AI-powered analysis of mindset, skill, and confidence</p>
              <Textarea
                placeholder="Paste conversation transcript..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={4}
                data-testid="input-discovery-transcript"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcome</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                  outcome === "accept"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => setOutcome(outcome === "accept" ? null : "accept")}
                data-testid="button-outcome-accept"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                  outcome === "defer"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => setOutcome(outcome === "defer" ? null : "defer")}
                data-testid="button-outcome-defer"
              >
                <Clock className="w-3.5 h-3.5" /> Defer
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                  outcome === "decline"
                    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => setOutcome(outcome === "decline" ? null : "decline")}
                data-testid="button-outcome-decline"
              >
                <XCircle className="w-3.5 h-3.5" /> Not a fit
              </button>
            </div>

            {outcome === "accept" && (
              <div className="space-y-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-500/5">
                <div className="space-y-2">
                  <Label>Journey Stage</Label>
                  <div className="flex gap-2">
                    {STAGE_OPTIONS.map(s => {
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
                          data-testid={`discovery-stage-${s.id}`}
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
                    <SelectTrigger data-testid="discovery-select-frequency">
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
                  <Label>Focus Areas (up to 3)</Label>
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
                        data-testid={`discovery-focus-${area.toLowerCase().replace(/\s+/g, "-")}`}
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
                    data-testid="discovery-input-custom-focus"
                  />
                </div>
              </div>
            )}

            {(outcome === "defer" || outcome === "decline") && (
              <div className="space-y-2">
                <Label>{outcome === "defer" ? "Reason for deferring" : "Reason"}</Label>
                <Textarea
                  placeholder={outcome === "defer" ? "When to revisit, any notes..." : "Brief reason..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  data-testid="input-discovery-outcome-notes"
                />
              </div>
            )}

            {outcome === "accept" && (
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Any notes about the match..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  data-testid="input-discovery-accept-notes"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            data-testid="button-save-discovery"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {outcome === "accept" ? "Accept & Save" : outcome === "defer" ? "Defer & Save" : outcome === "decline" ? "Decline & Save" : "Save Notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
