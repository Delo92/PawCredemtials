import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy load pages for code-splitting
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Packages = lazy(() => import("@/pages/Packages"));
const SetupRequired = lazy(() => import("@/pages/SetupRequired"));
const NotFound = lazy(() => import("@/pages/not-found"));
const DoctorReviewPortal = lazy(() => import("@/pages/DoctorReviewPortal"));

// Dashboard pages
const ApplicantDashboard = lazy(() => import("@/pages/dashboard/ApplicantDashboard"));
const NewApplication = lazy(() => import("@/pages/dashboard/applicant/NewApplication"));
const DoctorDashboard = lazy(() => import("@/pages/dashboard/DoctorDashboard"));
const AdminDashboard = lazy(() => import("@/pages/dashboard/AdminDashboard"));
const UsersManagement = lazy(() => import("@/pages/dashboard/admin/UsersManagement"));
const PackagesManagement = lazy(() => import("@/pages/dashboard/admin/PackagesManagement"));
const OwnerDashboard = lazy(() => import("@/pages/dashboard/OwnerDashboard"));
const SiteSettings = lazy(() => import("@/pages/dashboard/owner/SiteSettings"));

// Applicant sub-pages
const RegistrationPage = lazy(() => import("@/pages/dashboard/applicant/RegistrationPage"));
const DocumentsPage = lazy(() => import("@/pages/dashboard/applicant/DocumentsPage"));
const PaymentsPage = lazy(() => import("@/pages/dashboard/applicant/PaymentsPage"));
const FormViewerPage = lazy(() => import("@/pages/dashboard/applicant/FormViewerPage"));

// Shared pages (used across multiple levels)
const SharedSettingsPage = lazy(() => import("@/pages/dashboard/shared/SettingsPage"));
const SharedMessagesPage = lazy(() => import("@/pages/dashboard/shared/MessagesPage"));
const SharedCompletedPage = lazy(() => import("@/pages/dashboard/shared/CompletedPage"));
const SharedApplicationsListPage = lazy(() => import("@/pages/dashboard/shared/ApplicationsListPage"));
const SharedPaymentsManagementPage = lazy(() => import("@/pages/dashboard/shared/PaymentsManagementPage"));
const SharedAnalyticsPage = lazy(() => import("@/pages/dashboard/shared/AnalyticsPage"));
const SharedCommissionsPage = lazy(() => import("@/pages/dashboard/shared/CommissionsPage"));
const SharedReferralsPage = lazy(() => import("@/pages/dashboard/shared/ReferralsPage"));

// Generic placeholder for pages not yet implemented
const PlaceholderPage = lazy(() => import("@/pages/dashboard/placeholders/PlaceholderPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <AuthProvider>
          <ConfigProvider>
            <TooltipProvider>
              <Toaster />
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  {/* Public routes with AppShell */}
                  <Route path="/">
                    <AppShell><Home /></AppShell>
                  </Route>
                  <Route path="/login">
                    <AppShell><Login /></AppShell>
                  </Route>
                  <Route path="/register">
                    <AppShell><Register /></AppShell>
                  </Route>
                  <Route path="/packages">
                    <AppShell><Packages /></AppShell>
                  </Route>
                  <Route path="/setup">
                    <AppShell><SetupRequired /></AppShell>
                  </Route>

                  {/* Applicant Routes (Level 1+) */}
                  <Route path="/dashboard/applicant/applications/new">
                    <ProtectedRoute minLevel={1}>
                      <NewApplication />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant/registration">
                    <ProtectedRoute minLevel={1}>
                      <RegistrationPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant/documents/:applicationId/form">
                    <ProtectedRoute minLevel={1}>
                      <FormViewerPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant/documents">
                    <ProtectedRoute minLevel={1}>
                      <DocumentsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant/messages">
                    <ProtectedRoute minLevel={1}>
                      <SharedMessagesPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant/payments">
                    <ProtectedRoute minLevel={1}>
                      <PaymentsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant/settings">
                    <ProtectedRoute minLevel={1}>
                      <SharedSettingsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/applicant">
                    <ProtectedRoute minLevel={1}>
                      <ApplicantDashboard />
                    </ProtectedRoute>
                  </Route>

                  {/* Doctor Routes (Level 2+) */}
                  <Route path="/dashboard/doctor/reviews">
                    <ProtectedRoute minLevel={2}>
                      <SharedCompletedPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/doctor/referrals">
                    <ProtectedRoute minLevel={2}>
                      <SharedReferralsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/doctor/commissions">
                    <ProtectedRoute minLevel={2}>
                      <SharedCommissionsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/doctor/messages">
                    <ProtectedRoute minLevel={2}>
                      <SharedMessagesPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/doctor/settings">
                    <ProtectedRoute minLevel={2}>
                      <SharedSettingsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/doctor">
                    <ProtectedRoute minLevel={2}>
                      <DoctorDashboard />
                    </ProtectedRoute>
                  </Route>

                  {/* Redirects for old routes */}
                  <Route path="/dashboard/agent/:rest*">
                    <Redirect to="/dashboard/doctor" />
                  </Route>
                  <Route path="/dashboard/agent">
                    <Redirect to="/dashboard/doctor" />
                  </Route>
                  <Route path="/dashboard/reviewer/:rest*">
                    <Redirect to="/dashboard/doctor" />
                  </Route>
                  <Route path="/dashboard/reviewer">
                    <Redirect to="/dashboard/doctor" />
                  </Route>

                  {/* Admin Routes (Level 3+) */}
                  <Route path="/dashboard/admin/users">
                    <ProtectedRoute minLevel={3}>
                      <UsersManagement />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/packages">
                    <ProtectedRoute minLevel={3}>
                      <PackagesManagement />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/applications">
                    <ProtectedRoute minLevel={3}>
                      <SharedApplicationsListPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/payments">
                    <ProtectedRoute minLevel={3}>
                      <SharedPaymentsManagementPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/analytics">
                    <ProtectedRoute minLevel={3}>
                      <SharedAnalyticsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/reports">
                    <ProtectedRoute minLevel={3}>
                      <PlaceholderPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/messages">
                    <ProtectedRoute minLevel={3}>
                      <SharedMessagesPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin/settings">
                    <ProtectedRoute minLevel={3}>
                      <SharedSettingsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/admin">
                    <ProtectedRoute minLevel={3}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  </Route>

                  {/* Owner Routes (Level 4) */}
                  <Route path="/dashboard/owner/users">
                    <ProtectedRoute minLevel={4}>
                      <UsersManagement />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/packages">
                    <ProtectedRoute minLevel={4}>
                      <PackagesManagement />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/applications">
                    <ProtectedRoute minLevel={4}>
                      <SharedApplicationsListPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/site-settings">
                    <ProtectedRoute minLevel={4}>
                      <SiteSettings />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/settings">
                    <ProtectedRoute minLevel={4}>
                      <SharedSettingsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/payments">
                    <ProtectedRoute minLevel={4}>
                      <SharedPaymentsManagementPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/commissions">
                    <ProtectedRoute minLevel={4}>
                      <SharedCommissionsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner/analytics">
                    <ProtectedRoute minLevel={4}>
                      <SharedAnalyticsPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/dashboard/owner">
                    <ProtectedRoute minLevel={4}>
                      <OwnerDashboard />
                    </ProtectedRoute>
                  </Route>

                  {/* Public Doctor Review Portal (no auth needed) */}
                  <Route path="/review/:token">
                    <DoctorReviewPortal />
                  </Route>

                  {/* Fallback */}
                  <Route>
                    <AppShell><NotFound /></AppShell>
                  </Route>
                </Switch>
              </Suspense>
            </TooltipProvider>
          </ConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
