import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseTable, PurchaseRow } from "@/components/purchases/PurchaseTable";
import { SelectionActionBar } from "@/components/purchases/SelectionActionBar";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { exportToExcel, ExportRow } from "@/lib/exportExcel";
import { exportToPdf } from "@/lib/exportPdf";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PurchasesPage() {
  const nav = useNavigate();
  const me = useQuery(api.users.getMe);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "reimbursed">("all");
  const debouncedSearch = useDebounced(search, 300);
  const searchActive = debouncedSearch.trim().length >= 2;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<Id<"purchases"> | null>(null);
  const del = useMutation(api.purchases.deletePurchase);

  const listed = usePaginatedQuery(
    api.purchases.listMine,
    searchActive ? "skip" : { status: statusFilter === "all" ? undefined : statusFilter },
    { initialNumItems: PAGE_SIZE },
  );

  const searched = usePaginatedQuery(
    api.purchases.search,
    searchActive ? { queryText: debouncedSearch, field: "products" } : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  const activeQuery = searchActive ? searched : listed;
  const rows = (activeQuery.results ?? []) as PurchaseRow[];

  useEffect(() => {
    setSelected(new Set());
  }, [debouncedSearch, statusFilter]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = (currentRows: PurchaseRow[]) => {
    setSelected((s) => {
      const allCurrentlySelected = currentRows.every((r) => s.has(r._id));
      if (allCurrentlySelected) {
        const n = new Set(s);
        for (const r of currentRows) n.delete(r._id);
        return n;
      }
      const n = new Set(s);
      for (const r of currentRows) n.add(r._id);
      return n;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r._id)),
    [rows, selected],
  );

  const doExport = (fn: typeof exportToExcel | typeof exportToPdf) => {
    if (!me) return;
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
    fn({ rows: data, userName: me.name, uniqueCode: me.unique_code });
    toast.success("Export started");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await del({ purchaseId: deleteId });
      toast.success("Purchase deleted");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">My Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track your reimbursement claims
          </p>
        </div>
        <Button variant="amber" onClick={() => nav("/purchases/new")}>
          <Plus className="h-4 w-4 mr-1" />
          Add Purchase
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative flex-1 min-w-[260px]">
                {searched.isLoading && searchActive ? (
                  <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products (min 2 chars)..."
                  className="pl-9 pr-9"
                  disabled={statusFilter !== "all" && false}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </TooltipTrigger>
            {statusFilter !== "all" && search && (
              <TooltipContent>Clear status filter to search</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as any)}
                  disabled={searchActive}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="reimbursed">Reimbursed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            {searchActive && (
              <TooltipContent>Clear search to use filter</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {searchActive && (
        <div className="text-xs text-muted-foreground">
          Showing {rows.length} result{rows.length === 1 ? "" : "s"} for "
          {debouncedSearch}"
        </div>
      )}

      {activeQuery.isLoading ? (
        <SkeletonTable />
      ) : (
        <PurchaseTable
          rows={rows}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          highlightTerm={searchActive ? debouncedSearch : undefined}
          canMutate={(r) => r.status === "pending"}
          onEdit={(id) => nav(`/purchases/${id}`)}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      {!searchActive && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={activeQuery.status !== "CanLoadMore"}
            onClick={() => activeQuery.loadMore(PAGE_SIZE)}
          >
            <ChevronRight className="h-4 w-4 mr-1" />
            Load more
          </Button>
        </div>
      )}

      <SelectionActionBar
        count={selected.size}
        onExportExcel={() => doExport(exportToExcel)}
        onExportPdf={() => doExport(exportToPdf)}
        onClear={() => setSelected(new Set())}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this purchase?"
        description="This action cannot be undone. Files will also be deleted from storage."
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
