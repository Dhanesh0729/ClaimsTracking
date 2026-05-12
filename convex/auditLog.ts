import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUser, isAdmin } from "./lib/helpers";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    conflictOnly: v.optional(v.boolean()),
    actions: v.optional(v.array(v.string())),
    userId: v.optional(v.id("users")),
    fromTs: v.optional(v.number()),
    toTs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");

    let q;
    if (args.conflictOnly) {
      q = ctx.db
        .query("audit_log")
        .withIndex("by_conflict_flag", (qq) => qq.eq("conflict_flag", true))
        .order("desc");
    } else if (args.fromTs !== undefined || args.toTs !== undefined) {
      q = ctx.db
        .query("audit_log")
        .withIndex("by_timestamp", (qq) => {
          let r: any = qq;
          if (args.fromTs !== undefined) r = r.gte("timestamp", args.fromTs);
          if (args.toTs !== undefined) r = r.lt("timestamp", args.toTs);
          return r;
        })
        .order("desc");
    } else {
      q = ctx.db.query("audit_log").withIndex("by_timestamp").order("desc");
    }

    const page = await q.paginate(args.paginationOpts);
    let rows = page.page;
    if (args.actions && args.actions.length > 0) {
      const set = new Set(args.actions);
      rows = rows.filter((r) => set.has(r.action));
    }
    if (args.userId) {
      rows = rows.filter((r) => r.performed_by === args.userId);
    }
    return { ...page, page: rows };
  },
});

export const listByPurchase = query({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("audit_log")
      .withIndex("by_purchase", (q) => q.eq("purchase_id", args.purchaseId))
      .order("desc")
      .collect();
  },
});

export const getMany = query({
  args: { ids: v.array(v.id("audit_log")) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) throw new ConvexError("Forbidden");
    const out = [];
    for (const id of args.ids) {
      const r = await ctx.db.get(id);
      if (r) out.push(r);
    }
    return out;
  },
});
