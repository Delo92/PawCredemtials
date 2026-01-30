import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Download, Trash2, Eye, FolderOpen } from "lucide-react";

export default function DocumentsPage() {
  const { toast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // This would fetch from /api/documents when that endpoint exists
  const { data: documents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    enabled: false, // Disabled until endpoint is implemented
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      toast({
        title: "Upload Started",
        description: "Your document has been uploaded successfully.",
      });
      setIsUploadOpen(false);
      setSelectedFile(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-documents-title">
              My Notes
            </h1>
            <p className="text-muted-foreground">
              View and download your doctor's notes
            </p>
          </div>
          <Button onClick={() => setIsUploadOpen(true)} data-testid="button-upload-document">
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Doctor's Notes</CardTitle>
            <CardDescription>
              Download your completed doctor's notes here
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No notes yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Your completed doctor's notes will appear here for download once your order is processed.
              </p>
              <Button onClick={() => setIsUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Supporting Document
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supporting Documents (Optional)</CardTitle>
            <CardDescription>
              You may upload additional documents if needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Photo ID</p>
                    <p className="text-sm text-muted-foreground">Government-issued ID (driver's license, passport)</p>
                  </div>
                </div>
                <Badge variant="outline">Not uploaded</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Additional Documentation</p>
                    <p className="text-sm text-muted-foreground">Any supporting materials for your order</p>
                  </div>
                </div>
                <Badge variant="outline">Not uploaded</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Supporting File</DialogTitle>
              <DialogDescription>
                Select a file to upload. Supported formats: PDF, JPG, PNG (max 10MB)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">Click to select a file</p>
                  <p className="text-sm text-muted-foreground">or drag and drop</p>
                </label>
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="h-5 w-5" />
                  <span className="flex-1 truncate">{selectedFile.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!selectedFile} data-testid="button-confirm-upload">
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
