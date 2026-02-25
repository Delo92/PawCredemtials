import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { UserProfileModal } from "@/components/shared/UserProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Search, UserCog, UserPlus, Loader2, Eye, EyeOff } from "lucide-react";

const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  userLevel: z.string().min(1, "User level is required"),
  doctorFullName: z.string().optional(),
  licenseNumber: z.string().optional(),
  npiNumber: z.string().optional(),
  deaNumber: z.string().optional(),
  doctorPhone: z.string().optional(),
  fax: z.string().optional(),
  doctorAddress: z.string().optional(),
  specialty: z.string().optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const { getLevelName } = useConfig();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: generatePassword(),
      userLevel: "1",
      doctorFullName: "",
      licenseNumber: "",
      npiNumber: "",
      deaNumber: "",
      doctorPhone: "",
      fax: "",
      doctorAddress: "",
      specialty: "",
    },
  });

  const watchedLevel = form.watch("userLevel");
  const isDoctor = watchedLevel === "2";

  const createUser = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const response = await apiRequest("POST", "/api/admin/users", {
        ...data,
        userLevel: parseInt(data.userLevel),
      });
      return response.json();
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: generatePassword(),
        userLevel: "1",
        doctorFullName: "",
        licenseNumber: "",
        npiNumber: "",
        deaNumber: "",
        doctorPhone: "",
        fax: "",
        doctorAddress: "",
        specialty: "",
      });
      toast({
        title: "User Created",
        description: `Account for ${newUser.firstName} ${newUser.lastName} has been created. A welcome email with login credentials has been sent.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create User",
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
  };

  const openCreateDialog = () => {
    form.reset({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: generatePassword(),
      userLevel: "1",
      doctorFullName: "",
      licenseNumber: "",
      npiNumber: "",
      deaNumber: "",
      doctorPhone: "",
      fax: "",
      doctorAddress: "",
      specialty: "",
    });
    setShowPassword(false);
    setIsCreateDialogOpen(true);
  };

  const onSubmit = (data: CreateUserFormData) => {
    createUser.mutate(data);
  };

  const canEditLevel = currentUser?.userLevel === 4 || currentUser?.userLevel === 5;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-users-title">
              User Management
            </h1>
            <p className="text-muted-foreground">
              View and manage all users on the platform
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-user">
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
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

        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          canEditLevel={canEditLevel}
        />

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Set up a new user account. A welcome email with login credentials will be sent automatically.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John" data-testid="input-create-first-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" data-testid="input-create-last-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@example.com" data-testid="input-create-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="(555) 555-5555" data-testid="input-create-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary Password *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            data-testid="input-create-password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-create-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Auto-generated. This will be included in the welcome email.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="userLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Level *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-user-level">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">{getLevelName(1)} (Level 1)</SelectItem>
                          <SelectItem value="2">{getLevelName(2)} (Level 2)</SelectItem>
                          <SelectItem value="3">{getLevelName(3)} (Level 3)</SelectItem>
                          {currentUser?.userLevel === 4 && (
                            <SelectItem value="4">{getLevelName(4)} (Level 4)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isDoctor && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-1 mb-4">
                      <h3 className="text-sm font-semibold">Doctor Professional Profile</h3>
                      <p className="text-xs text-muted-foreground">
                        These credentials appear on ESA letters and certificates issued by this doctor.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="doctorFullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Professional Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Dr. John Doe, MD" data-testid="input-doctor-full-name" {...field} />
                          </FormControl>
                          <FormDescription>As it should appear on documents (e.g., Dr. Jane Smith, LMHC)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="MED-123456" data-testid="input-doctor-license" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="npiNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NPI Number</FormLabel>
                            <FormControl>
                              <Input placeholder="1234567890" data-testid="input-doctor-npi" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="deaNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DEA Number</FormLabel>
                            <FormControl>
                              <Input placeholder="AB1234567" data-testid="input-doctor-dea" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="specialty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specialty</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Psychiatry, Psychology" data-testid="input-doctor-specialty" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="doctorPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Office Phone</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="(555) 555-5555" data-testid="input-doctor-phone" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fax</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="(555) 555-5556" data-testid="input-doctor-fax" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="doctorAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Office Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Medical Blvd, Suite 100, City, ST 12345" data-testid="input-doctor-address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createUser.isPending} data-testid="button-submit-create-user">
                    {createUser.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create User & Send Welcome Email
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
