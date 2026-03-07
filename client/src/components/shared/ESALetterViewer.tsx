import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { GizmoFormData } from "./GizmoForm";

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PLACEHOLDER_MAP: Record<string, { source: "patient" | "doctor" | "meta"; key: string }> = {
  "{firstName}": { source: "patient", key: "firstName" },
  "{middleName}": { source: "patient", key: "middleName" },
  "{lastName}": { source: "patient", key: "lastName" },
  "{suffix}": { source: "patient", key: "suffix" },
  "{dateOfBirth}": { source: "patient", key: "dateOfBirth" },
  "{address}": { source: "patient", key: "address" },
  "{apt}": { source: "patient", key: "apt" },
  "{city}": { source: "patient", key: "city" },
  "{state}": { source: "patient", key: "state" },
  "{zipCode}": { source: "patient", key: "zipCode" },
  "{zip}": { source: "patient", key: "zipCode" },
  "{phone}": { source: "patient", key: "phone" },
  "{email}": { source: "patient", key: "email" },
  "{medicalCondition}": { source: "patient", key: "medicalCondition" },
  "{idNumber}": { source: "patient", key: "idNumber" },
  "{driverLicenseNumber}": { source: "patient", key: "driverLicenseNumber" },
  "{dlNumber}": { source: "patient", key: "driverLicenseNumber" },
  "{idExpirationDate}": { source: "patient", key: "idExpirationDate" },
  "{date}": { source: "meta", key: "generatedDate" },
  "{doctorFirstName}": { source: "doctor", key: "firstName" },
  "{doctorMiddleName}": { source: "doctor", key: "middleName" },
  "{doctorLastName}": { source: "doctor", key: "lastName" },
  "{doctorPhone}": { source: "doctor", key: "phone" },
  "{doctorAddress}": { source: "doctor", key: "address" },
  "{doctorCity}": { source: "doctor", key: "city" },
  "{doctorState}": { source: "doctor", key: "state" },
  "{doctorZipCode}": { source: "doctor", key: "zipCode" },
  "{doctorLicenseNumber}": { source: "doctor", key: "licenseNumber" },
  "{doctorNpiNumber}": { source: "doctor", key: "npiNumber" },
  "{petName}": { source: "patient", key: "petName" },
  "{petBreed}": { source: "patient", key: "petBreed" },
  "{petType}": { source: "patient", key: "petType" },
  "{petWeight}": { source: "patient", key: "petWeight" },
  "{registrationId}": { source: "patient", key: "registrationId" },
};

function resolveValue(
  source: "patient" | "doctor" | "meta",
  key: string,
  data: GizmoFormData
): string {
  if (source === "meta") {
    if (key === "generatedDate") return data.generatedDate || "";
    return "";
  }
  const sourceObj = source === "patient" ? data.patientData : data.doctorData;
  let val = sourceObj[key] || "";
  if (key === "dateOfBirth" && val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    val = `${m}/${d}/${y}`;
  }
  return val;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

interface ESALetterViewerProps {
  data: GizmoFormData;
  onClose?: () => void;
}

export function ESALetterViewer({ data, onClose }: ESALetterViewerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [filledPdfBytes, setFilledPdfBytes] = useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [downloading, setDownloading] = useState(false);

  const loadAndFillPdf = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const pdfUrl = data.gizmoFormUrl;
      if (!pdfUrl) {
        setError("No letter template URL");
        setLoading(false);
        return;
      }

      const fetchUrl = pdfUrl.startsWith("/")
        ? pdfUrl
        : `/api/forms/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`;

      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
      const originalBytes = await response.arrayBuffer();

      const { PDFDocument, rgb: pdfRgb, StandardFonts } = await import("pdf-lib");
      const filledDoc = await PDFDocument.load(originalBytes.slice(0));
      const timesRoman = await filledDoc.embedFont(StandardFonts.TimesRoman);
      const filledPages = filledDoc.getPages();

      const scanPdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes.slice(0)) }).promise;

      for (let pageNum = 1; pageNum <= scanPdf.numPages; pageNum++) {
        const pdfPage = await scanPdf.getPage(pageNum);
        const textContent = await pdfPage.getTextContent();
        const filledPage = filledPages[pageNum - 1];
        if (!filledPage) continue;

        interface TextItem {
          str: string;
          transform: number[];
          width: number;
          height: number;
          fontName?: string;
        }

        const textItems = textContent.items.filter(
          (item): item is TextItem => "str" in item && item.str.length > 0
        );

        for (const item of textItems) {
          if (!/\{[a-zA-Z_]+\}/.test(item.str)) continue;

          const fontSize = Math.abs(item.transform[3]) || item.height || 12;
          const itemX = item.transform[4];
          const itemY = item.transform[5];
          const avgCharWidth = item.str.length > 0 ? item.width / item.str.length : fontSize * 0.5;

          const placeholderRegex = /\{([a-zA-Z_]+)\}/g;
          let match;
          while ((match = placeholderRegex.exec(item.str)) !== null) {
            const token = match[0];
            const mapping = PLACEHOLDER_MAP[token];
            if (!mapping) continue;

            const value = resolveValue(mapping.source, mapping.key, data);

            const phStartChar = match.index;
            const phEndChar = match.index + token.length;
            const phX = itemX + phStartChar * avgCharWidth;
            const phWidth = (phEndChar - phStartChar) * avgCharWidth;

            const pad = 2;
            filledPage.drawRectangle({
              x: phX - pad,
              y: itemY - 3,
              width: phWidth + pad * 2,
              height: fontSize + 6,
              color: pdfRgb(1, 1, 1),
              opacity: 1,
            });

            if (value) {
              filledPage.drawText(value, {
                x: phX,
                y: itemY,
                size: fontSize,
                font: timesRoman,
                color: pdfRgb(0, 0, 0),
              });
            }
          }
        }
      }

      scanPdf.destroy();

      const filledBytes = await filledDoc.save();
      const filledBuffer = filledBytes.buffer.slice(0) as ArrayBuffer;
      setFilledPdfBytes(filledBuffer);

      const displayPdf = await pdfjsLib.getDocument({
        data: new Uint8Array(filledBuffer.slice(0)),
      }).promise;
      setPdfDoc(displayPdf);
      setTotalPages(displayPdf.numPages);
      setLoading(false);
    } catch (err: any) {
      console.error("ESALetterViewer load error:", err);
      setError(err.message || "Failed to load letter PDF");
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    loadAndFillPdf();
  }, [loadAndFillPdf]);

  const renderTaskRef = useRef<any>(null);
  const isRenderingRef = useRef(false);

  const renderPage = useCallback(async () => {
    if (!pdfDoc) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        await renderTaskRef.current.promise.catch(() => {});
      } catch (_) {}
      renderTaskRef.current = null;
    }

    while (isRenderingRef.current) {
      await new Promise((r) => setTimeout(r, 50));
    }

    isRenderingRef.current = true;

    const tryRender = async (retries = 5): Promise<void> => {
      const canvas = canvasRef.current;
      if (!canvas) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 100));
          return tryRender(retries - 1);
        }
        return;
      }

      const page = await pdfDoc.getPage(currentPage);
      const rotation = page.rotate || 0;
      const viewport = page.getViewport({ scale, rotation });
      const ctx = canvas.getContext("2d")!;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") return;
        throw err;
      } finally {
        renderTaskRef.current = null;
      }
    };

    try {
      await tryRender();
    } finally {
      isRenderingRef.current = false;
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handleDownload = async () => {
    if (!filledPdfBytes) return;
    try {
      setDownloading(true);
      const blob = new Blob([filledPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${now.getFullYear()}`;
      const firstName = sanitizeFilename(
        data.patientData.firstName || "Patient"
      );
      const lastName = sanitizeFilename(data.patientData.lastName || "");
      const filename = `${firstName}_${lastName}_ESA_Letter_${dateStr}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: `${filename} saved successfully.`,
      });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({
        title: "Download Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!filledPdfBytes) return;
    try {
      const blob = new Blob([filledPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.addEventListener("load", () => printWindow.print());
      }
    } catch (err: any) {
      toast({
        title: "Print Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          Loading ESA Letter...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button
          variant="outline"
          onClick={loadAndFillPdf}
          data-testid="button-retry-letter"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div
        className="flex items-center justify-between flex-wrap gap-2"
        data-testid="letter-toolbar"
      >
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              data-testid="button-close-letter"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <Badge variant="secondary" data-testid="badge-letter-mode">
            ESA Letter
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            data-testid="button-letter-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            data-testid="button-letter-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {totalPages > 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                data-testid="button-letter-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                data-testid="button-letter-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            data-testid="button-letter-print"
          >
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            data-testid="button-letter-download"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div
          className="overflow-auto border rounded-lg bg-white h-full"
          ref={containerRef}
        >
          <div
            className="relative inline-block"
            style={{ minWidth: "fit-content" }}
          >
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>
      </div>
    </div>
  );
}
