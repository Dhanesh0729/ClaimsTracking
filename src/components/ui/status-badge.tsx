import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

export type Status = "pending" | "approved" | "rejected" | "reimbursed";

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-500/40",
  approved: "bg-green-100 text-green-700 border-green-500/40",
  rejected: "bg-red-100 text-red-700 border-red-500/40",
  reimbursed: "bg-blue-100 text-blue-700 border-blue-500/40",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  reimbursed: "Reimbursed",
};

export function StatusBadge({
  status,
  note,
  className,
}: {
  status: Status;
  note?: string;
  className?: string;
}) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full text-xs px-2.5 py-0.5 font-mono font-medium border",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );

  if (status === "rejected" && note) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{note}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return badge;
}
