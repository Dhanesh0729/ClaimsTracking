import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  Hourglass,
  ChevronRight,
  Pencil,
  Trash2,
  CircleAlert,
} from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { StatusBadge, Status } from "../ui/status-badge";
import { CategoryBadge, Category } from "../ui/category-badge";
import { formatINR, formatISTDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Id } from "../../../convex/_generated/dataModel";

export type PurchaseRow = {
  _id: Id<"purchases">;
  display_id: number;
  products_purchased: string;
  amount_spent: number;
  purchase_platform: string;
  category: Category;
  date_of_purchase: number;
  bill_files: Array<{ fileName: string }>;
  status: Status;
  status_note?: string;
  is_duplicate_flagged: boolean;
  scheduled_deletion_date?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ExpiryCell({ scheduled }: { scheduled?: number }) {
  if (!scheduled) return <span className="text-muted-foreground">—</span>;
  const daysLeft = Math.ceil((scheduled - Date.now()) / DAY_MS);
  if (daysLeft > 30) return <span className="text-muted-foreground">—</span>;
  const imminent = daysLeft <= 7;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-xs",
              imminent ? "text-danger" : "text-amber",
            )}
          >
            {imminent ? (
              <CircleAlert className="h-3.5 w-3.5" />
            ) : (
              <Hourglass className="h-3.5 w-3.5" />
            )}
            {daysLeft}d
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {imminent
            ? `Deletion in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — download now`
            : `Deletes on ${formatISTDate(scheduled)}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PurchaseTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  ownerNames,
  showUser = false,
  highlightTerm,
  onEdit,
  onDelete,
  canMutate,
}: {
  rows: PurchaseRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (rows: PurchaseRow[]) => void;
  ownerNames?: Map<string, { name: string; code: string }>;
  showUser?: boolean;
  highlightTerm?: string;
  onEdit?: (id: Id<"purchases">) => void;
  onDelete?: (id: Id<"purchases">) => void;
  canMutate?: (row: PurchaseRow) => boolean;
}) {
  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r._id));
  const someSelected = !allSelected && rows.some((r) => selected.has(r._id));

  const highlight = (text: string): React.ReactNode => {
    if (!highlightTerm || highlightTerm.length < 2) return text;
    const idx = text.toLowerCase().indexOf(highlightTerm.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold bg-amber-100 text-navy">
          {text.slice(idx, idx + highlightTerm.length)}
        </span>
        {text.slice(idx + highlightTerm.length)}
      </>
    );
  };

  return (
    <div className="overflow-x-auto rounded border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr className="text-left text-xs text-muted-foreground uppercase">
            <th className="p-2 w-10">
              <Checkbox
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
                onCheckedChange={() => onToggleAll(rows)}
                aria-label="Select all"
              />
            </th>
            <th className="p-2 w-12">#</th>
            {showUser && <th className="p-2">User</th>}
            <th className="p-2">Product</th>
            <th className="p-2 text-right">Amount</th>
            <th className="p-2">Platform</th>
            <th className="p-2">Category</th>
            <th className="p-2">Date</th>
            <th className="p-2 w-12">Files</th>
            <th className="p-2 w-8">⚠</th>
            <th className="p-2">Status</th>
            <th className="p-2 w-16">Expiry</th>
            <th className="p-2 w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={showUser ? 13 : 12}
                className="p-6 text-center text-muted-foreground"
              >
                No purchases to show.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const scheduled = r.scheduled_deletion_date;
            const daysLeft = scheduled
              ? Math.ceil((scheduled - Date.now()) / DAY_MS)
              : Infinity;
            const rowClass =
              daysLeft <= 7
                ? "table-row-deletion-imminent"
                : daysLeft <= 30
                  ? "table-row-deletion-soon"
                  : "";
            const owner = ownerNames?.get(String(r._id));
            const canEdit =
              onEdit && canMutate && canMutate(r);
            return (
              <tr
                key={r._id}
                className={cn(
                  "border-t hover:bg-secondary/30",
                  rowClass,
                  selected.has(r._id) && "bg-amber-50/40",
                )}
              >
                <td className="p-2">
                  <Checkbox
                    checked={selected.has(r._id)}
                    onCheckedChange={() => onToggle(r._id)}
                    aria-label="Select row"
                  />
                </td>
                <td className="p-2 font-mono text-xs">#{r.display_id}</td>
                {showUser && (
                  <td className="p-2">
                    <div className="text-xs font-medium">
                      {owner?.name ?? "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {owner?.code ?? ""}
                    </div>
                  </td>
                )}
                <td className="p-2 max-w-xs truncate">
                  <Link
                    to={`/purchases/${r._id}`}
                    className="hover:underline"
                  >
                    {highlight(r.products_purchased)}
                  </Link>
                </td>
                <td className="p-2 text-right font-mono">
                  {formatINR(r.amount_spent)}
                </td>
                <td className="p-2 text-xs">{highlight(r.purchase_platform)}</td>
                <td className="p-2">
                  <CategoryBadge category={r.category} />
                </td>
                <td className="p-2 font-mono text-xs">
                  {formatISTDate(r.date_of_purchase)}
                </td>
                <td className="p-2 text-center">
                  {r.bill_files.length > 0 ? (
                    <span className="inline-flex items-center text-muted-foreground text-xs">
                      <FileText className="h-3.5 w-3.5 mr-0.5" />
                      {r.bill_files.length}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {r.is_duplicate_flagged && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-4 w-4 text-amber" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Possible duplicate — review carefully
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
                <td className="p-2">
                  <StatusBadge status={r.status} note={r.status_note} />
                </td>
                <td className="p-2">
                  <ExpiryCell scheduled={r.scheduled_deletion_date} />
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    {canEdit ? (
                      <>
                        <button
                          onClick={() => onEdit?.(r._id)}
                          className="p-1 hover:bg-secondary rounded"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {onDelete && (
                          <button
                            onClick={() => onDelete(r._id)}
                            className="p-1 hover:bg-secondary rounded text-danger"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      onEdit && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-muted-foreground text-xs">—</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Claim is locked after review
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    )}
                    <Link
                      to={`/purchases/${r._id}`}
                      className="p-1 hover:bg-secondary rounded"
                      title="View"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
