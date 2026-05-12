import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 180;
const WARN_DAY = 173;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function _formatIST(timestamp: number): string {
  const d = new Date(timestamp + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_ABBREV[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year} ${hour}:${min} IST`;
}

function _buildBillRef(billReceivedTime: number, userName: string, displayId: number) {
  const d = new Date(billReceivedTime + IST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const cleanName = userName.toUpperCase().replace(/\s+/g, "_");
  const billNum = "BILL" + String(displayId).padStart(4, "0");
  return `${year}_${month}_${cleanName}_${billNum}`;
}

export const activateWarnings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - WARN_DAY * DAY_MS;
    const newlyEligible = await ctx.db
      .query("purchases")
      .withIndex("by_deletion_warned", (q) => q.eq("deletion_warned", false))
      .collect();

    const activated: Array<{ id: string }> = [];
    for (const p of newlyEligible) {
      if (p.bill_received_time > cutoff) continue;
      const scheduled = p.bill_received_time + RETENTION_DAYS * DAY_MS;
      await ctx.db.patch(p._id, {
        deletion_warned: true,
        deletion_warn_start: Date.now(),
        scheduled_deletion_date: scheduled,
      });
      await ctx.db.insert("notifications", {
        user_id: p.user_id,
        type: "deletion_warning",
        title: `Bill #${p.display_id} expiring soon`,
        message: `Your bill record for ${p.products_purchased} will be permanently deleted on ${_formatIST(scheduled)}. Download before then.`,
        purchase_id: p._id,
        is_read: false,
        created_at: Date.now(),
      });
      activated.push({ id: p._id });
    }
    return { activated: activated.length };
  },
});

export const listActiveWarnings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db
      .query("purchases")
      .withIndex("by_deletion_warned", (q) => q.eq("deletion_warned", true))
      .collect();
    return all
      .filter((p) => (p.scheduled_deletion_date ?? 0) > now)
      .map((p) => ({
        _id: p._id,
        scheduled: p.scheduled_deletion_date ?? 0,
      }));
  },
});

export const runDeletionWarnings = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.jobs.activateWarnings, {});
    const active = await ctx.runMutation(internal.jobs.listActiveWarnings, {});
    const now = Date.now();
    for (const item of active) {
      const daysLeft = Math.max(
        0,
        Math.ceil((item.scheduled - now) / DAY_MS),
      );
      if (daysLeft > 7 || daysLeft < 0) continue;
      await ctx.runAction(internal.email.sendDeletionWarningEmail, {
        purchaseId: item._id,
        daysLeft,
      });
    }
  },
});

export const collectExpiredForDeletion = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("purchases")
      .withIndex("by_scheduled_deletion", (q) =>
        q.lt("scheduled_deletion_date", now),
      )
      .collect();

    const snapshots = [];
    for (const p of candidates) {
      if (!p.scheduled_deletion_date) continue;
      const owner = await ctx.db.get(p.user_id);
      const billRef = _buildBillRef(
        p.bill_received_time,
        owner?.name ?? "USER",
        p.display_id,
      );
      snapshots.push({
        purchaseId: p._id,
        user_id: p.user_id,
        owner_name: owner?.name ?? "User",
        owner_email: owner?.email ?? "",
        display_id: p.display_id,
        product_name: p.products_purchased,
        amount: p.amount_spent,
        bill_received_time: p.bill_received_time,
        billRef,
        storageIds: p.bill_files.map((f) => f.storageId),
      });
    }
    return snapshots;
  },
});

export const finalizeDeletion = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    bill_received_time: v.number(),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.purchaseId);
    if (!p) return { skipped: true };

    await ctx.db.insert("audit_log", {
      purchase_id: args.purchaseId,
      action: "auto_deleted",
      performed_by: undefined,
      performed_by_role: "SYSTEM",
      performed_by_name: "ClaimTrack Auto-Deletion",
      conflict_flag: false,
      changes: JSON.stringify({
        deletedAt: Date.now(),
        bill_received_time: args.bill_received_time,
      }),
      timestamp: Date.now(),
    });

    await ctx.db.insert("notifications", {
      user_id: p.user_id,
      type: "deletion_complete",
      title: `Bill #${p.display_id} deleted`,
      message: `Your bill record for ${p.products_purchased} (₹${p.amount_spent}) has been permanently deleted per the 6-month retention policy.`,
      is_read: false,
      created_at: Date.now(),
    });

    await ctx.db.delete(args.purchaseId);

    const remaining = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("user_id", p.user_id))
      .first();
    if (!remaining) {
      const tracker = await ctx.db
        .query("display_id_tracker")
        .withIndex("by_user", (q) => q.eq("user_id", p.user_id))
        .unique();
      if (tracker) await ctx.db.delete(tracker._id);
    }
    return { ok: true };
  },
});

export const deleteExpiredRecords = internalAction({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.runMutation(
      internal.jobs.collectExpiredForDeletion,
      {},
    );
    for (const s of snapshots) {
      for (const sid of s.storageIds) {
        try {
          await ctx.storage.delete(sid);
        } catch (e) {
          console.warn("[jobs] storage.delete failed for", sid, e);
        }
      }
      await ctx.runMutation(internal.jobs.finalizeDeletion, {
        purchaseId: s.purchaseId,
        bill_received_time: s.bill_received_time,
      });
      if (s.owner_email) {
        await ctx.runAction(internal.email.sendDeletionCompleteEmail, {
          userEmail: s.owner_email,
          userName: s.owner_name,
          billRef: s.billRef,
          displayId: s.display_id,
          productName: s.product_name,
          amount: s.amount,
        });
      }
    }
    console.log(`[jobs] Auto-deleted ${snapshots.length} expired records`);
  },
});

export const collectReferencedStorageIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("purchases").collect();
    const ids = new Set<string>();
    for (const p of all) {
      for (const f of p.bill_files) ids.add(f.storageId);
    }
    return Array.from(ids);
  },
});

export const cleanupOrphanFiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const referenced = new Set(
      await ctx.runMutation(internal.jobs.collectReferencedStorageIds, {}),
    );
    let removed = 0;
    try {
      const list: any = (ctx.storage as any).list
        ? await (ctx.storage as any).list()
        : null;
      if (list && Array.isArray(list)) {
        for (const item of list) {
          const sid = item._id ?? item.id ?? item.storageId;
          if (sid && !referenced.has(sid)) {
            try {
              await ctx.storage.delete(sid);
              removed++;
            } catch (e) {
              console.warn("[jobs] cleanup failed for", sid, e);
            }
          }
        }
      } else {
        console.log("[jobs] storage.list() not available — orphan cleanup skipped");
      }
    } catch (e) {
      console.warn("[jobs] cleanupOrphanFiles error:", e);
    }
    console.log(`[jobs] Cleaned ${removed} orphan files`);
  },
});
