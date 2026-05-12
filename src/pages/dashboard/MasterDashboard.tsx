import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/formatters";
import { StatusBadge, Status } from "@/components/ui/status-badge";
import { CATEGORY_COLORS, Category } from "@/components/ui/category-badge";
import { UserDashboard } from "./UserDashboard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export function MasterDashboard() {
  const nav = useNavigate();
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const analytics = useQuery(api.analytics.getMasterAnalytics, { month, year });
  const assignedUsers = useQuery(api.users.getMyAssignedUsers);
  const [drillUserId, setDrillUserId] = useState<string>("");

  if (!analytics || !assignedUsers) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Master Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your {analytics.assignedUserCount} assigned users
          </p>
        </div>
        <Select value={drillUserId} onValueChange={setDrillUserId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Drill into individual user…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Overview (all users)</SelectItem>
            {assignedUsers.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.name} ({u.unique_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {drillUserId && drillUserId !== "__none__" ? (
        <SingleUserView userId={drillUserId as Id<"users">} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              label="Total Spend (Month)"
              value={formatINR(analytics.totalThisMonth)}
            />
            <Kpi
              label="Pending Approvals"
              value={String(analytics.pendingAcrossUsers)}
              cta={
                <Button
                  size="sm"
                  variant="amber"
                  className="mt-2"
                  onClick={() => nav("/approvals")}
                >
                  Review →
                </Button>
              }
            />
            <Kpi
              label="Approved Claims"
              value={String(analytics.status.approved.count)}
            />
            <Kpi
              label="Assigned Users"
              value={String(analytics.assignedUserCount)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Spenders (Month)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {analytics.topSpenders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topSpenders} layout="vertical">
                      <CartesianGrid stroke="#E2E8F0" />
                      <XAxis type="number" fontSize={10} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        fontSize={10}
                        width={100}
                      />
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      <Bar dataKey="total" fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Spend by Category</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {analytics.categories.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.categories}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={75}
                      >
                        {analytics.categories.map((c, i) => (
                          <Cell
                            key={i}
                            fill={
                              CATEGORY_COLORS[c.label as Category] ?? "#64748B"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Claim Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["pending", "approved", "rejected", "reimbursed"] as Status[]).map(
                  (s) => {
                    const v = analytics.status[s];
                    return (
                      <div
                        key={s}
                        className="rounded border p-3 flex flex-col items-center"
                      >
                        <StatusBadge status={s} />
                        <div className="text-lg font-mono font-bold mt-1">
                          {v.count}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {formatINR(v.total)}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SingleUserView({ userId }: { userId: Id<"users"> }) {
  return <UserDashboard userId={userId} />;
}

function Kpi({
  label,
  value,
  cta,
}: {
  label: string;
  value: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-mono font-bold">{value}</div>
        {cta}
      </CardContent>
    </Card>
  );
}
