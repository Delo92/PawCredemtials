import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { GizmoForm, type GizmoFormData } from "@/components/shared/GizmoForm";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function FormViewerPage() {
  const [, params] = useRoute("/dashboard/applicant/forms/:applicationId");
  const [, setLocation] = useLocation();
  const applicationId = params?.applicationId;

  const { data: formData, isLoading, error } = useQuery<GizmoFormData>({
    queryKey: ["/api/forms/data", applicationId],
    enabled: !!applicationId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/forms/data/${applicationId}`);
      return res.json();
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard/applicant")}
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[600px] w-full" />
          </div>
        )}

        {error && (
          <div className="p-6 border rounded-lg text-center space-y-3">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-destructive font-medium">Failed to load form data</p>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message || "Please try again later."}
            </p>
          </div>
        )}

        {formData && formData.gizmoFormUrl && (
          <GizmoForm
            data={formData}
            onClose={() => setLocation("/dashboard/applicant")}
          />
        )}

        {formData && !formData.gizmoFormUrl && (
          <div className="p-6 border rounded-lg text-center space-y-3">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="font-medium">No PDF Form Available</p>
            <p className="text-sm text-muted-foreground">
              A PDF template has not been assigned for this application yet. Please check back later.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
