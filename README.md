# ClaimTrack — Premium Purchase Reimbursement System

ClaimTrack is a state-of-the-art, full-stack corporate purchase reimbursement tracking platform designed for desktop and mobile devices. Engineered with a highly responsive, modern glassmorphic interface, ClaimTrack streamlines the employee expense claim lifecycle from submission through multi-layered review to final reimbursement.

---

## 🌟 Key Pillars of the System

*   **⚡ Real-Time Cloud Architecture**: Fast data syncing, live notifications, and real-time dashboard analytics powered by a Convex Cloud database.
*   **🔒 Secure Identity & Access Management**: Fully integrated with Clerk for multi-tenant user authentication and secure session management.
*   **📧 Automated Email Dispatcher**: Integrated with Resend to automatically deliver status receipts, role change notifications, and monthly budget warnings.
*   **📅 Compliance & Data Retention**: Automatic 6-month data compliance lifecycle (180 days) that gracefully handles warnings and permanent purges.

---

## 👥 Role & Permissions Matrix

ClaimTrack secures operations through four hierarchical roles. The authorization levels are enforced at both the client-side UI and verified securely inside the Convex backend mutation handlers.

| Capability / Action | User (Employee) | Master (Manager) | Admin | Super Admin (Root) |
| :--- | :---: | :---: | :---: | :---: |
| **Submit Expense Claims** | ✅ | ✅ | ✅ | ✅ |
| **Edit/Delete Pending Claims** | ✅ (Own only) | ✅ (Own only) | ✅ (Own only) | ✅ (Own only) |
| **Review & Approve Team Claims** | ❌ | ✅ (Assigned only) | ✅ (All) | ✅ (All) |
| **Conflict-of-Interest Guard** | *N/A* | 🛡️ Enforced | 🛡️ Enforced | 🛡️ Enforced |
| **Manage Budgets & Limits** | ❌ | ❌ | ✅ | ✅ |
| **Approve Role Upgrade Requests** | ❌ | ❌ | ✅ | ✅ |
| **Manage Users & Assign Masters** | ❌ | ❌ | ❌ | ✅ |
| **Atomic Role Transfer** | ❌ | ❌ | ❌ | ✅ (Super Admin Transfer) |

---

## 🔄 End-to-End Application Workflows

### 1. Registration & User Onboarding
1. **Authentication**: Users sign up using their corporate email and password via Clerk.
2. **Profile Creation**: Upon first sign-in, the user is redirected to a mandatory onboarding portal to input their full name and mobile number.
3. **Atomic Identification**: The system assigns a unique, immutable registration code (e.g., `A000-0001`) from an atomic database tracker.
4. **Initial Assignment**: The user is initialized with the `user` role and is ready to submit claims.

### 2. Reimbursement Claim Lifecycle
1. **Claim Submission**:
   * The user clicks **Add Purchase**, uploads receipt images/PDFs (up to 3 files), and inputs details: products, total amount spent, platform, date, and category.
   * The backend assigns an atomic, incrementing ID (e.g., `#1`) that cannot be duplicated.
   * The claim is initialized with the `pending` status.
2. **Safety & Integrity Checks**:
   * **Edit Lock**: Once a claim is updated to *Approved*, *Rejected*, or *Reimbursed*, it is permanently locked. A normal user can no longer edit or delete it.
   * **Conflict-of-Interest Guard**: A Master or Admin is blocked from approving or rejecting their own claims. The system requires another authorized reviewer to verify the claim.
3. **Manager Review**:
   * The assigned Master logs in and views their team's pending queue.
   * The Master can change the status to **Approved** or **Rejected** (with an optional explanation note).
   * Changing the status triggers an instant in-app notification and dispatches a detailed status email to the employee.
4. **Final Disbursal (Reimbursed)**:
   * Once finance disburses the funds, the claim status is moved to **Reimbursed**, signaling the end of the claim lifecycle.

### 3. Monthly Budget Allocation & Usage Alerts
*   **Personal Limits**: Admins configure individual monthly budget caps for employees based on corporate levels.
*   **Live Metrics**: Every employee dashboard displays progress bars visualizing their current monthly spending.
*   **Automated warnings**:
    *   **80% Capacity**: The moment a user's combined pending and approved claims hit **80%** of their monthly limit, they receive an automated warning email to monitor remaining funds.
    *   **100% Exceeded**: If the budget is exceeded, an automated alert email is sent to the employee, and an escalation email is sent directly to their assigned Master.

### 4. Role Promotion Requests
*   **The Request**: A user can submit a request in their Profile to upgrade their account to a **Master** or **Admin**.
*   **Administrative Actions**: Admins view a centralized **Role Requests** panel, allowing them to review the user's history and **Approve** or **Reject** the upgrade.
*   **Instant Sync**: Once approved, the role is instantly upgraded, and the user receives an email notification confirming their new access level.

### 5. Automated Data Retention & Auto-Purging
To maintain compliance and database health, ClaimTrack implements a strict 6-month retention cycle:
1. **Timestamping**: Every submitted claim is assigned an automatic deletion date exactly **180 days** from the receipt submission time.
2. **First Warning (Day 173)**: When a claim reaches 7 days before deletion, the system dispatches warning emails to the user, advising them to export their historical statements.
3. **Permanent Purging**: On Day 180, a secure background cron job permanently purges the claim record, deletes any receipt files stored in the cloud storage bucket, registers the event in the system audit logs, and emails the user a confirmation of deletion.

---

## 🛠️ Developer Setup & Configurations

### 1. Installation
Install dependencies and initialize your local development server:
```bash
npm install
```

### 2. Local Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```ini
# Clerk Publishable Key (found in your Clerk Dashboard)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Convex Dev Server URL (automatically generated when you run 'npx convex dev')
VITE_CONVEX_URL=your_convex_cloud_url
```

### 3. Syncing the Backend Dev-Daemon
Convex continuously syncs your local schema, triggers, and functions to the cloud. Start the sync server in a separate terminal:
```bash
npx convex dev
```

### 4. Running the Local Dev Server
Launch your Vite React frontend server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚀 Setting Up Core Cloud integrations

### 1. Clerk Authentication
1. Create a free application on [Clerk](https://clerk.com).
2. Set the User Authentication model to **Email + Password**.
3. Under **Configure -> JWT Templates**, click **New Template** and choose **Convex**. Keep the template name as exactly `convex` (lowercase). Save it.
4. Copy the Frontend API URL (`https://your-app.clerk.accounts.dev`) and add it to your Convex Cloud environment under the `convex/auth.config.ts` configuration.

### 2. Resend Emails
1. Sign up for a free email API account at [Resend](https://resend.com) and copy your generated API key.
2. Register the environment variable on your Convex Cloud backend:
   ```bash
   npx convex env set RESEND_API_KEY re_your_api_key
   ```
3. Set the application base URL so call-to-actions point to your local port:
   ```bash
   npx convex env set APP_URL http://localhost:5173
   ```

### 3. Database Initialization
Once the backend is linked and synced, seed the unique-code generator model by running:
```bash
npx convex run seed:initUniqueCodeTracker
```
Register your primary account, complete onboarding, and elevate yourself to the Super Admin root profile:
```bash
npx convex run seed:promoteToSuperAdmin '{"email":"your-corporate-email@domain.com"}'
```
