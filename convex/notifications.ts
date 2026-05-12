import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUser } from "./lib/helpers";

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", me._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const latest = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", me._id))
      .order("desc")
      .take(args.limit);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("user_id", user._id).eq("is_read", false),
      )
      .collect();
    return rows.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const n = await ctx.db.get(args.notificationId);
    if (!n) throw new ConvexError("Not found");
    if (n.user_id !== me._id) throw new ConvexError("Forbidden");
    await ctx.db.patch(args.notificationId, { is_read: true });
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("user_id", me._id).eq("is_read", false),
      )
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { is_read: true });
    }
    return { count: unread.length };
  },
});
