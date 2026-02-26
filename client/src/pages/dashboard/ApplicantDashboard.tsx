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
      pending: { variant: "secondary", label: "Processing" },
      in_review: { variant: "default", label: "Under Review" },
      awaiting_documents: { variant: "outline", label: "Info Needed" },
      awaiting_payment: { variant: "outline", label: "Payment Pending" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Declined" },
      completed: { variant: "default", label: "Ready for Download" },
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
              Track your registrations and download your certifications.
            </p>
          </div>
          <Button asChild data-testid="button-fill-registration">
            <Link href="/dashboard/applicant/registration">
              <FileText className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-active">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
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
              <CardTitle className="text-sm font-medium">Certificates Received</CardTitle>
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

        {/* Registration */}
        <Card data-testid="card-registration">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Review and update your personal information
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border hover-elevate transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">Profile Details</p>
                <p className="text-sm text-muted-foreground">
                  Personal info, contact details, and preferences
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/applicant/registration">
                  Edit
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Services */}
        <Card data-testid="card-available-services">
          <CardHeader>
            <CardTitle>Register a Support Animal</CardTitle>
            <CardDescription>
              Choose the registration type you need
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
                        ${(Number(pkg.price) / 100).toFixed(2)}
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
                No registration types available at this time.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
