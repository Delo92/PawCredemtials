import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { GizmoForm, type GizmoFormData } from "@/components/shared/GizmoForm";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface FormDataWithIdCard extends GizmoFormData {
  petIdCardUrl?: string;
}

export default function FormViewerPage() {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;
  const { user } = useAuth();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialTab = searchParams.get("tab") === "idcard" ? "idcard" : "letter";
  const [activeTab, setActiveTab] = useState<"letter" | "idcard">(initialTab);

  const { data, isLoading, error } = useQuery<FormDataWithIdCard>({
    queryKey: ["/api/forms/data", applicationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/forms/data/${applicationId}`);
      return res.json();
    },
    enabled: !!applicationId && !!user,
  });

  const hasIdCard = !!data?.petIdCardUrl && !!data?.patientData?.petName;

  const idCardData: GizmoFormData | null = data && hasIdCard ? {
    ...data,
    gizmoFormUrl: data.petIdCardUrl!,
  } : null;

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

      {data && (
        <>
          {hasIdCard && (
            <div className="flex gap-2 mb-4" data-testid="form-viewer-tabs">
              <Button
                variant={activeTab === "letter" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("letter")}
                data-testid="button-tab-letter"
              >
                <FileText className="h-4 w-4 mr-2" />
                ESA Letter
              </Button>
              <Button
                variant={activeTab === "idcard" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("idcard")}
                data-testid="button-tab-idcard"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pet ID Card
              </Button>
            </div>
          )}

          {activeTab === "letter" && data.gizmoFormUrl && (
            <GizmoForm data={data} onClose={() => window.history.back()} />
          )}

          {activeTab === "letter" && !data.gizmoFormUrl && (
            <div className="p-6 border rounded-lg text-center space-y-3">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="font-medium">No PDF Form Available</p>
              <p className="text-sm text-muted-foreground">
                A PDF template has not been assigned for this application yet. Please check back later.
              </p>
            </div>
          )}

          {activeTab === "idcard" && idCardData && (
            <GizmoForm data={idCardData} onClose={() => setActiveTab("letter")} />
          )}
        </>
      )}
    </DashboardLayout>
  );
}
