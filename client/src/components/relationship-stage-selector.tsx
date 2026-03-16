import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JOURNEY_STAGE_CONFIG } from "@/components/mentoring/mentoring-hooks";

const STAGES = [
  { key: "kakano", label: JOURNEY_STAGE_CONFIG.kakano.label },
  { key: "tipu", label: JOURNEY_STAGE_CONFIG.tipu.label },
  { key: "ora", label: JOURNEY_STAGE_CONFIG.ora.label },
  { key: "inactive", label: JOURNEY_STAGE_CONFIG.inactive.label },
];

interface RelationshipStageSelectorProps {
  currentStage: string;
  onStageChange: (stage: string) => void;
  disabled?: boolean;
}

export function RelationshipStageSelector({
  currentStage,
  onStageChange,
  disabled = false,
}: RelationshipStageSelectorProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-0" data-testid="relationship-stage-selector">
      {STAGES.map((stage, index) => {
        const isActive = stage.key === currentStage;
        const isPast = index < currentIndex;
        const config = JOURNEY_STAGE_CONFIG[stage.key];

        return (
          <div key={stage.key} className="flex items-center">
            {index > 0 && (
              <div
                className={cn(
                  "w-6 h-0.5",
                  isPast || isActive ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onStageChange(stage.key)}
              data-testid={`stage-pill-${stage.key}`}
              className="focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={cn(
                  "cursor-pointer transition-colors text-xs whitespace-nowrap",
                  isActive && `${config.bgColor} ${config.color} border no-default-hover-elevate`,
                  !isActive && isPast && "bg-muted text-muted-foreground",
                  !isActive && !isPast && "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
                    isActive ? "bg-primary" : isPast ? "bg-muted-foreground/50" : "bg-border"
                  )}
                />
                {stage.label}
              </Badge>
            </button>
          </div>
        );
      })}
    </div>
  );
}
