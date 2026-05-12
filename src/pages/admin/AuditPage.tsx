import { useEffect, useMemo, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { Search, FileDown, ChevronDown, ChevronRight, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RoleBadge, Role } from "@/components/ui/role-badge";
import { SkeletonTable } from "@/components/ui/skeleton";
import { formatIST } from "@/lib/formatters";
import { exportAuditCsv } from "@/lib/exportAuditCsv";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const ACTION_TYPES = ["created", "edited", "deleted", "status_changed", "auto_deleted"];

export function AuditPage() {
  const [conflictOnly, setConflictOnly] = useState(false);
  const [actionFilters, setActionFilters] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fromTs = fromDate
    ? new Date(fromDate + "T00:00:00.000Z").getTime()
    : undefined;
  const toTs = toDate
    ? new Date(toDate + "T23:59:59.999Z").getTime()
    : undefined;

  const args = useMemo(
    () => ({
      conflictOnly: conflictOnly || undefined,
      actions: actionFilters.length > 0 ? actionFilters : undefined,
      fromTs,
      toTs,
    }),
    [conflictOnly, actionFilters, fromTs, toTs],
  );

  const list = usePaginatedQuery(api.auditLog.list, args, {
    initialNumItems: PAGE_SIZE,
  });
  const rows = list.results ?? [];

  useEffect(() => setSelected(new Set()), [JSON.stringify(args)]);

  const toggleAction = (a: string) =>
    setActionFilters((cur) =>
      cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a],
    );

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const handleExport = () => {
    const selectedRows = rows.filter((r) => selected.has(r._id));
    if (!selectedRows.length) {
      toast.error("Select rows to export");
      return;
    }
    exportAuditCsv(
      selectedRows.map((r) => ({
        timestamp: r.timestamp,
        action: r.action,
        purchase_id: r.purchase_id,
        performed_by_name: r.performed_by_name,
        performed_by_role: r.performed_by_role,
        conflict_flag: r.conflict_flag,
        changes: r.changes,
      })),
    );
    toast.success("CSV download started");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Full record of every create, edit, delete, and status change
        </p>
      </div>

      <div className="rounded border bg-card p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Actions</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ACTION_TYPES.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAction(a)}
                  className={cn(
                    "text-xs px-2 py-1 rounded border",
                    actionFilters.includes(a)
                      ? "bg-navy text-white border-navy"
                      : "bg-background hover:bg-secondary",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={conflictOnly}
            onCheckedChange={(v) => setConflictOnly(!!v)}
          />
          <Label className="text-sm">Show conflicts only</Label>
          {(actionFilters.length > 0 || fromDate || toDate || conflictOnly) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setActionFilters([]);
                setFromDate("");
                setToDate("");
                setConflictOnly(false);
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded bg-secondary border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="amber" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {list.isLoading ? (
        <SkeletonTable />
      ) : (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="p-2 w-8"></th>
                <th className="p-2 w-8">
                  <Checkbox
                    checked={rows.length > 0 && rows.every((r) => selected.has(r._id))}
                    onCheckedChange={() => {
                      if (rows.every((r) => selected.has(r._id))) {
                        setSelected(new Set());
                      } else {
                        setSelected(new Set(rows.map((r) => r._id)));
                      }
                    }}
                  />
                </th>
                <th className="p-2">Timestamp</th>
                <th className="p-2">Action</th>
                <th className="p-2">Performed By</th>
                <th className="p-2">Role</th>
                <th className="p-2">Conflict</th>
                <th className="p-2">Purchase</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No audit entries match filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const isOpen = expanded.has(r._id);
                return (
                  <>
                    <tr
                      key={r._id}
                      className={cn(
                        "border-t cursor-pointer hover:bg-secondary/30",
                        r.conflict_flag && "bg-amber-50",
                      )}
                    >
                      <td className="p-2">
                        <button
                          onClick={() => toggleExpand(r._id)}
                          aria-label="Expand"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-2">
                        <Checkbox
                          checked={selected.has(r._id)}
                          onCheckedChange={() => toggleSelect(r._id)}
                        />
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {formatIST(r.timestamp)}
                      </td>
                      <td className="p-2 text-xs">
                        <span className="font-mono uppercase">{r.action}</span>
                      </td>
                      <td className="p-2 text-xs">{r.performed_by_name}</td>
                      <td className="p-2">
                        {r.performed_by_role === "SYSTEM" ? (
                          <span className="text-xs font-mono">SYSTEM</span>
                        ) : (
                          <RoleBadge
                            role={r.performed_by_role as Role}
                            size="sm"
                          />
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        {r.conflict_flag ? (
                          <span className="text-amber font-bold">⚠ YES</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2 font-mono text-[10px]">{r.purchase_id.slice(-8)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t bg-secondary/20">
                        <td colSpan={8} className="p-3">
                          {r.conflict_flag && (
                            <div className="mb-2 text-xs text-amber font-semibold">
                              EDITED BY APPROVER — ADMIN REVIEW REQUIRED
                            </div>
                          )}
                          <pre className="text-[11px] font-mono whitespace-pre-wrap bg-card p-3 rounded border">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(r.changes), null, 2);
                              } catch {
                                return r.changes;
                              }
                            })()}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {list.status === "CanLoadMore" && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

void Search;
