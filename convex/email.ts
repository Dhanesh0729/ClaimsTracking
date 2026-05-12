"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatIST(timestamp: number): string {
  const d = new Date(timestamp + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_ABBREV[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year} ${hour}:${min} IST`;
}

function formatINR(amount: number): string {
  const fixed = amount.toFixed(2);
  const [whole, dec] = fixed.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  if (digits.length <= 3) return `${negative ? "-" : ""}₹${digits}.${dec}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const restFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}₹${restFormatted},${last3}.${dec}`;
}

function buildBillRef(billReceivedTime: number, userName: string, displayId: number) {
  const d = new Date(billReceivedTime + IST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const cleanName = userName.toUpperCase().replace(/\s+/g, "_");
  const billNum = "BILL" + String(displayId).padStart(4, "0");
  return `${year}_${month}_${cleanName}_${billNum}`;
}

const FROM_EMAIL = () =>
  process.env.RESEND_FROM_EMAIL ?? "ClaimTrack <onboarding@resend.dev>";

const APP_URL = () => process.env.APP_URL ?? "https://claimtrack.app";

function emailShell(contentHtml: string): string {
  return `<!doctype html><html><body style="margin:0;font-family:Helvetica,Arial,sans-serif;background:#F8FAFC;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:4px;overflow:hidden;">
      <div style="background:#0F172A;color:#FFFFFF;padding:16px 24px;font-weight:700;font-size:20px;">ClaimTrack</div>
      <div style="padding:24px;color:#0F172A;font-size:14px;line-height:1.6;">${contentHtml}</div>
      <div style="background:#0F172A;color:#FFFFFF;padding:12px 24px;font-size:12px;text-align:center;">ClaimTrack — Automated Notification</div>
    </div>
  </body></html>`;
}

function detailsTable(rows: Array<[string, string]>): string {
  const tr = rows
    .map(
      ([label, value]) =>
        `<tr><td style="background:#F8FAFC;padding:8px 12px;font-weight:600;border:1px solid #E2E8F0;width:35%;">${label}</td><td style="padding:8px 12px;border:1px solid #E2E8F0;">${value}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">${tr}</table>`;
}

function ctaButton(label: string, url: string): string {
  return `<div style="text-align:center;margin:20px 0;"><a href="${url}" style="display:inline-block;background:#F59E0B;color:#0F172A;padding:12px 24px;text-decoration:none;font-weight:600;border-radius:4px;">${label}</a></div>`;
}

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[email] RESEND_API_KEY not set — skipping send to", args.to);
      return { skipped: true };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL(),
          to: args.to,
          subject: args.subject,
          html: args.html,
        }),
      });
      if (res.status === 429) {
        console.warn("[email] Resend rate limit hit (429)");
        return { rateLimited: true };
      }
      if (!res.ok) {
        const text = await res.text();
        console.warn("[email] Resend non-OK status", res.status, text);
        return { error: text };
      }
      return { ok: true };
    } catch (e: any) {
      console.warn("[email] Network error:", String(e?.message ?? e));
      return { error: String(e?.message ?? e) };
    }
  },
});

export const sendClaimStatusEmail = internalAction({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailData.fetchPurchaseForEmail,
      { purchaseId: args.purchaseId },
    );
    if (!payload) return;
    const { purchase, user } = payload;
    if (!user.email) return;
    const billRef = buildBillRef(
      purchase.bill_received_time,
      user.name,
      purchase.display_id,
    );
    const statusLabel =
      purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1);
    const html = emailShell(
      `<p>Dear ${user.name},</p>
       <p>The status of your claim has been updated to <strong>${statusLabel}</strong>.</p>
       ${detailsTable([
         ["Bill Reference", billRef],
         ["Purchase ID", `#${purchase.display_id}`],
         ["Product", purchase.products_purchased],
         ["Amount", formatINR(purchase.amount_spent)],
         ["Platform", purchase.purchase_platform],
         ["New Status", statusLabel],
         ...(purchase.status_note
           ? [["Note", purchase.status_note] as [string, string]]
           : []),
         ["Updated On", formatIST(purchase.status_updated_at ?? Date.now())],
       ])}
       ${ctaButton("Open ClaimTrack", APP_URL())}
       <p style="color:#64748B;font-size:12px;">This is an automated message.</p>`,
    );
    await ctx.runAction(internal.email.sendEmail, {
      to: user.email,
      subject: `Claim #${purchase.display_id} — ${statusLabel} — ClaimTrack`,
      html,
    });
  },
});

export const sendBudgetWarningEmail = internalAction({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
    percent: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.emailData.getUser, {
      userId: args.userId,
    });
    if (!user) return;
    const budget = await ctx.runQuery(internal.emailData.getBudget, {
      userId: args.userId,
      month: args.month,
      year: args.year,
    });
    if (!budget) return;
    const html = emailShell(
      `<p>Dear ${user.name},</p>
       <p>You have used <strong>${args.percent}%</strong> of your monthly reimbursement budget cap.</p>
       ${detailsTable([
         ["Month", `${args.month}/${args.year}`],
         ["Budget Cap", formatINR(budget.budget_cap)],
         ["Usage", `${args.percent}%`],
       ])}
       <p>Please review your pending and approved claims to avoid exceeding the cap.</p>
       ${ctaButton("Open ClaimTrack", APP_URL())}`,
    );
    await ctx.runAction(internal.email.sendEmail, {
      to: user.email,
      subject: `⚠️ Budget Warning — ${args.percent}% of monthly cap used`,
      html,
    });
  },
});

export const sendBudgetExceededEmail = internalAction({
  args: {
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.emailData.getUser, {
      userId: args.userId,
    });
    if (!user) return;
    const budget = await ctx.runQuery(internal.emailData.getBudget, {
      userId: args.userId,
      month: args.month,
      year: args.year,
    });
    if (!budget) return;
    const html = emailShell(
      `<p>Dear ${user.name},</p>
       <p>You have <strong>exceeded</strong> your monthly reimbursement budget cap.</p>
       ${detailsTable([
         ["Month", `${args.month}/${args.year}`],
         ["Budget Cap", formatINR(budget.budget_cap)],
       ])}
       <p>Further claim approvals may be reviewed more strictly.</p>
       ${ctaButton("Open ClaimTrack", APP_URL())}`,
    );
    await ctx.runAction(internal.email.sendEmail, {
      to: user.email,
      subject: `🚨 Budget Exceeded — ${args.month}/${args.year}`,
      html,
    });
    if (user.assigned_master_id) {
      const master = await ctx.runQuery(internal.emailData.getUser, {
        userId: user.assigned_master_id,
      });
      if (master?.email) {
        const masterHtml = emailShell(
          `<p>Dear ${master.name},</p>
           <p>Your assigned user <strong>${user.name}</strong> has exceeded their ${args.month}/${args.year} budget of ${formatINR(budget.budget_cap)}.</p>
           ${ctaButton("Open ClaimTrack", APP_URL())}`,
        );
        await ctx.runAction(internal.email.sendEmail, {
          to: master.email,
          subject: `🚨 ${user.name} exceeded budget — ClaimTrack`,
          html: masterHtml,
        });
      }
    }
  },
});

export const sendDeletionWarningEmail = internalAction({
  args: {
    purchaseId: v.id("purchases"),
    daysLeft: v.number(),
  },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailData.fetchPurchaseForEmail,
      { purchaseId: args.purchaseId },
    );
    if (!payload) return;
    const { purchase, user } = payload;
    if (!user.email) return;
    const billRef = buildBillRef(
      purchase.bill_received_time,
      user.name,
      purchase.display_id,
    );
    const html = emailShell(
      `<p>Dear ${user.name},</p>
       <p>This is an automated notification from ClaimTrack.</p>
       <p>The following bill record is scheduled for permanent deletion in <strong>${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}</strong> as part of our 6-month data retention policy.</p>
       ${detailsTable([
         ["Bill Reference", billRef],
         ["Purchase ID", `#${purchase.display_id}`],
         ["Product", purchase.products_purchased],
         ["Amount", formatINR(purchase.amount_spent)],
         ["Platform", purchase.purchase_platform],
         ["Submitted On", formatIST(purchase.bill_received_time)],
         ["Deletion Date", formatIST(purchase.scheduled_deletion_date ?? 0)],
       ])}
       <p>To retain this record, please download your purchase report before the deletion date using the ClaimTrack application.</p>
       ${ctaButton("Open ClaimTrack", APP_URL())}
       <p style="color:#64748B;font-size:12px;">This is an automated message. Please do not reply.</p>
       <p>Regards,<br/>ClaimTrack System</p>`,
    );
    await ctx.runAction(internal.email.sendEmail, {
      to: user.email,
      subject: `⚠️ Bill Deletion Notice — ${billRef} — ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"} remaining`,
      html,
    });
  },
});

export const sendDeletionCompleteEmail = internalAction({
  args: {
    userEmail: v.string(),
    userName: v.string(),
    billRef: v.string(),
    displayId: v.number(),
    productName: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const html = emailShell(
      `<p>Dear ${args.userName},</p>
       <p>This is to confirm that the following bill record has been permanently deleted from ClaimTrack as per our 6-month data retention policy.</p>
       ${detailsTable([
         ["Bill Reference", args.billRef],
         ["Purchase ID", `#${args.displayId}`],
         ["Product", args.productName],
         ["Amount", formatINR(args.amount)],
         ["Deleted On", formatIST(Date.now())],
       ])}
       <p>This record and all associated files have been permanently removed and cannot be recovered.</p>
       <p>Regards,<br/>ClaimTrack System</p>`,
    );
    await ctx.runAction(internal.email.sendEmail, {
      to: args.userEmail,
      subject: `🗑️ Bill Deleted — ${args.billRef} — ClaimTrack`,
      html,
    });
  },
});

export const sendRoleRequestEmail = internalAction({
  args: {
    requestId: v.id("role_requests"),
    recipientIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const req = await ctx.runQuery(internal.emailData.getRoleRequest, {
      requestId: args.requestId,
    });
    if (!req) return;
    for (const rid of args.recipientIds) {
      const recipient = await ctx.runQuery(internal.emailData.getUser, {
        userId: rid,
      });
      if (!recipient?.email) continue;
      const html = emailShell(
        `<p>Dear ${recipient.name},</p>
         <p>A new role promotion request requires your review.</p>
         ${detailsTable([
           ["Requester", req.requester_name],
           ["Unique Code", req.requester_unique_code],
           ["Current Role", req.current_role],
           ["Requested Role", req.requested_role],
           ["Submitted", formatIST(req.created_at)],
         ])}
         ${ctaButton("Review Request", APP_URL() + "/admin/users")}`,
      );
      await ctx.runAction(internal.email.sendEmail, {
        to: recipient.email,
        subject: `New Role Request — ${req.requester_name} → ${req.requested_role}`,
        html,
      });
    }
  },
});

export const sendRoleDecisionEmail = internalAction({
  args: { requestId: v.id("role_requests") },
  handler: async (ctx, args) => {
    const req = await ctx.runQuery(internal.emailData.getRoleRequest, {
      requestId: args.requestId,
    });
    if (!req) return;
    const requester = await ctx.runQuery(internal.emailData.getUser, {
      userId: req.requester_id,
    });
    if (!requester?.email) return;
    const approved = req.status === "approved";
    const html = emailShell(
      `<p>Dear ${requester.name},</p>
       <p>Your role promotion request has been <strong>${approved ? "approved" : "rejected"}</strong>.</p>
       ${detailsTable([
         ["Requested Role", req.requested_role],
         ["Decision", approved ? "Approved" : "Rejected"],
         ...(req.decision_note
           ? [["Note", req.decision_note] as [string, string]]
           : []),
         ["Decided On", formatIST(req.decided_at ?? Date.now())],
       ])}
       ${ctaButton("Open ClaimTrack", APP_URL())}`,
    );
    await ctx.runAction(internal.email.sendEmail, {
      to: requester.email,
      subject: `Role Request ${approved ? "Approved" : "Rejected"} — ClaimTrack`,
      html,
    });
  },
});
