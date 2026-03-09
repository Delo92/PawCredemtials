import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Clock,
  ArrowUpRight,
  Globe,
  FileText,
  Loader2,
} from "lucide-react";

interface ErrorLog {
  id: string;
  errorType: string;
  severity: string;
  message: string;
  stackTrace?: string;
  userLevel?: number;
  userUid?: string;
  userName?: string;
  userEmail?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  context?: Record<string, any>;
  wasShownToUser?: boolean;
  timestamp: string;
  createdAt: string;
}

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

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  error: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
};

const severityIcons: Record<string, any> = {
  critical: ShieldAlert,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const errorTypeLabels: Record<string, string> = {
  registration: "Registration",
  payment: "Payment",
  approval: "Approval",
  queue: "Queue",
  api: "API",
  client: "Client",
  email: "Email",
  sms: "SMS",
  pdf: "PDF",
  security_alert: "Security",
  workflow: "Workflow",
  system: "System",
  database: "Database",
  authentication: "Auth",
  validation: "Validation",
  form_upload: "Form Upload",
  admin_operation_error: "Admin Op",
  workflow_error: "Workflow",
  email_error: "Email",
  sms_error: "SMS",
  package_not_found: "Package",
  manual_action: "Manual",
  uncategorized: "Other",
};

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

function AnalyticsTab() {
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
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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
      </div>

      {isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading analytics data...</p>
          </CardContent>
        </Card>
      )}

      {error && (
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

      {ga4Data && (
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
  );
}

function ErrorLogsTab() {
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: "all",
    errorType: "all",
    search: "",
  });

  const { data, isLoading, refetch, isFetching } = useQuery<{ logs: ErrorLog[]; total: number }>({
    queryKey: ["/api/admin/error-logs", filters, page],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams();

      if (filters.severity !== "all") params.set("severity", filters.severity);
      if (filters.errorType !== "all") params.set("errorType", filters.errorType);
      params.set("limit", "50");
      params.set("offset", String(page * 50));

      const res = await fetch(`/api/admin/error-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch error logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const filteredLogs = filters.search
    ? logs.filter(
        (log) =>
          log.message.toLowerCase().includes(filters.search.toLowerCase()) ||
          log.userName?.toLowerCase().includes(filters.search.toLowerCase()) ||
          log.userEmail?.toLowerCase().includes(filters.search.toLowerCase()) ||
          log.endpoint?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : logs;

  const stats = {
    critical: logs.filter((l) => l.severity === "critical").length,
    error: logs.filter((l) => l.severity === "error").length,
    warning: logs.filter((l) => l.severity === "warning").length,
    info: logs.filter((l) => l.severity === "info").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-logs"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["critical", "error", "warning", "info"] as const).map((sev) => {
          const Icon = severityIcons[sev];
          return (
            <Card key={sev} data-testid={`card-stat-${sev}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${sev === "critical" ? "text-red-500" : sev === "error" ? "text-orange-500" : sev === "warning" ? "text-yellow-500" : "text-blue-500"}`} />
                <div>
                  <p className="text-2xl font-bold">{stats[sev]}</p>
                  <p className="text-xs text-muted-foreground capitalize">{sev}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages, users, endpoints..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="pl-9"
            data-testid="input-search-logs"
          />
        </div>
        <Select
          value={filters.severity}
          onValueChange={(v) => {
            setFilters((f) => ({ ...f, severity: v }));
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[150px]" data-testid="select-severity-filter">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.errorType}
          onValueChange={(v) => {
            setFilters((f) => ({ ...f, errorType: v }));
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
            <SelectValue placeholder="Error Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(errorTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No error logs found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const isExpanded = expandedRow === log.id;
            const Icon = severityIcons[log.severity] || AlertCircle;
            const colorClass = severityColors[log.severity] || severityColors.info;

            return (
              <Card key={log.id} data-testid={`card-error-log-${log.id}`}>
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                  data-testid={`button-expand-log-${log.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={colorClass} data-testid={`badge-severity-${log.id}`}>
                          {log.severity}
                        </Badge>
                        <Badge variant="secondary" data-testid={`badge-type-${log.id}`}>
                          {errorTypeLabels[log.errorType] || log.errorType}
                        </Badge>
                        {log.wasShownToUser && (
                          <Badge variant="outline" className="text-xs">
                            Shown to user
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate" data-testid={`text-message-${log.id}`}>
                        {log.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        {log.userName && <span>{log.userName}</span>}
                        {log.endpoint && <span>{log.endpoint}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t pt-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {log.userUid && (
                        <div>
                          <span className="text-muted-foreground">User ID:</span>
                          <p className="font-mono text-xs break-all">{log.userUid}</p>
                        </div>
                      )}
                      {log.userEmail && (
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <p>{log.userEmail}</p>
                        </div>
                      )}
                      {log.method && (
                        <div>
                          <span className="text-muted-foreground">Method:</span>
                          <p>{log.method}</p>
                        </div>
                      )}
                      {log.statusCode && (
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <p>{log.statusCode}</p>
                        </div>
                      )}
                    </div>

                    {log.stackTrace && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Stack Trace:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap" data-testid={`text-stack-${log.id}`}>
                          {log.stackTrace}
                        </pre>
                      </div>
                    )}

                    {log.context && Object.keys(log.context).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Context:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap" data-testid={`text-context-${log.id}`}>
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Diagnostics() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"analytics" | "errors">("analytics");

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="diagnostics-page">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-diagnostics-title">Diagnostics</h1>
          <p className="text-muted-foreground">
            Site traffic analytics and error monitoring
          </p>
        </div>

        <div className="flex gap-1 border-b" data-testid="tabs-diagnostics">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "analytics"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("analytics")}
            data-testid="tab-analytics"
          >
            <BarChart3 className="h-4 w-4 inline-block mr-2" />
            Analytics
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "errors"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("errors")}
            data-testid="tab-error-logs"
          >
            <AlertTriangle className="h-4 w-4 inline-block mr-2" />
            Error Logs
          </button>
        </div>

        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "errors" && <ErrorLogsTab />}
      </div>
    </DashboardLayout>
  );
}
