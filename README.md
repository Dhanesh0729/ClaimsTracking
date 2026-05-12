# ClaimTrack — Purchase Reimbursement Tracker

A full-stack React (TSX) + Convex DB web app for tracking corporate purchase reimbursements. Built for desktop and mobile.

## 1. Prerequisites

- **Node.js 18+** and **npm** (or pnpm)
- A **Convex** account — https://convex.dev (free tier)
- A **Clerk** account — https://clerk.com (free tier)
- A **Resend** account — https://resend.com (free tier — 3,000 emails/month, 100/day)

## 2. Install

```bash
npm install
npx convex dev
```

The first `npx convex dev` will:
- Prompt you to log in to Convex
- Create or link to a deployment
- Generate `convex/_generated/*` files
- Continuously sync your `convex/**/*.ts` files

Keep `npx convex dev` running in one terminal while developing.

## 3. Environment variables

### Frontend `.env` (copy from `.env.example`)

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxx
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

`VITE_CONVEX_URL` is printed by `npx convex dev` on first run.

### Convex environment variables (set via Convex dashboard — NOT in .env)

In your Convex dashboard → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `CLERK_FRONTEND_API_URL` | yes | Clerk Frontend API URL (`https://*.clerk.accounts.dev`) |
| `RESEND_API_KEY` | yes | Resend API key for sending emails |
| `RESEND_FROM_EMAIL` | optional | Defaults to `ClaimTrack <onboarding@resend.dev>` (sandbox) |
| `APP_URL` | optional | URL used inside CTA buttons in emails |

You can also set them via CLI:
```bash
npx convex env set RESEND_API_KEY re_xxxxxxxxxxxxxxx
npx convex env set CLERK_FRONTEND_API_URL https://your-domain.clerk.accounts.dev
```

## 4. Clerk setup (step by step)

1. Create a Clerk app at https://clerk.com
2. In the Clerk dashboard → User & Authentication → Email, Phone, Username: enable **Email + Password**. Disable other providers (Google OAuth is deferred per spec).
3. Email Verification: enabled (default).
4. Copy your **Publishable Key** (`pk_test_*`) and paste it into `.env` as `VITE_CLERK_PUBLISHABLE_KEY`.
5. In the Clerk dashboard, go to **JWT Templates** → New template → name it `convex`. Use the default Convex template (or include `sub`/`email` claims). Save.
6. Copy your Clerk **Frontend API URL** (looks like `https://something.clerk.accounts.dev`). This is shown on the Clerk dashboard home and on the JWT template page.
7. In the **Convex dashboard** → Settings → Authentication → Add JWT provider: paste the Frontend API URL.
8. Also set `CLERK_FRONTEND_API_URL` as a Convex env var (it's read by `convex/auth.config.ts`).

## 5. Resend setup

1. Sign up at https://resend.com (free, no credit card required).
2. **For dev/testing**: use Resend's sandbox. Sender = `onboarding@resend.dev`. You can only send to your own verified address until you verify a domain.
3. **For production**: in the Resend dashboard, verify your domain (add 2 DNS TXT records). Takes ~5 minutes.
4. Create an API key (Settings → API Keys → Create).
5. Set the key in Convex:
   ```bash
   npx convex env set RESEND_API_KEY re_xxxxxxxxxxxxxxxxxxxxxx
   ```
6. Optionally override the sender:
   ```bash
   npx convex env set RESEND_FROM_EMAIL "ClaimTrack <notifications@yourdomain.com>"
   ```

## 6. Seed the unique-code tracker

After Convex is connected:

```bash
npx convex run seed:initUniqueCodeTracker
```

This creates the single document used to atomically assign unique codes (`A000-0001`, `A000-0002`, …) to new users.

## 7. Create your account

1. Run the dev server:
   ```bash
   npm run dev
   ```
2. Visit http://localhost:5173.
3. Click **Sign up**. Register with the email you want to make Super Admin (the seed default is `dhaneshsuyambu@gmail.com`).
4. Verify the email via the link Clerk sends.
5. Complete the **Onboarding** form (Name + Mobile). This creates your Convex user record.

## 8. Promote to Super Admin

Once you have a Convex user record (verify with `npx convex dashboard` → users table), promote yourself via the CLI:

```bash
npx convex run seed:promoteToSuperAdmin '{"email":"dhaneshsuyambu@gmail.com"}'
```

Expected output:
```
"Super Admin promoted successfully for <your name>"
```

Sign out and back in — your role is now `super_admin`.

> **Safety**: this mutation refuses to run if a Super Admin already exists. To transfer the role to someone else, use the in-app User Registry → Role dropdown → "Transfer Super…". The transfer is atomic (you become Admin in the same transaction).

## 9. Cron timezone note

All Convex cron schedules use **UTC**. IST is UTC+5:30.

| Cron | UTC | IST |
|------|-----|-----|
| Deletion warning (morning) | 03:30 | 09:00 |
| Deletion warning (evening) | 11:30 | 17:00 |
| Auto-delete expired | 00:00 | 05:30 |
| Orphan file cleanup | 02:00 Sun | 07:30 Sun |

Crons fire within ~1–2 minutes of the scheduled time (Convex guarantee).

## 10. Resend free-tier limits

- **100 emails/day, 3,000/month**.
- Monitor usage at https://resend.com/dashboard.
- The deletion warning system sends 2 emails/day × 7 days = **14 emails per expiring record**. Plan ahead for large teams.
- The dispatcher (`convex/email.ts → sendEmail`) handles HTTP 429 gracefully (logs a warning and continues) — cron jobs will never crash because of email errors.

## 11. Folder structure

```
ClaimTrackingApp/
├─ src/
│  ├─ App.tsx              # Routes & role guards
│  ├─ main.tsx             # Clerk + Convex providers
│  ├─ index.css            # Tailwind + tokens
│  ├─ pages/               # Route-level components
│  │  ├─ auth/             # SignIn, SignUp, Onboarding
│  │  ├─ dashboard/        # User/Master/Admin views
│  │  ├─ purchases/        # List, Add, Detail
│  │  ├─ approvals/        # Approval queue + bulk actions
│  │  ├─ admin/            # Users, Reports, Audit
│  │  ├─ master/           # MasterReports
│  │  ├─ NotificationsPage.tsx
│  │  └─ ProfilePage.tsx
│  ├─ components/
│  │  ├─ layout/           # Sidebar, Navbar, BottomNav, NotificationBell
│  │  ├─ ui/               # ShadCN primitives + custom badges
│  │  └─ purchases/        # FileUploadZone, PurchaseTable, AddPurchaseForm,
│  │                       # DuplicateWarningModal, SelectionActionBar
│  └─ lib/                 # utils, formatters, exportExcel, exportPdf, exportAuditCsv
└─ convex/
   ├─ schema.ts            # 8 tables, all indexes & searchIndexes
   ├─ auth.config.ts       # Clerk JWT provider
   ├─ seed.ts              # initUniqueCodeTracker, promoteToSuperAdmin (CLI only)
   ├─ users.ts             # Onboarding, role mgmt, master assignment, super-admin transfer
   ├─ purchases.ts         # CRUD + atomic display_id + duplicate check + edit lock + conflict guard
   ├─ roleRequests.ts      # Request submit + admin decision + notifications
   ├─ budgets.ts           # Set/edit cap + 80/100% notify + email triggers
   ├─ analytics.ts         # Indexed aggregations for User/Master/Admin dashboards
   ├─ notifications.ts     # In-app notifications + unread count + mark-read
   ├─ auditLog.ts          # Filtered audit log queries
   ├─ email.ts             # Resend dispatcher + all email templates (Node action)
   ├─ emailData.ts         # Helper queries used by email actions
   ├─ jobs.ts              # Deletion warning + auto-delete + orphan cleanup
   ├─ crons.ts             # 4 cron entries
   └─ lib/helpers.ts       # formatIST, formatINR, counterToCode, buildBillRef, requireUser
```

## Architecture highlights

- **Atomic display_id and unique_code**: every new purchase / new user reads the per-user tracker doc, increments it, and patches in a single mutation. Convex serializes mutations per-document, so this is race-free without explicit locks.
- **Conflict-of-interest guard** (Master approval): every approve/reject mutation re-checks `purchase.edited_by_clerkId === callerClerkId` server-side. The UI also hides the buttons (double guard).
- **Edit lock**: when a purchase's status is anything other than `pending`, the `updatePurchase` mutation refuses the edit for role=`user`. The UI hides the edit/delete buttons too.
- **6-month retention**: each purchase carries `scheduled_deletion_date = bill_received_time + 180 days`. Day 173 activates the 7-day warning window. Two daily crons send warning emails; the daily delete cron purges expired records, deletes storage files, writes an audit row, sends a confirmation email.
- **All search is server-side** via `searchIndex` on `products_purchased` and `purchase_platform`. Min 2 characters, 300ms debounce, paginated 25/page.
- **All analytics aggregations run inside Convex queries** using indexed date-range scans — never `.collect()` on the full table without an index.

## NPM scripts

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # Type-check + production build
npm run preview      # Preview the production build
npm run convex:dev   # Convex dev sync (alternative to npx)
npm run convex:deploy # Convex production deploy
```

## Deploying to production

1. Run `npx convex deploy` (deploys backend + crons).
2. Build the frontend: `npm run build`.
3. Host `dist/` on any static host (Vercel, Netlify, Cloudflare Pages, etc.).
4. In your prod hosting environment variables, set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CONVEX_URL` (use the production Convex URL).
5. In Convex prod settings, add the Resend key, Clerk frontend API URL, and `APP_URL` (your prod URL).
6. Add your production domain to Clerk's allowed origins.
7. Run the seed commands against production:
   ```bash
   npx convex run --prod seed:initUniqueCodeTracker
   npx convex run --prod seed:promoteToSuperAdmin '{"email":"dhaneshsuyambu@gmail.com"}'
   ```
