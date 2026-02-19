import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, Shield, User, FileText, Clock, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function DoctorReviewPortal() {
  const [, params] = useRoute("/review/:token");
  const token = params?.token;
  const [decision, setDecision] = useState<"approved" | "denied" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: reviewData, isLoading, error } = useQuery<{
    patient: any;
    application: any;
    package: any;
    doctor: any;
    doctorProfile: any;
    expiresAt: string;
  }>({
    queryKey: [`/api/review/${token}`],
    enabled: !!token,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { decision: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/review/${token}/decision`, data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
          <p className="text-muted-foreground">Loading patient review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2" data-testid="text-error-title">Review Unavailable</h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {decision === "approved" ? (
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            )}
            <h2 className="text-xl font-semibold mb-2" data-testid="text-decision-result">
              Application {decision === "approved" ? "Approved" : "Denied"}
            </h2>
            <p className="text-muted-foreground">
              {decision === "approved"
                ? "The patient's application has been approved. Their documents will be prepared and sent to them."
                : "The patient's application has been denied. They will be notified of the decision."}
            </p>
            <p className="text-sm text-muted-foreground mt-4">You may close this window.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { patient, application, package: pkg, doctor, doctorProfile } = reviewData || {};

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary/10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-portal-title">Secure Patient Review Portal</h1>
            <p className="text-sm text-muted-foreground">Confidential medical review</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {doctor && (
          <div className="text-sm text-muted-foreground">
            Reviewing as: <span className="font-medium text-foreground">Dr. {doctor.lastName}</span>
            {doctorProfile?.specialty && <span> ({doctorProfile.specialty})</span>}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {patient ? (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Name</span>
                    <p className="font-medium" data-testid="text-patient-name">{patient.firstName} {patient.lastName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <p data-testid="text-patient-email">{patient.email}</p>
                  </div>
                  {patient.phone && (
                    <div>
                      <span className="text-sm text-muted-foreground">Phone</span>
                      <p data-testid="text-patient-phone">{patient.phone}</p>
                    </div>
                  )}
                  {patient.dateOfBirth && (
                    <div>
                      <span className="text-sm text-muted-foreground">Date of Birth</span>
                      <p data-testid="text-patient-dob">{patient.dateOfBirth}</p>
                    </div>
                  )}
                  {(patient.address || patient.city || patient.state) && (
                    <div>
                      <span className="text-sm text-muted-foreground">Location</span>
                      <p data-testid="text-patient-location">
                        {[patient.address, patient.city, patient.state, patient.zipCode].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Patient information unavailable</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pkg && (
                <div>
                  <span className="text-sm text-muted-foreground">Service Package</span>
                  <p className="font-medium" data-testid="text-package-name">{pkg.name}</p>
                  {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
                </div>
              )}
              {application && (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Application ID</span>
                    <p className="font-mono text-sm" data-testid="text-application-id">{application.id}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Submitted</span>
                    <p data-testid="text-application-date">{new Date(application.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="secondary" data-testid="badge-application-status">{application.status}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {application?.formData && Object.keys(application.formData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Application Form Data</CardTitle>
              <CardDescription>Information provided by the patient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(application.formData).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</span>
                    <p className="font-medium" data-testid={`text-formdata-${key}`}>{String(value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your Decision</CardTitle>
            <CardDescription>Review the patient information above and make your determination</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or comments about your decision..."
                className="resize-none"
                rows={3}
                data-testid="input-doctor-notes"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setDecision("approved");
                  submitMutation.mutate({ decision: "approved", notes });
                }}
                disabled={submitMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-approve"
              >
                {submitMutation.isPending && decision === "approved" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve Application
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setDecision("denied");
                  submitMutation.mutate({ decision: "denied", notes });
                }}
                disabled={submitMutation.isPending}
                data-testid="button-deny"
              >
                {submitMutation.isPending && decision === "denied" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Deny Application
              </Button>
            </div>

            {submitMutation.isError && (
              <p className="text-sm text-destructive" data-testid="text-submit-error">
                {(submitMutation.error as Error).message}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <Clock className="h-3 w-3" />
              <span data-testid="text-expiry">
                This review link expires on {reviewData?.expiresAt ? new Date(reviewData.expiresAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
