import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const initUniqueCodeTracker = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("unique_code_tracker").first();
    if (existing) {
      return `Tracker already exists (counter=${existing.counter}). No action taken.`;
    }
    await ctx.db.insert("unique_code_tracker", {
      counter: 1,
      last_code: "",
    });
    return "Unique code tracker initialized (counter=1)";
  },
});

export const promoteToSuperAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existingSuper = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .first();

    if (existingSuper && existingSuper.email !== args.email) {
      throw new ConvexError(
        "A Super Admin already exists. Transfer the role from the existing Super Admin inside the app.",
      );
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      throw new ConvexError(
        "User not found — sign up first through the app, then run this command",
      );
    }

    if (user.role === "super_admin") {
      return `User ${user.name} is already Super Admin.`;
    }

    await ctx.db.patch(user._id, { role: "super_admin" });
    return `Super Admin promoted successfully for ${user.name}`;
  },
});
