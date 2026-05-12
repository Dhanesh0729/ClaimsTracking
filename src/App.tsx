import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  useUser,
} from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { SignInPage } from "@/pages/auth/SignIn";
import { SignUpPage } from "@/pages/auth/SignUp";
import { OnboardingPage } from "@/pages/auth/Onboarding";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { PurchasesPage } from "@/pages/purchases/PurchasesPage";
import { AddPurchasePage } from "@/pages/purchases/AddPurchasePage";
import { PurchaseDetailPage } from "@/pages/purchases/PurchaseDetailPage";
import { ApprovalsPage } from "@/pages/approvals/ApprovalsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { AdminReportsPage } from "@/pages/admin/ReportsPage";
import { AuditPage } from "@/pages/admin/AuditPage";
import { MasterReportsPage } from "@/pages/master/MasterReportsPage";

function FullScreenLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {label}
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const me = useQuery(api.users.getMe);
  const location = useLocation();

  if (!isLoaded) return <FullScreenLoader />;
  if (!isSignedIn) return <RedirectToSignIn />;
  if (me === undefined) return <FullScreenLoader label="Loading profile…" />;

  const onOnboarding = location.pathname === "/onboarding";
  if (me === null && !onOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  if (me && onOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function RequireRole({
  allowed,
  children,
}: {
  allowed: Array<"super_admin" | "admin" | "master" | "user">;
  children: React.ReactNode;
}) {
  const me = useQuery(api.users.getMe);
  if (me === undefined) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!me || !allowed.includes(me.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />

      <Route
        path="/onboarding"
        element={
          <>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
            <SignedIn>
              <AuthGate>
                <OnboardingPage />
              </AuthGate>
            </SignedIn>
          </>
        }
      />

      <Route
        path="/*"
        element={
          <>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
            <SignedIn>
              <AuthGate>
                <AppLayout>
                  <Routes>
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="purchases" element={<PurchasesPage />} />
                    <Route path="purchases/new" element={<AddPurchasePage />} />
                    <Route path="purchases/:id" element={<PurchaseDetailPage />} />
                    <Route
                      path="approvals"
                      element={
                        <RequireRole allowed={["master", "admin", "super_admin"]}>
                          <ApprovalsPage />
                        </RequireRole>
                      }
                    />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route
                      path="admin/users"
                      element={
                        <RequireRole allowed={["admin", "super_admin"]}>
                          <UsersPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="admin/reports"
                      element={
                        <RequireRole allowed={["admin", "super_admin"]}>
                          <AdminReportsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="admin/audit"
                      element={
                        <RequireRole allowed={["admin", "super_admin"]}>
                          <AuditPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="master/reports"
                      element={
                        <RequireRole allowed={["master", "admin", "super_admin"]}>
                          <MasterReportsPage />
                        </RequireRole>
                      }
                    />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </AppLayout>
              </AuthGate>
            </SignedIn>
          </>
        }
      />
    </Routes>
  );
}
