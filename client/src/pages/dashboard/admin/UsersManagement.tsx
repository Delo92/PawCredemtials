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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { UserProfileModal } from "@/components/shared/UserProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Search, UserCog, UserPlus, Loader2, Eye, EyeOff, Stethoscope, FileText, Info, DollarSign } from "lucide-react";

const PLACEHOLDERS_REFERENCE = [
  { tag: "{{doctorName}}", desc: "Doctor's full name" },
  { tag: "{{doctorLicense}}", desc: "License number" },
  { tag: "{{doctorNPI}}", desc: "NPI number" },
  { tag: "{{doctorDEA}}", desc: "DEA number" },
  { tag: "{{doctorPhone}}", desc: "Doctor phone" },
  { tag: "{{doctorFax}}", desc: "Doctor fax" },
  { tag: "{{doctorAddress}}", desc: "Doctor address" },
  { tag: "{{doctorSpecialty}}", desc: "Specialty" },
  { tag: "{{doctorState}}", desc: "Doctor state" },
  { tag: "{{patientName}}", desc: "Patient full name" },
  { tag: "{{patientFirstName}}", desc: "First name" },
  { tag: "{{patientLastName}}", desc: "Last name" },
  { tag: "{{patientDOB}}", desc: "Date of birth" },
  { tag: "{{patientPhone}}", desc: "Patient phone" },
  { tag: "{{patientEmail}}", desc: "Patient email" },
  { tag: "{{patientAddress}}", desc: "Patient street" },
  { tag: "{{patientCity}}", desc: "Patient city" },
  { tag: "{{patientState}}", desc: "Patient state" },
  { tag: "{{patientZipCode}}", desc: "Patient zip" },
  { tag: "{{patientSSN}}", desc: "Patient SSN" },
  { tag: "{{patientDriverLicense}}", desc: "Driver license #" },
  { tag: "{{patientMedicalCondition}}", desc: "Medical condition" },
  { tag: "{{reason}}", desc: "Reason for note" },
  { tag: "{{packageName}}", desc: "Note type name" },
  { tag: "{{date}}", desc: "Today (long format)" },
  { tag: "{{dateShort}}", desc: "Today (short)" },
];

const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  userLevel: z.string().min(1, "User level is required"),
  doctorFullName: z.string().optional(),
  doctorLicense: z.string().optional(),
  doctorNPI: z.string().optional(),
  doctorDEA: z.string().optional(),
  doctorPhone: z.string().optional(),
  doctorFax: z.string().optional(),
  doctorAddress: z.string().optional(),
  doctorSpecialty: z.string().optional(),
  doctorState: z.string().optional(),
  formTemplate: z.string().optional(),
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
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [manualPaymentUser, setManualPaymentUser] = useState<User | null>(null);
  const [manualPaymentPackageId, setManualPaymentPackageId] = useState("");
  const [manualPaymentReason, setManualPaymentReason] = useState("");
  const [manualPaymentLoading, setManualPaymentLoading] = useState(false);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const defaultValues: CreateUserFormData = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: generatePassword(),
    userLevel: "1",
    doctorFullName: "",
    doctorLicense: "",
    doctorNPI: "",
    doctorDEA: "",
    doctorPhone: "",
    doctorFax: "",
    doctorAddress: "",
    doctorSpecialty: "",
    doctorState: "",
    formTemplate: "",
  };

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues,
  });

  const watchedLevel = form.watch("userLevel");
  const isDoctor = watchedLevel === "2";

  const createUser = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const payload: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        userLevel: parseInt(data.userLevel),
      };

      if (parseInt(data.userLevel) === 2) {
        payload.doctorProfile = {
          fullName: data.doctorFullName || `${data.firstName} ${data.lastName}`,
          licenseNumber: data.doctorLicense || "",
          npiNumber: data.doctorNPI || "",
          deaNumber: data.doctorDEA || "",
          phone: data.doctorPhone || data.phone || "",
          fax: data.doctorFax || "",
          address: data.doctorAddress || "",
          specialty: data.doctorSpecialty || "",
          state: data.doctorState || "",
          formTemplate: data.formTemplate || "",
        };
      }

      const response = await apiRequest("POST", "/api/admin/users", payload);
      return response.json();
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      form.reset({ ...defaultValues, password: generatePassword() });
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

  const { data: packages } = useQuery<any[]>({
    queryKey: ["/api/packages"],
  });
  const activePackages = packages?.filter((p: any) => p.isActive) || [];

  const handleOpenProfile = (user: User) => {
    setSelectedUser(user);
  };

  const handleManualPayment = async () => {
    if (!manualPaymentUser || !manualPaymentPackageId) return;
    setManualPaymentLoading(true);
    try {
      const res = await apiRequest("POST", `/api/admin/users/${manualPaymentUser.id}/manual-payment`, {
        packageId: manualPaymentPackageId,
        reason: manualPaymentReason || "Manual payment by admin",
      });
      const data = await res.json();
      toast({
        title: "Manual Payment Processed",
        description: `Application created for ${manualPaymentUser.firstName} ${manualPaymentUser.lastName}. ${data.message || ""}`,
      });
      setManualPaymentUser(null);
      setManualPaymentPackageId("");
      setManualPaymentReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setManualPaymentLoading(false);
    }
  };

  const openCreateDialog = () => {
    form.reset({ ...defaultValues, password: generatePassword() });
    setShowPassword(false);
    setShowPlaceholders(false);
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
                            <span className="flex items-center gap-1.5">
                              {user.userLevel === 2 && (
                                <Stethoscope className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              )}
                              {user.firstName} {user.lastName}
                            </span>
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
                            <div className="flex items-center justify-end gap-1">
                              {user.userLevel === 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setManualPaymentUser(user);
                                    setManualPaymentPackageId("");
                                    setManualPaymentReason("");
                                  }}
                                  data-testid={`button-manual-payment-${user.id}`}
                                  title="Manual Payment"
                                >
                                  <DollarSign className="h-4 w-4 text-green-500" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenProfile(user)}
                                data-testid={`button-view-profile-${user.id}`}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                            </div>
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

        <Dialog open={!!manualPaymentUser} onOpenChange={(open) => { if (!open) setManualPaymentUser(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Manual Payment
              </DialogTitle>
              <DialogDescription>
                Process a manual payment for {manualPaymentUser?.firstName} {manualPaymentUser?.lastName}. This will create an application and run it through the full workflow as if the patient paid on their own.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Select Package</Label>
                <Select value={manualPaymentPackageId} onValueChange={setManualPaymentPackageId}>
                  <SelectTrigger data-testid="select-manual-payment-package">
                    <SelectValue placeholder="Choose a registration type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activePackages.map((pkg: any) => (
                      <SelectItem key={pkg.id} value={pkg.id} data-testid={`select-package-${pkg.id}`}>
                        {pkg.name} — ${(Number(pkg.price) / 100).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason for Manual Payment</Label>
                <Textarea
                  placeholder="e.g. Phone payment, cash payment, courtesy waiver..."
                  value={manualPaymentReason}
                  onChange={(e) => setManualPaymentReason(e.target.value)}
                  rows={3}
                  data-testid="input-manual-payment-reason"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setManualPaymentUser(null)}
                disabled={manualPaymentLoading}
                data-testid="button-cancel-manual-payment"
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualPayment}
                disabled={!manualPaymentPackageId || manualPaymentLoading}
                data-testid="button-confirm-manual-payment"
              >
                {manualPaymentLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Process Payment"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Set up a new user account. A welcome email with login credentials will be sent automatically.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Tabs defaultValue="account">
                  <TabsList className={isDoctor ? "w-full" : ""}>
                    <TabsTrigger value="account" className={isDoctor ? "flex-1" : ""} data-testid="tab-create-account">
                      Account
                    </TabsTrigger>
                    {isDoctor && (
                      <>
                        <TabsTrigger value="credentials" className="flex-1" data-testid="tab-create-credentials">
                          <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
                          Credentials
                        </TabsTrigger>
                        <TabsTrigger value="formtemplate" className="flex-1" data-testid="tab-create-form-template">
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          Form Template
                        </TabsTrigger>
                      </>
                    )}
                  </TabsList>

                  <TabsContent value="account" className="space-y-4 mt-4">
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
                      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Doctor selected — use the <strong>Credentials</strong> and <strong>Form Template</strong> tabs to set up their profile.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {isDoctor && (
                    <TabsContent value="credentials" className="space-y-4 mt-4">
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
                            <FormLabel>Full Name (as it appears on documents)</FormLabel>
                            <FormControl>
                              <Input placeholder="Dr. John Doe, MD" data-testid="input-doctor-full-name" {...field} />
                            </FormControl>
                            <FormDescription>e.g., Dr. Jane Smith, LMHC</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="doctorLicense"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>License Number</FormLabel>
                              <FormControl>
                                <Input placeholder="MED-123456" data-testid="input-doctor-license" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="doctorNPI"
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
                          name="doctorDEA"
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
                          name="doctorSpecialty"
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
                          name="doctorFax"
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

                      <FormField
                        control={form.control}
                        name="doctorState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="FL" data-testid="input-doctor-state" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  )}

                  {isDoctor && (
                    <TabsContent value="formtemplate" className="space-y-4 mt-4">
                      <div className="space-y-1 mb-2">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          Document Form Template
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          This HTML template is used to auto-generate documents when this doctor approves an application. Use placeholders to insert dynamic data.
                        </p>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                        <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Use <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">{"{{placeholder}}"}</code> syntax to insert dynamic values. These will be replaced with actual data when the document is generated.
                        </p>
                      </div>

                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPlaceholders(!showPlaceholders)}
                          data-testid="button-toggle-placeholders"
                        >
                          {showPlaceholders ? "Hide" : "Show"} Available Placeholders
                        </Button>

                        {showPlaceholders && (
                          <div className="mt-3 p-3 border rounded-md bg-muted/50">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                              {PLACEHOLDERS_REFERENCE.map((p) => (
                                <div key={p.tag} className="flex items-center gap-2 text-xs py-0.5">
                                  <code className="bg-background px-1.5 py-0.5 rounded border font-mono text-xs whitespace-nowrap">{p.tag}</code>
                                  <span className="text-muted-foreground truncate">{p.desc}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name="formTemplate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HTML Template</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="<html>&#10;<body>&#10;  <h1>ESA Letter</h1>&#10;  <p>Doctor: {{doctorName}}</p>&#10;  <p>Patient: {{patientName}}</p>&#10;  ..."
                                className="font-mono text-sm min-h-[200px]"
                                data-testid="textarea-form-template"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Paste your HTML document template here. It will be used to generate certificates upon doctor approval.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  )}
                </Tabs>

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
