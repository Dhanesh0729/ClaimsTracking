import { UserButton } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { Moon, Sun, Wallet } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { RoleBadge } from "../ui/role-badge";
import { NotificationBell } from "./NotificationBell";

export function Navbar({ mobile = false }: { mobile?: boolean }) {
  const me = useQuery(api.users.getMe);
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("claimtrack-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("claimtrack-theme", "light");
    }
  };

  return (
    <header className="bg-card border-b border-border h-14 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shadow-soft">
      <div className="flex items-center gap-2">
        {mobile && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-navy flex items-center justify-center">
              <Wallet className="h-3.5 w-3.5 text-amber" />
            </div>
            <span className="font-bold">ClaimTrack</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {me && <RoleBadge role={me.role} size="sm" />}
        <button
          onClick={toggleDark}
          className="p-1.5 rounded hover:bg-accent transition"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <NotificationBell />
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
