import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser, isAdmin } from "./lib/helpers";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const getMyRequest = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    return await ctx.db
      .query("role_requests")
      .withIndex("by_requester", (q) => q.eq("requester_id", me._id))
      .order("desc")
      .first();
  },
});

export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }
    const all = await ctx.db
      .query("role_requests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    if (me.role === "admin") {
      return all.filter((r) => r.requested_role === "master");
    }
    return all;
  },
});

export const submitRequest = mutation({
  args: {
    requestedRole: v.union(v.literal("master"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);

    if (args.requestedRole === "master" && me.role !== "user") {
      throw new ConvexError("Only Users can request Master role");
    }
    if (args.requestedRole === "admin" && me.role !== "master") {
      throw new ConvexError("Only Masters can request Admin role");
    }

    const existing = await ctx.db
      .query("role_requests")
      .withIndex("by_requester", (q) => q.eq("requester_id", me._id))
      .order("desc")
      .first();
    if (existing && existing.status === "pending") {
      throw new ConvexError("You already have a pending role request");
    }

    const requestId = await ctx.db.insert("role_requests", {
      requester_id: me._id,
      requester_name: me.name,
      requester_unique_code: me.unique_code,
      current_role: me.role,
      requested_role: args.requestedRole,
      status: "pending",
      created_at: Date.now(),
    });

    let recipients: Id<"users">[] = [];
    if (args.requestedRole === "master") {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .collect();
      const superAdmins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "super_admin"))
        .collect();
      recipients = [...admins.map((a) => a._id), ...superAdmins.map((s) => s._id)];
    } else {
      const superAdmins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "super_admin"))
        .collect();
      recipients = superAdmins.map((s) => s._id);
    }

    for (const recipientId of recipients) {
      await ctx.db.insert("notifications", {
        user_id: recipientId,
        type: "role_request_received",
        title: "New Role Request",
        message: `${me.name} (${me.unique_code}) has requested promotion to ${args.requestedRole}.`,
        role_request_id: requestId,
        is_read: false,
        created_at: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.email.sendRoleRequestEmail, {
      requestId,
      recipientIds: recipients,
    });

    return requestId;
  },
});

export const decideRequest = mutation({
  args: {
    requestId: v.id("role_requests"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("Request not found");
    if (request.status !== "pending") {
      throw new ConvexError("Request already decided");
    }

    if (request.requested_role === "admin" && me.role !== "super_admin") {
      throw new ConvexError("Only Super Admin can decide Admin requests");
    }

    await ctx.db.patch(args.requestId, {
      status: args.approve ? "approved" : "rejected",
      decision_by: me._id,
      decision_note: args.note,
      decided_at: Date.now(),
    });

    if (args.approve) {
      await ctx.db.patch(request.requester_id, {
        role: request.requested_role as "admin" | "master",
      });
    }

    await ctx.db.insert("notifications", {
      user_id: request.requester_id,
      type: args.approve ? "role_request_approved" : "role_request_rejected",
      title: args.approve ? "Role Request Approved" : "Role Request Rejected",
      message: args.approve
        ? `Your request for ${request.requested_role} has been approved.`
        : `Your request for ${request.requested_role} was rejected.${args.note ? " Note: " + args.note : ""}`,
      role_request_id: args.requestId,
      is_read: false,
      created_at: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.email.sendRoleDecisionEmail, {
      requestId: args.requestId,
    });

    return { ok: true };
  },
});

export const getById = query({
  args: { requestId: v.id("role_requests") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.requestId);
  },
});

export const _internalGetById = internalMutation({
  args: { requestId: v.id("role_requests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});
