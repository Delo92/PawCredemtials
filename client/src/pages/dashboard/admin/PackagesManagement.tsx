import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Package } from "@shared/schema";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  features: z.string().optional(),
  processingTime: z.string().optional(),
  requiresLevel2Interaction: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type PackageFormData = z.infer<typeof packageSchema>;

export default function PackagesManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      features: "",
      processingTime: "",
      requiresLevel2Interaction: false,
      isActive: true,
    },
  });

  const createPackage = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const response = await apiRequest("POST", "/api/admin/packages", {
        ...data,
        price: parseFloat(data.price),
        features: data.features ? data.features.split("\n").filter(Boolean) : [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Note Type Created",
        description: "The note type has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PackageFormData }) => {
      const response = await apiRequest("PUT", `/api/admin/packages/${id}`, {
        ...data,
        price: parseFloat(data.price),
        features: data.features ? data.features.split("\n").filter(Boolean) : [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      setIsDialogOpen(false);
      setEditingPackage(null);
      form.reset();
      toast({
        title: "Note Type Updated",
        description: "The note type has been updated successfully.",
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

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/packages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      setDeleteConfirmId(null);
      toast({
        title: "Note Type Deleted",
        description: "The note type has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const openCreateDialog = () => {
    setEditingPackage(null);
    form.reset({
      name: "",
      description: "",
      price: "",
      features: "",
      processingTime: "",
      requiresLevel2Interaction: false,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (pkg: Package) => {
    setEditingPackage(pkg);
    form.reset({
      name: pkg.name,
      description: pkg.description || "",
      price: pkg.price.toString(),
      features: Array.isArray(pkg.features) ? pkg.features.join("\n") : "",
      processingTime: pkg.processingTime || "",
      requiresLevel2Interaction: pkg.requiresLevel2Interaction || false,
      isActive: pkg.isActive,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: PackageFormData) => {
    if (editingPackage) {
      updatePackage.mutate({ id: editingPackage.id, data });
    } else {
      createPackage.mutate(data);
    }
  };

  const isPending = createPackage.isPending || updatePackage.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-packages-title">
              Note Types Management
            </h1>
            <p className="text-muted-foreground">
              Create and manage doctor's note types
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-package">
            <Plus className="mr-2 h-4 w-4" />
            Add Note Type
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Note Types</CardTitle>
            <CardDescription>
              {packages?.length || 0} total note types
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages && packages.length > 0 ? (
                      packages.map((pkg) => (
                        <TableRow key={pkg.id} data-testid={`package-row-${pkg.id}`}>
                          <TableCell className="font-medium">{pkg.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {pkg.description || "-"}
                          </TableCell>
                          <TableCell>${Number(pkg.price).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={pkg.isActive ? "default" : "secondary"}>
                              {pkg.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(pkg)}
                                data-testid={`button-edit-package-${pkg.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {user?.userLevel === 5 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteConfirmId(pkg.id)}
                                  data-testid={`button-delete-package-${pkg.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No note types found. Create your first note type to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPackage ? "Edit Note Type" : "Create Note Type"}
              </DialogTitle>
              <DialogDescription>
                {editingPackage
                  ? "Update the note type details below."
                  : "Fill in the details to create a new doctor's note type."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note Type Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Work Excuse Note" data-testid="input-package-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the note type..."
                          data-testid="input-package-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="99.00"
                          data-testid="input-package-price"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="processingTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processing Time</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 3-5 business days" data-testid="input-package-time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="features"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Features (one per line)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Standard review time&#10;Email support&#10;Digital delivery"
                          className="min-h-[100px]"
                          data-testid="input-package-features"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Enter each feature on a new line</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiresLevel2Interaction"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Requires Level 2 Interaction</FormLabel>
                        <FormDescription>
                          Applicants must join call queue with a reviewer
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-package-level2"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Show this package to applicants
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-package-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending} data-testid="button-save-package">
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingPackage ? (
                      "Save Changes"
                    ) : (
                      "Create Package"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Package</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this package? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deletePackage.mutate(deleteConfirmId)}
                disabled={deletePackage.isPending}
                data-testid="button-confirm-delete"
              >
                {deletePackage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
