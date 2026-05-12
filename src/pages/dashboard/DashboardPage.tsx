import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { UserDashboard } from "./UserDashboard";
import { MasterDashboard } from "./MasterDashboard";
import { AdminDashboard } from "./AdminDashboard";
import { SkeletonCard } from "@/components/ui/skeleton";

export function DashboardPage() {
  const me = useQuery(api.users.getMe);
  if (me === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (!me) return null;
  if (me.role === "admin" || me.role === "super_admin") return <AdminDashboard />;
  if (me.role === "master") return <MasterDashboard />;
  return <UserDashboard />;
}
