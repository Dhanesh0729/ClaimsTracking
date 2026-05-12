import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { formatIST } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const nav = useNavigate();
  const unread = useQuery(api.notifications.unreadCount) ?? 0;
  const latest = useQuery(api.notifications.latest, { limit: 10 });
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-1.5 rounded hover:bg-accent transition"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold bg-danger text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-2 py-1.5 flex items-center justify-between">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <button
              className="text-xs text-info hover:underline"
              onClick={() => markAllRead({})}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!latest || latest.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {latest.map((n) => (
              <DropdownMenuItem
                key={n._id}
                className={cn(
                  "flex flex-col items-start py-2",
                  !n.is_read && "bg-amber-50/40",
                )}
                onClick={() => {
                  if (!n.is_read) markRead({ notificationId: n._id });
                  nav("/notifications");
                }}
              >
                <div className="text-xs font-semibold">{n.title}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">
                  {n.message}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-1">
                  {formatIST(n.created_at)}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-xs"
          onClick={() => nav("/notifications")}
        >
          View all →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
