# Gizmo PDF Auto-Fill System

How the PDF auto-fill system works for handicap parking permit applications. This guide covers everything needed to replicate it in another project.

---

## Overview

The system takes a PDF form template uploaded per doctor, detects its field structure, and auto-fills it with patient and doctor data. It runs entirely in the browser using two libraries:

- **pdf-lib** - Writes data into PDF fields, flattens forms for download
- **pdfjs-dist** - Renders the PDF to a canvas for on-screen preview, and scans the text layer to find placeholder tokens

The system supports two modes, chosen automatically based on what it finds in the PDF:

1. **AcroForm Mode** - For PDFs with interactive form fields (text inputs built into the PDF)
2. **Placeholder Mode** - For flat PDFs that have text tokens like `{firstName}` printed in the document

---

## Required npm Packages

```
pdf-lib
pdfjs-dist
```

### pdfjs-dist Worker Setup (Vite)

The PDF.js worker must be loaded locally, not from a CDN. Import it using Vite's `?url` suffix:

```typescript
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

### ArrayBuffer Rule

Always `.slice(0)` any ArrayBuffer before passing it to `pdfjsLib.getDocument()` or `PDFDocument.load()`. These libraries transfer ownership of the buffer, which detaches it and causes errors if you try to reuse it.

```typescript
const originalBytes = await response.arrayBuffer();
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalBytes.slice(0)) }).promise;
const pdfLibDoc = await PDFDocument.load(originalBytes.slice(0));
```

---

## How It Decides Which Mode to Use

When the PDF loads:

1. Load the PDF with `pdf-lib` and call `form.getFields()`
2. If there are interactive fields AND at least one field name matches the field name map (after normalization), use **AcroForm Mode**
3. Otherwise, fall through to **Placeholder Mode** and scan the text layer for `{token}` patterns

---

## AcroForm Mode

For PDFs with built-in interactive text fields (like fillable government forms created in Adobe).

### How Field Matching Works

Every field name from the PDF is **normalized** by lowercasing and stripping all non-alphanumeric characters:

```typescript
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
```

Examples:
- `"First Name"` becomes `"firstname"`
- `"Driver License/State Identification Card Number"` becomes `"driverlicensestateidentificationcardnumber"`
- `"doctor_phone"` becomes `"doctorphone"`

The normalized name is looked up in `FIELD_NAME_MAP` to find what data to fill in.

### FIELD_NAME_MAP (AcroForm field matching)

This maps normalized PDF field names to data sources. Each entry says where to pull the value from (`patient`, `doctor`, or `meta`) and which key to use.

```typescript
const FIELD_NAME_MAP = {
  // Patient fields
  firstname:        { source: "patient", key: "firstName" },
  middlename:       { source: "patient", key: "middleName" },
  lastname:         { source: "patient", key: "lastName" },
  suffix:           { source: "patient", key: "suffix" },
  dateofbirth:      { source: "patient", key: "dateOfBirth" },
  dob:              { source: "patient", key: "dateOfBirth" },
  address:          { source: "patient", key: "address" },
  apt:              { source: "patient", key: "apt" },
  city:             { source: "patient", key: "city" },
  state:            { source: "patient", key: "state" },
  zipcode:          { source: "patient", key: "zipCode" },
  zip:              { source: "patient", key: "zipCode" },
  phone:            { source: "patient", key: "phone" },
  email:            { source: "patient", key: "email" },
  medicalcondition: { source: "patient", key: "medicalCondition" },
  idnumber:         { source: "patient", key: "idNumber" },
  driverlicensenumber: { source: "patient", key: "driverLicenseNumber" },
  driverlicense:    { source: "patient", key: "driverLicenseNumber" },
  dlnumber:         { source: "patient", key: "driverLicenseNumber" },
  driverslicense:   { source: "patient", key: "driverLicenseNumber" },
  driverslicensenumber: { source: "patient", key: "driverLicenseNumber" },
  driverlicensestateidentificationcardnumber: { source: "patient", key: "driverLicenseNumber" },
  idexpirationdate: { source: "patient", key: "idExpirationDate" },

  // Meta fields
  date: { source: "meta", key: "generatedDate" },

  // Doctor fields
  doctorfirstname:     { source: "doctor", key: "firstName" },
  doctormiddlename:    { source: "doctor", key: "middleName" },
  doctorlastname:      { source: "doctor", key: "lastName" },
  doctorphone:         { source: "doctor", key: "phone" },
  doctoraddress:       { source: "doctor", key: "address" },
  doctorcity:          { source: "doctor", key: "city" },
  doctorstate:         { source: "doctor", key: "state" },
  doctorzipcode:       { source: "doctor", key: "zipCode" },
  doctorlicensenumber: { source: "doctor", key: "licenseNumber" },
  doctornpinumber:     { source: "doctor", key: "npiNumber" },
};
```

To add a new field mapping, just add a new entry. Multiple normalized names can point to the same data key (like all the driver's license variations above).

### AcroForm Preview Rendering

To avoid the white highlight that pdf-lib adds to filled AcroForm fields, the preview creates a **flattened copy** for display while keeping the editable copy for downloads:

1. Fill fields on the original PDF with `field.setText(value)` + `field.updateAppearances()`
2. Create a second copy, fill it the same way, then call `form.flatten()` on it
3. Use the flattened copy for the canvas preview (clean rendering, no highlights)
4. Keep the un-flattened copy in state for download/print (so fields can be re-edited in the sidebar)

---

## Placeholder Mode

For flat PDFs where text tokens like `{firstName}` are printed directly in the document. The system scans the PDF's text layer to find these tokens and overlays editable input fields on top of the canvas at the correct positions.

### PLACEHOLDER_MAP (text token matching)

These are the exact text tokens the system looks for in the PDF text layer:

```typescript
const PLACEHOLDER_MAP = {
  "{firstName}":          { source: "patient", key: "firstName" },
  "{middleName}":         { source: "patient", key: "middleName" },
  "{lastName}":           { source: "patient", key: "lastName" },
  "{suffix}":             { source: "patient", key: "suffix" },
  "{dateOfBirth}":        { source: "patient", key: "dateOfBirth" },
  "{address}":            { source: "patient", key: "address" },
  "{apt}":                { source: "patient", key: "apt" },
  "{city}":               { source: "patient", key: "city" },
  "{state}":              { source: "patient", key: "state" },
  "{zipCode}":            { source: "patient", key: "zipCode" },
  "{zip}":                { source: "patient", key: "zipCode" },
  "{phone}":              { source: "patient", key: "phone" },
  "{email}":              { source: "patient", key: "email" },
  "{medicalCondition}":   { source: "patient", key: "medicalCondition" },
  "{idNumber}":           { source: "patient", key: "idNumber" },
  "{driverLicenseNumber}":{ source: "patient", key: "driverLicenseNumber" },
  "{dlNumber}":           { source: "patient", key: "driverLicenseNumber" },
  "{idExpirationDate}":   { source: "patient", key: "idExpirationDate" },
  "{date}":               { source: "meta", key: "generatedDate" },
  "{doctorFirstName}":    { source: "doctor", key: "firstName" },
  "{doctorMiddleName}":   { source: "doctor", key: "middleName" },
  "{doctorLastName}":     { source: "doctor", key: "lastName" },
  "{doctorPhone}":        { source: "doctor", key: "phone" },
  "{doctorAddress}":      { source: "doctor", key: "address" },
  "{doctorCity}":         { source: "doctor", key: "city" },
  "{doctorState}":        { source: "doctor", key: "state" },
  "{doctorZipCode}":      { source: "doctor", key: "zipCode" },
  "{doctorLicenseNumber}":{ source: "doctor", key: "licenseNumber" },
  "{doctorNpiNumber}":    { source: "doctor", key: "npiNumber" },
};
```

### How Placeholder Scanning Works

1. For each page, get all text items from `page.getTextContent()`
2. Group text items into lines (items within 3px vertical tolerance)
3. Sort each line left-to-right, concatenate text
4. Run regex `/{([a-zA-Z]+)}/g` on the joined line text
5. If a match is found in `PLACEHOLDER_MAP`, calculate its pixel position from the text item transforms
6. Create an overlay input field at that position

### How Token Positions Are Calculated

Each text item from PDF.js has a `transform` array where:
- `transform[4]` = X position
- `transform[5]` = Y position (from bottom of page, inverted for screen)

The overlay input's position is calculated as:
```
x = anchorItem.transform[4]
y = viewport.height - anchorItem.transform[5]
```

Field width is calculated by looking for the next field on the same line, or using the remaining page width.

---

## Radio Buttons

Radio buttons use tokens in the format `{radio_id_NUMBER}` in the PDF text layer.

### The Problem: Split Tokens

In many PDFs, the radio tokens get split across multiple text items by the PDF text extractor. For example, `{radio_id_7}` might appear as:
- Text item 1: `{radio` at position (x1, y1)
- Text item 2: `_id7` at position (x2, y2) on a different line

### Three-Pass Detection

To handle this, the system uses three passes:

**Pass 1 - Full token on one line:**
Regex `{radio_GROUP_OPTION}` on joined line text. Works when the entire token is on one line.

**Pass 2 - Combined in single text item:**
Scan each text item for patterns like `radio_id7`, `radio_id_7`, `{radio_id11}` using a flexible regex that allows optional braces, spaces, and underscores.

**Pass 3 - Split across items:**
Find text items containing just `{radio` or `radio`, then look for nearby items (within 60px horizontal, 20px vertical) containing `_id` + a number. Combine them.

### Radio Groups

Radio buttons are organized into groups. Only one option can be selected per group. The group is determined by the option number:

```typescript
function getRadioGroup(option: string): string {
  const num = parseInt(option, 10);
  if (num >= 1 && num <= 3) return "placardtype";   // New / Renewal / Replacement
  if (num >= 4 && num <= 5) return "placardcount";   // 1 placard / 2 placards
  if (num >= 7 && num <= 14) return "condition";     // Conditions A through H
  if (num >= 15 && num <= 16) return "duration";     // Temporary / 5-year
  return "other";
}
```

### Radio Auto-Fill

The `RADIO_AUTO_FILL` map auto-selects a radio button based on patient data:

```typescript
const RADIO_AUTO_FILL = {
  condition: {
    sourceField: "disabilityCondition",  // Field from patient data
    valueMap: {
      A: "7",   // If disabilityCondition = "A", select radio option 7
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

### Oklahoma Form Radio Token Reference

For the Oklahoma Physical Disability Parking Placard Application (DPS 302DC 002):

| Token | Option | Section |
|-------|--------|---------|
| `{radio_id_1}` | New | Type of placard |
| `{radio_id_2}` | Renewal | Type of placard |
| `{radio_id_3}` | Replacement | Type of placard |
| `{radio_id_4}` | 1 placard | Number requested |
| `{radio_id_5}` | 2 placards | Number requested |
| `{radio_id_7}` | Condition A | Physician statement |
| `{radio_id_8}` | Condition B | Physician statement |
| `{radio_id_9}` | Condition C | Physician statement |
| `{radio_id_10}` | Condition D | Physician statement |
| `{radio_id_11}` | Condition E | Physician statement |
| `{radio_id_12}` | Condition F | Physician statement |
| `{radio_id_13}` | Condition G | Physician statement |
| `{radio_id_14}` | Condition H | Physician statement |
| `{radio_id_15}` | Temporary | Placard duration |
| `{radio_id_16}` | 5-year | Placard duration |

---

## Server-Side Components

### PDF Template Upload Endpoint

Each doctor gets their own PDF template uploaded via:

```
POST /api/admin/doctor-templates/:doctorProfileId/gizmo-form
```

- Accepts multipart form data with a `file` field
- Uploads to Firebase Storage at `doctor-gizmo-forms/{doctorProfileId}/{timestamp}.pdf`
- Makes the file public
- Saves the URL as `gizmoFormUrl` on the doctor's profile

### PDF Proxy Endpoint

External PDF URLs (like Firebase Storage) can't be fetched directly from the browser due to CORS. The proxy endpoint handles this:

```
GET /api/forms/proxy-pdf?url=ENCODED_URL
```

Returns the PDF bytes with `Content-Type: application/pdf`.

### Form Data Assembly Endpoint

Assembles patient + doctor data for auto-fill:

```
GET /api/forms/data/:applicationId
```

Returns:
```json
{
  "success": true,
  "patientData": {
    "firstName": "...",
    "lastName": "...",
    "dateOfBirth": "...",
    "address": "...",
    "city": "...",
    "state": "...",
    "zipCode": "...",
    "phone": "...",
    "email": "...",
    "medicalCondition": "...",
    "idNumber": "...",
    "driverLicenseNumber": "...",
    "disabilityCondition": "A",
    ...
  },
  "doctorData": {
    "firstName": "...",
    "lastName": "...",
    "phone": "...",
    "address": "...",
    "state": "...",
    "licenseNumber": "...",
    "npiNumber": "...",
    ...
  },
  "gizmoFormUrl": "https://storage.googleapis.com/...",
  "generatedDate": "02/25/2026",
  "patientName": "John Smith"
}
```

---

## Download & Print

When the user downloads or prints, the system creates a fresh filled PDF:

**AcroForm Mode:**
1. Load original PDF bytes with pdf-lib
2. Fill all text fields from the sidebar values
3. Call `form.flatten()` to lock in the values
4. Save and trigger download/print

**Placeholder Mode:**
1. Load original PDF bytes with pdf-lib
2. Draw text at each placeholder field position using `page.drawText()`
3. Draw filled rectangles at each selected radio position using `page.drawRectangle()`
4. Save and trigger download/print

---

## Creating a New PDF Template

To make a PDF work with this system, you have two options:

### Option A: AcroForm (Recommended for new forms)

Use Adobe Acrobat or a PDF editor to add interactive text fields to the PDF. Name the fields using names that will normalize to match `FIELD_NAME_MAP`. For example:
- Name a field `"First Name"` and it will match `firstname` -> patient's first name
- Name a field `"Doctor Phone"` and it will match `doctorphone` -> doctor's phone

### Option B: Placeholder Text (For existing flat PDFs)

Type the placeholder tokens directly into the PDF where you want data to appear:
- Type `{firstName}` where the first name should go
- Type `{doctorLicenseNumber}` where the license number should go
- Type `{radio_id_7}` where condition A's checkbox should go
- etc.

The tokens will be invisible in the final output because the overlay input fields cover them, and the download writes the actual data at those positions.

---

## Key Files

| File | Purpose |
|------|---------|
| `client/src/components/GizmoForm.tsx` | The main component - PDF rendering, field detection, auto-fill, download, print |
| `server/routes.ts` | Upload endpoint, proxy endpoint, form data assembly endpoint |
| `client/src/pages/dashboard/applicant/FormViewerPage.tsx` | Page that loads form data and renders GizmoForm for applicants |
| `client/src/components/shared/UserProfileModal.tsx` | Admin preview of doctor's PDF template with GizmoForm |

---

## Adding a New Field

To add support for a new data field:

1. Add the normalized name(s) to `FIELD_NAME_MAP` in GizmoForm.tsx
2. Add the placeholder token(s) to `PLACEHOLDER_MAP` in GizmoForm.tsx
3. Make sure the form data endpoint (`/api/forms/data/:applicationId`) includes the field in its `patientData` or `doctorData` response
4. Make sure the field is collected during registration or application submission
