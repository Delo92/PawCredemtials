import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Search, Copy, Share2, UserPlus, Link2, CheckCircle, Clock, ChevronDown, ChevronUp, Plus, Trash2, ExternalLink } from "lucide-react";

interface ReferredUser {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  createdAt?: string;
  applicationCount: number;
  completedCount: number;
  status?: string;
}

interface MyReferralsData {
  referrals: ReferredUser[];
  stats: { total: number; active: number; converted: number };
}

interface ReferrerSummary {
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referralCode: string;
  userLevel: number;
  isSystem?: boolean;
  useCount?: number;
  totalReferred: number;
  activeReferrals: number;
  convertedReferrals: number;
  referredUsers: ReferredUser[];
}

interface SystemReferralCode {
  id: string;
  name: string;
  email: string;
  code: string;
  useCount: number;
  isActive: boolean;
  createdAt: string;
}

interface AdminReferralsData {
  referrers: ReferrerSummary[];
  systemCodes?: SystemReferralCode[];
  stats: { totalReferralCodes: number; totalReferred: number; totalConverted: number };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "converted") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" data-testid={`badge-status-${status}`}><CheckCircle className="h-3 w-3 mr-1" />Converted</Badge>;
  if (status === "active") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" data-testid={`badge-status-${status}`}><Clock className="h-3 w-3 mr-1" />Active</Badge>;
  return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Registered</Badge>;
}

function PersonalReferralsView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [search, setSearch] = useState("");

  const referralCode = user?.referralCode || "";
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const { data, isLoading } = useQuery<MyReferralsData>({
    queryKey: ["/api/referrals/my-referrals"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/referrals/my-referrals");
      return res.json();
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard" });
  };

  const filteredReferrals = (data?.referrals || []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = `${r.firstName || ""} ${r.lastName || ""}`.toLowerCase();
    return name.includes(s) || r.email.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-referrals-title">My Referrals</h1>
          <p className="text-muted-foreground">Manage your referrals and track commissions</p>
        </div>
        <Button onClick={() => setIsShareOpen(true)} data-testid="button-share-referral">
          <Share2 className="mr-2 h-4 w-4" />
          Share Referral Link
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Referral Code</CardTitle>
          <CardDescription>Share this code to earn commissions on referrals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Referral Code</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono" data-testid="text-referral-code">{referralCode || "—"}</span>
                {referralCode && (
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(referralCode)} data-testid="button-copy-code">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Referral Link</p>
              <div className="flex items-center gap-2">
                <span className="text-sm truncate" data-testid="text-referral-link">{referralLink}</span>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(referralLink)} data-testid="button-copy-link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-referrals">{data?.stats.total || 0}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <UserPlus className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-referrals">{data?.stats.active || 0}</div>
                <p className="text-xs text-muted-foreground">With pending applications</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Converted</CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-converted-referrals">{data?.stats.converted || 0}</div>
                <p className="text-xs text-muted-foreground">Completed applications</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral History</CardTitle>
          <CardDescription>People who signed up using your referral code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search referrals..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-referrals"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredReferrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No referrals yet</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Share your referral link to start earning commissions when people sign up.
              </p>
              <Button onClick={() => setIsShareOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" />
                Share Your Link
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.map((r) => (
                  <TableRow key={r.id} data-testid={`row-referral-${r.id}`}>
                    <TableCell className="font-medium">{r.firstName} {r.lastName}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.applicationCount} ({r.completedCount} completed)</TableCell>
                    <TableCell><StatusBadge status={r.status || "registered"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Your Referral Link</DialogTitle>
            <DialogDescription>Share this link with potential applicants to earn commissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Referral Link</label>
              <div className="flex gap-2">
                <Input value={referralLink} readOnly data-testid="input-referral-link" />
                <Button variant="outline" onClick={() => copyToClipboard(referralLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Referral Code</label>
              <div className="flex gap-2">
                <Input value={referralCode} readOnly data-testid="input-referral-code" />
                <Button variant="outline" onClick={() => copyToClipboard(referralCode)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsShareOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminReferralsView() {
  const [search, setSearch] = useState("");
  const [expandedReferrer, setExpandedReferrer] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeEmail, setNewCodeEmail] = useState("");
  const [newCodeCustom, setNewCodeCustom] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AdminReferralsData>({
    queryKey: ["/api/admin/referrals"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/referrals");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; email: string; code?: string }) => {
      const res = await apiRequest("POST", "/api/admin/system-referral-codes", body);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create referral code");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      setIsCreateOpen(false);
      setNewCodeName("");
      setNewCodeEmail("");
      setNewCodeCustom("");
      toast({ title: "Referral code created", description: "The referral code has been created and is ready to use." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/system-referral-codes/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({ title: "Referral code deactivated" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard" });
  };

  const filteredReferrers = (data?.referrers || []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.referrerName.toLowerCase().includes(s) || r.referrerEmail.toLowerCase().includes(s) || r.referralCode.toLowerCase().includes(s);
  });

  const systemCodes = (data?.systemCodes || []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.code.toLowerCase().includes(s);
  });

  const levelLabel = (level: number, isSystem?: boolean) => {
    if (isSystem) return "External";
    switch (level) {
      case 1: return "Applicant";
      case 2: return "Reviewer";
      case 3: return "Admin";
      case 4: return "Owner";
      default: return `Level ${level}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-referrals-title">Referral Management</h1>
          <p className="text-muted-foreground">Track all referral activity across the platform</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-referral-code">
          <Plus className="mr-2 h-4 w-4" />
          Create Referral Code
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Referral Codes</CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-codes">{data?.stats.totalReferralCodes || 0}</div>
                <p className="text-xs text-muted-foreground">Users with referral codes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Referred</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-referred">{data?.stats.totalReferred || 0}</div>
                <p className="text-xs text-muted-foreground">Users signed up via referrals</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Converted</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-converted">{data?.stats.totalConverted || 0}</div>
                <p className="text-xs text-muted-foreground">Completed applications from referrals</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Referral Codes</CardTitle>
              <CardDescription>External referral codes created for non-users</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : systemCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <ExternalLink className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">No external referral codes yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-3">
                Create referral codes for people outside the platform. They'll get an email each time someone uses their code.
              </p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} data-testid="button-create-code-empty">
                <Plus className="mr-2 h-4 w-4" />
                Create Code
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-center">Times Used</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemCodes.map((sc) => (
                  <TableRow key={sc.id} data-testid={`row-system-code-${sc.id}`}>
                    <TableCell className="font-medium">{sc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{sc.email}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{sc.code}</code>
                    </TableCell>
                    <TableCell className="text-center font-medium">{sc.useCount || 0}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${window.location.origin}/register?ref=${sc.code}`)}
                        data-testid={`button-copy-system-link-${sc.id}`}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Link
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Deactivate referral code for ${sc.name}?`)) {
                            deleteMutation.mutate(sc.id);
                          }
                        }}
                        data-testid={`button-delete-system-code-${sc.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referrers</CardTitle>
          <CardDescription>All referrers across the platform (users and external)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or code..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-referrers"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredReferrers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No referral activity yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Referral data will appear here once users start referring others.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Referred</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Converted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrers.map((r) => (
                  <>
                    <TableRow key={r.referrerId} className="cursor-pointer" onClick={() => setExpandedReferrer(expandedReferrer === r.referrerId ? null : r.referrerId)} data-testid={`row-referrer-${r.referrerId}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.referrerName}</p>
                          <p className="text-xs text-muted-foreground">{r.referrerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono" data-testid={`text-code-${r.referrerId}`}>{r.referralCode}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.isSystem ? "default" : "outline"}>
                          {levelLabel(r.userLevel, r.isSystem)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{r.totalReferred}</TableCell>
                      <TableCell className="text-center">{r.activeReferrals}</TableCell>
                      <TableCell className="text-center">{r.convertedReferrals}</TableCell>
                      <TableCell>
                        {r.totalReferred > 0 && (expandedReferrer === r.referrerId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </TableCell>
                    </TableRow>
                    {expandedReferrer === r.referrerId && r.referredUsers.map((u) => (
                      <TableRow key={u.id} className="bg-muted/30" data-testid={`row-referred-user-${u.id}`}>
                        <TableCell className="pl-8">
                          <p className="text-sm">{u.name}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center text-sm">{u.applicationCount} apps</TableCell>
                        <TableCell className="text-center text-sm">{u.completedCount} done</TableCell>
                        <TableCell colSpan={2}>
                          <StatusBadge status={u.completedCount > 0 ? "converted" : u.applicationCount > 0 ? "active" : "registered"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Referral Code</DialogTitle>
            <DialogDescription>
              Create a referral code for someone outside the platform. They'll receive an email notification each time someone signs up using their code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="referral-name">Name</Label>
              <Input
                id="referral-name"
                placeholder="John Smith"
                value={newCodeName}
                onChange={(e) => setNewCodeName(e.target.value)}
                data-testid="input-new-code-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral-email">Email</Label>
              <Input
                id="referral-email"
                type="email"
                placeholder="john@example.com"
                value={newCodeEmail}
                onChange={(e) => setNewCodeEmail(e.target.value)}
                data-testid="input-new-code-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral-code">Custom Code (optional)</Label>
              <Input
                id="referral-code"
                placeholder="Leave blank to auto-generate"
                value={newCodeCustom}
                onChange={(e) => setNewCodeCustom(e.target.value.toUpperCase())}
                data-testid="input-new-code-custom"
              />
              <p className="text-xs text-muted-foreground">If left blank, a random code will be generated.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newCodeName.trim() || !newCodeEmail.trim()) {
                  toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" });
                  return;
                }
                createMutation.mutate({
                  name: newCodeName.trim(),
                  email: newCodeEmail.trim(),
                  ...(newCodeCustom.trim() ? { code: newCodeCustom.trim() } : {}),
                });
              }}
              disabled={createMutation.isPending}
              data-testid="button-submit-create-code"
            >
              {createMutation.isPending ? "Creating..." : "Create Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ReferralsPage() {
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = (user.userLevel || 1) >= 3;

  return (
    <DashboardLayout>
      {isAdmin ? <AdminReferralsView /> : <PersonalReferralsView />}
    </DashboardLayout>
  );
}
