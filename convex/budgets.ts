import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser, isAdmin, getMonthBounds } from "./lib/helpers";
import { internal } from "./_generated/api";

export const getBudgetForUser = query({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me._id !== args.userId && !isAdmin(me.role) && me.role !== "master") {
      throw new ConvexError("Forbidden");
    }
    return await ctx.db
      .query("budgets")
      .withIndex("by_user_month_year", (q) =>
        q.eq("user_id", args.userId).eq("month", args.month).eq("year", args.year),
      )
      .unique();
  },
});

export const getAllBudgets = query({
  args: { month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");
    const all = await ctx.db.query("budgets").collect();
    return all.filter((b) => b.month === args.month && b.year === args.year);
  },
});

export const setBudget = mutation({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
    budgetCap: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");

    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_user_month_year", (q) =>
        q.eq("user_id", args.userId).eq("month", args.month).eq("year", args.year),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        budget_cap: args.budgetCap,
        set_by: me._id,
      });
      return existing._id;
    }
    return await ctx.db.insert("budgets", {
      user_id: args.userId,
      month: args.month,
      year: args.year,
      budget_cap: args.budgetCap,
      set_by: me._id,
      created_at: Date.now(),
    });
  },
});

export const deleteBudget = mutation({
  args: { budgetId: v.id("budgets") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");
    await ctx.db.delete(args.budgetId);
    return { ok: true };
  },
});

export const checkBudgetAndNotify = internalMutation({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const budget = await ctx.db
      .query("budgets")
      .withIndex("by_user_month_year", (q) =>
        q
          .eq("user_id", args.userId)
          .eq("month", args.month)
          .eq("year", args.year),
      )
      .unique();
    if (!budget) return;

    const bounds = getMonthBounds(args.month, args.year);
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_user_and_date", (q) =>
        q
          .eq("user_id", args.userId)
          .gte("date_of_purchase", bounds.start)
          .lt("date_of_purchase", bounds.end),
      )
      .collect();

    const approvedSum = purchases
      .filter((p) => p.status === "approved" || p.status === "reimbursed")
      .reduce((s, p) => s + p.amount_spent, 0);

    const ratio = approvedSum / budget.budget_cap;
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    const monthStart = bounds.start;
    const existingThisMonth = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .collect();
    const recent = existingThisMonth.filter((n) => n.created_at >= monthStart);

    if (ratio >= 1.0) {
      const already = recent.some((n) => n.type === "budget_exceeded");
      if (!already) {
        await ctx.db.insert("notifications", {
          user_id: args.userId,
          type: "budget_exceeded",
          title: "Budget Exceeded",
          message: `You have exceeded your ₹${budget.budget_cap} monthly budget. Current spend: ₹${approvedSum.toFixed(2)}.`,
          is_read: false,
          created_at: Date.now(),
        });
        if (user.assigned_master_id) {
          await ctx.db.insert("notifications", {
            user_id: user.assigned_master_id,
            type: "budget_exceeded",
            title: `${user.name} exceeded budget`,
            message: `${user.name} exceeded their ₹${budget.budget_cap} monthly budget. Current: ₹${approvedSum.toFixed(2)}.`,
            is_read: false,
            created_at: Date.now(),
          });
        }
        await ctx.scheduler.runAfter(0, internal.email.sendBudgetExceededEmail, {
          userId: args.userId,
          month: args.month,
          year: args.year,
        });
      }
    } else if (ratio >= 0.8) {
      const already = recent.some(
        (n) => n.type === "budget_warning" || n.type === "budget_exceeded",
      );
      if (!already) {
        await ctx.db.insert("notifications", {
          user_id: args.userId,
          type: "budget_warning",
          title: "Budget Warning (80%)",
          message: `You've used ${(ratio * 100).toFixed(0)}% of your ₹${budget.budget_cap} monthly budget.`,
          is_read: false,
          created_at: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.email.sendBudgetWarningEmail, {
          userId: args.userId,
          month: args.month,
          year: args.year,
          percent: Math.round(ratio * 100),
        });
      }
    }
  },
});
