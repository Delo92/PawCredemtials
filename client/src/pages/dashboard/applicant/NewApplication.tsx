import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Package } from "@shared/schema";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

const applicationSchema = z.object({
  packageId: z.string().min(1, "Please select a note type"),
  fullName: z.string().min(1, "Full name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Valid zip code required"),
  phone: z.string().min(10, "Valid phone number required"),
  reason: z.string().min(10, "Please provide more details"),
  additionalInfo: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export default function NewApplication() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedPackage = params.get("package") || "";

  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const { data: packages, isLoading: packagesLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      packageId: preselectedPackage,
      fullName: user ? `${user.firstName} ${user.lastName}` : "",
      dateOfBirth: user?.dateOfBirth || "",
      address: user?.address || "",
      city: user?.city || "",
      state: user?.state || "",
      zipCode: user?.zipCode || "",
      phone: user?.phone || "",
      reason: "",
      additionalInfo: "",
    },
  });

  const createApplication = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      const response = await apiRequest("POST", "/api/applications", {
        packageId: data.packageId,
        formData: data,
      });
      return response.json();
    },
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Order Submitted!",
        description: "Your doctor's note request has been submitted successfully.",
      });
      setLocation(`/dashboard/applicant/applications/${application.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const selectedPackage = packages?.find((p) => p.id === form.watch("packageId"));

  const nextStep = () => {
    if (step === 1 && !form.getValues("packageId")) {
      form.setError("packageId", { message: "Please select a note type" });
      return;
    }
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const onSubmit = (data: ApplicationFormData) => {
    createApplication.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/applicant">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-new-app-title">
              Order Doctor's Note
            </h1>
            <p className="text-muted-foreground">
              Step {step} of {totalSteps}
            </p>
          </div>
        </div>

        <Progress value={(step / totalSteps) * 100} className="h-2" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Step 1: Package Selection */}
            {step === 1 && (
              <Card data-testid="step-package-selection">
                <CardHeader>
                  <CardTitle>Select Note Type</CardTitle>
                  <CardDescription>
                    Choose the type of doctor's note you need
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {packagesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="packageId"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="space-y-3"
                            >
                              {packages?.map((pkg) => (
                                <div key={pkg.id}>
                                  <RadioGroupItem
                                    value={pkg.id}
                                    id={pkg.id}
                                    className="peer sr-only"
                                  />
                                  <Label
                                    htmlFor={pkg.id}
                                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover-elevate transition-all"
                                    data-testid={`package-option-${pkg.id}`}
                                  >
                                    <div>
                                      <p className="font-semibold">{pkg.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {pkg.description}
                                      </p>
                                    </div>
                                    <div className="text-xl font-bold text-primary">
                                      ${Number(pkg.price).toFixed(2)}
                                    </div>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Personal Information */}
            {step === 2 && (
              <Card data-testid="step-personal-info">
                <CardHeader>
                  <CardTitle>Your Information</CardTitle>
                  <CardDescription>
                    Please provide your details for the doctor's note
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Legal Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" data-testid="input-full-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-dob" {...field} />
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
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 555-5555" data-testid="input-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" data-testid="input-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" data-testid="input-city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" data-testid="input-state" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem className="col-span-2 md:col-span-1">
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" data-testid="input-zip" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Application Details */}
            {step === 3 && (
              <Card data-testid="step-application-details">
                <CardHeader>
                  <CardTitle>Note Details</CardTitle>
                  <CardDescription>
                    Provide the details needed for your doctor's note
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose of Note</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What do you need this doctor's note for? (e.g., work absence, school excuse, etc.)"
                            className="min-h-[120px]"
                            data-testid="input-reason"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="additionalInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Information (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any other details you'd like to share..."
                            className="min-h-[80px]"
                            data-testid="input-additional"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedPackage && (
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <p className="text-sm font-medium mb-1">Selected Note Type</p>
                      <p className="text-lg font-bold">{selectedPackage.name}</p>
                      <p className="text-2xl font-bold text-primary mt-2">
                        ${Number(selectedPackage.price).toFixed(2)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard/applicant">Cancel</Link>
                </Button>
              )}

              {step < totalSteps ? (
                <Button type="button" onClick={nextStep} data-testid="button-next-step">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createApplication.isPending}
                  data-testid="button-submit-application"
                >
                  {createApplication.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Submit Order
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
