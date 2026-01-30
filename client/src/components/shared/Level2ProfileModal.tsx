import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useConfig } from "@/contexts/ConfigContext";
import type { QueueEntry } from "@shared/schema";
import { 
  User as UserIcon,
  MapPin,
  Package,
  Calendar
} from "lucide-react";

interface Level2ProfileModalProps {
  entry: QueueEntry | null;
  onClose: () => void;
}

export function Level2ProfileModal({ entry, onClose }: Level2ProfileModalProps) {
  const { config } = useConfig();
  const level1Name = config?.levelNames?.level1 || "Applicant";

  if (!entry) return null;

  const firstName = entry.applicantFirstName || "Unknown";
  const lastName = entry.applicantLastName || "";
  const state = entry.applicantState || "Not specified";
  const packageName = entry.packageName || "Not specified";
  const packagePrice = entry.packagePrice;

  return (
    <Dialog open={!!entry} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {level1Name} Profile
          </DialogTitle>
          <DialogDescription>
            Read-only information from registration and purchase
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              <span>Name</span>
            </div>
            <p className="text-lg font-medium p-3 bg-muted rounded-md" data-testid="text-profile-name">
              {firstName} {lastName}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>State</span>
            </div>
            <p className="text-lg font-medium p-3 bg-muted rounded-md" data-testid="text-profile-state">
              {state}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Purchase</span>
            </div>
            <div className="p-3 bg-muted rounded-md" data-testid="text-profile-purchase">
              <p className="font-medium">{packageName}</p>
              {packagePrice !== undefined && packagePrice !== null && (
                <p className="text-sm text-muted-foreground mt-1">
                  ${packagePrice}
                </p>
              )}
            </div>
          </div>

          {entry.createdAt && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Joined queue: {new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground mt-2">
          This information is read-only and comes from the {level1Name}'s registration and purchase.
        </div>
      </DialogContent>
    </Dialog>
  );
}
