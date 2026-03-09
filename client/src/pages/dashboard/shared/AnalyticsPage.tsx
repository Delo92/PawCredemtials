import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, TrendingUp, Users, Eye, Clock, ArrowUpRight, Globe, FileText, Loader2, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase";

interface GA4Data {
  overview: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
    newUsers: number;
  };
  topPages: Array<{ path: string; views: number; users: number }>;
  dailyData: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
  trafficSources: Array<{ source: string; sessions: number }>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MiniBarChart({ data, dataKey, maxHeight = 120 }: { data: Array<Record<string, any>>; dataKey: string; maxHeight?: number }) {
  if (!data.length) return null;
  const values = data.map(d => d[dataKey] as number);
  const max = Math.max(...values, 1);
  const barWidth = Math.max(4, Math.min(20, Math.floor(300 / data.length) - 2));

  return (
    <div className="flex items-end gap-[2px] justify-center" style={{ height: maxHeight }} data-testid="chart-mini-bar">
      {data.map((d, i) => {
        const height = Math.max(2, (d[dataKey] / max) * (maxHeight - 20));
        return (
          <div key={i} className="flex flex-col items-center group relative">
            <div
              className="bg-primary/80 hover:bg-primary rounded-t transition-colors cursor-default"
              style={{ width: barWidth, height }}
              title={`${d.date}: ${d[dataKey]}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("30d");

  const { data: ga4Data, isLoading, error } = useQuery<GA4Data>({
    queryKey: ["/api/admin/ga4-analytics", dateRange],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/ga4-analytics?dateRange=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      return json.data;
    },
    enabled: !!user && (user.userLevel || 0) >= 4,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (!user) return null;

  const isOwner = (user.userLevel || 0) >= 4;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-analytics-title">
              Analytics
            </h1>
            <p className="text-muted-foreground">
              {isOwner ? "Google Analytics website traffic data" : "Platform performance and insights"}
            </p>
          </div>
          {isOwner && (
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {!isOwner && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Analytics data is available to platform owners.
              </p>
            </CardContent>
          </Card>
        )}

        {isOwner && isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading analytics data...</p>
            </CardContent>
          </Card>
        )}

        {isOwner && error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-4" />
              <p className="text-sm text-destructive mb-2">Failed to load GA4 data</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Make sure the Firebase service account has Viewer access on the GA4 property and data collection is active.
              </p>
            </CardContent>
          </Card>
        )}

        {isOwner && ga4Data && (
          <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card data-testid="card-active-users">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ga4Data.overview.activeUsers.toLocaleString()}</div>
                  <div className="flex items-center text-xs text-green-600">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    {ga4Data.overview.newUsers} new
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-sessions">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ga4Data.overview.sessions.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total visits</div>
                </CardContent>
              </Card>
              <Card data-testid="card-page-views">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ga4Data.overview.pageViews.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total views</div>
                </CardContent>
              </Card>
              <Card data-testid="card-avg-duration">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatDuration(ga4Data.overview.avgSessionDuration)}</div>
                  <div className="text-xs text-muted-foreground">Per session</div>
                </CardContent>
              </Card>
              <Card data-testid="card-bounce-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercent(ga4Data.overview.bounceRate)}</div>
                  <div className="text-xs text-muted-foreground">Single page visits</div>
                </CardContent>
              </Card>
              <Card data-testid="card-new-users">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">New Users</CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ga4Data.overview.newUsers.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">First-time visitors</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-daily-users-chart">
                <CardHeader>
                  <CardTitle>Daily Users</CardTitle>
                  <CardDescription>Active users per day</CardDescription>
                </CardHeader>
                <CardContent>
                  {ga4Data.dailyData.length > 0 ? (
                    <MiniBarChart data={ga4Data.dailyData} dataKey="users" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[120px] text-center">
                      <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card data-testid="card-daily-pageviews-chart">
                <CardHeader>
                  <CardTitle>Daily Page Views</CardTitle>
                  <CardDescription>Page views per day</CardDescription>
                </CardHeader>
                <CardContent>
                  {ga4Data.dailyData.length > 0 ? (
                    <MiniBarChart data={ga4Data.dailyData} dataKey="pageViews" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[120px] text-center">
                      <Eye className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-top-pages">
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Most visited pages</CardDescription>
                </CardHeader>
                <CardContent>
                  {ga4Data.topPages.length > 0 ? (
                    <div className="space-y-3">
                      {ga4Data.topPages.map((page, i) => {
                        const maxViews = ga4Data.topPages[0]?.views || 1;
                        const widthPercent = (page.views / maxViews) * 100;
                        return (
                          <div key={i} className="space-y-1" data-testid={`row-page-${i}`}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="truncate max-w-[200px] font-medium">{page.path}</span>
                              <span className="text-muted-foreground ml-2">{page.views} views</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/60 rounded-full transition-all"
                                style={{ width: `${widthPercent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                      <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No page data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-traffic-sources">
                <CardHeader>
                  <CardTitle>Traffic Sources</CardTitle>
                  <CardDescription>Where visitors come from</CardDescription>
                </CardHeader>
                <CardContent>
                  {ga4Data.trafficSources.length > 0 ? (
                    <div className="space-y-3">
                      {ga4Data.trafficSources.map((source, i) => {
                        const maxSessions = ga4Data.trafficSources[0]?.sessions || 1;
                        const widthPercent = (source.sessions / maxSessions) * 100;
                        return (
                          <div key={i} className="space-y-1" data-testid={`row-source-${i}`}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{source.source || "(direct)"}</span>
                              <span className="text-muted-foreground ml-2">{source.sessions} sessions</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/60 rounded-full transition-all"
                                style={{ width: `${widthPercent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                      <Globe className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No source data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
