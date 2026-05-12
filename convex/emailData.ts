import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const fetchPurchaseForEmail = internalQuery({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) return null;
    const user = await ctx.db.get(purchase.user_id);
    if (!user) return null;
    return { purchase, user };
  },
});

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getBudget = internalQuery({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("budgets")
      .withIndex("by_user_month_year", (q) =>
        q
          .eq("user_id", args.userId)
          .eq("month", args.month)
          .eq("year", args.year),
      )
      .unique();
  },
});

export const getRoleRequest = internalQuery({
  args: { requestId: v.id("role_requests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});
