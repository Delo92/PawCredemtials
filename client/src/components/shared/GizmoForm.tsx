import { useState, useEffect, useRef, useCallback } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, FileText, AlertCircle, CheckCircle } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface GizmoFormData {
  success: boolean;
  gizmoFormLayout?: "A" | "B";
  patientData: Record<string, string>;
  doctorData: Record<string, string>;
  gizmoFormUrl: string | null;
  generatedDate: string;
  patientName: string;
}

interface PlaceholderField {
  token: string;
  key: string;
  source: "patient" | "doctor" | "meta";
  dataKey: string;
  x: number;
  y: number;
  width: number;
  page: number;
  value: string;
}

interface RadioField {
  token: string;
  group: string;
  option: string;
  x: number;
  y: number;
  page: number;
  selected: boolean;
  fontSize: number;
}

const FIELD_NAME_MAP: Record<string, { source: "patient" | "doctor" | "meta"; key: string }> = {
  firstname: { source: "patient", key: "firstName" },
  middlename: { source: "patient", key: "middleName" },
  lastname: { source: "patient", key: "lastName" },
  suffix: { source: "patient", key: "suffix" },
  dateofbirth: { source: "patient", key: "dateOfBirth" },
  dob: { source: "patient", key: "dateOfBirth" },
  address: { source: "patient", key: "address" },
  apt: { source: "patient", key: "apt" },
  city: { source: "patient", key: "city" },
  state: { source: "patient", key: "state" },
  zipcode: { source: "patient", key: "zipCode" },
  zip: { source: "patient", key: "zipCode" },
  phone: { source: "patient", key: "phone" },
  email: { source: "patient", key: "email" },
  medicalcondition: { source: "patient", key: "medicalCondition" },
  date: { source: "meta", key: "generatedDate" },
  doctorfirstname: { source: "doctor", key: "firstName" },
  doctormiddlename: { source: "doctor", key: "middleName" },
  doctorlastname: { source: "doctor", key: "lastName" },
  doctorphone: { source: "doctor", key: "phone" },
  doctoraddress: { source: "doctor", key: "address" },
  doctorcity: { source: "doctor", key: "city" },
  doctorstate: { source: "doctor", key: "state" },
  doctorzipcode: { source: "doctor", key: "zipCode" },
  doctorlicensenumber: { source: "doctor", key: "licenseNumber" },
  doctornpinumber: { source: "doctor", key: "npiNumber" },
};

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
};

const RADIO_AUTO_FILL: Record<string, { sourceField: string; valueMap: Record<string, string> }> = {
  idtype: {
    sourceField: "idType",
    valueMap: {
      drivers_license: "dl",
      us_passport_photo_id: "passport",
      id_card: "idcard",
      tribal_id_card: "tribal",
    },
  },
};

const DOCTOR_FORM_OFFSETS: Record<string, { x: number; y: number }> = {
  fore: { x: 3, y: -4 },
  foshee: { x: 0, y: -3 },
};

function formatDOB(val: string): string {
  if (!val) return "";
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return val;
}

function resolveValue(
  source: "patient" | "doctor" | "meta",
  key: string,
  data: GizmoFormData
): string {
  let val = "";
  if (source === "patient") val = data.patientData[key] || "";
  else if (source === "doctor") val = data.doctorData[key] || "";
  else if (source === "meta") val = (data as any)[key] || "";
  if (key === "dateOfBirth") val = formatDOB(val);
  return val;
}

interface GizmoFormProps {
  data: GizmoFormData;
  onClose?: () => void;
}

export function GizmoForm({ data, onClose }: GizmoFormProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"acroform" | "placeholder" | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fields, setFields] = useState<PlaceholderField[]>([]);
  const [radioFields, setRadioFields] = useState<RadioField[]>([]);
  const [acroFormValues, setAcroFormValues] = useState<Record<string, string>>({});
  const [acroFormFieldNames, setAcroFormFieldNames] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale] = useState(1.5);

  const doctorLastName = (data.doctorData.lastName || "").toLowerCase();
  const offsets = DOCTOR_FORM_OFFSETS[doctorLastName] || { x: 0, y: 0 };

  const loadPdf = useCallback(async () => {
    if (!data.gizmoFormUrl) {
      setError("No PDF template URL provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const proxyUrl = `/api/forms/proxy-pdf?url=${encodeURIComponent(data.gizmoFormUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch PDF template");
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      setPdfBytes(bytes);

      const pdfLibDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = pdfLibDoc.getForm();
      const pdfFields = form.getFields();

      let acroMatches = 0;
      const acroValues: Record<string, string> = {};
      const fieldNames: string[] = [];

      for (const field of pdfFields) {
        const name = field.getName();
        fieldNames.push(name);
        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const mapping = FIELD_NAME_MAP[normalized];
        if (mapping) {
          acroMatches++;
          const val = resolveValue(mapping.source, mapping.key, data);
          acroValues[name] = val;
        } else {
          acroValues[name] = "";
        }
      }

      if (acroMatches > 0) {
        setMode("acroform");
        setAcroFormValues(acroValues);
        setAcroFormFieldNames(fieldNames);
      } else {
        setMode("placeholder");
        await extractPlaceholders(bytes);
      }

      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || "Failed to load PDF");
    } finally {
      setLoading(false);
    }
  }, [data]);

  async function extractPlaceholders(bytes: Uint8Array) {
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    const detectedFields: PlaceholderField[] = [];
    const detectedRadios: RadioField[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      interface TextItem {
        str: string;
        transform: number[];
        width: number;
        height: number;
      }

      const items: TextItem[] = textContent.items
        .filter((item: any) => "str" in item)
        .map((item: any) => ({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
        }));

      const lines: TextItem[][] = [];
      for (const item of items) {
        const y = item.transform[5];
        let foundLine = false;
        for (const line of lines) {
          if (Math.abs(line[0].transform[5] - y) < 3) {
            line.push(item);
            foundLine = true;
            break;
          }
        }
        if (!foundLine) lines.push([item]);
      }

      for (const line of lines) {
        line.sort((a, b) => a.transform[4] - b.transform[4]);
        const fullText = line.map((i) => i.str).join("");

        const placeholderRegex = /\{(\w+)\}/g;
        let match;
        while ((match = placeholderRegex.exec(fullText)) !== null) {
          const token = match[0];

          const radioMatch = token.match(/^\{radio_(\w+)_(\w+)\}$/);
          if (radioMatch) {
            const [, group, option] = radioMatch;
            let charPos = 0;
            let tokenX = 0;
            let tokenY = 0;
            let fontSize = 12;
            for (const item of line) {
              if (charPos + item.str.length > match.index!) {
                const offset = match.index! - charPos;
                tokenX = item.transform[4] + (offset / Math.max(item.str.length, 1)) * item.width;
                tokenY = viewport.height - item.transform[5];
                fontSize = item.height || 12;
                break;
              }
              charPos += item.str.length;
            }

            const autoFillConfig = RADIO_AUTO_FILL[group.toLowerCase()];
            let selected = false;
            if (autoFillConfig) {
              const patientVal = data.patientData[autoFillConfig.sourceField] || "";
              const expectedOption = autoFillConfig.valueMap[patientVal];
              if (expectedOption === option.toLowerCase()) selected = true;
            }

            detectedRadios.push({
              token,
              group,
              option,
              x: tokenX + offsets.x,
              y: tokenY + offsets.y,
              page: pageNum,
              selected,
              fontSize,
            });
            continue;
          }

          const mapping = PLACEHOLDER_MAP[token];
          if (!mapping) continue;

          let charPos = 0;
          let tokenX = 0;
          let tokenY = 0;
          for (const item of line) {
            if (charPos + item.str.length > match.index!) {
              const offset = match.index! - charPos;
              tokenX = item.transform[4] + (offset / Math.max(item.str.length, 1)) * item.width;
              tokenY = viewport.height - item.transform[5];
              break;
            }
            charPos += item.str.length;
          }

          const val = resolveValue(mapping.source, mapping.key, data);
          const fieldsOnLine = detectedFields.filter(
            (f) => f.page === pageNum && Math.abs(f.y - (viewport.height - line[0].transform[5])) < 3
          );
          const width = fieldsOnLine.length > 0 ? 150 : 200;

          detectedFields.push({
            token,
            key: `${pageNum}-${match.index}`,
            source: mapping.source,
            dataKey: mapping.key,
            x: tokenX + offsets.x,
            y: tokenY + offsets.y,
            width,
            page: pageNum,
            value: val,
          });
        }
      }
    }

    setFields(detectedFields);
    setRadioFields(detectedRadios);
  }

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    renderPage(currentPage);
  }, [pdfDoc, currentPage, scale]);

  async function renderPage(pageNum: number) {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  function updateFieldValue(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  }

  function updateAcroValue(name: string, value: string) {
    setAcroFormValues((prev) => ({ ...prev, [name]: value }));
  }

  function toggleRadio(group: string, option: string) {
    setRadioFields((prev) =>
      prev.map((r) => {
        if (r.group === group) {
          return { ...r, selected: r.option === option };
        }
        return r;
      })
    );
  }

  async function downloadPdf() {
    if (!pdfBytes) return;

    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      if (mode === "acroform") {
        const form = pdfDoc.getForm();
        for (const fieldName of acroFormFieldNames) {
          const val = acroFormValues[fieldName] || "";
          try {
            const field = form.getTextField(fieldName);
            field.setText(val);
          } catch {}
        }
        form.flatten();
      } else {
        const pages = pdfDoc.getPages();
        for (const field of fields) {
          if (field.page <= pages.length && field.value) {
            const page = pages[field.page - 1];
            const { height } = page.getSize();
            page.drawText(field.value, {
              x: field.x,
              y: height - field.y - 12,
              size: 10,
              font,
              color: rgb(0, 0, 0),
            });
          }
        }

        for (const radio of radioFields) {
          if (radio.selected && radio.page <= pages.length) {
            const page = pages[radio.page - 1];
            const { height } = page.getSize();
            const radius = Math.max(radio.fontSize * 0.3, 4);
            page.drawCircle({
              x: radio.x + radius,
              y: height - radio.y - radius,
              size: radius,
              color: rgb(0, 0, 0),
            });
          }
        }
      }

      const filledBytes = await pdfDoc.save();
      const blob = new Blob([filledBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const firstName = (data.patientData.firstName || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
      const lastName = (data.patientData.lastName || "").replace(/[^a-zA-Z0-9]/g, "_");
      const today = new Date();
      const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}-${today.getFullYear()}`;
      const filename = `${firstName}_${lastName}_Physician_Recommendation_${dateStr}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF download failed:", err);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Loading Form...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[600px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Form Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadPdf} data-testid="button-retry-pdf">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Physician Recommendation Form
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {mode === "acroform" ? "Interactive Form" : "Template Form"}
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Auto-filled
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Patient: <span className="font-medium text-foreground">{data.patientName}</span>
          </p>
          <div className="flex items-center gap-2">
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  data-testid="button-prev-page"
                >
                  Prev
                </Button>
                <span className="text-sm px-2">
                  {currentPage} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="relative border rounded-lg overflow-auto bg-gray-100 dark:bg-gray-900" style={{ maxHeight: "600px" }}>
          <canvas ref={canvasRef} className="mx-auto" />

          {mode === "placeholder" &&
            fields
              .filter((f) => f.page === currentPage)
              .map((field) => (
                <Input
                  key={field.key}
                  value={field.value}
                  onChange={(e) => updateFieldValue(field.key, e.target.value)}
                  className="absolute bg-white/80 dark:bg-gray-800/80 text-xs h-6 px-1 border-blue-300"
                  style={{
                    left: field.x * scale,
                    top: field.y * scale,
                    width: field.width * scale,
                    fontSize: "10px",
                  }}
                  data-testid={`input-field-${field.dataKey}`}
                />
              ))}

          {mode === "placeholder" &&
            radioFields
              .filter((r) => r.page === currentPage)
              .map((radio) => (
                <button
                  key={`${radio.group}-${radio.option}`}
                  onClick={() => toggleRadio(radio.group, radio.option)}
                  className={`absolute w-4 h-4 rounded-full border-2 ${
                    radio.selected
                      ? "bg-black border-black dark:bg-white dark:border-white"
                      : "bg-white border-gray-400 dark:bg-gray-700 dark:border-gray-500"
                  }`}
                  style={{
                    left: radio.x * scale,
                    top: radio.y * scale,
                  }}
                  data-testid={`radio-${radio.group}-${radio.option}`}
                />
              ))}
        </div>

        {mode === "acroform" && (
          <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
            <h4 className="col-span-2 text-sm font-semibold mb-1">Form Fields</h4>
            {acroFormFieldNames.map((name) => (
              <div key={name} className="space-y-1">
                <label className="text-xs text-muted-foreground">{name}</label>
                <Input
                  value={acroFormValues[name] || ""}
                  onChange={(e) => updateAcroValue(name, e.target.value)}
                  className="h-8 text-sm"
                  data-testid={`input-acro-${name}`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between pt-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} data-testid="button-close-form">
              Close
            </Button>
          )}
          <Button onClick={downloadPdf} className="ml-auto" data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download Filled PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
