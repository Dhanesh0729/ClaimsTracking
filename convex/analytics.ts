import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser, isAdmin, getMonthBounds } from "./lib/helpers";
import { Doc, Id } from "./_generated/dataModel";

function aggregateByField(
  rows: Doc<"purchases">[],
  field: keyof Doc<"purchases">,
): Array<{ label: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (r.status !== "approved" && r.status !== "reimbursed") continue;
    const key = String((r as any)[field] ?? "—");
    const m = map.get(key) ?? { total: 0, count: 0 };
    m.total += r.amount_spent;
    m.count += 1;
    map.set(key, m);
  }
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

function statusBreakdown(rows: Doc<"purchases">[]) {
  const out = {
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    rejected: { count: 0, total: 0 },
    reimbursed: { count: 0, total: 0 },
  };
  for (const r of rows) {
    out[r.status].count += 1;
    out[r.status].total += r.amount_spent;
  }
  return out;
}

async function fetchMonthForUser(
  ctx: any,
  userId: Id<"users">,
  month: number,
  year: number,
): Promise<Doc<"purchases">[]> {
  const bounds = getMonthBounds(month, year);
  return await ctx.db
    .query("purchases")
    .withIndex("by_user_and_date", (q: any) =>
      q
        .eq("user_id", userId)
        .gte("date_of_purchase", bounds.start)
        .lt("date_of_purchase", bounds.end),
    )
    .collect();
}

export const getUserAnalytics = query({
  args: {
    userId: v.optional(v.id("users")),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const targetId = args.userId ?? me._id;
    if (
      targetId !== me._id &&
      !isAdmin(me.role) &&
      me.role !== "master"
    ) {
      throw new ConvexError("Forbidden");
    }
    if (me.role === "master" && targetId !== me._id) {
      const target = await ctx.db.get(targetId);
      if (!target || target.assigned_master_id !== me._id) {
        throw new ConvexError("Not your assigned user");
      }
    }
    const rows = await fetchMonthForUser(ctx, targetId, args.month, args.year);

    const totalApprovedThisMonth = rows
      .filter((r) => r.status === "approved" || r.status === "reimbursed")
      .reduce((s, r) => s + r.amount_spent, 0);

    const budget = await ctx.db
      .query("budgets")
      .withIndex("by_user_month_year", (q) =>
        q
          .eq("user_id", targetId)
          .eq("month", args.month)
          .eq("year", args.year),
      )
      .unique();

    const allTime = await ctx.db
      .query("purchases")
      .withIndex("by_user_and_status", (q) =>
        q.eq("user_id", targetId).eq("status", "reimbursed"),
      )
      .collect();
    const totalReimbursedAllTime = allTime.reduce(
      (s, r) => s + r.amount_spent,
      0,
    );

    const pendingCount = (
      await ctx.db
        .query("purchases")
        .withIndex("by_user_and_status", (q) =>
          q.eq("user_id", targetId).eq("status", "pending"),
        )
        .collect()
    ).length;

    const categories = aggregateByField(rows, "category");
    const platforms = aggregateByField(rows, "purchase_platform").slice(0, 5);
    const banks = aggregateByField(rows, "bank_used_to_pay");
    const status = statusBreakdown(rows);

    const recent = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("user_id", targetId))
      .order("desc")
      .take(5);

    return {
      totalApprovedThisMonth,
      budget,
      totalReimbursedAllTime,
      pendingCount,
      categories,
      platforms,
      banks,
      status,
      recent,
    };
  },
});

export const getMonthlyTrend = query({
  args: {
    userId: v.optional(v.id("users")),
    months: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const targetId = args.userId ?? me._id;
    if (
      targetId !== me._id &&
      !isAdmin(me.role) &&
      me.role !== "master"
    ) {
      throw new ConvexError("Forbidden");
    }
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const months: Array<{ month: number; year: number; label: string; total: number }> = [];
    for (let i = args.months - 1; i >= 0; i--) {
      const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const m = ref.getUTCMonth() + 1;
      const y = ref.getUTCFullYear();
      const rows = await fetchMonthForUser(ctx, targetId, m, y);
      const total = rows
        .filter((r) => r.status === "approved" || r.status === "reimbursed")
        .reduce((s, r) => s + r.amount_spent, 0);
      months.push({
        month: m,
        year: y,
        label: ref.toLocaleString("en-US", { month: "short" }) + " " + String(y).slice(2),
        total,
      });
    }
    return months;
  },
});

export const getMasterAnalytics = query({
  args: { month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me.role !== "master" && !isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }

    let assignedUsers: Doc<"users">[];
    if (isAdmin(me.role)) {
      assignedUsers = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "user"))
        .collect();
    } else {
      assignedUsers = await ctx.db
        .query("users")
        .withIndex("by_assigned_master", (q) =>
          q.eq("assigned_master_id", me._id),
        )
        .collect();
    }

    const bounds = getMonthBounds(args.month, args.year);
    const rows: Doc<"purchases">[] = [];
    for (const u of assignedUsers) {
      const r = await ctx.db
        .query("purchases")
        .withIndex("by_user_and_date", (q) =>
          q
            .eq("user_id", u._id)
            .gte("date_of_purchase", bounds.start)
            .lt("date_of_purchase", bounds.end),
        )
        .collect();
      rows.push(...r);
    }

    const totalThisMonth = rows
      .filter((r) => r.status === "approved" || r.status === "reimbursed")
      .reduce((s, r) => s + r.amount_spent, 0);

    const pendingAcrossUsers = (
      await Promise.all(
        assignedUsers.map((u) =>
          ctx.db
            .query("purchases")
            .withIndex("by_user_and_status", (q) =>
              q.eq("user_id", u._id).eq("status", "pending"),
            )
            .collect(),
        ),
      )
    ).flat().length;

    const topSpenders = assignedUsers
      .map((u) => {
        const userRows = rows.filter(
          (r) =>
            r.user_id === u._id &&
            (r.status === "approved" || r.status === "reimbursed"),
        );
        return {
          userId: u._id,
          name: u.name,
          total: userRows.reduce((s, r) => s + r.amount_spent, 0),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const categories = aggregateByField(rows, "category");
    const status = statusBreakdown(rows);

    return {
      totalThisMonth,
      pendingAcrossUsers,
      topSpenders,
      categories,
      status,
      assignedUserCount: assignedUsers.length,
    };
  },
});

export const getAdminAnalytics = query({
  args: { month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");

    const bounds = getMonthBounds(args.month, args.year);
    const allMonth = await ctx.db
      .query("purchases")
      .withIndex("by_date", (q) =>
        q.gte("date_of_purchase", bounds.start).lt("date_of_purchase", bounds.end),
      )
      .collect();

    const totalCompanyThisMonth = allMonth
      .filter((r) => r.status === "approved" || r.status === "reimbursed")
      .reduce((s, r) => s + r.amount_spent, 0);

    const budgets = await ctx.db.query("budgets").collect();
    const monthBudgets = budgets.filter(
      (b) => b.month === args.month && b.year === args.year,
    );
    const companyBudget = monthBudgets.reduce((s, b) => s + b.budget_cap, 0);

    const status = statusBreakdown(allMonth);
    const categories = aggregateByField(allMonth, "category");
    const platforms = aggregateByField(allMonth, "purchase_platform").slice(0, 6);
    const banks = aggregateByField(allMonth, "bank_used_to_pay");

    const prev = new Date(Date.UTC(args.year, args.month - 2, 1));
    const prevMonth = prev.getUTCMonth() + 1;
    const prevYear = prev.getUTCFullYear();
    const prevBounds = getMonthBounds(prevMonth, prevYear);
    const prevRows = await ctx.db
      .query("purchases")
      .withIndex("by_date", (q) =>
        q.gte("date_of_purchase", prevBounds.start).lt("date_of_purchase", prevBounds.end),
      )
      .collect();
    const prevTotal = prevRows
      .filter((r) => r.status === "approved" || r.status === "reimbursed")
      .reduce((s, r) => s + r.amount_spent, 0);

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const editsThisWeek = (
      await ctx.db
        .query("audit_log")
        .withIndex("by_timestamp", (q) => q.gte("timestamp", weekAgo))
        .collect()
    ).filter((a) => a.action === "edited");

    const topEditors = (() => {
      const map = new Map<string, number>();
      for (const e of editsThisWeek) {
        map.set(e.performed_by_name, (map.get(e.performed_by_name) ?? 0) + 1);
      }
      return Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    })();

    const horizon = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = (
      await ctx.db
        .query("purchases")
        .withIndex("by_scheduled_deletion", (q) =>
          q.gte("scheduled_deletion_date", Date.now()).lt("scheduled_deletion_date", horizon),
        )
        .collect()
    ).length;

    return {
      totalCompanyThisMonth,
      companyBudget,
      status,
      categories,
      platforms,
      banks,
      monthOverMonth: { current: totalCompanyThisMonth, previous: prevTotal },
      editsThisWeek: editsThisWeek.length,
      topEditors,
      expiringSoon,
    };
  },
});

export const getBudgetUtilization = query({
  args: { month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");

    const budgets = await ctx.db.query("budgets").collect();
    const monthBudgets = budgets.filter(
      (b) => b.month === args.month && b.year === args.year,
    );

    const bounds = getMonthBounds(args.month, args.year);
    const result = [];
    for (const b of monthBudgets) {
      const rows = await ctx.db
        .query("purchases")
        .withIndex("by_user_and_date", (q) =>
          q
            .eq("user_id", b.user_id)
            .gte("date_of_purchase", bounds.start)
            .lt("date_of_purchase", bounds.end),
        )
        .collect();
      const spent = rows
        .filter((r) => r.status === "approved" || r.status === "reimbursed")
        .reduce((s, r) => s + r.amount_spent, 0);
      const user = await ctx.db.get(b.user_id);
      result.push({
        userId: b.user_id,
        userName: user?.name ?? "—",
        cap: b.budget_cap,
        spent,
        remaining: b.budget_cap - spent,
        percent: b.budget_cap > 0 ? (spent / b.budget_cap) * 100 : 0,
      });
    }
    return result.sort((a, b) => b.percent - a.percent);
  },
});

export const getDeletionRiskCount = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role) && me.role !== "user" && me.role !== "master") {
      throw new ConvexError("Forbidden");
    }
    const horizon = Date.now() + args.days * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("purchases")
      .withIndex("by_scheduled_deletion", (q) =>
        q.gte("scheduled_deletion_date", Date.now()).lt("scheduled_deletion_date", horizon),
      )
      .collect();
    if (me.role === "user") {
      return rows.filter((r) => r.user_id === me._id).length;
    }
    if (me.role === "master") {
      const assigned = await ctx.db
        .query("users")
        .withIndex("by_assigned_master", (q) =>
          q.eq("assigned_master_id", me._id),
        )
        .collect();
      const ids = new Set(assigned.map((u) => u._id));
      return rows.filter((r) => ids.has(r.user_id)).length;
    }
    return rows.length;
  },
});

export const getMyExpiringPurchases = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const horizon = Date.now() + args.days * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("purchases")
      .withIndex("by_scheduled_deletion", (q) =>
        q.gte("scheduled_deletion_date", Date.now()).lt("scheduled_deletion_date", horizon),
      )
      .collect();
    return rows.filter((r) => r.user_id === me._id);
  },
});
