import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, Search, Users, TrendingUp, Wallet, Settings, Loader2 } from "lucide-react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function CommissionSettingsPanel() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/commission-settings"],
  });

  const [doctorFee, setDoctorFee] = useState<string>("");
  const [referralPayout, setReferralPayout] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setDoctorFee(settings.doctorReviewFee ? (settings.doctorReviewFee / 100).toFixed(2) : "");
    setReferralPayout(settings.referralPayoutAmount ? (settings.referralPayoutAmount / 100).toFixed(2) : "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: { doctorReviewFee: number; referralPayoutAmount: number }) => {
      const res = await apiRequest("PUT", "/api/admin/commission-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commission-settings"] });
      toast({ title: "Settings saved", description: "Commission settings have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const feeInCents = Math.round(parseFloat(doctorFee || "0") * 100);
    const payoutInCents = Math.round(parseFloat(referralPayout || "0") * 100);
    saveMutation.mutate({ doctorReviewFee: feeInCents, referralPayoutAmount: payoutInCents });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Commission Settings</CardTitle>
            <CardDescription>Configure payout amounts for doctor reviews and referrals</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doctorFee">Doctor Review Fee</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="doctorFee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={doctorFee}
                onChange={(e) => setDoctorFee(e.target.value)}
                className="pl-9"
                data-testid="input-doctor-review-fee"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Flat fee paid to the doctor for each approved review
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referralPayout">Referral Payout Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="referralPayout"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={referralPayout}
                onChange={(e) => setReferralPayout(e.target.value)}
                className="pl-9"
                data-testid="input-referral-payout"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Flat fee paid to the referrer when a referred applicant completes
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-commission-settings"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommissionsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const isAdmin = user && user.userLevel >= 3;

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery<any[]>({
    queryKey: ["/api/commissions"],
  });

  const filteredCommissions = commissions.filter((c: any) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesId = c.id?.toLowerCase().includes(searchLower);
      const matchesApp = c.applicationId?.toLowerCase().includes(searchLower);
      const matchesType = c.commissionType?.toLowerCase().includes(searchLower);
      if (!matchesId && !matchesApp && !matchesType) return false;
    }
    return true;
  });

  const totalEarned = commissions
    .filter((c: any) => c.status === "paid")
    .reduce((sum: number, c: any) => sum + parseFloat(c.amount || "0"), 0);

  const pendingAmount = commissions
    .filter((c: any) => c.status === "pending")
    .reduce((sum: number, c: any) => sum + parseFloat(c.amount || "0"), 0);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEarned = commissions
    .filter((c: any) => c.status === "paid" && new Date(c.createdAt) >= thisMonthStart)
    .reduce((sum: number, c: any) => sum + parseFloat(c.amount || "0"), 0);

  const referralCount = commissions.filter((c: any) => c.commissionType === "referral").length;

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-commissions-title">
              Commissions
            </h1>
            <p className="text-muted-foreground">
              Track commissions and payouts
            </p>
          </div>
        </div>

        {isAdmin && <CommissionSettingsPanel />}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-earned">${totalEarned.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All time earnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Wallet className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-amount">${pendingAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Awaiting payout</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-this-month">${thisMonthEarned.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Current month earnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-referral-count">{referralCount}</div>
              <p className="text-xs text-muted-foreground">Referral commissions</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Commission History</CardTitle>
            <CardDescription>All commission transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or type..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-commissions"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-commission-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Commissions</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {commissionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCommissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No commissions yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  Commission history will appear here as reviews are completed and referrals come through.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommissions.map((commission: any) => (
                      <tr key={commission.id} className="border-b" data-testid={`row-commission-${commission.id}`}>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={commission.commissionType === "doctor_review" ? "default" : "secondary"}>
                            {commission.commissionType === "doctor_review" ? "Doctor Review" : "Referral"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          ${parseFloat(commission.amount || "0").toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge
                            variant={
                              commission.status === "paid" ? "default" :
                              commission.status === "approved" ? "secondary" :
                              "outline"
                            }
                            className={
                              commission.status === "paid" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                              commission.status === "approved" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                              ""
                            }
                          >
                            {commission.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {commission.createdAt ? new Date(commission.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
