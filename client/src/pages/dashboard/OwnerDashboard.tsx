import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useConfig } from "@/contexts/ConfigContext";
import type { User, Application, Payment, Commission } from "@shared/schema";
import {
  Users,
  FileText,
  DollarSign,
  Settings,
  ArrowRight,
  TrendingUp,
  Building2,
  CreditCard,
  BarChart3,
  Palette,
} from "lucide-react";

export default function OwnerDashboard() {
  const { config, getLevelName } = useConfig();

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery<Application[]>({
    queryKey: ["/api/admin/applications"],
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery<Commission[]>({
    queryKey: ["/api/admin/commissions"],
  });

  const totalUsers = users?.length || 0;
  const totalApplications = applications?.length || 0;
  
  const totalRevenue = payments
    ?.filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const pendingCommissions = commissions
    ?.filter((c) => c.status === "pending" || c.status === "approved")
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const usersByLevel = users?.reduce((acc, u) => {
    acc[u.userLevel] = (acc[u.userLevel] || 0) + 1;
    return acc;
  }, {} as Record<number, number>) || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
              {getLevelName(4)} Dashboard
            </h1>
            <p className="text-muted-foreground">
              Complete system overview and configuration.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/owner/site-settings">
              <Palette className="mr-2 h-4 w-4" />
              Customize Platform
            </Link>
          </Button>
        </div>

        {/* Revenue Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              )}
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-pending-commissions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">${pendingCommissions.toFixed(2)}</div>
              )}
              <p className="text-xs text-muted-foreground">
                Commissions to pay
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-total-users">
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
                Registered accounts
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-applications">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Applications</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{totalApplications}</div>
              )}
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Platform Configuration */}
        <Card data-testid="card-platform-config">
          <CardHeader>
            <CardTitle>Platform Configuration</CardTitle>
            <CardDescription>
              Current white-label settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Site Name</p>
                <p className="font-medium">{config.siteName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tagline</p>
                <p className="font-medium">{config.tagline}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Primary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded border"
                    style={{ backgroundColor: config.primaryColor }}
                  />
                  <span className="font-mono text-sm">{config.primaryColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Level 1 Name</p>
                <p className="font-medium">{config.levelNames.level1}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Level 2 Name</p>
                <p className="font-medium">{config.levelNames.level2}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Level 3 Name</p>
                <p className="font-medium">{config.levelNames.level3}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" asChild>
                <Link href="/dashboard/owner/site-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Configuration
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Distribution */}
        <Card data-testid="card-user-distribution">
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
            <CardDescription>
              Users by role level
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-2 flex-1" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((level) => {
                  const count = usersByLevel[level] || 0;
                  const percentage = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-4">
                      <span className="text-sm font-medium w-24 shrink-0">
                        {getLevelName(level)}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" asChild>
            <Link href="/dashboard/owner/users">
              <Users className="h-6 w-6" />
              <span>Manage Users</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" asChild>
            <Link href="/dashboard/owner/packages">
              <Building2 className="h-6 w-6" />
              <span>Manage Packages</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" asChild>
            <Link href="/dashboard/owner/commissions">
              <DollarSign className="h-6 w-6" />
              <span>Manage Commissions</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" asChild>
            <Link href="/dashboard/owner/analytics">
              <BarChart3 className="h-6 w-6" />
              <span>View Analytics</span>
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
