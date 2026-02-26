import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { GizmoForm, type GizmoFormData } from "@/components/shared/GizmoForm";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

export default function FormViewerPage() {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<GizmoFormData>({
    queryKey: ["/api/forms/data", applicationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/forms/data/${applicationId}`);
      return res.json();
    },
    enabled: !!applicationId && !!user,
  });

  return (
    <DashboardLayout>
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

      {data && data.gizmoFormUrl && (
        <GizmoForm data={data} onClose={() => window.history.back()} />
      )}

      {data && !data.gizmoFormUrl && (
        <div className="p-6 border rounded-lg text-center space-y-3">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="font-medium">No PDF Form Available</p>
          <p className="text-sm text-muted-foreground">
            A PDF template has not been assigned for this application yet. Please check back later.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
