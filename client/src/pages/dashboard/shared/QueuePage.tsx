import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  User, 
  Package, 
  Phone,
  Loader2,
  FileText,
  Briefcase,
  XCircle,
  RotateCcw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Application, User as UserType, Package as PackageType } from "@shared/schema";

type ApplicationWithDetails = Application & {
  user?: UserType;
  package?: PackageType;
};

export default function QueuePage() {
  const { user } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);
  const [workNotes, setWorkNotes] = useState("");
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);

  const level3Name = config?.levelNames?.level3 || "Agent";
  const level4Name = config?.levelNames?.level4 || "Admin";

  // Level 3: Work Queue
  const { data: workQueue, isLoading: workLoading } = useQuery<ApplicationWithDetails[]>({
    queryKey: ["/api/agent/work-queue"],
    enabled: user?.userLevel === 3,
    refetchInterval: 10000,
  });

  const { data: workStats } = useQuery<{ waiting: number; inProgress: number; completedToday: number }>({
    queryKey: ["/api/agent/work-queue/stats"],
    enabled: user?.userLevel === 3,
  });

  // Level 4: Verification Queue
  const { data: verifyQueue, isLoading: verifyLoading } = useQuery<ApplicationWithDetails[]>({
    queryKey: ["/api/admin/verification-queue"],
    enabled: user?.userLevel === 4,
    refetchInterval: 10000,
  });

  const { data: verifyStats } = useQuery<{ pending: number; completedToday: number }>({
    queryKey: ["/api/admin/verification-queue/stats"],
    enabled: user?.userLevel === 4,
  });

  // Level 3: Claim mutation
  const claimMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest(`/api/agent/work-queue/${applicationId}/claim`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue/stats"] });
      toast({ title: "Application claimed", description: "You can now work on this application" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to claim", description: error.message, variant: "destructive" });
    },
  });

  // Level 3: Complete mutation
  const completeMutation = useMutation({
    mutationFn: async ({ applicationId, notes }: { applicationId: string; notes: string }) => {
      return apiRequest(`/api/agent/work-queue/${applicationId}/complete`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue/stats"] });
      setShowCompleteDialog(false);
      setSelectedApp(null);
      setWorkNotes("");
      toast({ title: "Work completed", description: `Application sent to ${level4Name} for verification` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to complete", description: error.message, variant: "destructive" });
    },
  });

  // Level 4: Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ applicationId, notes, approved }: { applicationId: string; notes: string; approved: boolean }) => {
      return apiRequest(`/api/admin/verification-queue/${applicationId}/verify`, {
        method: "POST",
        body: JSON.stringify({ notes, approved }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verification-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verification-queue/stats"] });
      setShowVerifyDialog(false);
      setSelectedApp(null);
      setWorkNotes("");
      if (variables.approved) {
        toast({ title: "Application approved", description: "Application has been completed successfully" });
      } else {
        toast({ title: "Sent back for rework", description: `Application returned to ${level3Name}` });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to verify", description: error.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  const isLevel3 = user.userLevel === 3;
  const isLevel4 = user.userLevel === 4;
  const isLoading = isLevel3 ? workLoading : verifyLoading;

  // Level 3 queue data
  const waitingQueue = workQueue?.filter(app => !app.assignedAgentId) || [];
  const myWork = workQueue?.filter(app => app.assignedAgentId === user.id) || [];

  // Level 4 queue data
  const pendingVerification = verifyQueue || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-queue-title">
            {isLevel3 ? "Work" : "Verification"} Queue
          </h1>
          <p className="text-muted-foreground">
            {isLevel3 
              ? "Applications ready for you to process" 
              : "Applications pending your verification"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {isLevel3 ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Waiting</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-waiting-count">
                    {workStats?.waiting || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Available to claim</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-in-progress-count">
                    {workStats?.inProgress || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Your current work</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-completed-count">
                    {workStats?.completedToday || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Finished today</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-count">
                    {verifyStats?.pending || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Awaiting your review</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-verified-count">
                    {verifyStats?.completedToday || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed today</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Level 3: My Current Work */}
            {isLevel3 && myWork.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    My Current Work
                  </CardTitle>
                  <CardDescription>Applications you're currently working on</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {myWork.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-primary/5"
                        data-testid={`card-my-work-${app.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {app.formData?.firstName || "Applicant"} {app.formData?.lastName || ""}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Package className="h-3 w-3" />
                              Application #{app.id.slice(0, 8)}
                            </p>
                            {app.formData?.phone && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {app.formData.phone}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">In Progress</Badge>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedApp(app);
                              setShowCompleteDialog(true);
                            }}
                            data-testid={`button-complete-${app.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Level 3: Waiting Queue */}
            {isLevel3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Available Work
                  </CardTitle>
                  <CardDescription>
                    Applications waiting to be claimed ({waitingQueue.length})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {waitingQueue.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No applications waiting in queue</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {waitingQueue.map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                          data-testid={`card-queue-item-${app.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {app.formData?.firstName || "Applicant"} {app.formData?.lastName || ""}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Application #{app.id.slice(0, 8)}
                              </p>
                              {app.level2ApprovedAt && (
                                <p className="text-xs text-green-600 dark:text-green-400">
                                  Approved by Level 2 on {new Date(app.level2ApprovedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => claimMutation.mutate(app.id)}
                            disabled={claimMutation.isPending}
                            data-testid={`button-claim-${app.id}`}
                          >
                            {claimMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Claim"
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Level 4: Verification Queue */}
            {isLevel4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Pending Verification
                  </CardTitle>
                  <CardDescription>
                    Applications completed by {level3Name} awaiting your verification ({pendingVerification.length})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingVerification.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No applications pending verification</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingVerification.map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                          data-testid={`card-verify-item-${app.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {app.formData?.firstName || "Applicant"} {app.formData?.lastName || ""}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Application #{app.id.slice(0, 8)}
                              </p>
                              {app.level3CompletedAt && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Completed by {level3Name} on {new Date(app.level3CompletedAt).toLocaleDateString()}
                                </p>
                              )}
                              {app.level3Notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Notes: {app.level3Notes.substring(0, 50)}...
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              setSelectedApp(app);
                              setShowVerifyDialog(true);
                            }}
                            data-testid={`button-verify-${app.id}`}
                          >
                            Review & Verify
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Level 3: Complete Dialog */}
        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Work</DialogTitle>
              <DialogDescription>
                Add notes about the work completed. This will send the application to {level4Name} for verification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Applicant</p>
                <p className="text-muted-foreground">
                  {selectedApp?.formData?.firstName} {selectedApp?.formData?.lastName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Work Notes</label>
                <Textarea
                  placeholder="Describe the work completed..."
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  className="mt-1"
                  rows={4}
                  data-testid="input-work-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedApp) {
                    completeMutation.mutate({ applicationId: selectedApp.id, notes: workNotes });
                  }
                }}
                disabled={completeMutation.isPending}
                data-testid="button-confirm-complete"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Complete & Send to {level4Name}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Level 4: Verify Dialog */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Verify Application</DialogTitle>
              <DialogDescription>
                Review the work completed and approve or send back for rework.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Applicant</p>
                <p className="text-muted-foreground">
                  {selectedApp?.formData?.firstName} {selectedApp?.formData?.lastName}
                </p>
              </div>
              {selectedApp?.level3Notes && (
                <div>
                  <p className="text-sm font-medium mb-1">{level3Name} Notes</p>
                  <p className="text-muted-foreground text-sm bg-muted p-3 rounded-md">
                    {selectedApp.level3Notes}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Verification Notes</label>
                <Textarea
                  placeholder="Add your verification notes..."
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  className="mt-1"
                  rows={3}
                  data-testid="input-verify-notes"
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (selectedApp) {
                    verifyMutation.mutate({ applicationId: selectedApp.id, notes: workNotes, approved: false });
                  }
                }}
                disabled={verifyMutation.isPending}
                data-testid="button-send-rework"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Send Back
              </Button>
              <Button
                onClick={() => {
                  if (selectedApp) {
                    verifyMutation.mutate({ applicationId: selectedApp.id, notes: workNotes, approved: true });
                  }
                }}
                disabled={verifyMutation.isPending}
                data-testid="button-approve"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve & Complete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
