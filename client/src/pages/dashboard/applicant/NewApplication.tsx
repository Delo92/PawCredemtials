import { useState, useEffect, useRef, useCallback } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, User, CreditCard, Lock } from "lucide-react";

const applicationSchema = z.object({
  packageId: z.string().min(1, "Please select a registration type"),
  reason: z.string().min(10, "Please provide more details"),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

function isProfileComplete(profile: any): boolean {
  if (!profile) return false;
  const requiredFields = [
    profile.firstName,
    profile.lastName,
    profile.phone,
    profile.dateOfBirth,
    profile.address,
    profile.city,
    profile.state,
    profile.zipCode,
  ];
  const requiredConsents = [
    profile.smsConsent,
    profile.emailConsent,
    profile.chargeUnderstanding,
    profile.patientAuthorization,
  ];
  return requiredFields.every((f) => !!f) && requiredConsents.every((c) => !!c);
}

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        secureData: any,
        callback: (response: any) => void
      ) => void;
    };
  }
}

export default function NewApplication() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedPackage = params.get("package") || "";

  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [acceptJsLoaded, setAcceptJsLoaded] = useState(false);
  const draftLoaded = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/profile"],
  });

  const { data: packages, isLoading: packagesLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const { data: draftData } = useQuery<any>({
    queryKey: ["/api/profile/draft-form"],
  });

  const { data: paymentConfig } = useQuery<any>({
    queryKey: ["/api/payment/config"],
  });

  const profileComplete = isProfileComplete(profile);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      packageId: preselectedPackage,
      reason: "",
    },
  });

  useEffect(() => {
    if (draftData?.draftFormData && !draftLoaded.current && !preselectedPackage) {
      const draft = draftData.draftFormData;
      if (draft.packageId) {
        form.setValue("packageId", draft.packageId);
      }
      if (draft.reason) {
        form.setValue("reason", draft.reason);
      }
      if (draft.customFields) {
        setCustomFields(draft.customFields);
      }
      if (draft.step && draft.step >= 1 && draft.step <= totalSteps) {
        setStep(draft.step);
      }
      draftLoaded.current = true;
    }
  }, [draftData, form, preselectedPackage]);

  useEffect(() => {
    if (paymentConfig?.acceptJsUrl && !acceptJsLoaded) {
      const existing = document.querySelector(`script[src="${paymentConfig.acceptJsUrl}"]`);
      if (existing) {
        setAcceptJsLoaded(true);
        return;
      }
      const script = document.createElement("script");
      script.src = paymentConfig.acceptJsUrl;
      script.async = true;
      script.onload = () => setAcceptJsLoaded(true);
      script.onerror = () => console.error("Failed to load Accept.js");
      document.head.appendChild(script);
    }
  }, [paymentConfig, acceptJsLoaded]);

  const saveDraft = useCallback((packageId: string, reason: string, fields: Record<string, string>, currentStep: number) => {
    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
    }
    draftSaveTimer.current = setTimeout(() => {
      apiRequest("PUT", "/api/profile/draft-form", {
        draftFormData: { packageId, reason, customFields: fields, step: currentStep },
      }).catch(() => {});
    }, 1000);
  }, []);

  const watchedPackageId = form.watch("packageId");
  const watchedReason = form.watch("reason");

  useEffect(() => {
    if (draftLoaded.current || watchedPackageId || watchedReason || Object.keys(customFields).length > 0) {
      saveDraft(watchedPackageId, watchedReason, customFields, step);
    }
  }, [watchedPackageId, watchedReason, customFields, step, saveDraft]);

  const selectedPackage = packages?.find((p) => p.id === watchedPackageId);

  const fullName = [profile?.firstName, profile?.middleName, profile?.lastName]
    .filter(Boolean)
    .join(" ");

  const buildFormData = useCallback(() => {
    return {
      ...form.getValues(),
      ...customFields,
      fullName,
      firstName: profile?.firstName,
      middleName: profile?.middleName,
      lastName: profile?.lastName,
      email: profile?.email,
      phone: profile?.phone,
      dateOfBirth: profile?.dateOfBirth,
      address: profile?.address,
      city: profile?.city,
      state: profile?.state,
      zipCode: profile?.zipCode,
      driverLicenseNumber: profile?.driverLicenseNumber,
      medicalCondition: profile?.medicalCondition,
      ssn: profile?.ssn,
      hasMedicare: profile?.hasMedicare,
      isVeteran: profile?.isVeteran,
    };
  }, [form, customFields, fullName, profile]);

  const processPayment = useCallback(async () => {
    if (!selectedPackage) return;

    if (paymentConfig?.configured && acceptJsLoaded && window.Accept) {
      if (!cardNumber || !expMonth || !expYear || !cvv) {
        toast({ title: "Missing Card Details", description: "Please fill in all credit card fields", variant: "destructive" });
        return;
      }

      setPaymentProcessing(true);

      const secureData = {
        authData: {
          clientKey: paymentConfig.clientKey,
          apiLoginID: paymentConfig.apiLoginId,
        },
        cardData: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          month: expMonth.padStart(2, "0"),
          year: expYear.length === 2 ? `20${expYear}` : expYear,
          cardCode: cvv,
        },
      };

      window.Accept.dispatchData(secureData, async (response: any) => {
        if (response.messages.resultCode === "Error") {
          setPaymentProcessing(false);
          toast({
            title: "Payment Error",
            description: response.messages.message[0]?.text || "Card validation failed",
            variant: "destructive",
          });
          return;
        }

        try {
          const chargeRes = await apiRequest("POST", "/api/payment/charge", {
            opaqueDataDescriptor: response.opaqueData.dataDescriptor,
            opaqueDataValue: response.opaqueData.dataValue,
            packageId: selectedPackage.id,
            formData: buildFormData(),
          });
          const result = await chargeRes.json();

          await apiRequest("PUT", "/api/profile/draft-form", { draftFormData: {} }).catch(() => {});

          queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/profile/draft-form"] });
          toast({
            title: "Order Submitted!",
            description: "Payment processed and application submitted successfully.",
          });
          setLocation(`/dashboard/applicant/applications/${result.application?.id || ""}`);
        } catch (error: any) {
          toast({ title: "Payment Failed", description: error.message || "Payment processing failed", variant: "destructive" });
        } finally {
          setPaymentProcessing(false);
        }
      });
    } else {
      setPaymentProcessing(true);
      try {
        const response = await apiRequest("POST", "/api/applications", {
          packageId: selectedPackage.id,
          formData: buildFormData(),
          autoSendToDoctor: true,
          paymentStatus: "paid",
        });
        const application = await response.json();
        await apiRequest("PUT", "/api/profile/draft-form", { draftFormData: {} }).catch(() => {});

        queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile/draft-form"] });
        toast({
          title: "Order Submitted!",
          description: "Your ESA letter application has been submitted successfully.",
        });
        setLocation(`/dashboard/applicant/applications/${application.id}`);
      } catch (error: any) {
        toast({ title: "Submission Failed", description: error.message || "Something went wrong", variant: "destructive" });
      } finally {
        setPaymentProcessing(false);
      }
    }
  }, [selectedPackage, paymentConfig, acceptJsLoaded, cardNumber, expMonth, expYear, cvv, buildFormData, toast, setLocation]);

  const nextStep = () => {
    if (step === 1 && !form.getValues("packageId")) {
      form.setError("packageId", { message: "Please select a registration type" });
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

  const onSubmit = async (data: ApplicationFormData) => {
    await processPayment();
  };

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profileComplete) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              Please complete your profile before applying for an ESA letter.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile First</CardTitle>
              <CardDescription>
                Your profile information will be used on your medical forms and ESA letter application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/applicant/registration">
                <Button className="w-full" data-testid="button-complete-profile">
                  <User className="mr-2 h-4 w-4" />
                  Complete My Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

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
              Apply for ESA Letter
            </h1>
            <p className="text-muted-foreground">
              Step {step} of {totalSteps}:{" "}
              {step === 1 ? "Select Package" : step === 2 ? "Your Information" : "Review & Pay"}
            </p>
          </div>
        </div>

        <Progress value={(step / totalSteps) * 100} className="h-2" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {step === 1 && (
              <Card data-testid="step-package-selection">
                <CardHeader>
                  <CardTitle>Select Registration Type</CardTitle>
                  <CardDescription>
                    Choose the type of ESA registration you need
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
                                    className="flex items-center justify-between gap-4 p-4 border rounded-md cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover-elevate transition-all"
                                    data-testid={`package-option-${pkg.id}`}
                                  >
                                    <div>
                                      <p className="font-semibold">{pkg.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {pkg.description}
                                      </p>
                                    </div>
                                    <div className="text-xl font-bold text-primary">
                                      ${(Number(pkg.price) / 100).toFixed(2)}
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

            {step === 2 && (
              <div className="space-y-6">
                <Card data-testid="step-review-info">
                  <CardHeader>
                    <CardTitle>Your Information</CardTitle>
                    <CardDescription>
                      This information is pulled from your profile and will be used on your ESA letter application
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        <p className="font-medium" data-testid="text-profile-name">{fullName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="font-medium" data-testid="text-profile-email">{profile?.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone</p>
                        <p className="font-medium" data-testid="text-profile-phone">{profile?.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                        <p className="font-medium" data-testid="text-profile-dob">{profile?.dateOfBirth}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Address</p>
                        <p className="font-medium" data-testid="text-profile-address">
                          {profile?.address}, {profile?.city}, {profile?.state} {profile?.zipCode}
                        </p>
                      </div>
                      {profile?.driverLicenseNumber && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Driver License</p>
                          <p className="font-medium" data-testid="text-profile-dl">{profile.driverLicenseNumber}</p>
                        </div>
                      )}
                      {profile?.medicalCondition && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Medical Condition</p>
                          <p className="font-medium" data-testid="text-profile-condition">{profile.medicalCondition}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <Link href="/dashboard/applicant/registration">
                        <Button variant="outline" size="sm" type="button" data-testid="button-edit-profile">
                          Edit Profile Information
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Reason for ESA Letter</CardTitle>
                    <CardDescription>
                      Please describe why you need an Emotional Support Animal letter
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purpose of Registration</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What do you need this ESA letter for? (e.g., housing ESA, travel, emotional support, etc.)"
                              className="min-h-[120px]"
                              data-testid="input-reason"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {Array.isArray((selectedPackage as any)?.formFields) &&
                  (selectedPackage as any).formFields.length > 0 && (
                    <Card data-testid="card-custom-fields">
                      <CardHeader>
                        <CardTitle>Additional Information</CardTitle>
                        <CardDescription>
                          Please fill out the following fields required for this registration type
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(selectedPackage as any).formFields.map((field: any, idx: number) => (
                          <div key={field.name || idx}>
                            <Label>
                              {field.label || field.name}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {field.type === "textarea" ? (
                              <Textarea
                                value={customFields[field.name] || ""}
                                onChange={(e) =>
                                  setCustomFields({ ...customFields, [field.name]: e.target.value })
                                }
                                data-testid={`input-custom-${field.name}`}
                              />
                            ) : field.type === "radio" && Array.isArray(field.radioOptions) ? (
                              <RadioGroup
                                value={customFields[field.name] || ""}
                                onValueChange={(value) =>
                                  setCustomFields({ ...customFields, [field.name]: value })
                                }
                                className="space-y-2 mt-2"
                              >
                                {field.radioOptions.map((opt: any) => (
                                  <div key={opt.radioId} className="flex items-center gap-3">
                                    <RadioGroupItem
                                      value={opt.radioId}
                                      id={`${field.name}-${opt.radioId}`}
                                      data-testid={`radio-custom-${field.name}-${opt.radioId}`}
                                    />
                                    <Label
                                      htmlFor={`${field.name}-${opt.radioId}`}
                                      className="cursor-pointer font-normal"
                                    >
                                      {opt.statement}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            ) : field.type === "select" ? (
                              <Select
                                value={customFields[field.name] || ""}
                                onValueChange={(value) =>
                                  setCustomFields({ ...customFields, [field.name]: value })
                                }
                              >
                                <SelectTrigger data-testid={`select-custom-${field.name}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(field.options || []).map((opt: string) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={field.type === "phone" ? "tel" : field.type || "text"}
                                value={customFields[field.name] || ""}
                                onChange={(e) =>
                                  setCustomFields({ ...customFields, [field.name]: e.target.value })
                                }
                                data-testid={`input-custom-${field.name}`}
                              />
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <Card data-testid="step-final-review">
                  <CardHeader>
                    <CardTitle>Review & Pay</CardTitle>
                    <CardDescription>
                      Please review your order details and complete payment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedPackage && (
                      <div className="p-4 rounded-md border bg-muted/30">
                        <p className="text-sm font-medium mb-1">Selected Registration Type</p>
                        <p className="text-lg font-bold" data-testid="text-selected-package">
                          {selectedPackage.name}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">{selectedPackage.description}</p>
                        <p className="text-2xl font-bold text-primary" data-testid="text-selected-price">
                          ${(Number(selectedPackage.price) / 100).toFixed(2)}
                        </p>
                      </div>
                    )}

                    <div className="p-4 rounded-md border bg-muted/30">
                      <p className="text-sm font-medium mb-1">Applicant</p>
                      <p className="font-bold">{fullName}</p>
                      <p className="text-sm text-muted-foreground">{profile?.email}</p>
                      <p className="text-sm text-muted-foreground">{profile?.phone}</p>
                    </div>

                    {form.getValues("reason") && (
                      <div className="p-4 rounded-md border bg-muted/30">
                        <p className="text-sm font-medium mb-1">Reason</p>
                        <p className="text-sm">{form.getValues("reason")}</p>
                      </div>
                    )}

                    {Object.keys(customFields).length > 0 && (
                      <div className="p-4 rounded-md border bg-muted/30">
                        <p className="text-sm font-medium mb-2">Additional Details</p>
                        {Object.entries(customFields).map(([key, value]) => (
                          value && (
                            <div key={key} className="mb-1">
                              <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}: </span>
                              <span className="text-sm">{value}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {paymentConfig?.configured && (
                  <Card data-testid="card-payment">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payment Information
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Your payment details are securely processed
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="4111 1111 1111 1111"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          maxLength={19}
                          data-testid="input-card-number"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="expMonth">Month</Label>
                          <Select value={expMonth} onValueChange={setExpMonth}>
                            <SelectTrigger data-testid="select-exp-month">
                              <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => {
                                const m = String(i + 1).padStart(2, "0");
                                return <SelectItem key={m} value={m}>{m}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="expYear">Year</Label>
                          <Select value={expYear} onValueChange={setExpYear}>
                            <SelectTrigger data-testid="select-exp-year">
                              <SelectValue placeholder="YYYY" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 10 }, (_, i) => {
                                const y = String(new Date().getFullYear() + i);
                                return <SelectItem key={y} value={y}>{y}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="cvv">CVV</Label>
                          <Input
                            id="cvv"
                            placeholder="123"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value)}
                            maxLength={4}
                            data-testid="input-cvv"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <div className="flex justify-between gap-4 mt-6">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={prevStep} data-testid="button-prev-step">
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
                  disabled={paymentProcessing}
                  data-testid="button-submit-application"
                >
                  {paymentProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {paymentConfig?.configured ? (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Pay ${selectedPackage ? (Number(selectedPackage.price) / 100).toFixed(2) : "0.00"} & Submit
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Submit Order
                        </>
                      )}
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
