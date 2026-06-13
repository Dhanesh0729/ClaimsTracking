import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR, formatISTDate } from "@/lib/formatters";
import { BudgetProgressBar } from "@/components/ui/budget-progress-bar";
import { DeletionWarningBanner } from "@/components/ui/deletion-warning-banner";
import { StatusBadge, Status } from "@/components/ui/status-badge";
import { CategoryBadge, CATEGORY_COLORS, Category } from "@/components/ui/category-badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export function UserDashboard({ userId }: { userId?: Id<"users"> } = {}) {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const analytics = useQuery(api.analytics.getUserAnalytics, {
    userId,
    month,
    year,
  });
  const trend = useQuery(api.analytics.getMonthlyTrend, {
    userId,
    months: 6,
  });
  const expiring = useQuery(
    api.analytics.getMyExpiringPurchases,
    userId ? "skip" : { days: 30 },
  );

  if (!analytics || !trend) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {expiring && expiring.length > 0 && (
        <DeletionWarningBanner expiring={expiring as any} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Spent This Month"
          value={formatINR(analytics.totalApprovedThisMonth)}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">
              Budget Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.budget ? (
              <BudgetProgressBar
                spent={analytics.totalApprovedThisMonth}
                cap={analytics.budget.budget_cap}
              />
            ) : (
              <div className="text-xs text-muted-foreground">No budget set</div>
            )}
          </CardContent>
        </Card>
        <Kpi
          label="Pending Claims"
          value={String(analytics.pendingCount)}
          mono
        />
        <Kpi
          label="Total Reimbursed"
          value={formatINR(analytics.totalReimbursedAllTime)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Spend Trend (6 mo)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip
                  formatter={(v: number) => formatINR(v)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0F172A"
                  strokeWidth={2}
                  dot={{ fill: "#F59E0B" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Spend by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {analytics.categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No data this month
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
                    {analytics.categories.map((c: any, i: number) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 5 Platforms</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {analytics.platforms.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.platforms} layout="vertical">
                  <CartesianGrid stroke="#E2E8F0" />
                  <XAxis type="number" fontSize={10} />
                  <YAxis dataKey="label" type="category" fontSize={10} width={80} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="total" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bank Usage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {analytics.banks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.banks} layout="vertical">
                  <CartesianGrid stroke="#E2E8F0" />
                  <XAxis type="number" fontSize={10} />
                  <YAxis dataKey="label" type="category" fontSize={10} width={80} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="total" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent 5 Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody>
                {analytics.recent.length === 0 && (
                  <tr>
                    <td className="text-muted-foreground py-2">
                      No purchases yet
                    </td>
                  </tr>
                )}
                {analytics.recent.map((p: any) => (
                  <tr key={p._id} className="border-t">
                    <td className="py-1.5 max-w-[180px] truncate">
                      {p.products_purchased}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatINR(p.amount_spent)}
                    </td>
                    <td className="py-1.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground font-mono">
                      {formatISTDate(p.date_of_purchase)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={mono ? "text-2xl font-mono font-bold" : "text-2xl font-mono font-bold"}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

void CategoryBadge;
