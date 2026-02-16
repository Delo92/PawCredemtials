import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import type { QueueEntry, Commission } from "@shared/schema";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  Play,
  Timer,
  DollarSign,
  TrendingUp,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { getLevelName } = useConfig();
  const { toast } = useToast();

  const { data: queueEntries, isLoading: queueLoading } = useQuery<QueueEntry[]>({
    queryKey: ["/api/queue"],
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery<Commission[]>({
    queryKey: ["/api/commissions"],
  });

  const waitingEntries = queueEntries?.filter((e) => e.status === "waiting") || [];
  const myClaimedEntries = queueEntries?.filter(
    (e) => e.status === "claimed" && e.reviewerId === user?.id
  ) || [];

  const completedCount = queueEntries?.filter((e) => e.status === "completed").length || 0;

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
            Review applications, manage referrals, and track commissions.
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
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{waitingEntries.length}</div>
              )}
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-active">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">My Active</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{myClaimedEntries.length}</div>
              )}
              <p className="text-xs text-muted-foreground">Currently reviewing</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-completed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{completedCount}</div>
              )}
              <p className="text-xs text-muted-foreground">Applications completed</p>
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

        <Card data-testid="card-review-queue">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>
                Applications waiting for your review
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/doctor/queue">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                  </div>
                ))}
              </div>
            ) : waitingEntries.length > 0 ? (
              <div className="space-y-3">
                {waitingEntries.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg hover-elevate transition-all"
                    data-testid={`queue-entry-${entry.id}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Application #{(entry.applicationId || entry.id).slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Priority: {entry.priority || 0} • Added{" "}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Waiting</Badge>
                      <Button size="sm" asChild data-testid={`button-claim-${entry.id}`}>
                        <Link href={`/dashboard/doctor/queue/${entry.id}`}>
                          <Play className="mr-1 h-3 w-3" />
                          Claim
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Queue is empty</h3>
                <p className="text-muted-foreground max-w-sm">
                  There are no applications waiting for review at the moment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {myClaimedEntries.length > 0 && (
          <Card data-testid="card-my-reviews">
            <CardHeader>
              <CardTitle>My Active Reviews</CardTitle>
              <CardDescription>
                Applications you're currently reviewing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myClaimedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg border-primary/20 bg-primary/5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Timer className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Application #{(entry.applicationId || entry.id).slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Claimed {entry.claimedAt ? new Date(entry.claimedAt).toLocaleTimeString() : ""}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/dashboard/doctor/queue/${entry.id}`}>
                        Continue Review
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
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
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg hover-elevate transition-all"
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
