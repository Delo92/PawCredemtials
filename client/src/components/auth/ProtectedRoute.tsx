import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredLevel?: number;  // Exact level match
  minLevel?: number;       // Minimum level (inclusive) - user.level >= minLevel
}

export function ProtectedRoute({
  children,
  requiredLevel,
  minLevel,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    setLocation("/login");
    return null;
  }

  // Check exact level requirement (only for level-specific dashboards)
  // Higher level users (admins/owners) can access lower level dashboards
  if (requiredLevel !== undefined && user.userLevel < requiredLevel) {
    redirectToDashboard(user.userLevel, setLocation);
    return null;
  }

  // Check minimum level requirement (for admin features that require at least X level)
  if (minLevel !== undefined && user.userLevel < minLevel) {
    redirectToDashboard(user.userLevel, setLocation);
    return null;
  }

  return <>{children}</>;
}

function redirectToDashboard(
  userLevel: number,
  setLocation: (path: string) => void
) {
  switch (userLevel) {
    case 1:
      setLocation("/dashboard/applicant");
      break;
    case 2:
      setLocation("/dashboard/doctor");
      break;
    case 3:
      setLocation("/dashboard/admin");
      break;
    case 4:
      setLocation("/dashboard/owner");
      break;
    default:
      setLocation("/");
  }
}
