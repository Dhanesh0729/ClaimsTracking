import { usePaginatedQuery, useMutation } from "convex/react";
import {
  Bell,
  Check,
  X,
  Wallet,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/ui/skeleton";
import { formatIST } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  claim_approved: Check,
  claim_rejected: X,
  claim_reimbursed: Wallet,
  budget_warning: AlertTriangle,
  budget_exceeded: AlertTriangle,
  deletion_warning: AlertTriangle,
  deletion_complete: Trash2,
  role_request_received: Inbox,
  role_request_approved: ShieldCheck,
  role_request_rejected: ShieldCheck,
};

const TYPE_COLORS: Record<string, string> = {
  claim_approved: "text-success bg-green-100",
  claim_rejected: "text-danger bg-red-100",
  claim_reimbursed: "text-info bg-blue-100",
  budget_warning: "text-amber bg-amber-100",
  budget_exceeded: "text-danger bg-red-100",
  deletion_warning: "text-amber bg-amber-100",
  deletion_complete: "text-muted-foreground bg-secondary",
  role_request_received: "text-info bg-blue-100",
  role_request_approved: "text-success bg-green-100",
  role_request_rejected: "text-danger bg-red-100",
};

export function NotificationsPage() {
  const list = usePaginatedQuery(
    api.notifications.listMine,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const rows = list.results ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Updates on claims, budgets, deletions, and role requests
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => markAllRead({})}>
          Mark all read
        </Button>
      </div>

      {list.isLoading ? (
        <SkeletonTable />
      ) : rows.length === 0 ? (
        <div className="rounded border bg-card p-10 text-center">
          <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">No notifications yet</div>
        </div>
      ) : (
        <div className="rounded border bg-card divide-y">
          {rows.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            return (
              <button
                key={n._id}
                onClick={() => {
                  if (!n.is_read) markRead({ notificationId: n._id });
                }}
                className={cn(
                  "w-full text-left p-3 flex gap-3 hover:bg-secondary/30 transition",
                  !n.is_read && "bg-amber-50/40",
                )}
              >
                <div
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                    TYPE_COLORS[n.type] ?? "bg-secondary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {n.title}
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                      {formatIST(n.created_at)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {n.message}
                  </div>
                </div>
              </button>
            );
          })}
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
