import { Button } from "@/components/ui/button";
import { useState } from "react";

export interface StagePromptProps {
  stage: string;
  interactionCount: number;
  connectionStrength?: string | null;
  contactId: number;
  onPromote: (stage: string) => void;
}

export function StagePrompt({ stage, interactionCount, connectionStrength, contactId, onPromote }: StagePromptProps) {
  const dismissKey = `stage-prompt-dismissed-${contactId}-${stage}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === "true");

  if (dismissed) return null;

  const connLevel = ["aware", "connected", "trusted", "woven"].indexOf(connectionStrength || "");
  let suggestion: { nextStage: string; label: string } | null = null;

  if (stage === "kakano" && interactionCount >= 3 && connLevel >= 2) {
    suggestion = { nextStage: "tipu", label: "Tipu" };
  } else if (stage === "tipu" && interactionCount >= 10 && connLevel >= 3) {
    suggestion = { nextStage: "ora", label: "Ora" };
  }

  if (!suggestion) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <span className="text-[11px] text-amber-700 dark:text-amber-300">Ready for {suggestion.label}?</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-5 text-[11px] px-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
        onClick={() => onPromote(suggestion!.nextStage)}
      >
        Move
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-5 text-[11px] px-1 text-muted-foreground"
        onClick={() => { localStorage.setItem(dismissKey, "true"); setDismissed(true); }}
      >
        Dismiss
      </Button>
    </div>
  );
}
