import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    mobile: v.string(),
    unique_code: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("master"),
      v.literal("user"),
    ),
    assigned_master_id: v.optional(v.id("users")),
    created_at: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_assigned_master", ["assigned_master_id"]),

  purchases: defineTable({
    user_id: v.id("users"),
    display_id: v.number(),
    products_purchased: v.string(),
    amount_spent: v.number(),
    purchase_platform: v.string(),
    bank_used_to_pay: v.string(),
    upi_app_used_to_pay: v.string(),
    category: v.union(
      v.literal("Food"),
      v.literal("Travel"),
      v.literal("Accommodation"),
      v.literal("Supplies"),
      v.literal("Equipment"),
      v.literal("Communication"),
      v.literal("Other"),
    ),
    date_of_purchase: v.number(),
    bill_received_time: v.number(),
    bill_files: v.array(
      v.object({
        storageId: v.string(),
        fileName: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
        convexUrl: v.string(),
      }),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("reimbursed"),
    ),
    status_note: v.optional(v.string()),
    status_updated_by: v.optional(v.id("users")),
    status_updated_at: v.optional(v.number()),
    edited_by: v.optional(v.id("users")),
    edited_by_clerkId: v.optional(v.string()),
    edited_at: v.optional(v.number()),
    edited_by_role: v.optional(v.string()),
    is_duplicate_flagged: v.boolean(),
    deletion_warned: v.boolean(),
    deletion_warn_start: v.optional(v.number()),
    scheduled_deletion_date: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_user_and_date", ["user_id", "date_of_purchase"])
    .index("by_user_and_status", ["user_id", "status"])
    .index("by_status", ["status"])
    .index("by_date", ["date_of_purchase"])
    .index("by_bill_received_time", ["bill_received_time"])
    .index("by_deletion_warned", ["deletion_warned"])
    .index("by_scheduled_deletion", ["scheduled_deletion_date"])
    .searchIndex("search_products", {
      searchField: "products_purchased",
      filterFields: ["user_id", "status", "category"],
    })
    .searchIndex("search_platform", {
      searchField: "purchase_platform",
      filterFields: ["user_id", "status"],
    }),

  budgets: defineTable({
    user_id: v.id("users"),
    month: v.number(),
    year: v.number(),
    budget_cap: v.number(),
    set_by: v.id("users"),
    created_at: v.number(),
  }).index("by_user_month_year", ["user_id", "month", "year"]),

  audit_log: defineTable({
    purchase_id: v.id("purchases"),
    action: v.union(
      v.literal("created"),
      v.literal("edited"),
      v.literal("deleted"),
      v.literal("status_changed"),
      v.literal("auto_deleted"),
    ),
    performed_by: v.optional(v.id("users")),
    performed_by_role: v.string(),
    performed_by_name: v.string(),
    conflict_flag: v.boolean(),
    changes: v.string(),
    timestamp: v.number(),
  })
    .index("by_purchase", ["purchase_id"])
    .index("by_timestamp", ["timestamp"])
    .index("by_performer", ["performed_by"])
    .index("by_conflict_flag", ["conflict_flag"]),

  display_id_tracker: defineTable({
    user_id: v.id("users"),
    last_display_id: v.number(),
  }).index("by_user", ["user_id"]),

  unique_code_tracker: defineTable({
    counter: v.number(),
    last_code: v.string(),
  }),

  notifications: defineTable({
    user_id: v.id("users"),
    type: v.union(
      v.literal("claim_approved"),
      v.literal("claim_rejected"),
      v.literal("claim_reimbursed"),
      v.literal("budget_warning"),
      v.literal("budget_exceeded"),
      v.literal("deletion_warning"),
      v.literal("deletion_complete"),
      v.literal("role_request_received"),
      v.literal("role_request_approved"),
      v.literal("role_request_rejected"),
    ),
    title: v.string(),
    message: v.string(),
    purchase_id: v.optional(v.id("purchases")),
    role_request_id: v.optional(v.id("role_requests")),
    is_read: v.boolean(),
    created_at: v.number(),
  })
    .index("by_user_unread", ["user_id", "is_read"])
    .index("by_user", ["user_id"]),

  role_requests: defineTable({
    requester_id: v.id("users"),
    requester_name: v.string(),
    requester_unique_code: v.string(),
    current_role: v.string(),
    requested_role: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    decision_by: v.optional(v.id("users")),
    decision_note: v.optional(v.string()),
    decided_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_requester", ["requester_id"])
    .index("by_status", ["status"]),
});
