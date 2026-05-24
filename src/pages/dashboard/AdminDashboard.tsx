import { useState } from "react";
import { useQuery } from "convex/react";
import { Activity, Hourglass, Users as UsersIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export function AdminDashboard() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const analytics = useQuery(api.analytics.getAdminAnalytics, { month, year });
  const budgetUtil = useQuery(api.analytics.getBudgetUtilization, { month, year });
  const users = useQuery(api.users.getAll);
  const [view, setView] = useState<"company" | "individual">("company");
  const [drillUserId, setDrillUserId] = useState<string>("");

  if (!analytics || !budgetUtil || !users) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const monthOverMonth = [
    {
      label: "Last Month",
      total: analytics.monthOverMonth.previous,
    },
    {
      label: "This Month",
      total: analytics.monthOverMonth.current,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Company-wide reimbursement metrics
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="company">Company View</TabsTrigger>
            <TabsTrigger value="individual">Individual View</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "individual" ? (
        <>
          <Select value={drillUserId} onValueChange={setDrillUserId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a user to drill into…" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name} ({u.unique_code}) — {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {drillUserId && <IndividualView userId={drillUserId as Id<"users">} />}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              label="Total Company Spend"
              value={formatINR(analytics.totalCompanyThisMonth)}
            />
            <Kpi
              label="Company Budget"
              value={formatINR(analytics.companyBudget)}
            />
            <Kpi
              label="Edits This Week"
              value={String(analytics.editsThisWeek)}
              icon={<Activity className="h-4 w-4 text-info" />}
            />
            <Kpi
              label="Expiring (30d)"
              value={String(analytics.expiringSoon)}
              icon={<Hourglass className="h-4 w-4 text-amber" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Month over Month</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthOverMonth}>
                    <CartesianGrid stroke="#E2E8F0" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Bar dataKey="total" fill="#0F172A" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Platform Spend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {analytics.platforms.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.platforms}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={75}
                      >
                        {analytics.platforms.map((_: any, i: number) => (
                          <Cell
                            key={i}
                            fill={
                              [
                                "#0F172A",
                                "#F59E0B",
                                "#3B82F6",
                                "#10B981",
                                "#A855F7",
                                "#EF4444",
                              ][i % 6]
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

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {analytics.categories.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.categories}>
                      <CartesianGrid stroke="#E2E8F0" />
                      <XAxis dataKey="label" fontSize={9} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      <Bar dataKey="total">
                        {analytics.categories.map((c: any, i: number) => (
                          <Cell
                            key={i}
                            fill={
                              CATEGORY_COLORS[c.label as Category] ?? "#64748B"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Audit Activity (Week)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold">
                  {analytics.editsThisWeek}
                </div>
                <div className="text-xs text-muted-foreground">
                  total edits in the past 7 days
                </div>
                {analytics.topEditors.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold mb-1">Top editors</div>
                    <ul className="text-xs space-y-1">
                      {analytics.topEditors.map((e: any) => (
                        <li key={e.name} className="flex justify-between">
                          <span>{e.name}</span>
                          <span className="font-mono">{e.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Budget Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              {budgetUtil.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No budgets set this month
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">User</th>
                      <th className="text-right p-2">Cap</th>
                      <th className="text-right p-2">Spent</th>
                      <th className="text-right p-2">Remaining</th>
                      <th className="p-2 w-32">% Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetUtil.map((b: any) => {
                      let color = "bg-success";
                      if (b.percent >= 100) color = "bg-danger";
                      else if (b.percent >= 80) color = "bg-amber";
                      return (
                        <tr key={b.userId} className="border-t">
                          <td className="p-2">{b.userName}</td>
                          <td className="p-2 text-right font-mono">
                            {formatINR(b.cap)}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {formatINR(b.spent)}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {formatINR(b.remaining)}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded bg-secondary overflow-hidden">
                                <div
                                  className={"h-full " + color}
                                  style={{
                                    width: `${Math.min(100, b.percent)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-mono w-12 text-right">
                                {b.percent.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <UsersIcon className="h-4 w-4" /> Status Breakdown
              </CardTitle>
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

function IndividualView({ userId }: { userId: Id<"users"> }) {
  return <UserDashboard userId={userId} />;
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-mono font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
