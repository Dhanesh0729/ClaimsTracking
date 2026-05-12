import { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatIST(timestamp: number): string {
  const d = new Date(timestamp + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_ABBREV[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year} ${hour}:${min} IST`;
}

export function formatINR(amount: number): string {
  const fixed = amount.toFixed(2);
  const [whole, dec] = fixed.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  if (digits.length <= 3) {
    return `${negative ? "-" : ""}₹${digits}.${dec}`;
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const restFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}₹${restFormatted},${last3}.${dec}`;
}

export function counterToCode(n: number): string {
  const LETTER_IDX = Math.floor(n / 10_000_000);
  const rem = n % 10_000_000;
  const group = Math.floor(rem / 10_000);
  const seq = rem % 10_000;
  const letter = String.fromCharCode(65 + LETTER_IDX);
  return `${letter}${String(group).padStart(3, "0")}-${String(seq).padStart(4, "0")}`;
}

export function buildBillRef(
  billReceivedTime: number,
  userName: string,
  displayId: number,
): string {
  const d = new Date(billReceivedTime + IST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const cleanName = userName.toUpperCase().replace(/\s+/g, "_");
  const billNum = "BILL" + String(displayId).padStart(4, "0");
  return `${year}_${month}_${cleanName}_${billNum}`;
}

export function getMonthBounds(month: number, year: number): { start: number; end: number } {
  const start = Date.UTC(year, month - 1, 1) - IST_OFFSET_MS;
  const end = Date.UTC(year, month, 1) - IST_OFFSET_MS;
  return { start, end };
}

export function getDayBoundsIST(timestamp: number): { start: number; end: number } {
  const istDate = new Date(timestamp + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();
  const d = istDate.getUTCDate();
  const start = Date.UTC(y, m, d) - IST_OFFSET_MS;
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new ConvexError("User not registered — complete onboarding first");
  }
  return user;
}

export async function getUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
}

export function isAdmin(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export function isPrivileged(role: string): boolean {
  return role === "master" || role === "admin" || role === "super_admin";
}

export function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "master":
      return "Master";
    case "user":
      return "User";
    default:
      return role;
  }
}

export async function appendAuditLog(
  ctx: MutationCtx,
  args: {
    purchase_id: Id<"purchases">;
    action: "created" | "edited" | "deleted" | "status_changed" | "auto_deleted";
    performed_by: Id<"users"> | undefined;
    performed_by_role: string;
    performed_by_name: string;
    conflict_flag: boolean;
    changes: string;
  },
): Promise<void> {
  await ctx.db.insert("audit_log", {
    ...args,
    timestamp: Date.now(),
  });
}
