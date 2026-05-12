import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    const v = localStorage.getItem("claimtrack-sidebar-collapsed");
    return v === "1";
  });

  const onToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("claimtrack-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-background">
      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggle={onToggle} />
        <div
          className={cn(
            "flex-1 flex flex-col min-h-screen transition-all",
            collapsed ? "lg:ml-16" : "lg:ml-60",
          )}
        >
          <Navbar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
      <div className="lg:hidden flex flex-col min-h-screen">
        <Navbar mobile />
        <main className="flex-1 p-4 pb-24">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
