# Gizmo Form System — Field Mapping Guide

How the browser-side PDF auto-fill works so you can reuse it in other projects.

---

## Overview

The Gizmo Form system fills a doctor recommendation PDF entirely in the browser using **pdf-lib** (writing) and **pdfjs-dist** (rendering/reading). No server-side PDF generation is involved. The PDF template is fetched from a CDN URL and filled client-side, then downloaded as a named file.

The system auto-detects which kind of PDF template you uploaded and picks the appropriate fill strategy:

| Mode | Trigger | How it fills |
|------|---------|-------------|
| **AcroForm** | PDF has interactive form fields (text boxes) | Uses pdf-lib's form API to set field values, then flattens |
| **Placeholder** | PDF is a flat document with `{placeholder}` tokens in the text | Scans text layer via pdfjs, overlays typed text at exact coordinates |

---

## Data Structure (`GizmoFormData`)

This is the object passed into the component. You need to supply it from your own API.

```ts
interface GizmoFormData {
  success: boolean;
  gizmoFormLayout?: 'A' | 'B';   // optional layout variant hint (unused in fill logic, available for rendering hints)
  patientData: Record<string, string>;  // patient fields (see map below)
  doctorData: Record<string, string>;   // doctor fields (see map below)
  gizmoFormUrl: string | null;          // publicly accessible PDF template URL
  generatedDate: string;                // today's date string, used for {date} placeholder
  patientName: string;                  // display name only, not used for filling
}
```

### `patientData` fields used by the system

| Key | What it maps to |
|-----|----------------|
| `firstName` | First name |
| `middleName` | Middle name |
| `lastName` | Last name |
| `suffix` | Name suffix (Jr, Sr, etc.) |
| `dateOfBirth` | DOB — auto-formatted `YYYY-MM-DD` → `MM/DD/YYYY` on fill |
| `address` | Street address |
| `apt` | Apt / unit number |
| `city` | City |
| `state` | State abbreviation |
| `zipCode` | ZIP code |
| `phone` | Phone number |
| `email` | Email address |
| `medicalCondition` | Qualifying condition |
| `idNumber` | Government ID number |
| `idExpirationDate` | ID expiration date |
| `idType` | Used for radio auto-fill (see Radio section) |

### `doctorData` fields used by the system

| Key | What it maps to |
|-----|----------------|
| `firstName` | Doctor first name |
| `middleName` | Doctor middle name |
| `lastName` | Doctor last name (also used for per-doctor offsets) |
| `phone` | Doctor phone |
| `address` | Doctor address |
| `city` | Doctor city |
| `state` | Doctor state |
| `zipCode` | Doctor ZIP |
| `licenseNumber` | Medical license number |
| `npiNumber` | NPI number |

---

## Mode 1 — AcroForm PDFs

If the PDF was created with interactive form fields (e.g. from Adobe Acrobat or LibreOffice with form fields), the system uses this mode automatically.

### How it works

1. pdf-lib reads all field names from the PDF's AcroForm dictionary
2. Each field name is **normalized**: lowercased, all non-alphanumeric characters stripped
3. Normalized name is looked up in `FIELD_NAME_MAP`
4. Matched fields get their value set; unmatched fields are left blank (but shown as editable in the UI)
5. `form.flatten()` is called on download to bake the text in permanently

### `FIELD_NAME_MAP` — AcroForm field name → data mapping

Name matching is **fuzzy**: the PDF field can be named anything as long as, after stripping spaces/dashes/underscores and lowercasing, it matches one of these keys.

| Normalized key | Source | Data key |
|----------------|--------|----------|
| `firstname` | patient | `firstName` |
| `middlename` | patient | `middleName` |
| `lastname` | patient | `lastName` |
| `suffix` | patient | `suffix` |
| `dateofbirth` | patient | `dateOfBirth` |
| `dob` | patient | `dateOfBirth` |
| `address` | patient | `address` |
| `apt` | patient | `apt` |
| `city` | patient | `city` |
| `state` | patient | `state` |
| `zipcode` | patient | `zipCode` |
| `zip` | patient | `zipCode` |
| `phone` | patient | `phone` |
| `email` | patient | `email` |
| `medicalcondition` | patient | `medicalCondition` |
| `date` | meta | `generatedDate` |
| `doctorfirstname` | doctor | `firstName` |
| `doctormiddlename` | doctor | `middleName` |
| `doctorlastname` | doctor | `lastName` |
| `doctorphone` | doctor | `phone` |
| `doctoraddress` | doctor | `address` |
| `doctorcity` | doctor | `city` |
| `doctorstate` | doctor | `state` |
| `doctorzipcode` | doctor | `zipCode` |
| `doctorlicensenumber` | doctor | `licenseNumber` |
| `doctornpinumber` | doctor | `npiNumber` |

**Example:** A PDF field named `"Doctor License Number"` normalizes to `doctorlicensenumber` → matches → filled with `doctorData.licenseNumber`.

If no recognized fields are found (zero matches), the system falls back to Placeholder mode.

---

## Mode 2 — Placeholder PDFs

For flat PDFs (no form fields), you embed token strings directly in the PDF text. The system scans the text layer, finds the tokens, overlays typed text at those exact coordinates, and draws it onto the PDF on download.

### How to prepare a template PDF

Open your PDF in any editor (Word → export to PDF, Canva, etc.) and type the placeholder tokens directly where you want the data to appear. The token must appear as literal text in the PDF's text layer.

```
Patient Name: {firstName} {lastName}
Date of Birth: {dateOfBirth}
Address: {address}, {city}, {state} {zipCode}
```

### `PLACEHOLDER_MAP` — full token list

| Token | Source | Data key |
|-------|--------|----------|
| `{firstName}` | patient | `firstName` |
| `{middleName}` | patient | `middleName` |
| `{lastName}` | patient | `lastName` |
| `{suffix}` | patient | `suffix` |
| `{dateOfBirth}` | patient | `dateOfBirth` (auto-formatted MM/DD/YYYY) |
| `{address}` | patient | `address` |
| `{apt}` | patient | `apt` |
| `{city}` | patient | `city` |
| `{state}` | patient | `state` |
| `{zipCode}` | patient | `zipCode` |
| `{zip}` | patient | `zipCode` |
| `{phone}` | patient | `phone` |
| `{email}` | patient | `email` |
| `{medicalCondition}` | patient | `medicalCondition` |
| `{idNumber}` | patient | `idNumber` |
| `{idExpirationDate}` | patient | `idExpirationDate` |
| `{date}` | meta | `generatedDate` |
| `{doctorFirstName}` | doctor | `firstName` |
| `{doctorMiddleName}` | doctor | `middleName` |
| `{doctorLastName}` | doctor | `lastName` |
| `{doctorPhone}` | doctor | `phone` |
| `{doctorAddress}` | doctor | `address` |
| `{doctorCity}` | doctor | `city` |
| `{doctorState}` | doctor | `state` |
| `{doctorZipCode}` | doctor | `zipCode` |
| `{doctorLicenseNumber}` | doctor | `licenseNumber` |
| `{doctorNpiNumber}` | doctor | `npiNumber` |

### How coordinates are resolved

pdfjs returns every text item with its PDF coordinate (`x`, `y`). The system:

1. Groups text items into horizontal lines (items within 3 units of the same Y)
2. Scans each line for `{token}` matches using regex
3. Records the X/Y of the first character of the token — that's where text is drawn
4. For **width**: if multiple fields are on the same line, each field's width is the gap between its anchor X and the next field's anchor X (minus 8px padding). Last field on a line gets the remaining width to the right margin.
5. For **anchor X**: the system looks for a label to the left of the placeholder (within 25 units below, 15 units to the left) and uses the label's left edge as the anchor — this keeps the typed text aligned with the label rather than right-offset from the token position.

### What the agent/user edits

After auto-fill, every detected field renders as an `<input>` overlaid on the PDF canvas at the correct position. The agent can correct any field before downloading.

---

## Radio Buttons (Placeholder mode only)

For checkboxes / radio button groups in flat PDFs, use this token syntax:

```
{radio_groupName_optionValue}
```

**Example:** An ID type group with four options:
```
○ {radio_idtype_dl}    ○ {radio_idtype_passport}    ○ {radio_idtype_idcard}    ○ {radio_idtype_tribal}
```

### `RADIO_AUTO_FILL` — automatic selection from patient data

The system maps `patientData.idType` values to radio options automatically:

| `idType` value | Auto-selects option |
|---------------|---------------------|
| `drivers_license` | `dl` |
| `us_passport_photo_id` | `passport` |
| `id_card` | `idcard` |
| `tribal_id_card` | `tribal` |

This works for any group named `idtype`, `licensetype`, or `id` in the token.

### How radio buttons are drawn on download

Each selected radio option draws a filled black circle at the token's coordinates. The circle radius scales with the font size of the token text.

Tokens are stripped from the downloaded PDF — only the filled circle remains.

---

## Doctor-Specific Coordinate Offsets

Different doctors may use different PDF templates where the text coordinates don't align perfectly. A small per-doctor correction table is hardcoded:

```ts
const DOCTOR_FORM_OFFSETS: Record<string, { x: number; y: number }> = {
  'fore':   { x: 3,  y: -4 },
  'foshee': { x: 0,  y: -3 },
};
```

The key is the doctor's **last name, lowercased**. If no entry exists, offsets default to `{ x: 0, y: 0 }`.

To add a new doctor's offset: add their lowercased last name and the pixel correction needed. Positive X shifts right, negative Y shifts down (PDF coordinate system has Y=0 at bottom).

---

## File Download

The downloaded PDF is named automatically:

```
{firstName}_{lastName}_Physician_Recommendation_MM-DD-YYYY.pdf
```

Special characters in names are replaced with underscores.

---

## Dependencies

```
pdf-lib       — write text/shapes onto PDF bytes, fill + flatten AcroForm fields
pdfjs-dist    — parse PDF text layer to find placeholder coordinates
```

Both run entirely in the browser. No server endpoint is called for the actual fill — only the initial template fetch (via a proxy endpoint to avoid CORS issues on the PDF CDN URL).

---

## Reusing in Another Project

1. Copy `GizmoForm.tsx` (or extract the pure functions: `FIELD_NAME_MAP`, `PLACEHOLDER_MAP`, `RADIO_AUTO_FILL`, `extractPlaceholders`, `extractRadioButtons`, `detectAcroFormFields`, `resolveValue`)
2. Supply a `GizmoFormData` object from your own API (patient + doctor data + PDF URL)
3. Add a proxy endpoint `GET /api/forms/proxy-pdf?url=...` that fetches the PDF bytes and streams them back (needed to avoid CORS blocking direct CDN fetches from the browser)
4. Install `pdf-lib` and `pdfjs-dist`, set `pdfjsLib.GlobalWorkerOptions.workerSrc` to your worker file
5. To add new placeholder tokens: add an entry to `PLACEHOLDER_MAP` and `FIELD_NAME_MAP` — no other changes needed
6. To add new radio groups: add an entry to `RADIO_AUTO_FILL` with the group name, source field, and value→option mapping

### Minimal proxy endpoint (Express)

```ts
router.get('/proxy-pdf', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'url required' });
  const response = await fetch(url);
  if (!response.ok) return res.status(502).json({ error: 'Failed to fetch PDF' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'no-store');
  const buffer = await response.arrayBuffer();
  res.send(Buffer.from(buffer));
});
```
