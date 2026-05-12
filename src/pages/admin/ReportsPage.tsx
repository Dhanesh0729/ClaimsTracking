import { useEffect, useMemo, useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseTable, PurchaseRow } from "@/components/purchases/PurchaseTable";
import { SelectionActionBar } from "@/components/purchases/SelectionActionBar";
import { Button } from "@/components/ui/button";
import { exportToExcel, ExportRow } from "@/lib/exportExcel";
import { exportToPdf } from "@/lib/exportPdf";
import { SkeletonTable } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;

export function AdminReportsPage() {
  const users = useQuery(api.users.getAll);
  const [userId, setUserId] = useState<string>("");
  const target = useMemo(
    () => (users ?? []).find((u) => u._id === userId) as Doc<"users"> | undefined,
    [users, userId],
  );

  const list = usePaginatedQuery(
    api.purchases.listByUser,
    userId ? { userId: userId as Id<"users"> } : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [userId]);

  const rows = (list.results ?? []) as PurchaseRow[];
  const selectedRows = rows.filter((r) => selected.has(r._id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = (cur: PurchaseRow[]) =>
    setSelected((s) => {
      const all = cur.every((r) => s.has(r._id));
      if (all) {
        const n = new Set(s);
        for (const r of cur) n.delete(r._id);
        return n;
      }
      const n = new Set(s);
      for (const r of cur) n.add(r._id);
      return n;
    });

  const doExport = (fn: typeof exportToExcel | typeof exportToPdf) => {
    if (!target) return;
    const data: ExportRow[] = selectedRows.map((r) => ({
      display_id: r.display_id,
      products_purchased: r.products_purchased,
      amount_spent: r.amount_spent,
      purchase_platform: r.purchase_platform,
      bank_used_to_pay: (r as any).bank_used_to_pay ?? "",
      upi_app_used_to_pay: (r as any).upi_app_used_to_pay ?? "",
      category: r.category,
      date_of_purchase: r.date_of_purchase,
      bill_received_time: (r as any).bill_received_time ?? Date.now(),
      status: r.status,
      bill_files: ((r as any).bill_files ?? []) as any,
    }));
    fn({
      rows: data,
      userName: target.name,
      uniqueCode: target.unique_code,
    });
    toast.success("Export started");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">User Reports</h1>
        <p className="text-sm text-muted-foreground">
          Select a user and export their purchase records
        </p>
      </div>

      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="max-w-md">
          <SelectValue placeholder="Choose a user..." />
        </SelectTrigger>
        <SelectContent>
          {(users ?? []).map((u) => (
            <SelectItem key={u._id} value={u._id}>
              {u.name} ({u.unique_code}) — {u.role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!userId ? (
        <div className="rounded border bg-card p-8 text-center text-sm text-muted-foreground">
          Select a user above to view and export their purchases.
        </div>
      ) : list.isLoading ? (
        <SkeletonTable />
      ) : (
        <>
          <PurchaseTable
            rows={rows}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />
          {list.status === "CanLoadMore" && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => list.loadMore(PAGE_SIZE)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <SelectionActionBar
        count={selected.size}
        onExportExcel={() => doExport(exportToExcel)}
        onExportPdf={() => doExport(exportToPdf)}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}
