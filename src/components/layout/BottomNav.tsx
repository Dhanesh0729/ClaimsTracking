import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  CheckSquare,
  User,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const me = useQuery(api.users.getMe);
  const isPrivileged =
    me?.role === "master" || me?.role === "admin" || me?.role === "super_admin";
  const nav = useNavigate();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-navy border-t border-white/10 flex justify-around py-2 lg:hidden">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-0.5 text-[10px] px-2",
            isActive ? "text-amber" : "text-white/70")
        }
      >
        <LayoutDashboard className="h-5 w-5" />
        <span>Dashboard</span>
      </NavLink>
      <NavLink
        to="/purchases"
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-0.5 text-[10px] px-2",
            isActive ? "text-amber" : "text-white/70")
        }
      >
        <Receipt className="h-5 w-5" />
        <span>Purchases</span>
      </NavLink>
      <button
        onClick={() => nav("/purchases/new")}
        className="flex flex-col items-center gap-0.5 text-[10px] text-white/90 px-2"
      >
        <PlusCircle className="h-7 w-7 text-amber" />
        <span>Add</span>
      </button>
      {isPrivileged ? (
        <NavLink
          to="/approvals"
          className={({ isActive }) =>
            cn("flex flex-col items-center gap-0.5 text-[10px] px-2",
              isActive ? "text-amber" : "text-white/70")
          }
        >
          <CheckSquare className="h-5 w-5" />
          <span>Approvals</span>
        </NavLink>
      ) : (
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            cn("flex flex-col items-center gap-0.5 text-[10px] px-2",
              isActive ? "text-amber" : "text-white/70")
          }
        >
          <CheckSquare className="h-5 w-5" />
          <span>Alerts</span>
        </NavLink>
      )}
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          cn("flex flex-col items-center gap-0.5 text-[10px] px-2",
            isActive ? "text-amber" : "text-white/70")
        }
      >
        <User className="h-5 w-5" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}
