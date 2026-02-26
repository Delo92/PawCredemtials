# Gizmo PDF Auto-Fill System — Exact Code Patterns

Copy-paste reference for replicating this system. Every code block here is the exact working code from this project. The most common crashes come from ArrayBuffer handling, pdfjs worker setup, and the AcroForm dual-document pattern.

---

## CRASH PREVENTION: The 3 Rules

### Rule 1: pdfjs Worker Must Be Local (Not CDN)

The pdfjs-dist package version and its worker version must match exactly. CDN workers are a different version and will silently fail or crash. Import the worker locally using Vite's `?url` suffix:

```typescript
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

This MUST be at the top of the file, outside any component. If you use `pdf.worker.min.js` instead of `pdf.worker.min.mjs`, it will crash in Vite. If you point to a CDN, the version mismatch will crash.

### Rule 2: Always `.slice(0)` Every ArrayBuffer

Both `pdfjsLib.getDocument()` and `PDFDocument.load()` transfer ownership of the ArrayBuffer. After either call, the original buffer is **detached** (empty). If you try to reuse it, you get `Cannot perform Construct on a detached ArrayBuffer`.

Every single time you pass an ArrayBuffer to either library, slice it first:

```typescript
const originalBytes = await response.arrayBuffer();

// CORRECT — each call gets its own copy
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes.slice(0)) }).promise;
const pdfLibDoc = await PDFDocument.load(originalBytes.slice(0));

// WRONG — second call crashes because first call detached the buffer
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes) }).promise;
const pdfLibDoc = await PDFDocument.load(originalBytes); // CRASH: detached ArrayBuffer
```

### Rule 3: AcroForm Preview Needs Two Separate Documents

When you fill AcroForm fields with pdf-lib, it adds white highlight backgrounds behind the text. If you render that to canvas, the form looks wrong. The fix: create a **flattened** copy for the canvas preview, but keep the **editable** copy for download/print.

```typescript
// Fill the editable copy (keep for downloads)
const pdfLibDoc = await PDFDocument.load(originalBytes.slice(0));
const form = pdfLibDoc.getForm();
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

// Create a SEPARATE flattened copy for canvas preview (no white highlights)
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

// Save editable bytes for download/print
const editableBytes = await pdfLibDoc.save();
const editableBuffer = editableBytes.buffer as ArrayBuffer;
setPdfBytes(editableBuffer.slice(0));

// Use flattened preview for the canvas
const filledPdf = await pdfjsLib.getDocument({ data: new Uint8Array(previewBuffer.slice(0)) }).promise;
setPdfDoc(filledPdf);
```

If you skip the dual-document pattern and render the editable copy directly, every filled field will have an ugly white rectangle behind it.

---

## Required npm Packages

```
pdf-lib
pdfjs-dist
```

---

## Complete Component: Exact Imports and State

```typescript
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
```

### Exact Interfaces

```typescript
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
```

### Exact Component State

```typescript
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
```

---

## Exact Field Maps

### FIELD_NAME_MAP (for AcroForm mode — matches normalized PDF field names)

```typescript
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
```

### PLACEHOLDER_MAP (for Placeholder mode — matches `{token}` text in PDF)

```typescript
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
```

### Normalization Function

```typescript
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
```

### Per-Doctor Position Offsets

Optional per-doctor X/Y pixel adjustments for placeholder positions. Keyed by lowercase doctor last name. Empty by default — add entries if a specific doctor's PDF needs position tweaking:

```typescript
const DOCTOR_FORM_OFFSETS: Record<string, { x: number; y: number }> = {};
```

Used in the component body:

```typescript
const doctorLastName = (data.doctorData?.lastName || "").toLowerCase();
const offsets = DOCTOR_FORM_OFFSETS[doctorLastName] || { x: 0, y: 0 };
```

These `offsets` values are added to every placeholder and radio position in `extractPlaceholdersFromPdf`. If you skip this, all positions still work (offsets default to 0), but you lose the ability to fine-tune per doctor.

### Value Resolution Function

```typescript
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
```

---

## Exact PDF Loading Function (The Core — Where Most Crashes Happen)

This is the complete `loadPdf` function. It fetches the PDF, detects the mode, and sets up the component state. Every `.slice(0)` is mandatory.

```typescript
const loadPdf = useCallback(async () => {
  if (!data.gizmoFormUrl) {
    setError("No PDF template URL provided");
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setError(null);

    // External URLs go through proxy to avoid CORS. Local paths served directly.
    const fetchUrl = data.gizmoFormUrl.startsWith("/")
      ? data.gizmoFormUrl
      : `/api/forms/proxy-pdf?url=${encodeURIComponent(data.gizmoFormUrl)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error("Failed to fetch PDF template");

    const originalBytes = await response.arrayBuffer();
    const bytes = originalBytes.slice(0);   // RULE 2: slice before storing
    setPdfBytes(bytes);

    // Load with pdfjs for canvas rendering — MUST slice
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes.slice(0)) }).promise;
    setPdfDoc(pdf);
    setTotalPages(pdf.numPages);

    // Load with pdf-lib to check for AcroForm fields — MUST slice
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

        // Fill editable copy
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

        // RULE 3: Create SEPARATE flattened copy for preview
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

        // Save editable bytes for download/print
        const editableBytes = await pdfLibDoc.save();
        const editableBuffer = editableBytes.buffer as ArrayBuffer;
        setPdfBytes(editableBuffer.slice(0));

        // Render flattened preview to canvas
        const filledPdf = await pdfjsLib.getDocument({ data: new Uint8Array(previewBuffer.slice(0)) }).promise;
        setPdfDoc(filledPdf);
        setLoading(false);
        return;
      }
    }

    // No AcroForm fields matched — fall through to Placeholder mode
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
```

---

## Exact Canvas Rendering (With Retry for Dialog Animation)

When GizmoForm is inside a dialog, the canvas element may not be mounted yet when the dialog is still animating open. This retry loop prevents a crash:

```typescript
const renderPage = useCallback(async () => {
  if (!pdfDoc) return;

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

    await page.render({ canvasContext: ctx, viewport }).promise;
  };

  await tryRender();
}, [pdfDoc, currentPage, scale]);

useEffect(() => {
  renderPage();
}, [renderPage]);
```

Without the retry, opening GizmoForm inside a Shadcn Dialog will crash because `canvasRef.current` is null during the opening animation.

---

## Exact Placeholder Extraction (Three-Pass Radio Detection)

This is the function that scans the PDF text layer for `{token}` placeholders and `{radio_id_N}` tokens. The three-pass approach handles PDFs where the radio tokens get split across multiple text items.

```typescript
const extractPlaceholdersFromPdf = async (pdf: pdfjsLib.PDFDocumentProxy) => {
  const fields: PlaceholderField[] = [];
  const radios: RadioField[] = [];

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

    // Group text items into lines (within 3px vertical tolerance)
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

    for (const line of lines) {
      line.sort((a, b) => a.transform[4] - b.transform[4]);
      const fullText = line.map((i) => i.str).join("");

      // PASS 1: Find {token} placeholders on joined line text
      const placeholderRegex = /\{([a-zA-Z]+)\}/g;
      let match;
      while ((match = placeholderRegex.exec(fullText)) !== null) {
        const token = match[0];
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

            // Look for a label item to the left (within 15px gap)
            let labelItem: TextItem | null = null;
            for (let li = line.indexOf(anchorItem) - 1; li >= 0; li--) {
              const candidate = line[li];
              if (anchorItem.transform[4] - (candidate.transform[4] + candidate.width) < 15) {
                labelItem = candidate;
                break;
              }
            }

            const anchorX = labelItem ? labelItem.transform[4] : x;
            const nextFieldOnLine = fields.filter(
              (f) => f.pageIndex === pageNum - 1 && Math.abs(f.y - y) < 3 && f.x > anchorX
            );
            const nextX = nextFieldOnLine.length > 0 ? Math.min(...nextFieldOnLine.map((f) => f.x)) : null;
            const fieldWidth = nextX ? nextX - anchorX - 8 : viewport.width - anchorX - 20;

            fields.push({
              token,
              key: mapping.key,
              source: mapping.source,
              dataKey: mapping.key,
              x: anchorX + offsets.x,
              y: viewport.height - y + offsets.y,
              width: Math.max(fieldWidth, 60),
              pageIndex: pageNum - 1,
              value: resolveValue(mapping.source, mapping.key, data),
            });
          }
        }
      }

      // PASS 1 (radios): Find {radio_GROUP_OPTION} on joined line text
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
          const x = anchorItem.transform[4] + offsets.x;
          const y = viewport.height - anchorItem.transform[5] + offsets.y;
          const fontSize = anchorItem.height || 12;

          let selected = false;
          const autoFill = RADIO_AUTO_FILL[group];
          if (autoFill) {
            const patientVal = data.patientData[autoFill.sourceField] || "";
            const expectedOption = autoFill.valueMap[patientVal];
            if (expectedOption === option) {
              selected = true;
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

    // PASS 2: Combined radio tokens in single text items
    const radioItemRegex = /^[{\s]*radio\s*$/i;
    const idItemRegex = /^[_\s]*id[_\s]*(\d{1,2})\s*\}?\s*$/i;
    const combinedRadioRegex = /\{?\s*radio\s*_?\s*id\s*_?\s*(\d{1,2})\s*\}?/i;
    const seenRadioOptions = new Set(radios.filter(r => r.pageIndex === pageNum - 1).map(r => r.option));

    const addRadioFromItem = (option: string, itemX: number, itemY: number, itemHeight: number) => {
      if (seenRadioOptions.has(option)) return;
      seenRadioOptions.add(option);

      const group = getRadioGroup(option);
      const x = itemX + offsets.x;
      const y = viewport.height - itemY + offsets.y;
      const fontSize = itemHeight || 12;

      let selected = false;
      const autoFill = RADIO_AUTO_FILL[group];
      if (autoFill) {
        const patientVal = data.patientData[autoFill.sourceField] || "";
        const expectedOption = autoFill.valueMap[patientVal];
        if (expectedOption === option) {
          selected = true;
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

    // PASS 3: Split across items — find "radio" item + nearby "_id_N" item
    const radioOnlyRegex = /^\{?\s*radio\s*$/i;  // matches standalone "{radio" or "radio" text items
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
```

---

## Radio Button Groups and Auto-Fill

```typescript
function getRadioGroup(option: string): string {
  const num = parseInt(option, 10);
  if (num >= 1 && num <= 3) return "placardtype";
  if (num >= 4 && num <= 5) return "placardcount";
  if (num >= 7 && num <= 14) return "condition";
  if (num >= 15 && num <= 16) return "duration";
  return "other";
}

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
  condition: {
    sourceField: "disabilityCondition",
    valueMap: {
      A: "7",
      B: "8",
      C: "9",
      D: "10",
      E: "11",
      F: "12",
      G: "13",
      H: "14",
    },
  },
};
```

---

## Exact State Update Functions

```typescript
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
```

---

## Exact Download Function

```typescript
function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const handleDownload = async () => {
  if (!pdfBytes) return;

  try {
    setDownloading(true);
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const pdfLibDoc = await PDFDocument.load(pdfBytes.slice(0));  // RULE 2: slice
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

      // Radio buttons rendered as filled black squares
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
```

---

## Exact Print Function

```typescript
const handlePrint = async () => {
  if (!pdfBytes) return;
  try {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const pdfLibDoc = await PDFDocument.load(pdfBytes.slice(0));  // RULE 2: slice
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
```

---

## Exact JSX Rendering

### Toolbar

```tsx
<div className="flex items-center justify-between flex-wrap gap-2">
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
    <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>
      <ZoomOut className="h-4 w-4" />
    </Button>
    <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
    <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(3, s + 0.25))}>
      <ZoomIn className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-1" /> Print
    </Button>
    <Button size="sm" onClick={handleDownload} disabled={downloading}>
      {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
      Download PDF
    </Button>
  </div>
</div>
```

### Canvas + Overlay Fields

```tsx
<div className="flex gap-4">
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
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )}
</div>
```

The `bg-white` on the canvas container is important — without it, the canvas has a transparent background and the PDF looks broken on dark mode.

### Page Navigation (Multi-Page PDFs)

```tsx
// Computed before the return:
const pageFields = placeholderFields.filter((f) => f.pageIndex === currentPage - 1);
const pageRadios = radioFields.filter((r) => r.pageIndex === currentPage - 1);

// In JSX:
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
      disabled={currentPage <= 1}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span className="text-sm text-muted-foreground">
      Page {currentPage} of {totalPages}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
      disabled={currentPage >= totalPages}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
)}
```

---

## Server Endpoints — Exact Code

### PDF Proxy (CORS workaround)

```typescript
app.get("/api/forms/proxy-pdf", async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ message: "url query parameter required" });
      return;
    }
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ message: "Failed to fetch PDF from source URL" });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error("PDF proxy error:", error);
    res.status(500).json({ message: "Failed to proxy PDF" });
  }
});
```

### Form Data Assembly

```typescript
app.get("/api/forms/data/:applicationId", requireAuth, async (req, res) => {
  try {
    const application = await storage.getApplication(req.params.applicationId);
    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (application.userId !== req.user!.id && req.user!.userLevel < 3) {
      res.status(403).json({ message: "Not authorized" });
      return;
    }

    const patient = application.userId ? await storage.getUser(application.userId) : null;
    const formData = (application.formData || {}) as Record<string, any>;

    let doctorProfile: any = null;
    let gizmoFormUrl: string | null = null;

    if (application.assignedReviewerId) {
      doctorProfile = await storage.getDoctorProfileByUserId(application.assignedReviewerId);
      gizmoFormUrl = doctorProfile?.gizmoFormUrl || null;
    }

    const pkg = application.packageId ? await storage.getPackage(application.packageId) : null;

    const now = new Date();
    const generatedDate = now.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });

    const patientData: Record<string, string> = {
      firstName: patient?.firstName || formData.firstName || "",
      middleName: patient?.middleName || formData.middleName || "",
      lastName: patient?.lastName || formData.lastName || "",
      suffix: formData.suffix || "",
      dateOfBirth: patient?.dateOfBirth || formData.dateOfBirth || "",
      address: patient?.address || formData.address || "",
      apt: formData.apt || "",
      city: patient?.city || formData.city || "",
      state: patient?.state || formData.state || "",
      zipCode: patient?.zipCode || formData.zipCode || "",
      phone: patient?.phone || formData.phone || "",
      email: patient?.email || formData.email || "",
      medicalCondition: formData.medicalCondition || patient?.medicalCondition || "",
      idNumber: formData.driverLicenseNumber || patient?.driverLicenseNumber || "",
      driverLicenseNumber: formData.driverLicenseNumber || patient?.driverLicenseNumber || "",
      idExpirationDate: formData.idExpirationDate || "",
      idType: formData.idType || "",
      disabilityCondition: formData.disabilityCondition || "",
    };

    const doctorData: Record<string, string> = {
      firstName: doctorProfile?.fullName?.split(" ")[0] || "",
      middleName: "",
      lastName: doctorProfile?.fullName?.split(" ").slice(1).join(" ") || "",
      phone: doctorProfile?.phone || "",
      address: doctorProfile?.address || "",
      city: "",
      state: doctorProfile?.state || "",
      zipCode: "",
      licenseNumber: doctorProfile?.licenseNumber || "",
      npiNumber: doctorProfile?.npiNumber || "",
    };

    const result: any = {
      success: true,
      patientData,
      doctorData,
      gizmoFormUrl,
      generatedDate,
      patientName: `${patientData.firstName} ${patientData.lastName}`.trim(),
      applicationId: application.id,
      packageName: pkg?.name || "Service",
    };

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

### PDF Upload Endpoint

```typescript
app.post("/api/admin/doctor-templates/:doctorProfileId/gizmo-form", requireAuth, requireLevel(3), (req, res, next) => {
  documentUpload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "File size must be under 20MB" });
        return;
      }
      res.status(400).json({ message: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ message: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    try {
      const doctorProfileId = req.params.doctorProfileId as string;
      const profile = await storage.getDoctorProfile(doctorProfileId);
      if (!profile) {
        res.status(404).json({ message: "Doctor profile not found" });
        return;
      }

      const bucket = firebaseStorage.bucket();
      const uniqueSuffix = Date.now() + "-" + randomBytes(4).toString("hex");
      const fileName = `doctor-gizmo-forms/${doctorProfileId}/${uniqueSuffix}.pdf`;
      const file = bucket.file(fileName);

      await file.save(req.file.buffer, {
        metadata: { contentType: "application/pdf" },
      });

      await file.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      await storage.updateDoctorProfile(doctorProfileId, { gizmoFormUrl: url });

      res.json({ url });
    } catch (error: any) {
      console.error("Gizmo form upload error:", error);
      res.status(500).json({ message: "Failed to upload PDF form" });
    }
  });
});
```

---

## Key Files

| File | Purpose |
|------|---------|
| `client/src/components/GizmoForm.tsx` | The main component — all code above lives here |
| `server/routes.ts` | Upload, proxy, and form data endpoints |
| `client/src/pages/dashboard/applicant/FormViewerPage.tsx` | Applicant page that loads data and renders GizmoForm |
| `client/src/components/shared/UserProfileModal.tsx` | Admin preview dialog for doctor's PDF template |
