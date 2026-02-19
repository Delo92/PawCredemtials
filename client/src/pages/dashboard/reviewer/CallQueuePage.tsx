import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Level2ProfileModal } from "@/components/shared/Level2ProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Users,
  Clock,
  CheckCircle2,
  Loader2,
  Search,
  UserCog,
  PhoneIncoming
} from "lucide-react";

interface QueueStats {
  waitingCount: number;
  inCallCount: number;
  completedTodayCount: number;
  waiting: any[];
  inCall: any[];
  completed: any[];
}

type CallTab = "waiting" | "in_call" | "completed";

export default function ReviewerCallQueuePage() {
  const { user } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<CallTab>("waiting");
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [profileEntry, setProfileEntry] = useState<any | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
      setActiveTab("in_call");
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

  const getWaitTime = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min";
    return `${minutes} mins`;
  };

  const getDisplayName = (entry: any) => {
    if (entry.applicantFirstName || entry.applicantLastName) {
      return `${entry.applicantFirstName || ""} ${entry.applicantLastName || ""}`.trim();
    }
    return `${level1Name} #${entry.id.slice(0, 6)}`;
  };

  const filterEntries = (entries: any[] | undefined) => {
    if (!entries) return [];
    if (!searchQuery) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(entry => {
      const name = getDisplayName(entry).toLowerCase();
      const state = (entry.applicantState || "").toLowerCase();
      const pkg = (entry.packageName || "").toLowerCase();
      return name.includes(query) || state.includes(query) || pkg.includes(query);
    });
  };

  const getTabData = () => {
    if (activeTab === "waiting") return filterEntries(stats?.waiting);
    if (activeTab === "in_call") return filterEntries(stats?.inCall);
    if (activeTab === "completed") return filterEntries(stats?.completed);
    return [];
  };

  const myClaimedEntry = stats?.inCall?.find(e => e.reviewerId === user?.id);

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

        {/* Tab Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card 
            className={`cursor-pointer transition-all ${activeTab === "waiting" ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
            onClick={() => setActiveTab("waiting")}
            data-testid="tab-waiting"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Waiting</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-waiting-count">
                {stats?.waitingCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">Shared queue - claim to start</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${activeTab === "in_call" ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
            onClick={() => setActiveTab("in_call")}
            data-testid="tab-in-call"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">In Call</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-in-call-count">
                {stats?.inCallCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active calls across all reviewers</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${activeTab === "completed" ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
            onClick={() => setActiveTab("completed")}
            data-testid="tab-completed"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completed-count">
                {stats?.completedTodayCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">Calls handled today</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Call Banner - Show when user has a claimed/in-call entry */}
        {myClaimedEntry && (
          <Card className="border-primary bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhoneIncoming className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    {myClaimedEntry.status === "in_call" ? "Active Call" : "Claimed Caller"}
                  </CardTitle>
                  <Badge variant={myClaimedEntry.status === "in_call" ? "default" : "secondary"}>
                    {myClaimedEntry.status === "in_call" ? "In Call" : "Ready"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{getDisplayName(myClaimedEntry)}</p>
                  <p className="text-sm text-muted-foreground">
                    {myClaimedEntry.applicantState && `${myClaimedEntry.applicantState} • `}
                    {myClaimedEntry.packageName || "No package"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {myClaimedEntry.status === "claimed" && (
                    <Button
                      onClick={() => startCall.mutate(myClaimedEntry.id)}
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
                  {myClaimedEntry.status === "in_call" && (
                    <Button
                      onClick={() => {
                        setSelectedEntry(myClaimedEntry);
                        setCompleteDialogOpen(true);
                      }}
                      data-testid="button-complete-call"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Call
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => releaseCaller.mutate(myClaimedEntry.id)}
                    disabled={releaseCaller.isPending}
                    data-testid="button-release-caller"
                  >
                    {releaseCaller.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PhoneOff className="mr-2 h-4 w-4" />
                    )}
                    Release
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table-based Queue Display */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {activeTab === "waiting" && <Clock className="h-5 w-5" />}
                  {activeTab === "in_call" && <PhoneCall className="h-5 w-5" />}
                  {activeTab === "completed" && <CheckCircle2 className="h-5 w-5" />}
                  {activeTab === "waiting" && "Waiting Queue (Shared)"}
                  {activeTab === "in_call" && "Active Calls"}
                  {activeTab === "completed" && "Completed Today"}
                </CardTitle>
                <CardDescription>
                  {activeTab === "waiting" && `${level1Name}s waiting to be claimed (${stats?.waitingCount || 0})`}
                  {activeTab === "in_call" && `${level1Name}s currently in calls with reviewers (${stats?.inCallCount || 0})`}
                  {activeTab === "completed" && `Calls completed today (${stats?.completedTodayCount || 0})`}
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                  data-testid="input-search-queue"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {getTabData().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  {activeTab === "waiting" && <Users className="h-8 w-8 text-muted-foreground" />}
                  {activeTab === "in_call" && <PhoneCall className="h-8 w-8 text-muted-foreground" />}
                  {activeTab === "completed" && <CheckCircle2 className="h-8 w-8 text-muted-foreground" />}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {activeTab === "waiting" && "Queue is Empty"}
                  {activeTab === "in_call" && "No Active Calls"}
                  {activeTab === "completed" && "No Completed Calls"}
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  {activeTab === "waiting" && `No ${level1Name}s are currently waiting. Check back soon!`}
                  {activeTab === "in_call" && `No ${level1Name}s are currently in a call.`}
                  {activeTab === "completed" && "No calls have been completed today."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>
                        {activeTab === "waiting" && "Wait Time"}
                        {activeTab === "in_call" && "Status"}
                        {activeTab === "completed" && "Outcome"}
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTabData().map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-${activeTab}-${entry.id}`}>
                        <TableCell className="font-medium">
                          {getDisplayName(entry)}
                        </TableCell>
                        <TableCell>{entry.applicantState || "-"}</TableCell>
                        <TableCell>{entry.packageName || "-"}</TableCell>
                        <TableCell>
                          {activeTab === "waiting" && (
                            <span className="text-muted-foreground">{getWaitTime(entry.createdAt)}</span>
                          )}
                          {activeTab === "in_call" && (
                            <Badge className={entry.status === "in_call" 
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                              : ""} 
                              variant={entry.status === "in_call" ? "default" : "secondary"}>
                              {entry.status === "in_call" ? "In Call" : "Claimed"}
                            </Badge>
                          )}
                          {activeTab === "completed" && (
                            <Badge variant={entry.outcome === "approved" ? "default" : "secondary"}>
                              {entry.outcome || "Completed"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setProfileEntry(entry)}
                              data-testid={`button-view-profile-${entry.id}`}
                              title="View Profile"
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                            {activeTab === "waiting" && (
                              <Button
                                size="sm"
                                onClick={() => claimCaller.mutate(entry.id)}
                                disabled={claimCaller.isPending || !!myClaimedEntry}
                                data-testid={`button-claim-${entry.id}`}
                              >
                                {claimCaller.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Claim"
                                )}
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

        {/* Level 2 Profile Modal */}
        <Level2ProfileModal
          entry={profileEntry}
          onClose={() => setProfileEntry(null)}
        />

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
