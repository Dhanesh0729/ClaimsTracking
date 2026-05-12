import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  requireUser,
  getUserByClerkId,
  counterToCode,
  isAdmin,
} from "./lib/helpers";

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await getUserByClerkId(ctx, args.clerkId);
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await getUserByClerkId(ctx, identity.subject);
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }
    return await ctx.db.query("users").collect();
  },
});

export const getByRole = query({
  args: {
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("master"),
      v.literal("user"),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect();
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.userId);
  },
});

export const getMyAssignedUsers = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (me.role !== "master" && !isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }
    if (isAdmin(me.role)) {
      return await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "user"))
        .collect();
    }
    return await ctx.db
      .query("users")
      .withIndex("by_assigned_master", (q) => q.eq("assigned_master_id", me._id))
      .collect();
  },
});

export const completeOnboarding = mutation({
  args: {
    name: v.string(),
    mobile: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const existing = await getUserByClerkId(ctx, identity.subject);
    if (existing) {
      return existing._id;
    }

    const email = identity.email ?? "";
    if (!email) {
      throw new ConvexError("Missing email from auth identity");
    }

    let tracker = await ctx.db.query("unique_code_tracker").first();
    if (!tracker) {
      const trackerId = await ctx.db.insert("unique_code_tracker", {
        counter: 1,
        last_code: "",
      });
      tracker = await ctx.db.get(trackerId);
    }
    if (!tracker) throw new ConvexError("Failed to access unique code tracker");

    const code = counterToCode(tracker.counter);
    await ctx.db.patch(tracker._id, {
      counter: tracker.counter + 1,
      last_code: code,
    });

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name.trim(),
      email,
      mobile: args.mobile.trim(),
      unique_code: code,
      role: "user",
      created_at: Date.now(),
    });

    return userId;
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("master"),
      v.literal("user"),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden — only Admins can change roles");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("Target user not found");

    if (target.role === "super_admin") {
      throw new ConvexError("Cannot change Super Admin role here — use transferSuperAdmin");
    }

    if (target.role === "admin" && me.role !== "super_admin") {
      throw new ConvexError("Only Super Admin can demote an Admin");
    }
    if (args.newRole === "admin" && me.role !== "super_admin") {
      throw new ConvexError("Only Super Admin can promote to Admin");
    }

    await ctx.db.patch(args.userId, { role: args.newRole });
    return { ok: true, message: `Role updated to ${args.newRole}` };
  },
});

export const assignMaster = mutation({
  args: {
    userId: v.id("users"),
    masterId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found");
    if (target.role !== "user") {
      throw new ConvexError("Can only assign a Master to a User-role account");
    }

    if (args.masterId) {
      const master = await ctx.db.get(args.masterId);
      if (!master) throw new ConvexError("Master not found");
      if (master.role !== "master") {
        throw new ConvexError("Assigned account must have role=master");
      }
      await ctx.db.patch(args.userId, { assigned_master_id: args.masterId });
    } else {
      await ctx.db.patch(args.userId, { assigned_master_id: undefined });
    }
    return { ok: true };
  },
});

export const transferSuperAdmin = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me.role !== "super_admin") {
      throw new ConvexError("Only the current Super Admin can transfer the role");
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("Target user not found");
    if (target.role !== "admin") {
      throw new ConvexError("Super Admin can only be transferred to an Admin");
    }

    await ctx.db.patch(me._id, { role: "admin" });
    await ctx.db.patch(target._id, { role: "super_admin" });

    return {
      ok: true,
      message: `Super Admin transferred to ${target.name}`,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    mobile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const patch: Record<string, string> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.mobile !== undefined) patch.mobile = args.mobile.trim();
    if (Object.keys(patch).length === 0) return { ok: true };
    await ctx.db.patch(me._id, patch);
    return { ok: true };
  },
});
