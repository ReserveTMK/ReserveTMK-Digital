import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function ScoreIndicator({ label, score, prevScore }: { label: string; score?: number; prevScore?: number }) {
  if (score === undefined || score === null) return null;
  const color = score >= 7 ? "text-green-600 dark:text-green-400" : score >= 4 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const trend = prevScore !== undefined && prevScore !== null ? (score > prevScore ? "up" : score < prevScore ? "down" : "flat") : null;
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-1 text-xs" data-testid={`score-${label.toLowerCase()}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{score}/10</span>
      {trend && <TrendIcon className={`w-3 h-3 ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`} />}
    </div>
  );
}
