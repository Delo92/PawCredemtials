import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function Diagnostics() {
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
    <DashboardLayout>
      <div className="space-y-6" data-testid="diagnostics-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-diagnostics-title">Diagnostics</h1>
            <p className="text-muted-foreground">
              {total} total error logs
            </p>
          </div>
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
    </DashboardLayout>
  );
}
