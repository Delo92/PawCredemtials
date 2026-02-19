import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useConfig } from "@/contexts/ConfigContext";
import type { User, Application } from "@shared/schema";
import {
  Users,
  FileText,
  DollarSign,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Stethoscope,
} from "lucide-react";

export default function AdminDashboard() {
  const { getLevelName } = useConfig();

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery<Application[]>({
    queryKey: ["/api/admin/applications"],
  });

  const totalUsers = users?.length || 0;
  const newUsersToday = users?.filter((u) => {
    const today = new Date();
    const created = new Date(u.createdAt);
    return created.toDateString() === today.toDateString();
  }).length || 0;

  const pendingApplications = applications?.filter(
    (a) => a.status === "pending" || a.status === "level3_work"
  ).length || 0;

  const awaitingDoctor = applications?.filter(
    (a) => a.status === "doctor_review"
  ).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {getLevelName(3)} Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of platform activity and management tools.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{totalUsers}</div>
              )}
              <p className="text-xs text-muted-foreground">
                +{newUsersToday} today
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-applications">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending Apps</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{pendingApplications}</div>
              )}
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-doctor-review">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">With Doctor</CardTitle>
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{awaitingDoctor}</div>
              )}
              <p className="text-xs text-muted-foreground">
                Awaiting doctor approval
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">
                0 transactions
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/dashboard/admin/users">
              <Users className="h-5 w-5" />
              <span>Manage Users</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/dashboard/admin/applications">
              <FileText className="h-5 w-5" />
              <span>View Applications</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/dashboard/admin/analytics">
              <BarChart3 className="h-5 w-5" />
              <span>Analytics</span>
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-recent-users">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Users</CardTitle>
                <CardDescription>
                  Newly registered users
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/admin/users">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : users && users.length > 0 ? (
                <div className="space-y-4">
                  {users.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {getLevelName(user.userLevel)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No users yet</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-applications">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>
                  Latest application submissions
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/admin/applications">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : applications && applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.slice(0, 5).map((app) => (
                    <div key={app.id} className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        app.status === "completed" || app.status === "doctor_approved"
                          ? "bg-chart-2/10 text-chart-2"
                          : app.status === "rejected" || app.status === "doctor_denied"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {app.status === "completed" || app.status === "doctor_approved" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : app.status === "rejected" || app.status === "doctor_denied" ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          Application #{app.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Step {app.currentStep}/{app.totalSteps}
                        </p>
                      </div>
                      <Badge
                        variant={
                          app.status === "completed" || app.status === "doctor_approved"
                            ? "default"
                            : app.status === "rejected" || app.status === "doctor_denied"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {app.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No applications yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
