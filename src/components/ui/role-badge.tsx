import { cn } from "@/lib/utils";

export type Role = "super_admin" | "admin" | "master" | "user";

const ROLE_STYLES: Record<Role, { label: string; classes: string }> = {
  super_admin: {
    label: "Super Admin",
    classes: "bg-purple-100 text-purple-700 border-purple-500/30",
  },
  admin: {
    label: "Admin",
    classes: "bg-red-100 text-red-700 border-red-500/30",
  },
  master: {
    label: "Master",
    classes: "bg-blue-100 text-blue-700 border-blue-500/30",
  },
  user: {
    label: "User",
    classes: "bg-slate-100 text-slate-700 border-slate-500/30",
  },
};

export function RoleBadge({
  role,
  className,
  size = "default",
}: {
  role: Role;
  className?: string;
  size?: "default" | "sm";
}) {
  const cfg = ROLE_STYLES[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-mono font-medium border",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-0.5",
        cfg.classes,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
