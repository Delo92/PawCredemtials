import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Construction, ArrowLeft } from "lucide-react";

export default function PlaceholderPage() {
  const [location] = useLocation();
  
  // Extract page name from path
  const pathParts = location.split("/");
  const pageName = pathParts[pathParts.length - 1] || "Page";
  const formattedName = pageName.charAt(0).toUpperCase() + pageName.slice(1).replace(/-/g, " ");
  
  // Get back path (go up one level)
  const backPath = pathParts.slice(0, -1).join("/") || "/dashboard/applicant";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Construction className="h-10 w-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">{formattedName}</CardTitle>
            <CardDescription>
              This feature is coming soon. Check back later!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href={backPath}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
