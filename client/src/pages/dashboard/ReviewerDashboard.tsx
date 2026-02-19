import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  Play,
  Timer,
} from "lucide-react";

export default function ReviewerDashboard() {
  const { user } = useAuth();
  const { config, getLevelName } = useConfig();

  const { data: queueEntries, isLoading } = useQuery<any[]>({
    queryKey: ["/api/queue"],
  });

  const waitingEntries = queueEntries?.filter((e: any) => e.status === "waiting") || [];
  const myClaimedEntries = queueEntries?.filter(
    (e: any) => e.status === "claimed" && e.reviewerId === user?.id
  ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {getLevelName(2)} Dashboard
          </h1>
          <p className="text-muted-foreground">
            Review and process applications in the queue.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-queue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">In Queue</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{waitingEntries.length}</div>
              )}
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-claimed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">My Active</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{myClaimedEntries.length}</div>
              )}
              <p className="text-xs text-muted-foreground">Currently reviewing</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-today">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Reviewed Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Applications completed</p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-avg-time">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Per review</p>
            </CardContent>
          </Card>
        </div>

        {/* Review Queue */}
        <Card data-testid="card-review-queue">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>
                Applications waiting for your review
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/reviewer/queue">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
                      <p className="font-medium">Application #{entry.applicationId.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Priority: {entry.priority || 0} • Added{" "}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Waiting</Badge>
                      <Button size="sm" asChild data-testid={`button-claim-${entry.id}`}>
                        <Link href={`/dashboard/reviewer/queue/${entry.id}`}>
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

        {/* My Active Reviews */}
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
                      <p className="font-medium">Application #{entry.applicationId.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Claimed {entry.claimedAt ? new Date(entry.claimedAt).toLocaleTimeString() : ""}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/dashboard/reviewer/queue/${entry.id}`}>
                        Continue Review
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
