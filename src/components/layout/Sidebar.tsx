import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  Bell,
  User,
  Users,
  FileBarChart,
  Activity,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"user" | "master" | "admin" | "super_admin">;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["user", "master", "admin", "super_admin"] },
  { to: "/purchases", label: "Purchases", icon: Receipt, roles: ["user", "master", "admin", "super_admin"] },
  { to: "/approvals", label: "Approvals", icon: CheckSquare, roles: ["master", "admin", "super_admin"] },
  { to: "/master/reports", label: "Reports", icon: FileBarChart, roles: ["master"] },
  { to: "/admin/users", label: "Users", icon: Users, roles: ["admin", "super_admin"] },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart, roles: ["admin", "super_admin"] },
  { to: "/admin/audit", label: "Audit Log", icon: Activity, roles: ["admin", "super_admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["user", "master", "admin", "super_admin"] },
  { to: "/profile", label: "Profile", icon: User, roles: ["user", "master", "admin", "super_admin"] },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const me = useQuery(api.users.getMe);
  const role = me?.role ?? "user";
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex-col bg-navy text-white border-r border-navy/30 flex transition-all overflow-y-auto",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-4 border-b border-white/10",
          collapsed && "justify-center",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-amber flex items-center justify-center">
              <Wallet className="h-4 w-4 text-navy" />
            </div>
            <span className="font-bold text-base">ClaimTrack</span>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded bg-amber flex items-center justify-center">
            <Wallet className="h-4 w-4 text-navy" />
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "text-white/70 hover:text-white p-1 rounded",
            collapsed && "absolute right-1 top-3",
          )}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        <TooltipProvider delayDuration={0}>
          {items.map((item) => {
            const Icon = item.icon;
            const linkInner = (
              <>
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </>
            );
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-white/80 hover:bg-white/10 hover:text-white transition",
                    collapsed && "justify-center",
                    isActive && "bg-white/15 text-white",
                  )
                }
              >
                {linkInner}
              </NavLink>
            );
            if (collapsed) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </TooltipProvider>
      </nav>
      <div className="px-3 py-3 border-t border-white/10 text-[10px] text-white/40">
        {!collapsed ? "v1.0" : ""}
      </div>
    </aside>
  );
}
