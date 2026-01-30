import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, PhoneOff, Users, Clock, Loader2, CheckCircle2 } from "lucide-react";

interface QueueStatus {
  inQueue: boolean;
  position?: number;
  entry?: {
    id: string;
    status: string;
    createdAt: string;
  };
}

export default function CallQueuePage() {
  const { user } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [phone, setPhone] = useState(user?.phone || "");

  const { data: queueStatus, isLoading, refetch } = useQuery<QueueStatus>({
    queryKey: ["/api/queue/my-status"],
    refetchInterval: 5000,
  });

  const joinQueue = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/queue/join", { phone });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue/my-status"] });
      toast({
        title: "Joined Queue",
        description: `You've been added to the call queue. A ${config?.levelNames?.level2 || "Reviewer"} will call you soon.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Join Queue",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const leaveQueue = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/queue/leave");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue/my-status"] });
      toast({
        title: "Left Queue",
        description: "You've been removed from the call queue.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Leave Queue",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user?.phone) {
      setPhone(user.phone);
    }
  }, [user?.phone]);

  const level2Name = config?.levelNames?.level2 || "Reviewer";

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-call-queue-title">
            Call Queue
          </h1>
          <p className="text-muted-foreground">
            Join the queue to speak with a {level2Name}
          </p>
        </div>

        {queueStatus?.inQueue ? (
          <Card className="border-primary">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Phone className="h-8 w-8 animate-pulse" />
              </div>
              <CardTitle>You're in the Queue</CardTitle>
              <CardDescription>
                Please keep this page open. A {level2Name} will call you shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-3xl font-bold text-primary">
                    #{queueStatus.position || 1}
                  </div>
                  <p className="text-sm text-muted-foreground">Your Position</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-3xl font-bold">
                    ~{((queueStatus.position || 1) * 5)}
                  </div>
                  <p className="text-sm text-muted-foreground">Est. Minutes</p>
                </div>
              </div>

              {queueStatus.entry?.status === "claimed" && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-700 dark:text-green-400">
                    A {level2Name} is preparing to call you!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please ensure your phone is ready
                  </p>
                </div>
              )}

              {queueStatus.entry?.status === "in_call" && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                  <Phone className="h-8 w-8 text-blue-500 mx-auto mb-2 animate-pulse" />
                  <p className="font-medium text-blue-700 dark:text-blue-400">
                    Call in Progress
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => leaveQueue.mutate()}
                disabled={leaveQueue.isPending}
                data-testid="button-leave-queue"
              >
                {leaveQueue.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PhoneOff className="mr-2 h-4 w-4" />
                )}
                Leave Queue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Join the Call Queue
              </CardTitle>
              <CardDescription>
                Enter your phone number and join the queue. A {level2Name} will call you when it's your turn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-phone-queue"
                />
                <p className="text-xs text-muted-foreground">
                  We'll call you at this number when it's your turn
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => joinQueue.mutate()}
                disabled={!phone || joinQueue.isPending}
                data-testid="button-join-queue"
              >
                {joinQueue.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Join Queue
                  </>
                )}
              </Button>

              <div className="p-4 rounded-lg bg-muted text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Average wait time: 5-10 minutes
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
