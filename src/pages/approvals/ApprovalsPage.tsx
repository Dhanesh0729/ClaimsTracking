import { useEffect, useMemo, useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Check, X, FileText, ExternalLink } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  formatINR,
  formatIST,
  formatISTDate,
  buildBillRef,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export function ApprovalsPage() {
  const me = useQuery(api.users.getMe);
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.purchases.listForApprovalQueue,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const updateStatus = useMutation(api.purchases.updateStatus);
  const bulkUpdate = useMutation(api.purchases.bulkUpdateStatus);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<Id<"purchases"> | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<
    "single" | "bulk" | null
  >(null);
  const [singleRejectId, setSingleRejectId] = useState<Id<"purchases"> | null>(null);

  const purchases = (results ?? []) as Doc<"purchases">[];

  const ownerIds = useMemo(
    () => Array.from(new Set(purchases.map((p) => p.user_id))),
    [purchases],
  );
  const ownersByIdQuery = useQuery(
    api.users.getAll,
    me && (me.role === "admin" || me.role === "super_admin")
      ? {}
      : "skip",
  );
  const masterAssignedQuery = useQuery(
    api.users.getMyAssignedUsers,
    me?.role === "master" ? {} : "skip",
  );
  const owners = ownersByIdQuery ?? masterAssignedQuery ?? [];
  const ownerMap = useMemo(() => {
    const m = new Map<string, { name: string; code: string; assigned_master_id?: string }>();
    for (const u of owners) {
      m.set(u._id, {
        name: u.name,
        code: u.unique_code,
        assigned_master_id: (u as any).assigned_master_id,
      });
    }
    return m;
  }, [owners]);

  useEffect(() => {
    setSelected(new Set());
  }, [purchases.length]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((s) => {
      const all = purchases.every((p) => s.has(p._id));
      if (all) return new Set();
      return new Set(purchases.map((p) => p._id));
    });

  const canApprove = (p: Doc<"purchases">): boolean => {
    if (!me) return false;
    if (me.role === "admin" || me.role === "super_admin") return true;
    if (me.role === "master") {
      if (p.edited_by_clerkId && p.edited_by_clerkId === me.clerkId) return false;
      return true;
    }
    return false;
  };

  const handleApprove = async (id: Id<"purchases">) => {
    try {
      await updateStatus({ purchaseId: id, newStatus: "approved" });
      toast.success("Approved");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("CONFLICT")) {
        toast.error("You edited this claim — an Admin must review it.");
      } else {
        toast.error(msg);
      }
    }
  };

  const submitRejection = async () => {
    if (!rejectNote.trim()) {
      toast.error("Rejection note is required");
      return;
    }
    try {
      if (rejectTarget === "single" && singleRejectId) {
        await updateStatus({
          purchaseId: singleRejectId,
          newStatus: "rejected",
          note: rejectNote.trim(),
        });
        toast.success("Rejected");
      } else if (rejectTarget === "bulk") {
        const res = await bulkUpdate({
          purchaseIds: Array.from(selected) as Id<"purchases">[],
          newStatus: "rejected",
          note: rejectNote.trim(),
        });
        const failed = res.filter((r: any) => !r.ok);
        toast.success(`Rejected ${res.length - failed.length}/${res.length}`);
        if (failed.length) {
          toast.error(`${failed.length} failed (conflicts or errors)`);
        }
        setSelected(new Set());
      }
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setRejectOpen(false);
      setRejectNote("");
      setRejectTarget(null);
      setSingleRejectId(null);
    }
  };

  const bulkApprove = async () => {
    try {
      const res = await bulkUpdate({
        purchaseIds: Array.from(selected) as Id<"purchases">[],
        newStatus: "approved",
      });
      const failed = res.filter((r: any) => !r.ok);
      toast.success(`Approved ${res.length - failed.length}/${res.length}`);
      if (failed.length) {
        toast.error(`${failed.length} conflicts skipped`);
      }
      setSelected(new Set());
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const detail = useMemo(
    () => purchases.find((p) => p._id === openId) ?? null,
    [purchases, openId],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Approval Queue</h1>
        <p className="text-sm text-muted-foreground">
          Pending claims awaiting your review
        </p>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded bg-secondary border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="success" onClick={bulkApprove}>
            <Check className="h-4 w-4 mr-1" /> Approve Selected
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setRejectTarget("bulk");
              setRejectOpen(true);
            }}
          >
            <X className="h-4 w-4 mr-1" /> Reject Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable />
      ) : (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="p-2 w-10">
                  <Checkbox
                    checked={
                      purchases.length > 0 &&
                      purchases.every((p) => selected.has(p._id))
                    }
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="p-2">User</th>
                <th className="p-2 w-20">Code</th>
                <th className="p-2">Product</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2">Category</th>
                <th className="p-2">Date</th>
                <th className="p-2">Files</th>
                <th className="p-2 w-8">⚠</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-muted-foreground">
                    No pending claims.
                  </td>
                </tr>
              )}
              {purchases.map((p) => {
                const owner = ownerMap.get(p.user_id);
                const conflictBlock = !canApprove(p);
                return (
                  <tr
                    key={p._id}
                    className={cn(
                      "border-t hover:bg-secondary/30",
                      selected.has(p._id) && "bg-amber-50/40",
                    )}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(p._id)}
                        onCheckedChange={() => toggle(p._id)}
                      />
                    </td>
                    <td className="p-2 text-xs font-medium">
                      <button
                        onClick={() => setOpenId(p._id)}
                        className="hover:underline text-left"
                      >
                        {owner?.name ?? "—"}
                      </button>
                    </td>
                    <td className="p-2 font-mono text-[10px]">
                      {owner?.code ?? ""}
                    </td>
                    <td className="p-2 max-w-xs truncate">
                      {p.products_purchased}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatINR(p.amount_spent)}
                    </td>
                    <td className="p-2">
                      <CategoryBadge category={p.category} />
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {formatISTDate(p.date_of_purchase)}
                    </td>
                    <td className="p-2">
                      {p.bill_files.length > 0 ? (
                        <span className="inline-flex items-center text-xs">
                          <FileText className="h-3 w-3 mr-0.5" />
                          {p.bill_files.length}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">
                      {p.is_duplicate_flagged && (
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
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {!conflictBlock ? (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApprove(p._id)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRejectTarget("single");
                                setSingleRejectId(p._id);
                                setRejectOpen(true);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="text-xs text-muted-foreground">
                                  Conflict
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                You edited this claim — Admin must review
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      )}

      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Claim Details</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">
                  Bill Reference
                </div>
                <div className="font-mono text-xs">
                  {buildBillRef(
                    detail.bill_received_time,
                    ownerMap.get(detail.user_id)?.name ?? "USER",
                    detail.display_id,
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product" value={detail.products_purchased} />
                <Field
                  label="Amount"
                  value={formatINR(detail.amount_spent)}
                  mono
                />
                <Field label="Platform" value={detail.purchase_platform} />
                <Field label="Bank" value={detail.bank_used_to_pay} />
                <Field label="UPI" value={detail.upi_app_used_to_pay} />
                <Field
                  label="Date"
                  value={formatISTDate(detail.date_of_purchase)}
                  mono
                />
                <Field label="Category" value={detail.category} />
                <Field
                  label="Submitted"
                  value={formatIST(detail.bill_received_time)}
                  mono
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Files ({detail.bill_files.length})
                </div>
                <div className="space-y-1">
                  {detail.bill_files.map((f: any, i: number) => (
                    <a
                      key={i}
                      href={f.convexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-xs text-info hover:underline"
                    >
                      {f.fileName}{" "}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ))}
                  {detail.bill_files.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      No files
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim{rejectTarget === "bulk" ? "s" : ""}</DialogTitle>
            <DialogDescription>
              A note is required when rejecting.
              {rejectTarget === "bulk" &&
                ` This note will apply to all ${selected.size} selected claims.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitRejection}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
