import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Application } from "@shared/schema";
import { 
  Search, 
  UserCog, 
  Loader2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  User as UserIcon,
  Package,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

type ApplicationWithPackage = Application & {
  package?: { name: string; price: number };
};

export default function UsersManagement() {
  const { getLevelName } = useConfig();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [newLevel, setNewLevel] = useState<string>("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: userApplications, isLoading: appsLoading } = useQuery<ApplicationWithPackage[]>({
    queryKey: ["/api/admin/users", selectedUser?.id, "applications"],
    enabled: !!selectedUser,
    queryFn: async () => {
      if (!selectedUser) return [];
      const response = await fetch(`/api/admin/users/${selectedUser.id}/applications`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<User> }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditing(false);
      toast({
        title: "User Updated",
        description: "User profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === "all" || user.userLevel === parseInt(levelFilter);
    return matchesSearch && matchesLevel;
  }) || [];

  const handleOpenProfile = (user: User) => {
    setSelectedUser(user);
    setEditedUser({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || "",
      dateOfBirth: user.dateOfBirth || "",
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      zipCode: user.zipCode || "",
    });
    setNewLevel(user.userLevel.toString());
    setNewStatus(user.isActive ? "active" : "inactive");
    setIsEditing(false);
  };

  const handleSaveProfile = () => {
    if (selectedUser) {
      const updates: Partial<User> = {
        ...editedUser,
        userLevel: parseInt(newLevel),
        isActive: newStatus === "active",
      };
      updateUser.mutate({ id: selectedUser.id, updates });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "rejected":
      case "level2_denied":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Denied</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "level2_review":
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><AlertCircle className="h-3 w-3 mr-1" />In Review</Badge>;
      case "level3_work":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><FileText className="h-3 w-3 mr-1" />Processing</Badge>;
      case "level4_verification":
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"><UserCog className="h-3 w-3 mr-1" />Verification</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLevel1 = selectedUser?.userLevel === 1;
  const canEdit = isLevel1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-users-title">
            User Management
          </h1>
          <p className="text-muted-foreground">
            View and manage all users on the platform
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  {users?.length || 0} total users
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                    data-testid="input-search-users"
                  />
                </div>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-full sm:w-40" data-testid="select-level-filter">
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="1">{getLevelName(1)}</SelectItem>
                    <SelectItem value="2">{getLevelName(2)}</SelectItem>
                    <SelectItem value="3">{getLevelName(3)}</SelectItem>
                    <SelectItem value="4">{getLevelName(4)}</SelectItem>
                    <SelectItem value="5">{getLevelName(5)}</SelectItem>
                  </SelectContent>
                </Select>
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
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                          <TableCell className="font-medium">
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {getLevelName(user.userLevel)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "destructive"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenProfile(user)}
                              data-testid={`button-view-profile-${user.id}`}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Profile Modal */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                User Profile
              </DialogTitle>
              <DialogDescription>
                {selectedUser?.firstName} {selectedUser?.lastName} - {getLevelName(selectedUser?.userLevel || 1)}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="profile" className="flex-1" data-testid="tab-profile">Profile</TabsTrigger>
                <TabsTrigger value="purchases" className="flex-1" data-testid="tab-purchases">Purchases</TabsTrigger>
                <TabsTrigger value="settings" className="flex-1" data-testid="tab-settings">Settings</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] mt-4">
                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4 pr-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Personal Information</h3>
                    {canEdit && (
                      <Button
                        variant={isEditing ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                        data-testid="button-toggle-edit"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.firstName || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, firstName: e.target.value })}
                          data-testid="input-first-name"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.firstName || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.lastName || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, lastName: e.target.value })}
                          data-testid="input-last-name"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.lastName || "-"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={editedUser.email || ""}
                        onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                        data-testid="input-email"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                        {selectedUser?.email || "-"}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Phone
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.phone || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                          data-testid="input-phone"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.phone || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Date of Birth
                      </Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedUser.dateOfBirth || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, dateOfBirth: e.target.value })}
                          data-testid="input-dob"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.dateOfBirth || "-"}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />
                  <h3 className="text-lg font-semibold flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Address
                  </h3>

                  <div className="space-y-2">
                    <Label>Street Address</Label>
                    {isEditing ? (
                      <Input
                        value={editedUser.address || ""}
                        onChange={(e) => setEditedUser({ ...editedUser, address: e.target.value })}
                        data-testid="input-address"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                        {selectedUser?.address || "-"}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.city || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, city: e.target.value })}
                          data-testid="input-city"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.city || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.state || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, state: e.target.value })}
                          data-testid="input-state"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.state || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Zip Code</Label>
                      {isEditing ? (
                        <Input
                          value={editedUser.zipCode || ""}
                          onChange={(e) => setEditedUser({ ...editedUser, zipCode: e.target.value })}
                          data-testid="input-zip"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                          {selectedUser?.zipCode || "-"}
                        </p>
                      )}
                    </div>
                  </div>

                  {!canEdit && (
                    <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                      Profile data is read-only for {getLevelName(selectedUser?.userLevel || 1)} users.
                    </div>
                  )}
                </TabsContent>

                {/* Purchases Tab */}
                <TabsContent value="purchases" className="space-y-4 pr-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" /> Purchases & Applications
                  </h3>

                  {appsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : userApplications && userApplications.length > 0 ? (
                    <div className="space-y-3">
                      {userApplications.map((app) => (
                        <div
                          key={app.id}
                          className="p-4 border rounded-lg space-y-2"
                          data-testid={`purchase-${app.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {app.package?.name || `Package #${app.packageId?.slice(0, 8)}`}
                            </div>
                            {getStatusBadge(app.status)}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                            {app.package?.price && (
                              <span className="font-medium text-foreground">
                                ${app.package.price}
                              </span>
                            )}
                          </div>
                          {app.level2Notes && (
                            <div className="text-xs bg-muted p-2 rounded">
                              <span className="font-medium">Review Notes: </span>
                              {app.level2Notes}
                            </div>
                          )}
                          {app.level3Notes && (
                            <div className="text-xs bg-muted p-2 rounded">
                              <span className="font-medium">Agent Notes: </span>
                              {app.level3Notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No purchases or applications found</p>
                    </div>
                  )}
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-4 pr-4">
                  <h3 className="text-lg font-semibold">Account Settings</h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>User Level</Label>
                      <Select value={newLevel} onValueChange={setNewLevel}>
                        <SelectTrigger data-testid="select-user-level">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{getLevelName(1)}</SelectItem>
                          <SelectItem value="2">{getLevelName(2)}</SelectItem>
                          <SelectItem value="3">{getLevelName(3)}</SelectItem>
                          <SelectItem value="4">{getLevelName(4)}</SelectItem>
                          <SelectItem value="5">{getLevelName(5)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Account Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger data-testid="select-account-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Member Since</Label>
                      <p className="text-sm p-2 bg-muted rounded-md">
                        {selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : "-"}
                      </p>
                    </div>

                    {selectedUser?.referralCode && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Referral Code</Label>
                        <p className="text-sm p-2 bg-muted rounded-md font-mono">
                          {selectedUser.referralCode}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={updateUser.isPending}
                data-testid="button-save-profile"
              >
                {updateUser.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
