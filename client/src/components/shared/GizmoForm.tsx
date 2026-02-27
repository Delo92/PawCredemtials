import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface GizmoFormData {
  success: boolean;
  gizmoFormLayout?: "A" | "B";
  patientData: Record<string, string>;
  doctorData: Record<string, string>;
  gizmoFormUrl: string | null;
  generatedDate: string;
  patientName: string;
  selectedRadioIds?: string[];
}

interface PlaceholderField {
  token: string;
  key: string;
  source: "patient" | "doctor" | "meta";
  dataKey: string;
  x: number;
  y: number;
  width: number;
  pageIndex: number;
  value: string;
}

interface RadioField {
  token: string;
  group: string;
  option: string;
  x: number;
  y: number;
  pageIndex: number;
  selected: boolean;
  fontSize: number;
}

interface GizmoFormProps {
  data: GizmoFormData;
  onClose?: () => void;
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
  idnumber: { source: "patient", key: "idNumber" },
  driverlicensenumber: { source: "patient", key: "driverLicenseNumber" },
  driverlicense: { source: "patient", key: "driverLicenseNumber" },
  dlnumber: { source: "patient", key: "driverLicenseNumber" },
  driverslicense: { source: "patient", key: "driverLicenseNumber" },
  driverslicensenumber: { source: "patient", key: "driverLicenseNumber" },
  driverlicensestateidentificationcardnumber: { source: "patient", key: "driverLicenseNumber" },
  idexpirationdate: { source: "patient", key: "idExpirationDate" },
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
};

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getRadioGroup(option: string): string {
  const num = parseInt(option, 10);
  if (num >= 1 && num <= 3) return "placardtype";
  if (num >= 4 && num <= 5) return "placardcount";
  if (num >= 7 && num <= 14) return "condition";
  if (num >= 15 && num <= 16) return "duration";
  return "other";
}

const RADIO_AUTO_FILL: Record<string, { sourceField: string; valueMap: Record<string, string>; defaultOption?: string }> = {
  idtype: {
    sourceField: "idType",
    valueMap: {
      drivers_license: "dl",
      us_passport_photo_id: "passport",
      id_card: "idcard",
      tribal_id_card: "tribal",
    },
  },
  condition: {
    sourceField: "disabilityCondition",
    defaultOption: "7",
    valueMap: {
      A: "7", B: "8", C: "9", D: "10",
      E: "11", F: "12", G: "13", H: "14",
    },
  },
};

const DOCTOR_FORM_OFFSETS: Record<string, { x: number; y: number }> = {};

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

async function checkForPlaceholderTokens(pdf: pdfjsLib.PDFDocumentProxy): Promise<boolean> {
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const allText = textContent.items
      .filter((item): item is { str: string } => "str" in item)
      .map((item) => item.str)
      .join("");

    if (/\{(firstName|lastName|middleName|dateOfBirth|address|city|state|zipCode|zip|phone|email|date|driverLicenseNumber|medicalCondition|idNumber|suffix|apt)\}?/i.test(allText)) {
      return true;
    }
    if (/\{radio[_\s]/i.test(allText) || /radio\s*_?\s*id/i.test(allText)) {
      return true;
    }
  }
  return false;
}

export function GizmoForm({ data, onClose }: GizmoFormProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"acroform" | "placeholder" | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [placeholderFields, setPlaceholderFields] = useState<PlaceholderField[]>([]);
  const [radioFields, setRadioFields] = useState<RadioField[]>([]);
  const [acroFormFields, setAcroFormFields] = useState<{ name: string; normalizedName: string; value: string; matched: boolean }[]>([]);
  const [downloading, setDownloading] = useState(false);

  const doctorLastName = (data.doctorData?.lastName || "").toLowerCase();
  const offsets = DOCTOR_FORM_OFFSETS[doctorLastName] || { x: 0, y: 0 };

  const extractPlaceholdersFromPdf = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const fields: PlaceholderField[] = [];
    const radios: RadioField[] = [];
    const selectedRadioIds = new Set<string>(
      (data.selectedRadioIds || []).map((id) => String(id))
    );

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      interface TextItem {
        str: string;
        transform: number[];
        width: number;
        height: number;
      }

      const items = textContent.items.filter((item): item is TextItem => "str" in item && item.str.length > 0);

      const lines: TextItem[][] = [];
      for (const item of items) {
        const y = item.transform[5];
        let foundLine = false;
        for (const line of lines) {
          const lineY = line[0].transform[5];
          if (Math.abs(y - lineY) < 3) {
            line.push(item);
            foundLine = true;
            break;
          }
        }
        if (!foundLine) {
          lines.push([item]);
        }
      }

      interface PendingField {
        token: string;
        mapping: { source: "patient" | "doctor" | "meta"; key: string };
        x: number;
        y: number;
        pageIndex: number;
      }

      const pendingFields: PendingField[] = [];

      for (const line of lines) {
        line.sort((a, b) => a.transform[4] - b.transform[4]);
        const fullText = line.map((i) => i.str).join("");

        const placeholderRegex = /\{([a-zA-Z]+)\}?/g;
        let match;
        while ((match = placeholderRegex.exec(fullText)) !== null) {
          const tokenName = match[1];
          const token = `{${tokenName}}`;
          const mapping = PLACEHOLDER_MAP[token];

          if (mapping) {
            let charPos = 0;
            let anchorItem: TextItem | null = null;
            let anchorOffset = 0;

            for (const item of line) {
              if (charPos + item.str.length > match.index) {
                anchorItem = item;
                anchorOffset = match.index - charPos;
                break;
              }
              charPos += item.str.length;
            }

            if (anchorItem) {
              const x = anchorItem.transform[4] + (anchorOffset * (anchorItem.width / Math.max(anchorItem.str.length, 1)));
              const y = anchorItem.transform[5];

              pendingFields.push({
                token,
                mapping,
                x,
                y,
                pageIndex: pageNum - 1,
              });
            }
          }
        }

        const radioRegex = /\{radio_([a-zA-Z0-9]+)_([a-zA-Z0-9]+)\}/g;
        let radioMatch;
        while ((radioMatch = radioRegex.exec(fullText)) !== null) {
          const rawGroup = radioMatch[1].toLowerCase();
          const option = radioMatch[2].toLowerCase();
          const group = rawGroup === "id" ? getRadioGroup(option) : rawGroup;

          let charPos = 0;
          let anchorItem: TextItem | null = null;

          for (const item of line) {
            if (charPos + item.str.length > radioMatch.index) {
              anchorItem = item;
              break;
            }
            charPos += item.str.length;
          }

          if (anchorItem) {
            const optNum = parseInt(option, 10);
            const radioOffsetX = (optNum >= 6 && optNum <= 16) ? 1 : 0;
            const radioOffsetY = (optNum >= 6 && optNum <= 16) ? -2 : 0;
            const x = anchorItem.transform[4] + offsets.x + radioOffsetX;
            const y = viewport.height - anchorItem.transform[5] + offsets.y + radioOffsetY;
            const fontSize = anchorItem.height || 12;

            let selected = false;
            if (selectedRadioIds.has(option)) {
              selected = true;
            } else {
              const autoFill = RADIO_AUTO_FILL[group];
              if (autoFill) {
                const patientVal = data.patientData[autoFill.sourceField] || "";
                const expectedOption = autoFill.valueMap[patientVal];
                if (expectedOption === option) {
                  selected = true;
                } else if (!patientVal && autoFill.defaultOption === option) {
                  selected = true;
                }
              }
            }

            radios.push({
              token: radioMatch[0],
              group,
              option,
              x,
              y,
              pageIndex: pageNum - 1,
              selected,
              fontSize,
            });
          }
        }
      }

      for (const pf of pendingFields) {
        const sameLine = pendingFields.filter(
          (other) => other.pageIndex === pf.pageIndex
            && Math.abs(other.y - pf.y) < 3
            && other.x > pf.x
        );
        const nextX = sameLine.length > 0 ? Math.min(...sameLine.map((f) => f.x)) : null;
        const fieldWidth = nextX ? nextX - pf.x - 5 : viewport.width - pf.x - 20;

        fields.push({
          token: pf.token,
          key: pf.mapping.key,
          source: pf.mapping.source,
          dataKey: pf.mapping.key,
          x: pf.x + offsets.x,
          y: viewport.height - pf.y + offsets.y,
          width: Math.max(fieldWidth, 40),
          pageIndex: pf.pageIndex,
          value: resolveValue(pf.mapping.source, pf.mapping.key, data),
        });
      }

      const radioItemRegex = /^[{\s]*radio\s*$/i;
      const idItemRegex = /^[_\s]*id[_\s]*(\d{1,2})\s*\}?\s*$/i;
      const combinedRadioRegex = /\{?\s*radio\s*_?\s*id\s*_?\s*(\d{1,2})\s*\}?/i;
      const seenRadioOptions = new Set(radios.filter(r => r.pageIndex === pageNum - 1).map(r => r.option));

      const addRadioFromItem = (option: string, itemX: number, itemY: number, itemHeight: number) => {
        if (seenRadioOptions.has(option)) return;
        seenRadioOptions.add(option);

        const group = getRadioGroup(option);
        const optNum = parseInt(option, 10);
        const radioOffsetX = (optNum >= 6 && optNum <= 16) ? 1 : 0;
        const radioOffsetY = (optNum >= 6 && optNum <= 16) ? -2 : 0;
        const x = itemX + offsets.x + radioOffsetX;
        const y = viewport.height - itemY + offsets.y + radioOffsetY;
        const fontSize = itemHeight || 12;

        let selected = false;
        if (selectedRadioIds.has(option)) {
          selected = true;
        } else {
          const autoFill = RADIO_AUTO_FILL[group];
          if (autoFill) {
            const patientVal = data.patientData[autoFill.sourceField] || "";
            const expectedOption = autoFill.valueMap[patientVal];
            if (expectedOption === option) {
              selected = true;
            } else if (!patientVal && autoFill.defaultOption === option) {
              selected = true;
            }
          }
        }

        radios.push({
          token: `{radio_id_${option}}`,
          group,
          option,
          x,
          y,
          pageIndex: pageNum - 1,
          selected,
          fontSize,
        });
      };

      for (const item of items) {
        const trimmed = item.str.trim();
        const combined = combinedRadioRegex.exec(trimmed);
        if (combined) {
          addRadioFromItem(combined[1], item.transform[4], item.transform[5], item.height);
          continue;
        }

        const idMatch = idItemRegex.exec(trimmed);
        if (idMatch) {
          addRadioFromItem(idMatch[1], item.transform[4], item.transform[5], item.height);
        }
      }

      const radioOnlyRegex = /^\{?\s*radio\s*$/i;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!radioOnlyRegex.test(item.str.trim())) continue;

        for (let j = 0; j < items.length; j++) {
          if (j === i) continue;
          const other = items[j];
          const dx = Math.abs(other.transform[4] - item.transform[4]);
          const dy = Math.abs(other.transform[5] - item.transform[5]);
          if (dx > 60 || dy > 20) continue;

          const otherMatch = idItemRegex.exec(other.str.trim());
          if (!otherMatch) continue;

          const option = otherMatch[1];
          const anchorX = Math.min(item.transform[4], other.transform[4]);
          const anchorY = Math.max(item.transform[5], other.transform[5]);
          addRadioFromItem(option, anchorX, anchorY, other.height || item.height);
        }
      }
    }

    setPlaceholderFields(fields);
    setRadioFields(radios);
  };

  const loadPdf = useCallback(async () => {
    if (!data.gizmoFormUrl) {
      setError("No PDF template URL provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchUrl = data.gizmoFormUrl.startsWith("/")
        ? data.gizmoFormUrl
        : `/api/forms/proxy-pdf?url=${encodeURIComponent(data.gizmoFormUrl)}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error("Failed to fetch PDF template");

      const originalBytes = await response.arrayBuffer();
      const bytes = originalBytes.slice(0);
      setPdfBytes(bytes);

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes.slice(0)) }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);

      const hasPlaceholders = await checkForPlaceholderTokens(pdf);

      if (hasPlaceholders) {
        setMode("placeholder");
        await extractPlaceholdersFromPdf(pdf);
        setLoading(false);
        return;
      }

      const { PDFDocument } = await import("pdf-lib");
      const pdfLibDoc = await PDFDocument.load(originalBytes.slice(0));
      const form = pdfLibDoc.getForm();
      const fields = form.getFields();

      if (fields.length > 0) {
        let matchCount = 0;
        const acroFields = fields.map((f) => {
          const name = f.getName();
          const normalized = normalizeFieldName(name);
          const mapping = FIELD_NAME_MAP[normalized];
          let value = "";
          let matched = false;

          if (mapping) {
            value = resolveValue(mapping.source, mapping.key, data);
            matched = true;
            matchCount++;
          }

          return { name, normalizedName: normalized, value, matched };
        });

        if (matchCount > 0) {
          setMode("acroform");
          setAcroFormFields(acroFields);

          for (const af of acroFields) {
            if (af.matched && af.value) {
              try {
                const field = form.getTextField(af.name);
                field.setText(af.value);
                field.setFontSize(10);
                field.updateAppearances();
              } catch {}
            }
          }

          const previewDoc = await PDFDocument.load(originalBytes.slice(0));
          const previewForm = previewDoc.getForm();
          for (const af of acroFields) {
            if (af.matched && af.value) {
              try {
                const pf = previewForm.getTextField(af.name);
                pf.setText(af.value);
                pf.setFontSize(10);
                pf.updateAppearances();
              } catch {}
            }
          }
          previewForm.flatten();
          const previewBytes = await previewDoc.save();
          const previewBuffer = previewBytes.buffer as ArrayBuffer;

          const editableBytes = await pdfLibDoc.save();
          const editableBuffer = editableBytes.buffer as ArrayBuffer;
          setPdfBytes(editableBuffer.slice(0));

          const filledPdf = await pdfjsLib.getDocument({ data: new Uint8Array(previewBuffer.slice(0)) }).promise;
          setPdfDoc(filledPdf);
          setLoading(false);
          return;
        }
      }

      setMode("placeholder");
      await extractPlaceholdersFromPdf(pdf);
      setLoading(false);
    } catch (err: any) {
      console.error("GizmoForm load error:", err);
      setError(err.message || "Failed to load PDF");
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  const renderTaskRef = useRef<any>(null);

  const renderPage = useCallback(async () => {
    if (!pdfDoc) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (_) {}
      renderTaskRef.current = null;
    }

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
      const viewport = page.getViewport({ scale });
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
      }
      renderTaskRef.current = null;
    };

    await tryRender();
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const updateFieldValue = (index: number, value: string) => {
    setPlaceholderFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  };

  const toggleRadio = (index: number) => {
    setRadioFields((prev) => {
      const updated = [...prev];
      const clicked = updated[index];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].group === clicked.group) {
          updated[i] = { ...updated[i], selected: i === index };
        }
      }
      return updated;
    });
  };

  const updateAcroFieldValue = (index: number, value: string) => {
    setAcroFormFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  };

  const handleDownload = async () => {
    if (!pdfBytes) return;

    try {
      setDownloading(true);
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfLibDoc = await PDFDocument.load(pdfBytes.slice(0));
      const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

      if (mode === "acroform") {
        const form = pdfLibDoc.getForm();
        for (const af of acroFormFields) {
          if (af.value) {
            try {
              const field = form.getTextField(af.name);
              field.setText(af.value);
            } catch {}
          }
        }
        form.flatten();
      } else if (mode === "placeholder") {
        const pages = pdfLibDoc.getPages();

        for (const field of placeholderFields) {
          if (!field.value) continue;
          const page = pages[field.pageIndex];
          if (!page) continue;

          const pageHeight = page.getHeight();
          page.drawText(field.value, {
            x: field.x,
            y: pageHeight - field.y,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
        }

        for (const radio of radioFields) {
          if (!radio.selected) continue;
          const page = pages[radio.pageIndex];
          if (!page) continue;

          const pageHeight = page.getHeight();
          const sz = 8;
          page.drawRectangle({
            x: radio.x,
            y: pageHeight - radio.y - sz + 2,
            width: sz,
            height: sz,
            color: rgb(0, 0, 0),
          });
        }
      }

      const finalBytes = await pdfLibDoc.save();
      const blob = new Blob([finalBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${now.getFullYear()}`;
      const firstName = sanitizeFilename(data.patientData.firstName || "Patient");
      const lastName = sanitizeFilename(data.patientData.lastName || "");
      const filename = `${firstName}_${lastName}_Physician_Recommendation_${dateStr}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Downloaded", description: `${filename} saved successfully.` });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!pdfBytes) return;
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfLibDoc = await PDFDocument.load(pdfBytes.slice(0));
      const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

      if (mode === "acroform") {
        const form = pdfLibDoc.getForm();
        for (const af of acroFormFields) {
          if (af.value) {
            try { form.getTextField(af.name).setText(af.value); } catch {}
          }
        }
        form.flatten();
      } else if (mode === "placeholder") {
        const pages = pdfLibDoc.getPages();
        for (const field of placeholderFields) {
          if (!field.value) continue;
          const page = pages[field.pageIndex];
          if (!page) continue;
          page.drawText(field.value, { x: field.x, y: page.getHeight() - field.y, size: 10, font, color: rgb(0, 0, 0) });
        }
        for (const radio of radioFields) {
          if (!radio.selected) continue;
          const page = pages[radio.pageIndex];
          if (!page) continue;
          const sz = 8;
          page.drawRectangle({ x: radio.x, y: page.getHeight() - radio.y - sz + 2, width: sz, height: sz, color: rgb(0, 0, 0) });
        }
      }

      const finalBytes = await pdfLibDoc.save();
      const blob = new Blob([finalBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.addEventListener("load", () => printWindow.print());
      }
    } catch (err: any) {
      toast({ title: "Print Failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" onClick={loadPdf} data-testid="button-retry-pdf">
          Retry
        </Button>
      </div>
    );
  }

  const pageFields = placeholderFields.filter((f) => f.pageIndex === currentPage - 1);
  const pageRadios = radioFields.filter((r) => r.pageIndex === currentPage - 1);

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2" data-testid="gizmo-toolbar">
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} data-testid="button-close-form">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <Badge variant="secondary" data-testid="badge-form-mode">
            {mode === "acroform" ? "AcroForm Mode" : "Placeholder Mode"}
          </Badge>
          <Badge variant="outline">
            {mode === "acroform"
              ? `${acroFormFields.filter((f) => f.matched).length} fields matched`
              : `${placeholderFields.length} fields, ${radioFields.length} radios`}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(3, s + 0.25))} data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          {totalPages > 1 && (
            <>
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} data-testid="button-prev-page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{currentPage}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} data-testid="button-next-page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-pdf">
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading} data-testid="button-download-pdf">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Download PDF
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 overflow-auto border rounded-lg bg-white" ref={containerRef}>
          <div className="relative inline-block" style={{ minWidth: "fit-content" }}>
            <canvas ref={canvasRef} className="block" />

            {mode === "placeholder" && pageFields.map((field, idx) => {
              const globalIdx = placeholderFields.indexOf(field);
              return (
                <Input
                  key={`field-${globalIdx}`}
                  value={field.value}
                  onChange={(e) => updateFieldValue(globalIdx, e.target.value)}
                  className="absolute bg-yellow-50/80 border-yellow-400 text-xs h-6 px-1 text-black"
                  style={{
                    left: field.x * scale,
                    top: field.y * scale,
                    width: field.width * scale,
                    fontSize: 10 * scale,
                    height: 16 * scale,
                  }}
                  data-testid={`input-field-${field.dataKey}`}
                />
              );
            })}

            {mode === "placeholder" && pageRadios.map((radio, idx) => {
              const globalIdx = radioFields.indexOf(radio);
              const size = 10 * scale;
              return (
                <button
                  key={`radio-${globalIdx}`}
                  onClick={() => toggleRadio(globalIdx)}
                  className="absolute rounded-sm flex items-center justify-center transition-colors"
                  style={{
                    left: radio.x * scale,
                    top: (radio.y - 2) * scale,
                    width: size,
                    height: size,
                    backgroundColor: radio.selected ? "#000" : "#fff",
                    border: `${Math.max(1, 1.5 * scale)}px solid ${radio.selected ? "#000" : "#999"}`,
                    zIndex: 10,
                  }}
                  data-testid={`radio-${radio.group}-${radio.option}`}
                >
                  {radio.selected && <Check className="text-white" style={{ width: 7 * scale, height: 7 * scale }} />}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "acroform" && (
          <Card className="w-72 flex-shrink-0">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Form Fields</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-2 space-y-2 max-h-[600px] overflow-y-auto">
              {acroFormFields.map((af, idx) => (
                <div key={af.name} className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    {af.matched && <Check className="h-3 w-3 text-green-500" />}
                    {af.name}
                  </label>
                  <Input
                    value={af.value}
                    onChange={(e) => updateAcroFieldValue(idx, e.target.value)}
                    className="h-7 text-xs"
                    data-testid={`input-acro-${af.name}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
