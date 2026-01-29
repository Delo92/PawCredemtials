import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Plus, Inbox, Search } from "lucide-react";

export default function MessagesPage() {
  const { toast } = useToast();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");

  // This would fetch from /api/messages when that endpoint exists
  const { data: conversations, isLoading } = useQuery<any[]>({
    queryKey: ["/api/messages"],
    enabled: false, // Disabled until endpoint is implemented
  });

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      toast({
        title: "Message Sent",
        description: "Messaging functionality will be available soon.",
      });
      setNewMessage("");
    }
  };

  const handleCompose = () => {
    toast({
      title: "New Message",
      description: "Messaging functionality will be available soon.",
    });
    setIsComposeOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-messages-title">
              Messages
            </h1>
            <p className="text-muted-foreground">
              Communicate with support and reviewers
            </p>
          </div>
          <Button onClick={() => setIsComposeOpen(true)} data-testid="button-new-message">
            <Plus className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Inbox</CardTitle>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search messages..." className="pl-9" data-testid="input-search-messages" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
              </div>
            </CardContent>
          </Card>

          {/* Message View */}
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Select a conversation from the inbox or start a new one.
                </p>
                <Button onClick={() => setIsComposeOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start New Conversation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Common support topics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setIsComposeOpen(true)}>
                <MessageSquare className="h-6 w-6 mb-2" />
                <span>Application Status</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setIsComposeOpen(true)}>
                <MessageSquare className="h-6 w-6 mb-2" />
                <span>Document Questions</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setIsComposeOpen(true)}>
                <MessageSquare className="h-6 w-6 mb-2" />
                <span>Payment Support</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compose Dialog */}
        <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
              <DialogDescription>
                Send a message to our support team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input placeholder="What is your message about?" data-testid="input-message-subject" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Type your message here..."
                  className="min-h-[150px]"
                  data-testid="input-message-body"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCompose} data-testid="button-send-message">
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
