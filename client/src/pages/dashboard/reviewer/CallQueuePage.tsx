import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QueueEntry } from "@shared/schema";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Users,
  Clock,
  CheckCircle2,
  Loader2,
  User,
  ArrowRight,
} from "lucide-react";

interface QueueStats {
  waitingCount: number;
  inCallCount: number;
  completedTodayCount: number;
  waiting: QueueEntry[];
  inCall: QueueEntry[];
}

export default function ReviewerCallQueuePage() {
  const { user } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");

  const { data: stats, isLoading } = useQuery<QueueStats>({
    queryKey: ["/api/queue/stats"],
    refetchInterval: 3000,
  });

  const claimCaller = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/queue/${id}/claim`);
      return response.json();
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue/stats"] });
      setSelectedEntry(entry);
      toast({
        title: "Caller Claimed",
        description: "You can now start the call.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Claim",
        description: error.message || "This caller may have been claimed by another reviewer",
        variant: "destructive",
      });
    },
  });

  const startCall = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/queue/${id}/start-call`);
      return response.json();
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue/stats"] });
      setSelectedEntry(entry);
      toast({
        title: "Call Started",
        description: "The call is now in progress.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Call",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeCall = useMutation({
    mutationFn: async ({ id, notes, outcome }: { id: string; notes: string; outcome: string }) => {
      const response = await apiRequest("POST", `/api/queue/${id}/complete`, { notes, outcome });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue/stats"] });
      setSelectedEntry(null);
      setCompleteDialogOpen(false);
      setNotes("");
      setOutcome("");
      toast({
        title: "Call Completed",
        description: "The call has been marked as complete.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Complete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const releaseCaller = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/queue/${id}/release`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue/stats"] });
      setSelectedEntry(null);
      toast({
        title: "Caller Released",
        description: "The caller has been returned to the queue.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Release",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const level1Name = config?.levelNames?.level1 || "Applicant";

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getWaitTime = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min";
    return `${minutes} mins`;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-call-queue-title">
            Call Queue
          </h1>
          <p className="text-muted-foreground">
            Manage incoming calls from {level1Name}s
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Waiting</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.waitingCount || 0}</div>
              <p className="text-xs text-muted-foreground">In queue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">In Call</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.inCallCount || 0}</div>
              <p className="text-xs text-muted-foreground">Active now</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedTodayCount || 0}</div>
              <p className="text-xs text-muted-foreground">Calls handled</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Call */}
        {selectedEntry && (
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PhoneCall className="h-5 w-5 text-primary" />
                    {selectedEntry.status === "in_call" ? "Active Call" : "Claimed Caller"}
                  </CardTitle>
                  <CardDescription>
                    {selectedEntry.applicantPhone || "No phone provided"}
                  </CardDescription>
                </div>
                <Badge variant={selectedEntry.status === "in_call" ? "default" : "secondary"}>
                  {selectedEntry.status === "in_call" ? "In Call" : "Ready"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {selectedEntry.status === "claimed" && (
                  <Button
                    onClick={() => startCall.mutate(selectedEntry.id)}
                    disabled={startCall.isPending}
                    data-testid="button-start-call"
                  >
                    {startCall.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="mr-2 h-4 w-4" />
                    )}
                    Start Call
                  </Button>
                )}
                {selectedEntry.status === "in_call" && (
                  <Button
                    onClick={() => setCompleteDialogOpen(true)}
                    data-testid="button-complete-call"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Call
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => releaseCaller.mutate(selectedEntry.id)}
                  disabled={releaseCaller.isPending}
                  data-testid="button-release-caller"
                >
                  {releaseCaller.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneOff className="mr-2 h-4 w-4" />
                  )}
                  Release Back to Queue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queue List */}
        <Card>
          <CardHeader>
            <CardTitle>Waiting Queue</CardTitle>
            <CardDescription>
              {stats?.waitingCount || 0} {level1Name}s waiting for a call
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.waiting && stats.waiting.length > 0 ? (
              <div className="space-y-3">
                {stats.waiting.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate transition-all"
                    data-testid={`queue-entry-${entry.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">
                          {entry.applicantPhone || `${level1Name} #${entry.id.slice(0, 6)}`}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Waiting {getWaitTime(entry.createdAt)}</span>
                          <span>•</span>
                          <span>Joined at {formatTime(entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => claimCaller.mutate(entry.id)}
                      disabled={claimCaller.isPending || !!selectedEntry}
                      data-testid={`button-claim-${entry.id}`}
                    >
                      {claimCaller.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Claim
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Queue is Empty</h3>
                <p className="text-muted-foreground max-w-sm">
                  No {level1Name}s are currently waiting. Check back soon!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Call Dialog */}
        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Call</DialogTitle>
              <DialogDescription>
                Add notes and select the outcome for this call.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger data-testid="select-outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="follow_up">Follow-up Required</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add any notes about the call..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedEntry && completeCall.mutate({ id: selectedEntry.id, notes, outcome })}
                disabled={!outcome || completeCall.isPending}
                data-testid="button-confirm-complete"
              >
                {completeCall.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Complete Call"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
