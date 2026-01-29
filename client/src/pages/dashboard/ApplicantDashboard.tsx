import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import type { Application, Package } from "@shared/schema";
import {
  FileText,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  MessageSquare,
  FolderOpen,
} from "lucide-react";

export default function ApplicantDashboard() {
  const { user } = useAuth();
  const { config } = useConfig();

  const { data: applications, isLoading: applicationsLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: packages, isLoading: packagesLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const activeApplications = applications?.filter(
    (app) => !["completed", "rejected"].includes(app.status)
  ) || [];

  const completedApplications = applications?.filter(
    (app) => app.status === "completed"
  ) || [];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      in_review: { variant: "default", label: "In Review" },
      awaiting_documents: { variant: "outline", label: "Documents Needed" },
      awaiting_payment: { variant: "outline", label: "Payment Needed" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      completed: { variant: "default", label: "Completed" },
    };
    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="text-muted-foreground">
              Track your applications and manage your documents.
            </p>
          </div>
          <Button asChild data-testid="button-fill-registration">
            <Link href="/dashboard/applicant/registration">
              <FileText className="mr-2 h-4 w-4" />
              Edit Registration
            </Link>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-active">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Active Applications</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{activeApplications.length}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-stat-completed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{completedApplications.length}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-stat-documents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-messages">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Unread</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Applications */}
        <Card data-testid="card-active-applications">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Applications</CardTitle>
              <CardDescription>
                Track the progress of your active applications
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/applicant/registration">
                View
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {applicationsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : activeApplications.length > 0 ? (
              <div className="space-y-4">
                {activeApplications.slice(0, 3).map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border hover-elevate transition-all"
                    data-testid={`application-${app.id}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Application #{app.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Step {app.currentStep} of {app.totalSteps}
                      </p>
                      <Progress
                        value={(app.currentStep / app.totalSteps) * 100}
                        className="h-1.5 mt-2"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(app.status)}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/applicant/applications/${app.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No active applications</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Complete your registration, then purchase a package to start your application.
                </p>
                <Button asChild>
                  <Link href="/dashboard/applicant/registration">
                    <FileText className="mr-2 h-4 w-4" />
                    Edit Registration
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Services */}
        <Card data-testid="card-available-services">
          <CardHeader>
            <CardTitle>Available Services</CardTitle>
            <CardDescription>
              Browse our available service packages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {packagesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-4 w-2/3 mb-2" />
                    <Skeleton className="h-3 w-full mb-4" />
                    <Skeleton className="h-6 w-1/3" />
                  </div>
                ))}
              </div>
            ) : packages && packages.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packages.slice(0, 3).map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-4 border rounded-lg hover-elevate transition-all"
                    data-testid={`package-${pkg.id}`}
                  >
                    <h3 className="font-semibold mb-1">{pkg.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {pkg.description || "Service package"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        ${Number(pkg.price).toFixed(2)}
                      </span>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/applicant/applications/new?package=${pkg.id}`}>
                          Select
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No packages available at this time.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
