import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/formatters";

export function BudgetProgressBar({
  spent,
  cap,
  className,
}: {
  spent: number;
  cap: number;
  className?: string;
}) {
  const percent = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0;
  const ratio = cap > 0 ? spent / cap : 0;
  let color = "bg-success";
  if (ratio >= 1) color = "bg-danger";
  else if (ratio >= 0.8) color = "bg-amber";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between items-baseline text-xs">
        <span className="text-muted-foreground">Budget</span>
        <span className="font-mono">
          {formatINR(spent)} / {formatINR(cap)}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded bg-secondary">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground font-mono text-right">
        {(ratio * 100).toFixed(1)}% used
      </div>
    </div>
  );
}
