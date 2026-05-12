import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  requireUser,
  isAdmin,
  isPrivileged,
  appendAuditLog,
  getDayBoundsIST,
} from "./lib/helpers";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const CATEGORY_VALIDATOR = v.union(
  v.literal("Food"),
  v.literal("Travel"),
  v.literal("Accommodation"),
  v.literal("Supplies"),
  v.literal("Equipment"),
  v.literal("Communication"),
  v.literal("Other"),
);

async function canUserAccessPurchase(
  ctx: { db: any },
  me: Doc<"users">,
  purchase: Doc<"purchases">,
): Promise<boolean> {
  if (isAdmin(me.role)) return true;
  if (purchase.user_id === me._id) return true;
  if (me.role === "master") {
    const owner = await ctx.db.get(purchase.user_id);
    if (owner && owner.assigned_master_id === me._id) return true;
  }
  return false;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrlForStorageId = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getById = query({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) return null;
    const ok = await canUserAccessPurchase(ctx, me, purchase);
    if (!ok) throw new ConvexError("Forbidden");
    const owner = await ctx.db.get(purchase.user_id);
    return { ...purchase, owner };
  },
});

export const listMine = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("reimbursed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    let q;
    if (args.status) {
      q = ctx.db
        .query("purchases")
        .withIndex("by_user_and_status", (qq) =>
          qq.eq("user_id", me._id).eq("status", args.status!),
        )
        .order("desc");
    } else {
      q = ctx.db
        .query("purchases")
        .withIndex("by_user", (qq) => qq.eq("user_id", me._id))
        .order("desc");
    }
    return await q.paginate(args.paginationOpts);
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdmin(me.role) && me.role !== "master") {
      throw new ConvexError("Forbidden");
    }
    if (me.role === "master") {
      const target = await ctx.db.get(args.userId);
      if (!target || target.assigned_master_id !== me._id) {
        throw new ConvexError("Not your assigned user");
      }
    }
    return await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listAll = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("reimbursed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isPrivileged(me.role)) {
      throw new ConvexError("Forbidden");
    }

    if (me.role === "master") {
      const assigned = await ctx.db
        .query("users")
        .withIndex("by_assigned_master", (q) => q.eq("assigned_master_id", me._id))
        .collect();
      const assignedIds = new Set(assigned.map((u) => u._id));
      let qq;
      if (args.status) {
        qq = ctx.db.query("purchases").withIndex("by_status", (q) =>
          q.eq("status", args.status!),
        ).order("desc");
      } else {
        qq = ctx.db.query("purchases").order("desc");
      }
      const page = await qq.paginate(args.paginationOpts);
      return {
        ...page,
        page: page.page.filter((p) => assignedIds.has(p.user_id)),
      };
    }

    let q;
    if (args.status) {
      q = ctx.db
        .query("purchases")
        .withIndex("by_status", (qq) => qq.eq("status", args.status!))
        .order("desc");
    } else {
      q = ctx.db.query("purchases").order("desc");
    }
    return await q.paginate(args.paginationOpts);
  },
});

export const listForApprovalQueue = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me.role === "user") throw new ConvexError("Forbidden");

    const page = await ctx.db
      .query("purchases")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .paginate(args.paginationOpts);

    if (me.role === "master") {
      const assigned = await ctx.db
        .query("users")
        .withIndex("by_assigned_master", (q) =>
          q.eq("assigned_master_id", me._id),
        )
        .collect();
      const ids = new Set(assigned.map((u) => u._id));
      return {
        ...page,
        page: page.page.filter((p) => ids.has(p.user_id)),
      };
    }
    return page;
  },
});

export const search = query({
  args: {
    queryText: v.string(),
    field: v.union(v.literal("products"), v.literal("platform")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (args.queryText.length < 2) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    if (args.field === "products") {
      if (isAdmin(me.role)) {
        return await ctx.db
          .query("purchases")
          .withSearchIndex("search_products", (q) =>
            q.search("products_purchased", args.queryText),
          )
          .paginate(args.paginationOpts);
      }
      if (me.role === "master") {
        const page = await ctx.db
          .query("purchases")
          .withSearchIndex("search_products", (q) =>
            q.search("products_purchased", args.queryText),
          )
          .paginate(args.paginationOpts);
        const assigned = await ctx.db
          .query("users")
          .withIndex("by_assigned_master", (q) =>
            q.eq("assigned_master_id", me._id),
          )
          .collect();
        const ids = new Set(assigned.map((u) => u._id));
        return {
          ...page,
          page: page.page.filter((p) => ids.has(p.user_id)),
        };
      }
      return await ctx.db
        .query("purchases")
        .withSearchIndex("search_products", (q) =>
          q
            .search("products_purchased", args.queryText)
            .eq("user_id", me._id),
        )
        .paginate(args.paginationOpts);
    } else {
      if (isAdmin(me.role)) {
        return await ctx.db
          .query("purchases")
          .withSearchIndex("search_platform", (q) =>
            q.search("purchase_platform", args.queryText),
          )
          .paginate(args.paginationOpts);
      }
      if (me.role === "master") {
        const page = await ctx.db
          .query("purchases")
          .withSearchIndex("search_platform", (q) =>
            q.search("purchase_platform", args.queryText),
          )
          .paginate(args.paginationOpts);
        const assigned = await ctx.db
          .query("users")
          .withIndex("by_assigned_master", (q) =>
            q.eq("assigned_master_id", me._id),
          )
          .collect();
        const ids = new Set(assigned.map((u) => u._id));
        return {
          ...page,
          page: page.page.filter((p) => ids.has(p.user_id)),
        };
      }
      return await ctx.db
        .query("purchases")
        .withSearchIndex("search_platform", (q) =>
          q
            .search("purchase_platform", args.queryText)
            .eq("user_id", me._id),
        )
        .paginate(args.paginationOpts);
    }
  },
});

export const checkDuplicate = mutation({
  args: {
    amount_spent: v.number(),
    purchase_platform: v.string(),
    date_of_purchase: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const bounds = getDayBoundsIST(args.date_of_purchase);
    const sameDay = await ctx.db
      .query("purchases")
      .withIndex("by_user_and_date", (q) =>
        q
          .eq("user_id", me._id)
          .gte("date_of_purchase", bounds.start)
          .lt("date_of_purchase", bounds.end),
      )
      .collect();
    const now = Date.now();
    const platformLower = args.purchase_platform.trim().toLowerCase();
    const match = sameDay.find(
      (p) =>
        p.amount_spent === args.amount_spent &&
        p.purchase_platform.toLowerCase() === platformLower &&
        now - p.bill_received_time <= 24 * 60 * 60 * 1000,
    );
    if (match) {
      return { isDuplicate: true, matchingDisplayId: match.display_id };
    }
    return { isDuplicate: false };
  },
});

export const createPurchase = mutation({
  args: {
    products_purchased: v.string(),
    amount_spent: v.number(),
    purchase_platform: v.string(),
    bank_used_to_pay: v.string(),
    upi_app_used_to_pay: v.string(),
    category: CATEGORY_VALIDATOR,
    date_of_purchase: v.number(),
    bill_files: v.array(
      v.object({
        storageId: v.string(),
        fileName: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
      }),
    ),
    forceSubmit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);

    const bounds = getDayBoundsIST(args.date_of_purchase);
    const sameDay = await ctx.db
      .query("purchases")
      .withIndex("by_user_and_date", (q) =>
        q
          .eq("user_id", me._id)
          .gte("date_of_purchase", bounds.start)
          .lt("date_of_purchase", bounds.end),
      )
      .collect();
    const now = Date.now();
    const platformLower = args.purchase_platform.trim().toLowerCase();
    const duplicate = sameDay.find(
      (p) =>
        p.amount_spent === args.amount_spent &&
        p.purchase_platform.toLowerCase() === platformLower &&
        now - p.bill_received_time <= 24 * 60 * 60 * 1000,
    );
    const isDuplicate = !!duplicate;

    if (isDuplicate && !args.forceSubmit) {
      return {
        isDuplicate: true,
        matchingDisplayId: duplicate!.display_id,
      };
    }

    const tracker = await ctx.db
      .query("display_id_tracker")
      .withIndex("by_user", (q) => q.eq("user_id", me._id))
      .unique();

    let displayId: number;
    if (!tracker) {
      await ctx.db.insert("display_id_tracker", {
        user_id: me._id,
        last_display_id: 1,
      });
      displayId = 1;
    } else {
      displayId = tracker.last_display_id + 1;
      await ctx.db.patch(tracker._id, { last_display_id: displayId });
    }

    const billFiles = [];
    for (const f of args.bill_files) {
      const url = await ctx.storage.getUrl(f.storageId);
      billFiles.push({
        storageId: f.storageId,
        fileName: f.fileName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        convexUrl: url ?? "",
      });
    }

    const billReceivedTime = Date.now();
    const purchaseId = await ctx.db.insert("purchases", {
      user_id: me._id,
      display_id: displayId,
      products_purchased: args.products_purchased.trim(),
      amount_spent: args.amount_spent,
      purchase_platform: args.purchase_platform.trim(),
      bank_used_to_pay: args.bank_used_to_pay.trim(),
      upi_app_used_to_pay: args.upi_app_used_to_pay.trim(),
      category: args.category,
      date_of_purchase: args.date_of_purchase,
      bill_received_time: billReceivedTime,
      bill_files: billFiles,
      status: "pending",
      is_duplicate_flagged: isDuplicate,
      deletion_warned: false,
    });

    await appendAuditLog(ctx, {
      purchase_id: purchaseId,
      action: "created",
      performed_by: me._id,
      performed_by_role: me.role,
      performed_by_name: me.name,
      conflict_flag: false,
      changes: JSON.stringify({
        display_id: displayId,
        amount_spent: args.amount_spent,
        is_duplicate_flagged: isDuplicate,
      }),
    });

    return { isDuplicate: false, purchaseId, displayId };
  },
});

export const updatePurchase = mutation({
  args: {
    purchaseId: v.id("purchases"),
    products_purchased: v.optional(v.string()),
    amount_spent: v.optional(v.number()),
    purchase_platform: v.optional(v.string()),
    bank_used_to_pay: v.optional(v.string()),
    upi_app_used_to_pay: v.optional(v.string()),
    category: v.optional(CATEGORY_VALIDATOR),
    date_of_purchase: v.optional(v.number()),
    bill_files: v.optional(
      v.array(
        v.object({
          storageId: v.string(),
          fileName: v.string(),
          fileType: v.string(),
          fileSize: v.number(),
          convexUrl: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) throw new ConvexError("Purchase not found");

    if (me.role === "user") {
      if (purchase.user_id !== me._id) throw new ConvexError("Forbidden");
      if (purchase.status !== "pending") {
        throw new ConvexError("LOCKED");
      }
    } else if (me.role === "master") {
      const owner = await ctx.db.get(purchase.user_id);
      if (!owner || owner.assigned_master_id !== me._id) {
        throw new ConvexError("Forbidden");
      }
    } else if (!isAdmin(me.role)) {
      throw new ConvexError("Forbidden");
    }

    const changes: Array<{ field: string; before: unknown; after: unknown }> =
      [];
    const patch: Record<string, unknown> = {};

    const fields: Array<keyof typeof args> = [
      "products_purchased",
      "amount_spent",
      "purchase_platform",
      "bank_used_to_pay",
      "upi_app_used_to_pay",
      "category",
      "date_of_purchase",
    ];
    for (const f of fields) {
      if (args[f] !== undefined) {
        const before = (purchase as any)[f];
        const after = args[f];
        if (before !== after) {
          changes.push({ field: f as string, before, after });
          patch[f as string] =
            typeof after === "string" ? after.trim() : after;
        }
      }
    }

    if (args.bill_files !== undefined) {
      const newFiles = [];
      for (const f of args.bill_files) {
        const url = f.convexUrl ?? (await ctx.storage.getUrl(f.storageId));
        newFiles.push({
          storageId: f.storageId,
          fileName: f.fileName,
          fileType: f.fileType,
          fileSize: f.fileSize,
          convexUrl: url ?? "",
        });
      }
      changes.push({
        field: "bill_files",
        before: purchase.bill_files.length,
        after: newFiles.length,
      });
      patch.bill_files = newFiles;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, changed: false };
    }

    if (me.role !== "user") {
      const identity = await ctx.auth.getUserIdentity();
      patch.edited_by = me._id;
      patch.edited_by_clerkId = identity?.subject ?? me.clerkId;
      patch.edited_at = Date.now();
      patch.edited_by_role = me.role;
    }

    await ctx.db.patch(args.purchaseId, patch);

    const conflictFlag = me.role === "master";
    await appendAuditLog(ctx, {
      purchase_id: args.purchaseId,
      action: "edited",
      performed_by: me._id,
      performed_by_role: me.role,
      performed_by_name: me.name,
      conflict_flag: conflictFlag,
      changes: JSON.stringify(changes),
    });

    return { ok: true, changed: true };
  },
});

export const updateStatus = mutation({
  args: {
    purchaseId: v.id("purchases"),
    newStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("reimbursed"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me.role === "user") throw new ConvexError("Forbidden");

    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) throw new ConvexError("Purchase not found");

    const identity = await ctx.auth.getUserIdentity();
    const callerClerkId = identity?.subject ?? me.clerkId;
    if (
      purchase.edited_by_clerkId &&
      purchase.edited_by_clerkId === callerClerkId &&
      me.role === "master"
    ) {
      throw new ConvexError("CONFLICT");
    }

    if (me.role === "master") {
      const owner = await ctx.db.get(purchase.user_id);
      if (!owner || owner.assigned_master_id !== me._id) {
        throw new ConvexError("Forbidden");
      }
      if (purchase.status !== "pending") {
        throw new ConvexError("Master can only act on pending claims");
      }
      if (args.newStatus !== "approved" && args.newStatus !== "rejected") {
        throw new ConvexError("Invalid transition for Master");
      }
    } else {
      const from = purchase.status;
      const to = args.newStatus;
      const ok =
        (from === "pending" && (to === "approved" || to === "rejected")) ||
        (from === "approved" && (to === "reimbursed" || to === "rejected")) ||
        (from === "rejected" && to === "pending");
      if (!ok) {
        throw new ConvexError(`Invalid transition: ${from} → ${to}`);
      }
    }

    if (args.newStatus === "rejected" && !args.note?.trim()) {
      throw new ConvexError("Rejection note is required");
    }

    await ctx.db.patch(args.purchaseId, {
      status: args.newStatus,
      status_note: args.note,
      status_updated_by: me._id,
      status_updated_at: Date.now(),
    });

    await appendAuditLog(ctx, {
      purchase_id: args.purchaseId,
      action: "status_changed",
      performed_by: me._id,
      performed_by_role: me.role,
      performed_by_name: me.name,
      conflict_flag: false,
      changes: JSON.stringify({
        from: purchase.status,
        to: args.newStatus,
        note: args.note ?? null,
      }),
    });

    const owner = await ctx.db.get(purchase.user_id);
    if (owner) {
      let type:
        | "claim_approved"
        | "claim_rejected"
        | "claim_reimbursed"
        | null = null;
      if (args.newStatus === "approved") type = "claim_approved";
      else if (args.newStatus === "rejected") type = "claim_rejected";
      else if (args.newStatus === "reimbursed") type = "claim_reimbursed";
      if (type) {
        await ctx.db.insert("notifications", {
          user_id: owner._id,
          type,
          title: `Claim #${purchase.display_id} ${args.newStatus}`,
          message: `Your claim for ${purchase.products_purchased} (₹${purchase.amount_spent}) has been ${args.newStatus}.${args.note ? " Note: " + args.note : ""}`,
          purchase_id: args.purchaseId,
          is_read: false,
          created_at: Date.now(),
        });

        await ctx.scheduler.runAfter(0, internal.email.sendClaimStatusEmail, {
          purchaseId: args.purchaseId,
        });
      }
    }

    if (args.newStatus === "approved") {
      const istDate = new Date(purchase.date_of_purchase + 5.5 * 60 * 60 * 1000);
      const month = istDate.getUTCMonth() + 1;
      const year = istDate.getUTCFullYear();
      await ctx.scheduler.runAfter(0, internal.budgets.checkBudgetAndNotify, {
        userId: purchase.user_id,
        month,
        year,
      });
    }

    return { ok: true };
  },
});

export const deletePurchase = mutation({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) throw new ConvexError("Purchase not found");

    if (me.role === "user") {
      if (purchase.user_id !== me._id) throw new ConvexError("Forbidden");
      if (purchase.status !== "pending") throw new ConvexError("LOCKED");
    } else if (!isAdmin(me.role)) {
      throw new ConvexError("Only Admins or owner (while pending) can delete");
    }

    for (const f of purchase.bill_files) {
      try {
        await ctx.storage.delete(f.storageId);
      } catch {
        // ignore — already deleted
      }
    }

    await appendAuditLog(ctx, {
      purchase_id: args.purchaseId,
      action: "deleted",
      performed_by: me._id,
      performed_by_role: me.role,
      performed_by_name: me.name,
      conflict_flag: false,
      changes: JSON.stringify({
        display_id: purchase.display_id,
        amount_spent: purchase.amount_spent,
      }),
    });

    await ctx.db.delete(args.purchaseId);
    return { ok: true };
  },
});

export const bulkUpdateStatus = mutation({
  args: {
    purchaseIds: v.array(v.id("purchases")),
    newStatus: v.union(v.literal("approved"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me.role === "user") throw new ConvexError("Forbidden");
    if (args.newStatus === "rejected" && !args.note?.trim()) {
      throw new ConvexError("Rejection note required");
    }

    const identity = await ctx.auth.getUserIdentity();
    const callerClerkId = identity?.subject ?? me.clerkId;
    const results: { id: Id<"purchases">; ok: boolean; error?: string }[] = [];
    const now = Date.now();

    for (const id of args.purchaseIds) {
      const purchase = await ctx.db.get(id);
      if (!purchase) {
        results.push({ id, ok: false, error: "Not found" });
        continue;
      }
      if (purchase.status !== "pending") {
        results.push({ id, ok: false, error: "Not pending" });
        continue;
      }
      if (
        me.role === "master" &&
        purchase.edited_by_clerkId === callerClerkId
      ) {
        results.push({ id, ok: false, error: "CONFLICT" });
        continue;
      }
      if (me.role === "master") {
        const owner = await ctx.db.get(purchase.user_id);
        if (!owner || owner.assigned_master_id !== me._id) {
          results.push({ id, ok: false, error: "Forbidden" });
          continue;
        }
      }

      await ctx.db.patch(id, {
        status: args.newStatus,
        status_note: args.note,
        status_updated_by: me._id,
        status_updated_at: now,
      });

      await ctx.db.insert("audit_log", {
        purchase_id: id,
        action: "status_changed",
        performed_by: me._id,
        performed_by_role: me.role,
        performed_by_name: me.name,
        conflict_flag: false,
        changes: JSON.stringify({
          from: "pending",
          to: args.newStatus,
          note: args.note ?? null,
          bulk: true,
        }),
        timestamp: now,
      });

      const owner = await ctx.db.get(purchase.user_id);
      if (owner) {
        await ctx.db.insert("notifications", {
          user_id: owner._id,
          type:
            args.newStatus === "approved"
              ? "claim_approved"
              : "claim_rejected",
          title: `Claim #${purchase.display_id} ${args.newStatus}`,
          message: `Your claim for ${purchase.products_purchased} has been ${args.newStatus}.${args.note ? " Note: " + args.note : ""}`,
          purchase_id: id,
          is_read: false,
          created_at: now,
        });
        await ctx.scheduler.runAfter(0, internal.email.sendClaimStatusEmail, {
          purchaseId: id,
        });
      }

      if (args.newStatus === "approved") {
        const istDate = new Date(
          purchase.date_of_purchase + 5.5 * 60 * 60 * 1000,
        );
        const month = istDate.getUTCMonth() + 1;
        const year = istDate.getUTCFullYear();
        await ctx.scheduler.runAfter(0, internal.budgets.checkBudgetAndNotify, {
          userId: purchase.user_id,
          month,
          year,
        });
      }
      results.push({ id, ok: true });
    }
    return results;
  },
});

export const getMany = query({
  args: { ids: v.array(v.id("purchases")) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const out: Doc<"purchases">[] = [];
    for (const id of args.ids) {
      const p = await ctx.db.get(id);
      if (!p) continue;
      const ok = await canUserAccessPurchase(ctx, me, p);
      if (ok) out.push(p);
    }
    return out;
  },
});

export const _internalGet = internalMutation({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.purchaseId);
  },
});
