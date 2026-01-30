import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { UserProfileModal } from "@/components/shared/UserProfileModal";
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
  RotateCcw,
  Mail,
  Calendar,
  MapPin,
  Search,
  UserCog
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Application, User as UserType, Package as PackageType } from "@shared/schema";

type ApplicationWithDetails = Application & {
  user?: UserType;
  package?: PackageType;
};

type Level3Tab = "waiting" | "in_progress" | "completed";
type Level4Tab = "pending" | "verified";

export default function QueuePage() {
  const { user } = useAuth();
  const { config, getLevelName } = useConfig();
  const { toast } = useToast();
  const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [workNotes, setWorkNotes] = useState("");
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [level3Tab, setLevel3Tab] = useState<Level3Tab>("waiting");
  const [level4Tab, setLevel4Tab] = useState<Level4Tab>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const level3Name = config?.levelNames?.level3 || "Agent";
  const level4Name = config?.levelNames?.level4 || "Admin";
  const level1Name = config?.levelNames?.level1 || "Applicant";

  // Level 3: Work Queue (all applications in level3_work status)
  const { data: workQueue, isLoading: workLoading } = useQuery<ApplicationWithDetails[]>({
    queryKey: ["/api/agent/work-queue"],
    enabled: user?.userLevel === 3,
    refetchInterval: 10000,
  });

  // Level 3: Completed applications by this agent
  const { data: completedByMe, isLoading: completedLoading } = useQuery<ApplicationWithDetails[]>({
    queryKey: ["/api/agent/my-completed"],
    enabled: user?.userLevel === 3,
  });

  const { data: workStats } = useQuery<{ waiting: number; inProgress: number; completedTotal: number }>({
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
      return apiRequest("POST", `/api/agent/work-queue/${applicationId}/claim`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue/stats"] });
      toast({ title: "Application claimed", description: "Added to your In Progress queue" });
      setLevel3Tab("in_progress");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to claim", description: error.message, variant: "destructive" });
    },
  });

  // Level 3: Complete mutation
  const completeMutation = useMutation({
    mutationFn: async ({ applicationId, notes }: { applicationId: string; notes: string }) => {
      return apiRequest("POST", `/api/agent/work-queue/${applicationId}/complete`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/work-queue/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/my-completed"] });
      setShowCompleteDialog(false);
      setSelectedApp(null);
      setWorkNotes("");
      toast({ title: "Work completed", description: `Sent to ${level4Name} for verification` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to complete", description: error.message, variant: "destructive" });
    },
  });

  // Level 4: Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ applicationId, notes, approved }: { applicationId: string; notes: string; approved: boolean }) => {
      return apiRequest("POST", `/api/admin/verification-queue/${applicationId}/verify`, { notes, approved });
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
  const isLoading = isLevel3 ? (workLoading || completedLoading) : verifyLoading;

  // Level 3 queue data
  const waitingQueue = workQueue?.filter(app => !app.assignedAgentId) || [];
  const myInProgress = workQueue?.filter(app => app.assignedAgentId === user.id) || [];
  const myCompleted = completedByMe || [];

  // Level 4 queue data
  const pendingVerification = verifyQueue || [];

  // Filter based on search
  const filterApps = (apps: ApplicationWithDetails[]) => {
    if (!searchQuery) return apps;
    const query = searchQuery.toLowerCase();
    return apps.filter(app => {
      const name = `${app.formData?.firstName || ""} ${app.formData?.lastName || ""}`.toLowerCase();
      const email = (app.formData?.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  };

  const getDisplayName = (app: ApplicationWithDetails) => {
    return `${app.formData?.firstName || "Applicant"} ${app.formData?.lastName || ""}`;
  };

  const getQueueData = () => {
    if (level3Tab === "waiting") return filterApps(waitingQueue);
    if (level3Tab === "in_progress") return filterApps(myInProgress);
    if (level3Tab === "completed") return filterApps(myCompleted);
    return [];
  };

  const handleViewProfile = (app: ApplicationWithDetails) => {
    if (app.user) {
      setSelectedUser(app.user);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-queue-title">
            {isLevel3 ? "Work" : "Verification"} Queue
          </h1>
          <p className="text-muted-foreground">
            {isLevel3 
              ? `Manage your ${level1Name}s and track your work` 
              : "Applications pending your verification"}
          </p>
        </div>

        {/* Level 3: Clickable Tab Cards */}
        {isLevel3 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card 
              className={`cursor-pointer transition-all ${level3Tab === "waiting" ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
              onClick={() => setLevel3Tab("waiting")}
              data-testid="tab-waiting"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Waiting</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-waiting-count">
                  {workStats?.waiting || waitingQueue.length}
                </div>
                <p className="text-xs text-muted-foreground">Shared queue - claim to start</p>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${level3Tab === "in_progress" ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
              onClick={() => setLevel3Tab("in_progress")}
              data-testid="tab-in-progress"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-in-progress-count">
                  {workStats?.inProgress || myInProgress.length}
                </div>
                <p className="text-xs text-muted-foreground">Your claimed {level1Name}s</p>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${level3Tab === "completed" ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
              onClick={() => setLevel3Tab("completed")}
              data-testid="tab-completed"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-completed-count">
                  {workStats?.completedTotal || myCompleted.length}
                </div>
                <p className="text-xs text-muted-foreground">Your completed {level1Name}s</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Level 4: Stats (not tabs) */}
        {isLevel4 && (
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        )}

        {/* Level 3: Table-based Queue Display */}
        {isLevel3 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {level3Tab === "waiting" && <Clock className="h-5 w-5" />}
                    {level3Tab === "in_progress" && <Briefcase className="h-5 w-5" />}
                    {level3Tab === "completed" && <CheckCircle className="h-5 w-5" />}
                    {level3Tab === "waiting" && "Waiting Queue (Shared)"}
                    {level3Tab === "in_progress" && "My In Progress"}
                    {level3Tab === "completed" && `My Completed ${level1Name}s`}
                  </CardTitle>
                  <CardDescription>
                    {level3Tab === "waiting" && `${level1Name}s waiting to be claimed by any ${level3Name} (${waitingQueue.length})`}
                    {level3Tab === "in_progress" && `${level1Name}s you've claimed and are working on (${myInProgress.length})`}
                    {level3Tab === "completed" && `All ${level1Name}s you've completed (${myCompleted.length})`}
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                    data-testid="input-search-queue"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : getQueueData().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {level3Tab === "waiting" && (
                    <>
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No {level1Name}s waiting in queue</p>
                    </>
                  )}
                  {level3Tab === "in_progress" && (
                    <>
                      <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No {level1Name}s in progress</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setLevel3Tab("waiting")}
                      >
                        Go to Waiting Queue to claim
                      </Button>
                    </>
                  )}
                  {level3Tab === "completed" && (
                    <>
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No completed {level1Name}s yet</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getQueueData().map((app) => (
                        <TableRow key={app.id} data-testid={`row-${level3Tab}-${app.id}`}>
                          <TableCell className="font-medium">
                            {getDisplayName(app)}
                          </TableCell>
                          <TableCell>{app.formData?.email || "-"}</TableCell>
                          <TableCell>{app.formData?.phone || "-"}</TableCell>
                          <TableCell>
                            {level3Tab === "waiting" && (
                              <Badge variant="secondary">Waiting</Badge>
                            )}
                            {level3Tab === "in_progress" && (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">In Progress</Badge>
                            )}
                            {level3Tab === "completed" && (
                              <Badge className={app.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""} variant={app.status === "completed" ? "default" : "outline"}>
                                {app.status === "completed" ? "Verified" : "Pending Verification"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {level3Tab === "completed" && app.level3CompletedAt
                              ? new Date(app.level3CompletedAt).toLocaleDateString()
                              : app.createdAt
                                ? new Date(app.createdAt).toLocaleDateString()
                                : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewProfile(app)}
                                data-testid={`button-view-profile-${app.id}`}
                                title="View Profile"
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                              {level3Tab === "waiting" && (
                                <Button
                                  size="sm"
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
                              )}
                              {level3Tab === "in_progress" && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setShowCompleteDialog(true);
                                  }}
                                  data-testid={`button-complete-${app.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Level 4: Verification Queue (keep existing) */}
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
              {verifyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : pendingVerification.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No applications pending verification</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Agent Notes</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingVerification.map((app) => (
                        <TableRow key={app.id} data-testid={`verify-row-${app.id}`}>
                          <TableCell className="font-medium">
                            {getDisplayName(app)}
                          </TableCell>
                          <TableCell>{app.formData?.email || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {app.level3Notes || "-"}
                          </TableCell>
                          <TableCell>
                            {app.level3CompletedAt
                              ? new Date(app.level3CompletedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewProfile(app)}
                                data-testid={`button-view-profile-${app.id}`}
                                title="View Profile"
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setShowVerifyDialog(true);
                                }}
                                data-testid={`button-verify-${app.id}`}
                              >
                                Review
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Profile Modal */}
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          canEditLevel={false}
        />

        {/* Complete Work Dialog (Level 3) */}
        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Work</DialogTitle>
              <DialogDescription>
                Add notes about your work with {selectedApp?.formData?.firstName} {selectedApp?.formData?.lastName}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Work notes (required)"
              value={workNotes}
              onChange={(e) => setWorkNotes(e.target.value)}
              rows={4}
              data-testid="input-work-notes"
            />
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
                disabled={completeMutation.isPending || !workNotes.trim()}
                data-testid="button-confirm-complete"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Send to {level4Name}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Verify Dialog (Level 4) */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Application</DialogTitle>
              <DialogDescription>
                Review work by {level3Name} for {selectedApp?.formData?.firstName} {selectedApp?.formData?.lastName}
              </DialogDescription>
            </DialogHeader>
            {selectedApp?.level3Notes && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-medium text-xs mb-1">{level3Name} Notes:</p>
                <p className="text-muted-foreground">{selectedApp.level3Notes}</p>
              </div>
            )}
            <Textarea
              placeholder="Verification notes (optional)"
              value={workNotes}
              onChange={(e) => setWorkNotes(e.target.value)}
              rows={3}
              data-testid="input-verify-notes"
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedApp) {
                    verifyMutation.mutate({ applicationId: selectedApp.id, notes: workNotes, approved: false });
                  }
                }}
                disabled={verifyMutation.isPending}
                data-testid="button-rework"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Send for Rework
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
