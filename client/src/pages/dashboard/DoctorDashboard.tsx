import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import type { Commission } from "@shared/schema";
import {
  CheckCircle2,
  ArrowRight,
  DollarSign,
  TrendingUp,
  Copy,
  XCircle,
  Clock,
  Stethoscope,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { getLevelName } = useConfig();
  const { toast } = useToast();

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    total: number;
    approved: number;
    denied: number;
    pending: number;
    tokens: any[];
  }>({
    queryKey: ["/api/doctors/stats"],
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery<Commission[]>({
    queryKey: ["/api/commissions"],
  });

  const totalEarnings = commissions
    ?.filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const referralLink = user?.referralCode
    ? `${window.location.origin}/register?ref=${user.referralCode}`
    : null;

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {getLevelName(2)} Dashboard
          </h1>
          <p className="text-muted-foreground">
            View your review history, referrals, and commissions.
          </p>
        </div>

        {referralLink && (
          <Card className="border-primary/20 bg-primary/5" data-testid="card-referral-link">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Referral Link</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-background rounded-lg border px-3 py-2 text-sm font-mono truncate">
                  {referralLink}
                </div>
                <Button onClick={copyReferralLink} data-testid="button-copy-referral">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Share this link to earn commissions on referrals
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-pending">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{statsData?.pending || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Awaiting your decision</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-approved">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{statsData?.approved || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Applications approved</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-denied">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Denied</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{statsData?.denied || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Applications denied</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-commissions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Commissions</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
              )}
              <p className="text-xs text-muted-foreground">Total earned</p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-recent-reviews">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Reviews</CardTitle>
              <CardDescription>
                Your latest patient review activity
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/doctor/reviews">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-md">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : statsData?.tokens && statsData.tokens.length > 0 ? (
              <div className="space-y-3">
                {statsData.tokens.slice(0, 5).map((token: any) => (
                  <div
                    key={token.id}
                    className="flex flex-wrap items-center gap-3 p-4 border rounded-md"
                    data-testid={`review-token-${token.id}`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      token.status === "approved"
                        ? "bg-green-500/10 text-green-500"
                        : token.status === "denied"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {token.status === "approved" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : token.status === "denied" ? (
                        <XCircle className="h-5 w-5" />
                      ) : (
                        <Stethoscope className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        Application #{token.applicationId?.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        token.status === "approved"
                          ? "default"
                          : token.status === "denied"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {token.status.charAt(0).toUpperCase() + token.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <FileCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  When you are assigned patient reviews, they will appear here. You'll receive a secure link via email to review each patient.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-recent-commissions">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Commissions</CardTitle>
              <CardDescription>
                Track your commission status and payments
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/doctor/commissions">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {commissionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-md">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : commissions && commissions.length > 0 ? (
              <div className="space-y-3">
                {commissions.slice(0, 5).map((commission) => (
                  <div
                    key={commission.id}
                    className="flex flex-wrap items-center gap-3 p-4 border rounded-md"
                    data-testid={`commission-${commission.id}`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      commission.status === "paid"
                        ? "bg-chart-2/10 text-chart-2"
                        : commission.status === "approved"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {commission.status === "paid" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <DollarSign className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        ${Number(commission.amount).toFixed(2)} Commission
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(commission.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        commission.status === "paid"
                          ? "default"
                          : commission.status === "approved"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No commissions yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  Share your referral link to start earning commissions!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
