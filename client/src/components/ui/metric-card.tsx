import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
  color?: "primary" | "secondary" | "accent" | "green" | "blue";
}

export function MetricCard({
  title,
  value,
  trend,
  trendValue,
  icon,
  className,
  color = "primary",
}: MetricCardProps) {
  
  const colorStyles = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary text-secondary-foreground",
    accent: "bg-accent/10 text-accent-foreground",
    green: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
  };

  return (
    <div className={cn(
      "bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300",
      className
    )}>
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className={cn("p-2 rounded-lg", colorStyles[color])}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-3xl font-bold font-display tracking-tight text-foreground">
            {value}
          </h3>
        </div>
        
        {trend && (
          <div className={cn(
            "flex items-center text-xs font-medium px-2 py-1 rounded-full",
            trend === "up" && "text-emerald-600 bg-emerald-50",
            trend === "down" && "text-rose-600 bg-rose-50",
            trend === "neutral" && "text-muted-foreground bg-secondary"
          )}>
            {trend === "up" && <ArrowUp className="w-3 h-3 mr-1" />}
            {trend === "down" && <ArrowDown className="w-3 h-3 mr-1" />}
            {trend === "neutral" && <Minus className="w-3 h-3 mr-1" />}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}
