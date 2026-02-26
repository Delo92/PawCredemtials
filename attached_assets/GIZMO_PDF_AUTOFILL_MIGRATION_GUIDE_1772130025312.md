# Gizmo PDF Auto-Fill System — Complete Migration Guide

Copy-paste this system into any project to get browser-side PDF auto-fill working. No server-side PDF generation. The PDF template is fetched, filled, and downloaded entirely in the browser.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Required Dependencies](#required-dependencies)
3. [Server-Side Setup](#server-side-setup)
4. [Frontend Component (GizmoForm.tsx)](#frontend-component)
5. [Data Structure](#data-structure)
6. [Mode Detection — The Critical Fix](#mode-detection)
7. [Placeholder Token Positioning — The Width Fix](#placeholder-positioning)
8. [Radio Buttons](#radio-buttons)
9. [Preparing a PDF Template](#preparing-a-pdf-template)
10. [Common Pitfalls](#common-pitfalls)

---

## How It Works

The system auto-detects which kind of PDF template was uploaded and picks the fill strategy:

| Mode | Trigger | How it fills |
|------|---------|-------------|
| **Placeholder** (preferred) | PDF text layer contains `{token}` strings like `{firstName}`, `{city}` | Scans text layer via pdfjs-dist, overlays `<input>` elements at exact token coordinates |
| **AcroForm** (fallback) | PDF has interactive form fields (text boxes from Adobe Acrobat) AND no placeholder tokens | Uses pdf-lib's form API to set field values, then flattens on download |

**CRITICAL**: Placeholder mode is checked FIRST. If `{token}` patterns exist anywhere in the PDF text layer, the system uses placeholder mode regardless of whether AcroForm fields also exist. This is the key fix that makes it work for PDFs that have both.

---

## Required Dependencies

```bash
npm install pdf-lib pdfjs-dist
```

### Versions tested
- `pdf-lib` ^1.17.1
- `pdfjs-dist` ^5.4.624

### Vite worker setup

The pdfjs worker must be imported as a URL for Vite:

```ts
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

---

## Server-Side Setup

You need two server endpoints. Both are simple Express routes.

### 1. Proxy PDF endpoint (required — avoids CORS)

PDFs hosted on external URLs (Firebase Storage, S3, CDN) will be blocked by CORS if fetched directly from the browser. This proxy fetches the PDF server-side and streams the bytes back.

```ts
// server/routes.ts
app.get("/api/forms/proxy-pdf", async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ message: "url query parameter required" });
      return;
    }
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ message: "Failed to fetch PDF from source" });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ message: "Proxy fetch failed" });
  }
});
```

### 2. Form data endpoint (returns patient + doctor data + PDF URL)

This endpoint assembles the data object the frontend component needs. Adapt the field names to match your database schema.

```ts
app.get("/api/forms/data/:applicationId", requireAuth, async (req, res) => {
  try {
    const application = await storage.getApplication(req.params.applicationId);
    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    // Authorization check
    if (application.userId !== req.user!.id && req.user!.userLevel < 3) {
      res.status(403).json({ message: "Not authorized" });
      return;
    }

    const patient = application.userId
      ? await storage.getUser(application.userId)
      : null;
    const formData = application.formData || {};

    // Look up assigned doctor's profile for their PDF template URL
    const doctorId = application.assignedReviewerId || application.assignedAgentId;
    let doctorProfile: Record<string, any> | null = null;
    if (doctorId) {
      doctorProfile = (await storage.getDoctorProfileByUserId(doctorId)) || null;
    }

    // Assemble patient data — pull from user record first, fall back to form submission
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
      medicalCondition: patient?.medicalCondition || formData.medicalCondition || "",
      idNumber: patient?.driverLicenseNumber || formData.driverLicenseNumber || formData.idNumber || "",
      driverLicenseNumber: patient?.driverLicenseNumber || formData.driverLicenseNumber || "",
      idExpirationDate: formData.idExpirationDate || "",
      idType: formData.idType || "",
    };

    // Assemble doctor data from their profile
    const nameParts = (doctorProfile?.fullName || "").split(" ").filter(Boolean);
    const doctorData: Record<string, string> = {
      firstName: nameParts[0] || "",
      middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "",
      lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
      phone: doctorProfile?.phone || "",
      address: doctorProfile?.address || "",
      city: doctorProfile?.city || "",
      state: doctorProfile?.state || "",
      zipCode: doctorProfile?.zipCode || "",
      licenseNumber: doctorProfile?.licenseNumber || "",
      npiNumber: doctorProfile?.npiNumber || "",
    };

    res.json({
      success: true,
      patientData,
      doctorData,
      gizmoFormUrl: doctorProfile?.gizmoFormUrl || null,
      generatedDate: new Date().toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }),
      patientName: [patient?.firstName, patient?.middleName, patient?.lastName]
        .filter(Boolean)
        .join(" ") || "Patient",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### 3. PDF template upload endpoint (optional — for admin UI)

If you want admins to upload PDF templates per doctor, use multer with a 20MB PDF limit and store the file in Firebase Storage (or S3, or anywhere that returns a public URL).

```ts
import multer from "multer";

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

app.post("/api/admin/doctor-templates/:doctorProfileId/gizmo-form",
  requireAuth, requireLevel(3),
  (req, res, next) => {
    documentUpload.single("file")(req, res, async (err) => {
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      try {
        const doctorProfileId = req.params.doctorProfileId;

        // Upload to Firebase Storage (adapt to your storage provider)
        const bucket = firebaseStorage.bucket();
        const uniqueSuffix = Date.now() + "-" + randomBytes(4).toString("hex");
        const fileName = `doctor-gizmo-forms/${doctorProfileId}/${uniqueSuffix}.pdf`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
          metadata: { contentType: "application/pdf" },
        });
        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // Save URL to doctor profile
        await storage.updateDoctorProfile(doctorProfileId, { gizmoFormUrl: url });
        res.json({ url });
      } catch (error: any) {
        res.status(500).json({ message: "Failed to upload PDF form" });
      }
    });
  }
);
```

---

## Frontend Component

The complete `GizmoForm.tsx` component. Copy this file as-is. The only things you may need to change are the UI component imports (Button, Input, Card, Badge) to match your component library.

### Required UI imports

The component uses these shadcn/ui components. Replace with your equivalents:
- `Button` — any button component
- `Input` — any text input component
- `Card`, `CardContent`, `CardHeader`, `CardTitle` — any card component (only used for AcroForm sidebar)
- `Badge` — any badge/tag component
- `useToast` — any toast notification hook

### Component props

```ts
interface GizmoFormProps {
  data: GizmoFormData;   // The data object from your /api/forms/data endpoint
  onClose?: () => void;  // Optional callback when user clicks "Back"
}
```

### How to call it

```tsx
// Fetch the data from your API
const { data } = useQuery({
  queryKey: ['/api/forms/data', applicationId],
});

// Render the component
{data && <GizmoForm data={data} onClose={() => setShowForm(false)} />}
```

### The complete GizmoForm.tsx file

Copy the entire file from `client/src/components/shared/GizmoForm.tsx` in this project. The file is ~900 lines. Here is the exact architecture inside:

#### Constants (lines 1-150)

```ts
// 1. FIELD_NAME_MAP — maps normalized AcroForm field names to data keys
//    Used only in AcroForm mode. Key = lowercased, stripped of non-alphanumeric.
//    Example: PDF field "First Name" → normalized "firstname" → maps to patientData.firstName
const FIELD_NAME_MAP: Record<string, { source: "patient" | "doctor" | "meta"; key: string }> = {
  firstname: { source: "patient", key: "firstName" },
  middlename: { source: "patient", key: "middleName" },
  lastname: { source: "patient", key: "lastName" },
  // ... full list in source file
};

// 2. PLACEHOLDER_MAP — maps {token} strings to data keys
//    Used in placeholder mode. Key = exact token including braces.
const PLACEHOLDER_MAP: Record<string, { source: "patient" | "doctor" | "meta"; key: string }> = {
  "{firstName}": { source: "patient", key: "firstName" },
  "{middleName}": { source: "patient", key: "middleName" },
  "{lastName}": { source: "patient", key: "lastName" },
  // ... full list in source file
};

// 3. DOCTOR_FORM_OFFSETS — per-doctor pixel corrections for misaligned templates
//    Key = doctor's last name lowercased. If not found, defaults to {x:0, y:0}.
const DOCTOR_FORM_OFFSETS: Record<string, { x: number; y: number }> = {};

// 4. RADIO_AUTO_FILL — maps patient data values to radio button selections
//    defaultOption: which option to pre-select when no patient data exists
const RADIO_AUTO_FILL: Record<string, {
  sourceField: string;
  valueMap: Record<string, string>;
  defaultOption?: string;
}> = {
  condition: {
    sourceField: "disabilityCondition",
    defaultOption: "7",
    valueMap: { A: "7", B: "8", C: "9", D: "10", E: "11", F: "12", G: "13", H: "14" },
  },
};

// 5. getRadioGroup — assigns numbered radio options to named groups
//    This is form-specific. Change the number ranges to match your PDF's radio layout.
function getRadioGroup(option: string): string {
  const num = parseInt(option, 10);
  if (num >= 1 && num <= 3) return "placardtype";
  if (num >= 4 && num <= 5) return "placardcount";
  if (num >= 7 && num <= 14) return "condition";
  if (num >= 15 && num <= 16) return "duration";
  return "other";
}
```

#### Key functions

**`checkForPlaceholderTokens(pdf)`** — Fast pre-scan that determines mode

This function scans the PDF text layer for ANY known `{token}` pattern. If found, returns `true` and the system uses placeholder mode. This runs BEFORE AcroForm detection. This is the critical fix — without it, PDFs that have both AcroForm fields AND placeholder tokens would incorrectly enter AcroForm mode and leave fields empty.

```ts
async function checkForPlaceholderTokens(pdf: pdfjsLib.PDFDocumentProxy): Promise<boolean> {
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const allText = textContent.items
      .filter((item): item is { str: string } => "str" in item)
      .map((item) => item.str)
      .join("");

    // Check for known placeholder tokens (closing brace optional — some PDFs split tokens)
    if (/\{(firstName|lastName|middleName|dateOfBirth|address|city|state|zipCode|zip|phone|email|date|driverLicenseNumber|medicalCondition|idNumber|suffix|apt)\}?/i.test(allText)) {
      return true;
    }
    // Check for radio tokens (may be split across text items)
    if (/\{radio[_\s]/i.test(allText) || /radio\s*_?\s*id/i.test(allText)) {
      return true;
    }
  }
  return false;
}
```

**`extractPlaceholdersFromPdf(pdf)`** — Finds token positions and calculates field widths

This is the main extraction logic. Critical details:

1. **Groups text items into horizontal lines** (items within 3 PDF units of the same Y coordinate)
2. **Joins each line's text** and scans for `{tokenName}` with regex `/\{([a-zA-Z]+)\}?/g` (closing brace optional)
3. **Collects token positions into `pendingFields` array** — does NOT calculate widths yet
4. **After ALL tokens on the page are found**, calculates widths by measuring distance to the next token on the same line

The two-pass approach (collect positions first, then calculate widths) is the fix for the field-overlap bug. The old code calculated widths during collection, which meant it would try to anchor fields to nearby labels and stretch them across neighboring fields.

```ts
// Width calculation (happens AFTER all tokens are collected):
for (const pf of pendingFields) {
  // Find the next token to the RIGHT on the same line
  const sameLine = pendingFields.filter(
    (other) => other.pageIndex === pf.pageIndex
      && Math.abs(other.y - pf.y) < 3
      && other.x > pf.x
  );
  const nextX = sameLine.length > 0 ? Math.min(...sameLine.map((f) => f.x)) : null;
  // Width = gap to next token (minus 5px padding), or remaining page width
  const fieldWidth = nextX ? nextX - pf.x - 5 : viewport.width - pf.x - 20;

  fields.push({
    x: pf.x + offsets.x,
    y: viewport.height - pf.y + offsets.y,   // PDF Y is bottom-up, canvas Y is top-down
    width: Math.max(fieldWidth, 40),          // minimum 40px wide
    // ...
  });
}
```

**Three-pass radio detection** — Handles split `{radio_id_N}` tokens

PDF text extractors often split radio tokens across multiple text items. For example, `{radio_id_7}` might appear as three separate items: `{radio`, `_id_`, `7}`. The system handles this with three passes:

1. **Pass 1 (in line loop)**: Full regex match `{radio_group_option}` on joined line text
2. **Pass 2 (item scan)**: Individual items matching combined pattern `radio_id_N` or just `_id_N`
3. **Pass 3 (proximity scan)**: Finds a `{radio` item and a nearby `_id_N` item within 60px horizontal / 20px vertical distance, combines them

All three passes use a `seenRadioOptions` set to prevent duplicates.

**`loadPdf()`** — The mode detection and loading sequence

```
1. Fetch PDF bytes via proxy endpoint
2. Parse with pdfjs-dist (for text layer reading)
3. checkForPlaceholderTokens(pdf)
4. IF placeholders found → placeholder mode → extractPlaceholdersFromPdf → DONE
5. ELSE → try AcroForm with pdf-lib
6. IF AcroForm fields match FIELD_NAME_MAP → acroform mode → fill + flatten → DONE
7. ELSE → fallback to placeholder mode anyway
```

**Canvas retry loop** — Prevents null canvas crash in dialogs

When the component is rendered inside a dialog/modal, the canvas element may not be mounted yet. The render function retries up to 5 times with 100ms delays:

```ts
const tryRender = async (retries = 5): Promise<void> => {
  const canvas = canvasRef.current;
  if (!canvas) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 100));
      return tryRender(retries - 1);
    }
    return;
  }
  // ... render page
};
```

**ArrayBuffer `.slice(0)` rule** — Prevents detached buffer crashes

Every time you pass an ArrayBuffer to `pdfjsLib.getDocument()` or `PDFDocument.load()`, the buffer gets transferred/detached. Always `.slice(0)` to create a copy first:

```ts
// CORRECT:
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes.slice(0)) }).promise;
const pdfLibDoc = await PDFDocument.load(originalBytes.slice(0));

// WRONG (will crash on second use):
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes) }).promise;
```

---

## Data Structure

### `GizmoFormData` — what the component expects

```ts
interface GizmoFormData {
  success: boolean;
  patientData: Record<string, string>;   // patient fields
  doctorData: Record<string, string>;    // doctor fields
  gizmoFormUrl: string | null;           // URL to the PDF template
  generatedDate: string;                 // today's date (MM/DD/YYYY)
  patientName: string;                   // display name (not used for filling)
}
```

### `patientData` keys

| Key | Description |
|-----|-------------|
| `firstName` | First name |
| `middleName` | Middle name |
| `lastName` | Last name |
| `suffix` | Name suffix (Jr, Sr) |
| `dateOfBirth` | DOB — auto-formatted from `YYYY-MM-DD` to `MM/DD/YYYY` |
| `address` | Street address |
| `apt` | Apt/unit number |
| `city` | City |
| `state` | State abbreviation |
| `zipCode` | ZIP code |
| `phone` | Phone number |
| `email` | Email |
| `medicalCondition` | Qualifying condition |
| `idNumber` | Government ID number |
| `driverLicenseNumber` | Driver license number |
| `idExpirationDate` | ID expiration date |
| `idType` | ID type (for radio auto-fill) |
| `disabilityCondition` | Disability condition letter A-H (for radio auto-fill) |

### `doctorData` keys

| Key | Description |
|-----|-------------|
| `firstName` | Doctor first name |
| `middleName` | Doctor middle name |
| `lastName` | Doctor last name |
| `phone` | Doctor phone |
| `address` | Doctor address |
| `city` | Doctor city |
| `state` | Doctor state |
| `zipCode` | Doctor ZIP |
| `licenseNumber` | Medical license number |
| `npiNumber` | NPI number |

---

## Mode Detection

### The problem that was fixed

Many PDFs have BOTH AcroForm fields (interactive text boxes from Adobe Acrobat) AND `{placeholder}` tokens in the text layer. The old code checked for AcroForm fields first. If even ONE AcroForm field name matched the `FIELD_NAME_MAP`, it entered AcroForm mode and completely skipped placeholder detection. But AcroForm field names are often different from what the map expects (e.g., "Mailing Address" instead of "Address", "ST" instead of "State"), so most fields ended up empty.

### The fix

Check for placeholder tokens FIRST by scanning the PDF text layer. If ANY `{token}` pattern is found, use placeholder mode regardless of AcroForm fields.

```ts
// In loadPdf():
const hasPlaceholders = await checkForPlaceholderTokens(pdf);

if (hasPlaceholders) {
  setMode("placeholder");
  await extractPlaceholdersFromPdf(pdf);
  setLoading(false);
  return;   // <-- STOPS HERE. Never checks AcroForm.
}

// Only reaches here if NO placeholder tokens were found
// Then try AcroForm detection...
```

---

## Placeholder Positioning

### The problem that was fixed

The old code used a "label anchor" strategy: for each `{token}`, it looked for a label text item to the LEFT and anchored the input field to the label's X position. This caused fields to overlap because `{firstName}` would anchor to the "First Name" label (far left) and stretch all the way to where `{middleName}` started.

### The fix — two-pass width calculation

1. **Pass 1**: Scan all lines, collect every `{token}` position into a `pendingFields` array. Record only the token's own X/Y position (where the `{` character appears in the text).

2. **Pass 2**: After ALL tokens are collected, calculate each field's width by measuring the distance to the NEXT token on the same line:

```
Field width = nextTokenX - thisTokenX - 5px padding
```

If there's no next token on the line, the field extends to the right margin:

```
Field width = pageWidth - thisTokenX - 20px padding
```

Minimum width is 40px to prevent zero-width fields.

This way, each field is sized to exactly fit between its token position and the next token — no overlap.

---

## Radio Buttons

### Token syntax in the PDF

Place radio tokens directly in the PDF text where you want the radio button to appear:

```
{radio_id_7}     ← renders as a clickable radio at this position
{radio_id_8}     ← same group (determined by getRadioGroup), only one selected
```

The token format is: `{radio_groupName_optionValue}` or `{radio_id_N}` where N is a number.

### Radio groups

The `getRadioGroup()` function assigns numbered options to named groups. Only one option per group can be selected. Customize the number ranges for your form:

```ts
function getRadioGroup(option: string): string {
  const num = parseInt(option, 10);
  if (num >= 1 && num <= 3) return "placardtype";
  if (num >= 7 && num <= 14) return "condition";
  if (num >= 15 && num <= 16) return "duration";
  return "other";
}
```

### Auto-fill from patient data

The `RADIO_AUTO_FILL` config maps patient data values to radio options:

```ts
const RADIO_AUTO_FILL = {
  condition: {
    sourceField: "disabilityCondition",   // patientData key to check
    defaultOption: "7",                   // pre-select this if no patient data
    valueMap: {
      A: "7",   // if patientData.disabilityCondition === "A", select option 7
      B: "8",
      // ...
    },
  },
};
```

### Default selection

If `defaultOption` is set and the patient has no value for `sourceField`, that option is pre-selected. The user can still click a different option to change it.

### How radios render on download

Selected radios draw a filled black rectangle at the token's coordinates in the downloaded PDF. Unselected radios draw nothing.

---

## Preparing a PDF Template

### For Placeholder mode (recommended)

1. Open your PDF in any editor (Word, Google Docs, Canva, etc.)
2. Type the `{token}` strings directly where you want data to appear:
   ```
   First Name: {firstName}    Middle: {middleName}    Last: {lastName}
   Address: {address}    City: {city}    State: {state}    Zip: {zipCode}
   ```
3. For radio buttons, type the radio tokens where you want the checkboxes:
   ```
   {radio_id_7} A. Cannot walk 200 feet
   {radio_id_8} B. Cannot walk without assistance
   ```
4. Export as PDF
5. Upload via the admin template upload endpoint

The token text MUST appear in the PDF's text layer (not as an image). If you created the PDF from a text editor or word processor, it will be in the text layer automatically.

### For AcroForm mode

1. Create the PDF with interactive form fields using Adobe Acrobat, LibreOffice, or similar
2. Name each field so that when lowercased and stripped of non-alphanumeric characters, it matches a key in `FIELD_NAME_MAP`
3. Example: A field named "First Name" normalizes to `firstname` which maps to `patientData.firstName`

---

## Common Pitfalls

### 1. PDF has both AcroForm fields AND placeholder tokens
**Symptom**: Fields show up as empty blue boxes instead of filled values.
**Cause**: Old code entered AcroForm mode first and skipped placeholder detection.
**Fix**: The `checkForPlaceholderTokens()` pre-scan ensures placeholder mode is used when tokens exist.

### 2. Fields overlap or are sized wrong
**Symptom**: firstName input stretches across middleName and lastName boxes.
**Cause**: Old code anchored fields to nearby label positions and calculated widths before all tokens were found.
**Fix**: Two-pass approach — collect all token positions first, then calculate widths based on distance to next token.

### 3. Radio tokens split across text items
**Symptom**: Radio buttons not detected. `{radio_id_7}` appears as separate text items `{radio`, `_id_`, `7}`.
**Fix**: Three-pass radio detection (full regex on joined line, individual item scan, proximity scan for split items).

### 4. Detached ArrayBuffer crash
**Symptom**: Error on second PDF operation: "Cannot perform Construct on a detached ArrayBuffer".
**Fix**: Always `.slice(0)` before passing ArrayBuffer to `pdfjsLib.getDocument()` or `PDFDocument.load()`.

### 5. Canvas is null in dialog/modal
**Symptom**: PDF doesn't render when component is inside a dialog that animates open.
**Fix**: Retry loop (5 attempts, 100ms delay) for canvas rendering.

### 6. Placeholder regex misses tokens with missing closing brace
**Symptom**: `{driverLicenseNumber` without `}` is not detected.
**Fix**: Regex uses `\}?` (optional closing brace): `/\{([a-zA-Z]+)\}?/g`. The token is reconstructed with braces for lookup: `` `{${match[1]}}` ``.

---

## Adding New Fields

To add a new placeholder token (e.g., `{ssn}`):

1. Add to `PLACEHOLDER_MAP`:
   ```ts
   "{ssn}": { source: "patient", key: "ssn" },
   ```

2. Add to `FIELD_NAME_MAP` (for AcroForm fallback):
   ```ts
   ssn: { source: "patient", key: "ssn" },
   socialsecuritynumber: { source: "patient", key: "ssn" },
   ```

3. Add to `checkForPlaceholderTokens` regex:
   ```ts
   /\{(firstName|lastName|...|ssn)\}?/i
   ```

4. Make sure your data endpoint includes `ssn` in `patientData`.

5. Put `{ssn}` in your PDF template where you want it filled.

No other code changes needed.

---

## Adding New Radio Groups

To add a new radio group (e.g., gender selection):

1. Add radio tokens to your PDF:
   ```
   {radio_gender_male} Male    {radio_gender_female} Female    {radio_gender_other} Other
   ```

2. Add to `RADIO_AUTO_FILL` (optional — for auto-selection from patient data):
   ```ts
   gender: {
     sourceField: "gender",
     defaultOption: "male",
     valueMap: {
       male: "male",
       female: "female",
       other: "other",
     },
   },
   ```

3. If using numbered `{radio_id_N}` format, update `getRadioGroup()` to assign the numbers to your group name.

---

## File Download Naming

Downloaded PDFs are named automatically:

```
{firstName}_{lastName}_Physician_Recommendation_MM-DD-YYYY.pdf
```

Special characters in names are replaced with underscores. Change the `handleDownload` function to customize the filename pattern.
