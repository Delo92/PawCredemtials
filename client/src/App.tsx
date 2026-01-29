import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
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

// Dashboard pages
const ApplicantDashboard = lazy(() => import("@/pages/dashboard/ApplicantDashboard"));
const NewApplication = lazy(() => import("@/pages/dashboard/applicant/NewApplication"));
const ReviewerDashboard = lazy(() => import("@/pages/dashboard/ReviewerDashboard"));
const AgentDashboard = lazy(() => import("@/pages/dashboard/AgentDashboard"));
const AdminDashboard = lazy(() => import("@/pages/dashboard/AdminDashboard"));
const UsersManagement = lazy(() => import("@/pages/dashboard/admin/UsersManagement"));
const PackagesManagement = lazy(() => import("@/pages/dashboard/admin/PackagesManagement"));
const OwnerDashboard = lazy(() => import("@/pages/dashboard/OwnerDashboard"));
const SiteSettings = lazy(() => import("@/pages/dashboard/owner/SiteSettings"));

// Applicant sub-pages
const ApplicationsPage = lazy(() => import("@/pages/dashboard/placeholders/ApplicationsPage"));
const DocumentsPage = lazy(() => import("@/pages/dashboard/applicant/DocumentsPage"));
const PaymentsPage = lazy(() => import("@/pages/dashboard/applicant/PaymentsPage"));
const MessagesPage = lazy(() => import("@/pages/dashboard/applicant/MessagesPage"));
const SettingsPage = lazy(() => import("@/pages/dashboard/applicant/SettingsPage"));

// Generic placeholder for other pages
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

function DashboardRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Applicant Routes (Level 1+) */}
        <Route path="/dashboard/applicant/applications/new">
          <ProtectedRoute minLevel={1}>
            <NewApplication />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/applicant/applications">
          <ProtectedRoute minLevel={1}>
            <ApplicationsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/applicant/documents">
          <ProtectedRoute minLevel={1}>
            <DocumentsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/applicant/messages">
          <ProtectedRoute minLevel={1}>
            <MessagesPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/applicant/payments">
          <ProtectedRoute minLevel={1}>
            <PaymentsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/applicant/settings">
          <ProtectedRoute minLevel={1}>
            <SettingsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/applicant">
          <ProtectedRoute minLevel={1}>
            <ApplicantDashboard />
          </ProtectedRoute>
        </Route>

        {/* Reviewer Routes (Level 2+) */}
        <Route path="/dashboard/reviewer/queue">
          <ProtectedRoute minLevel={2}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/reviewer/completed">
          <ProtectedRoute minLevel={2}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/reviewer/messages">
          <ProtectedRoute minLevel={2}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/reviewer/settings">
          <ProtectedRoute minLevel={2}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/reviewer">
          <ProtectedRoute minLevel={2}>
            <ReviewerDashboard />
          </ProtectedRoute>
        </Route>

        {/* Agent Routes (Level 3+) */}
        <Route path="/dashboard/agent/queue">
          <ProtectedRoute minLevel={3}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/agent/referrals">
          <ProtectedRoute minLevel={3}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/agent/commissions">
          <ProtectedRoute minLevel={3}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/agent/messages">
          <ProtectedRoute minLevel={3}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/agent/settings">
          <ProtectedRoute minLevel={3}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/agent">
          <ProtectedRoute minLevel={3}>
            <AgentDashboard />
          </ProtectedRoute>
        </Route>

        {/* Admin Routes (Level 4+) */}
        <Route path="/dashboard/admin/users">
          <ProtectedRoute minLevel={4}>
            <UsersManagement />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/applications">
          <ProtectedRoute minLevel={4}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/queue">
          <ProtectedRoute minLevel={4}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/packages">
          <ProtectedRoute minLevel={4}>
            <PackagesManagement />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/payments">
          <ProtectedRoute minLevel={4}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/analytics">
          <ProtectedRoute minLevel={4}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/messages">
          <ProtectedRoute minLevel={4}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin/settings">
          <ProtectedRoute minLevel={4}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/admin">
          <ProtectedRoute minLevel={4}>
            <AdminDashboard />
          </ProtectedRoute>
        </Route>

        {/* Owner Routes (Level 5) */}
        <Route path="/dashboard/owner/site-settings">
          <ProtectedRoute minLevel={5}>
            <SiteSettings />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner/users">
          <ProtectedRoute minLevel={5}>
            <UsersManagement />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner/applications">
          <ProtectedRoute minLevel={5}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner/packages">
          <ProtectedRoute minLevel={5}>
            <PackagesManagement />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner/payments">
          <ProtectedRoute minLevel={5}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner/commissions">
          <ProtectedRoute minLevel={5}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner/analytics">
          <ProtectedRoute minLevel={5}>
            <PlaceholderPage />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/owner">
          <ProtectedRoute minLevel={5}>
            <OwnerDashboard />
          </ProtectedRoute>
        </Route>

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function PublicRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/packages" component={Packages} />
        <Route path="/setup" component={SetupRequired} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
              <Switch>
                {/* Dashboard routes don't use AppShell (they have their own layout) */}
                <Route path="/dashboard/:rest*">
                  <DashboardRouter />
                </Route>
                {/* All other routes use AppShell */}
                <Route>
                  <AppShell>
                    <PublicRouter />
                  </AppShell>
                </Route>
              </Switch>
            </TooltipProvider>
          </ConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
