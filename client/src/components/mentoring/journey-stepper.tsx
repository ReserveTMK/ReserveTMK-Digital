import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { JOURNEY_STAGE_CONFIG } from "@/components/mentoring/mentoring-hooks";

export function JourneyStepper({ currentStage, compact }: { currentStage?: string; compact?: boolean }) {
  const stages = ["kakano", "tipu", "ora"];
  const currentIdx = stages.indexOf(currentStage || "");

  if (compact) {
    const config = JOURNEY_STAGE_CONFIG[currentStage || ""] || JOURNEY_STAGE_CONFIG.kakano;
    const StageIcon = config.icon;
    return (
      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${config.bgColor} ${config.color}`} data-testid="badge-journey-stage">
        <StageIcon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-0.5" data-testid="journey-stepper">
      {stages.map((stage, i) => {
        const config = JOURNEY_STAGE_CONFIG[stage];
        const StageIcon = config.icon;
        const isActive = i <= currentIdx;
        const isCurrent = stage === currentStage;
        return (
          <div key={stage} className="flex items-center">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${isCurrent ? `${config.bgColor} ${config.color} font-semibold border` : isActive ? `${config.color} opacity-60` : "text-muted-foreground opacity-40"}`}>
              <StageIcon className="w-3 h-3" />
              <span>{config.label}</span>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className={`w-3 h-3 mx-0.5 ${isActive ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
