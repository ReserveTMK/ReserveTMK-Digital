import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";

interface DismissPopoverProps {
  reasons: string[];
  onDismiss: (reason: string) => void;
  isPending?: boolean;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  testIdPrefix?: string;
}

export function DismissPopover({
  reasons,
  onDismiss,
  isPending,
  children,
  side = "bottom",
  align = "end",
  testIdPrefix = "dismiss",
}: DismissPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customReason, setCustomReason] = useState("");

  function handleReasonClick(reason: string) {
    onDismiss(reason);
    setOpen(false);
    setShowCustom(false);
    setCustomReason("");
  }

  function handleCustomSubmit() {
    if (!customReason.trim()) return;
    onDismiss(customReason.trim());
    setOpen(false);
    setShowCustom(false);
    setCustomReason("");
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setShowCustom(false); setCustomReason(""); } }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-52 p-1.5">
        {isPending ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {reasons.map((reason) => (
              <button
                key={reason}
                onClick={() => handleReasonClick(reason)}
                className="w-full text-left px-2.5 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                data-testid={`button-${testIdPrefix}-reason-${reason.toLowerCase().replace(/[\s']+/g, "-")}`}
              >
                {reason}
              </button>
            ))}
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-left px-2.5 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground cursor-pointer"
                data-testid={`button-${testIdPrefix}-reason-other`}
              >
                Other…
              </button>
            ) : (
              <div className="flex gap-1 p-1">
                <Input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); }}
                  placeholder="Custom reason..."
                  className="h-7 text-xs"
                  autoFocus
                  data-testid={`input-${testIdPrefix}-custom-reason`}
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCustomSubmit}
                  disabled={!customReason.trim()}
                  data-testid={`button-${testIdPrefix}-custom-submit`}
                >
                  OK
                </Button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
