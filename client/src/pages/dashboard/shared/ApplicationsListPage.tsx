import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText, Search, Clock, CheckCircle, XCircle, Stethoscope, Send,
  Loader2, Copy, ExternalLink, CreditCard,
} from "lucide-react";

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "completed" || status === "doctor_approved") return "default";
  if (status === "rejected" || status === "doctor_denied") return "destructive";
  return "secondary";
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function ApplicationsListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sendingAppId, setSendingAppId] = useState<string | null>(null);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [reviewLinkDialog, setReviewLinkDialog] = useState<{ url: string; doctorName: string } | null>(null);

  const { data: applications, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/applications"],
  });

  const sendToDoctorMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/send-to-doctor`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sent to Doctor",
        description: `Application sent to ${data.doctor?.name || "doctor"} for review.`,
      });
      setReviewLinkDialog({ url: data.reviewUrl, doctorName: data.doctor?.name || "Doctor" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      setSendingAppId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send to doctor",
        variant: "destructive",
      });
      setSendingAppId(null);
    },
  });

  const processPaymentMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/process-payment`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Processed",
        description: "Payment has been processed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      setProcessingPaymentId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
      setProcessingPaymentId(null);
    },
  });

  if (!user) return null;

  const filteredApps = applications?.filter(app => {
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        app.id?.toLowerCase().includes(q) ||
        app.userId?.toLowerCase().includes(q) ||
        app.status?.toLowerCase().includes(q)
      );
    }
    return true;
  }) || [];

  const pendingCount = applications?.filter(a => a.status === "pending" || a.status === "level3_work").length || 0;
  const awaitingPaymentCount = applications?.filter(a => a.status === "awaiting_payment").length || 0;
  const doctorReviewCount = applications?.filter(a => a.status === "doctor_review").length || 0;
  const approvedCount = applications?.filter(a => a.status === "completed" || a.status === "doctor_approved").length || 0;
  const deniedCount = applications?.filter(a => a.status === "rejected" || a.status === "doctor_denied").length || 0;

  const canSendToDoctor = (status: string) => {
    return status === "pending" || status === "level3_work";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-applications-title">
              All Orders
            </h1>
            <p className="text-muted-foreground">
              View and manage all support animal registration orders
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-count">{applications?.length || 0}</div>
              <p className="text-xs text-muted-foreground">All orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-count">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Ready to send</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Awaiting Payment</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-awaiting-payment-count">{awaitingPaymentCount}</div>
              <p className="text-xs text-muted-foreground">Payment pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">With Doctor</CardTitle>
              <Stethoscope className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-doctor-review-count">{doctorReviewCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-approved-count">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>All support animal registration orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or user..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-applications"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                  <SelectItem value="doctor_review">With Doctor</SelectItem>
                  <SelectItem value="doctor_approved">Approved</SelectItem>
                  <SelectItem value="doctor_denied">Denied</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                <p className="text-muted-foreground max-w-sm">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filter."
                    : "Orders will appear here as customers submit them."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApps.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-wrap items-center gap-3 p-4 border rounded-md"
                    data-testid={`row-application-${app.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-app-id-${app.id}`}>
                        Order #{app.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(app.status)} data-testid={`badge-status-${app.id}`}>
                      {formatStatus(app.status)}
                    </Badge>
                    {canSendToDoctor(app.status) && user.userLevel >= 3 && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSendingAppId(app.id);
                          sendToDoctorMutation.mutate(app.id);
                        }}
                        disabled={sendToDoctorMutation.isPending && sendingAppId === app.id}
                        data-testid={`button-send-to-doctor-${app.id}`}
                      >
                        {sendToDoctorMutation.isPending && sendingAppId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Send to Doctor
                      </Button>
                    )}
                    {app.status === "awaiting_payment" && user.userLevel >= 3 && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setProcessingPaymentId(app.id);
                          processPaymentMutation.mutate(app.id);
                        }}
                        disabled={processPaymentMutation.isPending && processingPaymentId === app.id}
                        data-testid={`button-process-payment-${app.id}`}
                      >
                        {processPaymentMutation.isPending && processingPaymentId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CreditCard className="h-4 w-4 mr-1" />
                        )}
                        Process Payment
                      </Button>
                    )}
                    {app.status === "doctor_review" && (
                      <Badge variant="secondary">
                        <Stethoscope className="h-3 w-3 mr-1" />
                        Awaiting Doctor
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!reviewLinkDialog} onOpenChange={() => setReviewLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Doctor Review Link Generated</DialogTitle>
            <DialogDescription>
              Copy this secure link and forward it to {reviewLinkDialog?.doctorName} for review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={reviewLinkDialog?.url || ""}
                readOnly
                className="font-mono text-sm"
                data-testid="input-review-link"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  if (reviewLinkDialog?.url) {
                    navigator.clipboard.writeText(reviewLinkDialog.url);
                    toast({ title: "Copied", description: "Review link copied to clipboard" });
                  }
                }}
                data-testid="button-copy-link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (reviewLinkDialog?.url) {
                    window.open(reviewLinkDialog.url, "_blank");
                  }
                }}
                data-testid="button-open-link"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
              <Button variant="outline" onClick={() => setReviewLinkDialog(null)} data-testid="button-close-dialog">
                Close
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 7 days and can only be used once. The doctor does not need to log in to review.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
