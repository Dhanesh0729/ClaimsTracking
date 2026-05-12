import { AlertTriangle, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./button";
import { formatISTDate } from "@/lib/formatters";

export function DeletionWarningBanner({
  expiring,
}: {
  expiring: Array<{
    _id: string;
    display_id: number;
    products_purchased: string;
    scheduled_deletion_date?: number;
  }>;
}) {
  const nav = useNavigate();
  if (!expiring.length) return null;
  return (
    <div className="rounded border-l-4 border-amber bg-amber-50 dark:bg-amber-50/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-sm">
            ⚠ {expiring.length} bill{expiring.length === 1 ? "" : "s"} expiring soon
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            These records will be permanently deleted as per the 6-month retention policy.
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {expiring.slice(0, 5).map((p) => (
              <li key={p._id} className="font-mono">
                Bill #{p.display_id} — {p.products_purchased} —{" "}
                {p.scheduled_deletion_date
                  ? formatISTDate(p.scheduled_deletion_date)
                  : "—"}
              </li>
            ))}
            {expiring.length > 5 && (
              <li className="text-muted-foreground">+ {expiring.length - 5} more</li>
            )}
          </ul>
          <Button
            size="sm"
            variant="amber"
            className="mt-3"
            onClick={() => nav("/purchases")}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download Report
          </Button>
        </div>
      </div>
    </div>
  );
}
