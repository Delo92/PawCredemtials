import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Bell, Lock, Loader2, Mail } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  contactEmail: z.string().email("Invalid email address").or(z.literal("")).optional(),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function AutoCompleteSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const { data: adminSettings } = useQuery<Record<string, any>>({
    queryKey: ["/api/admin/settings"],
  });
  const autoComplete = adminSettings?.autoCompleteApplications || false;
  const toggleAutoComplete = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", {
        autoCompleteApplications: enabled,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: enabled ? "Auto-Complete Enabled" : "Auto-Complete Disabled",
        description: enabled
          ? "Applications will be automatically completed after payment. The doctor will receive a copy."
          : "Applications will be sent to a doctor for manual review before completion.",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Auto-Complete Applications</CardTitle>
        </div>
        <CardDescription>
          When enabled, applications are automatically approved and completed after payment —
          no doctor review required. The patient receives their completed form immediately,
          and the assigned doctor gets a copy for their records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {autoComplete ? "Auto-Complete is ON" : "Auto-Complete is OFF"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {autoComplete
                ? "Applications skip doctor review and complete instantly after payment."
                : "Applications are sent to a doctor for review before completion."}
            </p>
          </div>
          <Switch
            checked={autoComplete}
            onCheckedChange={toggleAutoComplete}
            disabled={isSaving}
            data-testid="switch-auto-complete"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AdminNotificationSettings() {
  const { toast } = useToast();
  const [notificationEmail, setNotificationEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: adminSettings } = useQuery<Record<string, any>>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (adminSettings?.notificationEmail) {
      setNotificationEmail(adminSettings.notificationEmail);
    }
  }, [adminSettings]);

  const saveNotificationEmail = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", {
        notificationEmail: notificationEmail.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Notification Email Saved",
        description: "The admin notification email has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>Admin Notification Email</CardTitle>
        </div>
        <CardDescription>
          Set an email address that receives a copy of every approval request sent to doctors.
          Both the doctor and this email will get the same review link with an Approve button.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            type="email"
            placeholder="admin@pawcredentials.com"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            data-testid="input-notification-email"
            className="flex-1"
          />
          <Button
            onClick={saveNotificationEmail}
            disabled={isSaving}
            data-testid="button-save-notification-email"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
        {adminSettings?.notificationEmail && (
          <p className="text-sm text-muted-foreground">
            Currently sending notifications to: <strong>{adminSettings.notificationEmail}</strong>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { getLevelName } = useConfig();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      contactEmail: (user as any)?.contactEmail || "",
      phone: user?.phone || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast({
      title: "Settings Saved",
      description: "Your profile has been updated successfully.",
    });
    setIsSaving(false);
  };

  const getInitials = () => {
    return `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
            {getLevelName(user.userLevel)} Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
              </Avatar>
              <div>
                <Button variant="outline" size="sm">
                  Change Photo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG or GIF. Max 2MB.
                </p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input data-testid="input-first-name" {...field} />
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
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input data-testid="input-last-name" {...field} />
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
                      <FormLabel>Sign-In Email</FormLabel>
                      <FormControl>
                        <Input type="email" data-testid="input-email" {...field} disabled className="bg-muted" />
                      </FormControl>
                      <FormDescription>This is your login email and cannot be changed here.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Optional — for receipts & notifications" data-testid="input-contact-email" {...field} />
                      </FormControl>
                      <FormDescription>Receipts, approvals, and notifications go here. If empty, your sign-in email is used.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="(555) 555-5555" data-testid="input-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSaving} data-testid="button-save-profile">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Manage how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch defaultChecked data-testid="switch-email-notifications" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Application Updates</Label>
                <p className="text-sm text-muted-foreground">Get notified when application status changes</p>
              </div>
              <Switch defaultChecked data-testid="switch-app-notifications" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>New Assignments</Label>
                <p className="text-sm text-muted-foreground">Get notified when new items are assigned</p>
              </div>
              <Switch defaultChecked data-testid="switch-assignment-notifications" />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Password</Label>
                <p className="text-sm text-muted-foreground">Last changed: Never</p>
              </div>
              <Button variant="outline" data-testid="button-change-password">
                Change Password
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" data-testid="button-enable-2fa">
                Enable
              </Button>
            </div>
          </CardContent>
        </Card>

        {user.userLevel >= 3 && <AutoCompleteSettings />}
        {user.userLevel >= 3 && <AdminNotificationSettings />}
      </div>
    </DashboardLayout>
  );
}
