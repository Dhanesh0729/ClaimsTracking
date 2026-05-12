import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { Check, X, Search, Crown, Shield, Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleBadge, Role } from "@/components/ui/role-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, formatIST } from "@/lib/formatters";
import { SkeletonTable } from "@/components/ui/skeleton";

export function UsersPage() {
  const me = useQuery(api.users.getMe);
  const users = useQuery(api.users.getAll);
  const requests = useQuery(api.roleRequests.getPendingRequests);

  const updateRole = useMutation(api.users.updateRole);
  const assignMaster = useMutation(api.users.assignMaster);
  const transferSuper = useMutation(api.users.transferSuperAdmin);
  const decide = useMutation(api.roleRequests.decideRequest);
  const setBudget = useMutation(api.budgets.setBudget);

  const [search, setSearch] = useState("");
  const [transferTarget, setTransferTarget] = useState<Doc<"users"> | null>(null);
  const [budgetUser, setBudgetUser] = useState<Doc<"users"> | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [decisionRequest, setDecisionRequest] = useState<any | null>(null);
  const [decisionApprove, setDecisionApprove] = useState(true);
  const [decisionNote, setDecisionNote] = useState("");

  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const budgets = useQuery(api.budgets.getAllBudgets, { month, year });

  const masters = useMemo(
    () => (users ?? []).filter((u) => u.role === "master"),
    [users],
  );
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users ?? [];
    return (users ?? []).filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.unique_code.toLowerCase().includes(q),
    );
  }, [users, search]);

  if (!users || !me) return <SkeletonTable />;

  const budgetByUser = new Map(budgets?.map((b) => [b.user_id, b]) ?? []);

  const canEditRole = (target: Doc<"users">): boolean => {
    if (target.role === "super_admin") return false;
    if (target.role === "admin" && me.role !== "super_admin") return false;
    return true;
  };

  const handleRoleChange = async (target: Doc<"users">, newRole: string) => {
    try {
      if (newRole === "transfer_super") {
        setTransferTarget(target);
        return;
      }
      await updateRole({
        userId: target._id,
        newRole: newRole as "admin" | "master" | "user",
      });
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const handleAssign = async (userId: Id<"users">, masterId: string) => {
    try {
      await assignMaster({
        userId,
        masterId: masterId === "__none__" ? null : (masterId as Id<"users">),
      });
      toast.success("Master assignment updated");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const saveBudget = async () => {
    if (!budgetUser) return;
    const val = parseFloat(budgetValue);
    if (isNaN(val) || val < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await setBudget({
        userId: budgetUser._id,
        month,
        year,
        budgetCap: val,
      });
      toast.success("Budget saved");
      setBudgetUser(null);
      setBudgetValue("");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const exportRegistry = () => {
    const data = users.map((u) => ({
      Name: u.name,
      Email: u.email,
      Mobile: u.mobile,
      Code: u.unique_code,
      Role: u.role,
      AssignedMaster:
        users.find((x) => x._id === u.assigned_master_id)?.name ?? "",
      JoinedOn: formatIST(u.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(
      wb,
      `${year}_${String(month).padStart(2, "0")}_UserRegistry_ClaimTrack.xlsx`,
    );
  };

  const submitDecision = async () => {
    if (!decisionRequest) return;
    if (!decisionApprove && !decisionNote.trim()) {
      toast.error("A note is required for rejection");
      return;
    }
    try {
      await decide({
        requestId: decisionRequest._id,
        approve: decisionApprove,
        note: decisionNote.trim() || undefined,
      });
      toast.success(decisionApprove ? "Approved" : "Rejected");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setDecisionRequest(null);
      setDecisionNote("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">User Registry</h1>
          <p className="text-sm text-muted-foreground">
            Manage roles, master assignments, and monthly budgets
          </p>
        </div>
        <Button variant="amber" onClick={exportRegistry}>
          <Download className="h-4 w-4 mr-1" />
          Export Registry
        </Button>
      </div>

      {requests && requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber" />
              Pending Role Requests ({requests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Requester</th>
                  <th className="text-left p-2">Code</th>
                  <th className="text-left p-2">Current</th>
                  <th className="text-left p-2">Requested</th>
                  <th className="text-left p-2">Submitted</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r._id} className="border-t">
                    <td className="p-2">{r.requester_name}</td>
                    <td className="p-2 font-mono text-xs">
                      {r.requester_unique_code}
                    </td>
                    <td className="p-2">
                      <RoleBadge role={r.current_role as Role} size="sm" />
                    </td>
                    <td className="p-2">
                      <RoleBadge role={r.requested_role as Role} size="sm" />
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {formatIST(r.created_at)}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => {
                            setDecisionRequest(r);
                            setDecisionApprove(true);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDecisionRequest(r);
                            setDecisionApprove(false);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or code..."
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="p-2">Name</th>
              <th className="p-2">Code</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Assigned Master</th>
              <th className="p-2 text-right">Budget ({month}/{year})</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const editable = canEditRole(u);
              const b = budgetByUser.get(u._id);
              return (
                <tr key={u._id} className="border-t">
                  <td className="p-2 font-medium">{u.name}</td>
                  <td className="p-2 font-mono text-xs">{u.unique_code}</td>
                  <td className="p-2 text-xs">{u.email}</td>
                  <td className="p-2">
                    {u.role === "super_admin" ? (
                      <RoleBadge role="super_admin" />
                    ) : editable ? (
                      <Select
                        value={u.role}
                        onValueChange={(v) => handleRoleChange(u, v)}
                      >
                        <SelectTrigger className="w-36 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="master">Master</SelectItem>
                          {me.role === "super_admin" && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                          {me.role === "super_admin" && u.role === "admin" && (
                            <SelectItem value="transfer_super">
                              Transfer Super…
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </td>
                  <td className="p-2">
                    {u.role === "user" ? (
                      <Select
                        value={u.assigned_master_id ?? "__none__"}
                        onValueChange={(v) => handleAssign(u._id, v)}
                      >
                        <SelectTrigger className="w-44 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {masters.map((m) => (
                            <SelectItem key={m._id} value={m._id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {u.role === "user" ? (
                      <button
                        onClick={() => {
                          setBudgetUser(u);
                          setBudgetValue(b ? String(b.budget_cap) : "");
                        }}
                        className="text-xs font-mono hover:underline"
                      >
                        {b ? formatINR(b.budget_cap) : "Set budget"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={transferTarget !== null}
        onOpenChange={(o) => !o && setTransferTarget(null)}
        title={`Transfer Super Admin to ${transferTarget?.name}?`}
        description="You will be demoted to Admin in the same transaction. This action is atomic."
        confirmLabel="Transfer Super Admin"
        destructive
        onConfirm={async () => {
          if (!transferTarget) return;
          try {
            await transferSuper({ targetUserId: transferTarget._id });
            toast.success("Super Admin transferred");
          } catch (e: any) {
            toast.error(String(e?.message ?? e));
          }
        }}
      />

      <Dialog
        open={budgetUser !== null}
        onOpenChange={(o) => !o && setBudgetUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Set Budget — {budgetUser?.name}
            </DialogTitle>
            <DialogDescription>
              Monthly cap for {month}/{year} (INR)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Budget Cap (₹)</Label>
            <Input
              type="number"
              min="0"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetUser(null)}>
              Cancel
            </Button>
            <Button variant="amber" onClick={saveBudget}>
              Save Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={decisionRequest !== null}
        onOpenChange={(o) => !o && setDecisionRequest(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {decisionApprove ? "Approve" : "Reject"} Role Request
            </DialogTitle>
            <DialogDescription>
              {decisionRequest?.requester_name} → {decisionRequest?.requested_role}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={
              decisionApprove
                ? "Optional note..."
                : "Reason for rejection (required)..."
            }
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionRequest(null)}>
              Cancel
            </Button>
            <Button
              variant={decisionApprove ? "success" : "destructive"}
              onClick={submitDecision}
            >
              {decisionApprove ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
