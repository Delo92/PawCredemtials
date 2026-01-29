import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FileText, Plus } from "lucide-react";

export default function ApplicationsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Applications</h1>
            <p className="text-muted-foreground">
              View and manage all your applications
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/applicant/applications/new">
              <Plus className="mr-2 h-4 w-4" />
              New Application
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Applications</CardTitle>
            <CardDescription>Your application history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Start by creating a new application for our services.
              </p>
              <Button asChild>
                <Link href="/dashboard/applicant/applications/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Start New Application
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
