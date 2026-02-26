# Full Platform Upgrade Guide

This document covers all enhancements needed to upgrade another project to match this platform's features:

1. **Per-Doctor State-Specific PDF Forms** — each doctor can have different PDF forms per state
2. **Package Radio Button Fields with 1-to-1 PDF Mapping** — admin defines radio options that map directly to PDF radio buttons
3. **Patient Draft Save to Firestore** — patients can save progress and come back later
4. **Manual Payment Draft Integration** — admin manual payment pulls in patient's saved answers
5. **Authorize.Net Payment Integration** — credit card payment via Accept.js client-side tokenization, server-side charge, auto-assigns to doctor on success
6. **SendGrid Email Service** — transactional emails for doctor review requests, admin notifications, doctor records copies, and patient approval notifications
7. **Contact Email System & Admin Settings** — separate contact email per user, admin notification email config, auto-complete toggle
8. **Auto-Send to Doctor After Payment & Email Wiring** — automatic doctor assignment and dual email dispatch (doctor + admin) on payment
9. **Doctor Approval → Auto-Generate Document & Email Patient** — document auto-generation on approval, patient notified to download from dashboard
10. **Radio Button Positioning Fix for Oklahoma PDF** — offset adjustment for radio IDs 6-16 to align with checkbox squares

---

## Part 1: Per-Doctor State-Specific PDF Forms

### Overview

**Before**: Each doctor had one `gizmoFormUrl` field — a single PDF form used for all patients regardless of state.

**After**: Each doctor has a `stateForms` object (e.g., `{ "Oklahoma": "url1", "Texas": "url2" }`) stored on their profile. When a patient's application is processed, the system matches the patient's state to the doctor's state-specific form. The old `gizmoFormUrl` field still works as a fallback.

**Resolution order**: `doctorProfile.stateForms[patientState]` → `doctorProfile.gizmoFormUrl` (fallback)

### 1.1 Doctor Profile Data Model (Firestore)

Add the `stateForms` field to the doctor profile document. It's an object where keys are full state names and values are PDF URLs.

```
doctorProfiles/{id}:
  ...existing fields...
  stateForms: {
    "Oklahoma": "https://storage.googleapis.com/.../oklahoma-form.pdf",
    "Texas": "https://storage.googleapis.com/.../texas-form.pdf"
  }
  gizmoFormUrl: "https://..."  // kept as fallback
```

No schema migration needed — Firestore is schemaless. Just start writing the field.

### 1.2 Backend: Doctor Profile Create Endpoint

In the `POST /api/doctor-profiles` route, add `stateForms` to the destructured body and include it in `profileData`:

```typescript
const { ..., stateForms, userId: bodyUserId } = req.body;
// ...
if (stateForms !== undefined) profileData.stateForms = stateForms;
```

### 1.3 Backend: Doctor Profile Update Endpoint

In the `PUT /api/doctor-profiles/:id` route, add `stateForms` to the destructured body and include it in `updateData`:

```typescript
const { ..., stateForms } = req.body;
// ...
if (stateForms !== undefined) updateData.stateForms = stateForms;
```

### 1.4 Backend: Form Data Resolution

In the `GET /api/forms/data/:applicationId` endpoint, change the PDF URL resolution to check `doctorProfile.stateForms` first:

**Before** (if you had a separate stateFormTemplates collection):
```typescript
const patientState = formData.state || patient?.state || "";
if (patientState) {
  const stateTemplate = await storage.getStateFormTemplate(patientState);
  if (stateTemplate?.gizmoFormUrl) {
    gizmoFormUrl = stateTemplate.gizmoFormUrl;
  }
}
if (!gizmoFormUrl && doctorProfile?.gizmoFormUrl) {
  gizmoFormUrl = doctorProfile.gizmoFormUrl;
}
```

**After** (per-doctor state forms):
```typescript
const patientState = formData.state || patient?.state || "";
if (patientState && doctorProfile?.stateForms) {
  const stateFormUrl = (doctorProfile.stateForms as Record<string, string>)[patientState];
  if (stateFormUrl) {
    gizmoFormUrl = stateFormUrl;
  }
}
if (!gizmoFormUrl && doctorProfile?.gizmoFormUrl) {
  gizmoFormUrl = doctorProfile.gizmoFormUrl;
}
```

### 1.5 Frontend: Doctor Profile Modal (UserProfileModal.tsx)

#### a. Add state variables

```typescript
const [selectedPdfState, setSelectedPdfState] = useState<string>("");
const [previewPdfState, setPreviewPdfState] = useState<string>("");
```

#### b. Initialize `stateForms` in doctor profile data

When loading an existing profile:
```typescript
stateForms: doctorProfile.stateForms || {},
```

When creating a new profile:
```typescript
stateForms: {},
```

#### c. Replace the PDF section

Replace the old single-PDF section (the `gizmoFormUrl` card with Preview & Remove) with the new per-state system. The UI has three parts:

**Part 1 — State form list** (green cards): Shows all assigned state→PDF mappings. Each card has the state name, Preview & Fill button, and Remove button.

```tsx
{Object.keys(doctorProfileData.stateForms || {}).length > 0 && (
  <div className="space-y-2">
    {Object.entries(doctorProfileData.stateForms).map(([st, url]) => (
      <div key={st} className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">{st}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { setPreviewPdfState(st); setShowGizmoPreview(true); }}>
              <FileText className="h-3 w-3 mr-1" /> Preview & Fill
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
              const updated = { ...doctorProfileData.stateForms };
              delete updated[st];
              setDoctorProfileData({ ...doctorProfileData, stateForms: updated });
            }}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{url.split("/").pop()}</p>
      </div>
    ))}
  </div>
)}
```

**Part 2 — Uploaded PDF with state assignment dropdown** (amber card): After uploading a PDF, shows it with a state dropdown. Admin picks a state to assign the PDF. The card stays visible so the same PDF can be assigned to multiple states.

```tsx
{doctorProfileData.gizmoFormUrl && (
  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
    <div className="flex items-center justify-between">
      <span className="font-medium text-sm text-amber-700 dark:text-amber-300">Uploaded PDF</span>
      <Button variant="ghost" size="sm" className="text-destructive"
        onClick={() => setDoctorProfileData({ ...doctorProfileData, gizmoFormUrl: "" })}>
        <Trash2 className="h-3 w-3 mr-1" /> Clear
      </Button>
    </div>
    <p className="text-xs text-muted-foreground mt-1 truncate">{doctorProfileData.gizmoFormUrl.split("/").pop()}</p>
    <Select value={selectedPdfState} onValueChange={(val) => {
      const updated = { ...doctorProfileData.stateForms, [val]: doctorProfileData.gizmoFormUrl };
      setDoctorProfileData({ ...doctorProfileData, stateForms: updated });
      setSelectedPdfState("");
    }}>
      <SelectTrigger className="mt-2"><SelectValue placeholder="Assign to state..." /></SelectTrigger>
      <SelectContent>
        {ALL_STATES.filter(s => !doctorProfileData.stateForms[s]).map(st => (
          <SelectItem key={st} value={st}>{st}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

**Part 3 — Upload button**: Same as before, uploads to the existing gizmo-form endpoint.

#### d. Update the Preview dialog

Change the preview dialog to use the state-specific URL when previewing a state form:

```tsx
gizmoFormUrl: previewPdfState
  ? (doctorProfileData.stateForms || {})[previewPdfState]
  : doctorProfileData.gizmoFormUrl,
```

### 1.6 Remove Old State Forms Infrastructure (if applicable)

If you previously had a separate `stateFormTemplates` Firestore collection and admin State Forms management page:

- Delete the `StateFormsManagement.tsx` page
- Remove its routes from `App.tsx`
- Remove its nav items from `DashboardLayout.tsx`
- Remove the API endpoints (`/api/admin/state-forms/*`) from `routes.ts`
- Remove the storage methods (`getStateFormTemplates`, `getStateFormTemplate`, `upsertStateFormTemplate`) from `storage.ts`

---

## Part 2: Package Radio Button Fields with 1-to-1 PDF Mapping

### Overview

Admins define radio button fields on packages where each option has a **Radio ID** (the exact PDF radio button number) and a **Statement** (the text the patient sees). When the patient picks a statement, the radio ID is stored. The GizmoForm then checks the exact matching radio button on the PDF.

**How it works:**
1. Admin creates a radio field on a package, adds options like: `Radio ID: 7` / `Statement: "Cannot walk 200 feet without stopping"`
2. Patient sees the statement as a clickable card, selects it → the value `"7"` is stored
3. Backend collects all selected radio IDs into a `selectedRadioIds` array
4. GizmoForm checks `selectedRadioIds` against PDF `{radio_id_N}` placeholders

### 2.1 Form Field Schema (PackagesManagement.tsx)

Update the form field Zod schema to include `radioOptions`:

```typescript
const formFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select", "date", "email", "phone", "number", "radio"]),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  radioOptions: z.array(z.object({
    radioId: z.string(),
    text: z.string(),
  })).optional(),
});
```

### 2.2 Admin UI: Radio Option Editor (PackagesManagement.tsx)

When `field.type === "radio"`, render rows with Radio ID + Statement inputs instead of a comma-separated options input. Each row maps directly to one PDF radio button.

Replace the old radio/select options input:
```tsx
{(field.type === "select" || field.type === "radio") && (
  <Input
    placeholder="Options (comma-separated)"
    value={(field.options || []).join(", ")}
    onChange={(e) => updateFormField(index, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
  />
)}
```

With separate handling for select vs radio:
```tsx
{field.type === "select" && (
  <Input
    placeholder="Options (comma-separated)"
    value={(field.options || []).join(", ")}
    onChange={(e) => updateFormField(index, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
    data-testid={`input-field-options-${index}`}
  />
)}
{field.type === "radio" && (
  <div className="space-y-2 pt-1">
    <p className="text-xs text-muted-foreground">Each option maps to a specific radio button on the PDF. Enter just the number (e.g. 1, 2, 7) and the statement the patient will see.</p>
    {(field.radioOptions || []).map((ro, roIdx) => (
      <div key={roIdx} className="flex items-center gap-2">
        <Input
          placeholder="e.g. 1"
          value={ro.radioId}
          onChange={(e) => {
            const updated = [...(field.radioOptions || [])];
            updated[roIdx] = { ...updated[roIdx], radioId: e.target.value };
            updateFormField(index, { radioOptions: updated });
          }}
          className="w-24 flex-shrink-0"
          data-testid={`input-radio-id-${index}-${roIdx}`}
        />
        <Input
          placeholder="Statement shown to patient"
          value={ro.text}
          onChange={(e) => {
            const updated = [...(field.radioOptions || [])];
            updated[roIdx] = { ...updated[roIdx], text: e.target.value };
            updateFormField(index, { radioOptions: updated });
          }}
          className="flex-1"
          data-testid={`input-radio-text-${index}-${roIdx}`}
        />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => {
          const updated = (field.radioOptions || []).filter((_, i) => i !== roIdx);
          updateFormField(index, { radioOptions: updated });
        }}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    ))}
    <Button type="button" variant="outline" size="sm" onClick={() => {
      const updated = [...(field.radioOptions || []), { radioId: "", text: "" }];
      updateFormField(index, { radioOptions: updated });
    }} data-testid={`button-add-radio-option-${index}`}>
      <Plus className="h-3 w-3 mr-1" /> Add Option
    </Button>
  </div>
)}
```

### 2.3 Patient-Facing Radio UI (NewApplication.tsx)

Update the radio rendering to handle the new `radioOptions` format. When `radioOptions` is present, show the text but store the `radioId` as the value. Keep the old `options` format as fallback for backward compatibility.

Replace the radio rendering block:
```tsx
) : field.type === "radio" ? (
  <div className="space-y-2 pt-1" data-testid={`radio-group-${field.name}`}>
    {field.radioOptions && field.radioOptions.length > 0 ? (
      field.radioOptions.map((ro: any) => (
        <label key={ro.radioId} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${customFields[field.name] === ro.radioId ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
          <input
            type="radio"
            name={field.name}
            value={ro.radioId}
            checked={customFields[field.name] === ro.radioId}
            onChange={(e) => setCustomFields({ ...customFields, [field.name]: e.target.value })}
            className="h-4 w-4 text-primary"
            data-testid={`radio-${field.name}-${ro.radioId}`}
          />
          <span className="text-sm">{ro.text}</span>
        </label>
      ))
    ) : (field.options || []).map((opt: string) => (
      <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${customFields[field.name] === opt ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
        <input
          type="radio"
          name={field.name}
          value={opt}
          checked={customFields[field.name] === opt}
          onChange={(e) => setCustomFields({ ...customFields, [field.name]: e.target.value })}
          className="h-4 w-4 text-primary"
          data-testid={`radio-${field.name}-${opt.toLowerCase().replace(/\s+/g, "_")}`}
        />
        <span className="text-sm">{opt}</span>
      </label>
    ))}
  </div>
```

### 2.4 Backend: Collect Selected Radio IDs (routes.ts)

In the `GET /api/forms/data/:applicationId` endpoint, after building `patientData` and `doctorData`, add code to collect the selected radio IDs from fields that have `radioOptions`. Add this before the response `result` object:

```typescript
const selectedRadioIds: string[] = [];
const pkgFormFields = (pkg as any)?.formFields || (pkg as any)?.requiredFields || [];
if (Array.isArray(pkgFormFields)) {
  for (const field of pkgFormFields as any[]) {
    if (field.radioOptions && Array.isArray(field.radioOptions)) {
      const val = formData[field.name];
      if (val) {
        selectedRadioIds.push(String(val));
      }
    }
  }
}

const result: any = {
  success: true,
  patientData,
  doctorData,
  gizmoFormUrl,
  generatedDate,
  patientName: `${patientData.firstName} ${patientData.lastName}`.trim(),
  applicationId: application.id,
  packageName: pkg?.name || "Service",
  selectedRadioIds,  // <-- ADD THIS
};
```

**Important**: Use `formFields` (the Firestore field name). Some projects may use `requiredFields` — the code above checks both to be safe.

### 2.5 GizmoForm: Use selectedRadioIds (GizmoForm.tsx)

#### a. Update the GizmoFormData interface

Add `selectedRadioIds` to the data interface:

```typescript
export interface GizmoFormData {
  success: boolean;
  gizmoFormLayout?: "A" | "B";
  patientData: Record<string, string>;
  doctorData: Record<string, string>;
  gizmoFormUrl: string | null;
  generatedDate: string;
  patientName: string;
  selectedRadioIds?: string[];  // <-- ADD THIS
}
```

#### b. Build the set from API data

At the top of `extractPlaceholdersFromPdf`, create the set from the API response (NOT from scanning all patient data values):

```typescript
const extractPlaceholdersFromPdf = async (pdf: pdfjsLib.PDFDocumentProxy) => {
  const fields: PlaceholderField[] = [];
  const radios: RadioField[] = [];
  const selectedRadioIds = new Set(data.selectedRadioIds || []);  // <-- ADD THIS
  // ... rest of function
```

#### c. Update both auto-fill blocks

In both places where radio selection is determined (there are two — one for the regex match path and one for the `addRadioFromItem` helper), add `selectedRadioIds.has(option)` as the first check before the existing `RADIO_AUTO_FILL` lookup:

**Before:**
```typescript
let selected = false;
const autoFill = RADIO_AUTO_FILL[group];
if (autoFill) {
  const patientVal = String(data.patientData[autoFill.sourceField] || "");
  const lowerVal = patientVal.toLowerCase();
  const normalizedVal = lowerVal.replace(/[\s-]+/g, "_");
  const expectedOption = autoFill.valueMap[patientVal] || autoFill.valueMap[lowerVal] || autoFill.valueMap[normalizedVal];
  if (expectedOption === option) {
    selected = true;
  }
}
```

**After:**
```typescript
let selected = selectedRadioIds.has(option);
if (!selected) {
  const autoFill = RADIO_AUTO_FILL[group];
  if (autoFill) {
    const patientVal = String(data.patientData[autoFill.sourceField] || "");
    const lowerVal = patientVal.toLowerCase();
    const normalizedVal = lowerVal.replace(/[\s-]+/g, "_");
    const expectedOption = autoFill.valueMap[patientVal] || autoFill.valueMap[lowerVal] || autoFill.valueMap[normalizedVal];
    if (expectedOption === option) {
      selected = true;
    }
  }
}
```

The `selectedRadioIds` check runs first. If the radio ID was directly selected by the patient (via the new 1-to-1 mapping), it matches immediately. The old `RADIO_AUTO_FILL` value map lookup only runs as a fallback for legacy field formats.

---

## Part 3: Patient Draft Save to Firestore

### Overview

Patients can start filling out the application wizard, leave, and come back later — their progress is saved to Firestore on their user profile. This also enables the manual payment flow to pull in their answers.

**Data stored**: `draftFormData` object on the user document in Firestore containing:
- `packageId` — selected package
- `disabilityCondition` — selected condition
- `reason` — text reason
- `additionalInfo` — optional notes
- `customFields` — all radio button selections and other custom field answers
- `step` — current wizard step number

### 3.1 Backend: Draft Form Endpoints (routes.ts)

Add two new endpoints after the profile update route (`PUT /api/profile`):

```typescript
app.get("/api/profile/draft-form", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    res.json({ draftFormData: (user as any)?.draftFormData || {} });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/profile/draft-form", requireAuth, async (req, res) => {
  try {
    await storage.updateUser(req.user!.id, { draftFormData: req.body.draftFormData || {} } as any);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

No schema changes needed — Firestore stores the `draftFormData` object directly on the user document.

### 3.2 Frontend: Auto-Save and Restore (NewApplication.tsx)

#### a. Add imports

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
```

#### b. Add draft loading query

After the `useForm` setup, add:

```typescript
const { data: draftData, isLoading: draftLoading } = useQuery<{ draftFormData: Record<string, any> }>({
  queryKey: ["/api/profile/draft-form"],
});
```

#### c. Restore draft on load

```typescript
const draftLoaded = useRef(false);
useEffect(() => {
  if (draftData?.draftFormData && !draftLoaded.current) {
    draftLoaded.current = true;
    const draft = draftData.draftFormData;
    if (draft.packageId && !preselectedPackage) form.setValue("packageId", draft.packageId);
    if (draft.disabilityCondition) form.setValue("disabilityCondition", draft.disabilityCondition);
    if (draft.reason) form.setValue("reason", draft.reason);
    if (draft.additionalInfo) form.setValue("additionalInfo", draft.additionalInfo);
    if (draft.customFields) setCustomFields(draft.customFields);
    if (draft.step && draft.step > 1) setStep(draft.step);
  }
}, [draftData]);
```

#### d. Auto-save on changes (debounced 1 second)

```typescript
const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const saveDraft = useCallback(() => {
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    const values = form.getValues();
    const draftFormData = {
      packageId: values.packageId,
      disabilityCondition: values.disabilityCondition,
      reason: values.reason,
      additionalInfo: values.additionalInfo,
      customFields,
      step,
    };
    apiRequest("PUT", "/api/profile/draft-form", { draftFormData }).catch(() => {});
  }, 1000);
}, [customFields, step]);

useEffect(() => {
  if (draftLoaded.current) saveDraft();
}, [customFields, step, saveDraft]);

const watchedValues = form.watch();
useEffect(() => {
  if (draftLoaded.current) saveDraft();
}, [watchedValues.packageId, watchedValues.disabilityCondition, watchedValues.reason, watchedValues.additionalInfo]);
```

#### e. Clear draft on successful submission

In the `onSuccess` callback of the `createApplication` mutation, add:

```typescript
onSuccess: (application) => {
  queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
  apiRequest("PUT", "/api/profile/draft-form", { draftFormData: {} }).catch(() => {});
  queryClient.invalidateQueries({ queryKey: ["/api/profile/draft-form"] });
  // ... rest of success handler (toast, redirect)
},
```

---

## Part 4: Manual Payment Draft Integration

### Overview

When an admin processes a manual payment for a patient, the system pulls in the patient's saved draft answers (radio button selections, disability condition, etc.) into the application's `formData`. This means:
- Patient answers their questions at any time
- Admin processes manual payment later
- The application automatically includes all patient answers
- Those answers flow through to PDF auto-fill

### 4.1 Backend: Pull Draft into Manual Payment (routes.ts)

In the `POST /api/admin/users/:userId/manual-payment` endpoint, before creating the application, pull the draft data from the user's profile:

**Before:**
```typescript
const application = await storage.createApplication({
  userId: targetUser.id,
  packageId,
  currentStep: 1,
  totalSteps: workflowSteps.length,
  status: "pending",
  formData: {
    manualPayment: true,
    manualPaymentReason: reason || "Manual payment by admin",
    manualPaymentBy: `${req.user!.firstName} ${req.user!.lastName}`,
    manualPaymentAt: new Date().toISOString(),
    fullName: `${targetUser.firstName} ${targetUser.lastName}`,
    firstName: targetUser.firstName,
    lastName: targetUser.lastName,
    email: targetUser.email,
    phone: targetUser.phone || "",
    dateOfBirth: targetUser.dateOfBirth || "",
    address: targetUser.address || "",
    city: targetUser.city || "",
    state: targetUser.state || "",
    zipCode: targetUser.zipCode || "",
  },
  paymentStatus: "paid",
  paymentAmount: pkg.price,
});
```

**After:**
```typescript
const draftData = (targetUser as any).draftFormData || {};
const draftCustomFields = draftData.customFields || {};

const application = await storage.createApplication({
  userId: targetUser.id,
  packageId: draftData.packageId || packageId,
  currentStep: 1,
  totalSteps: workflowSteps.length,
  status: "pending",
  formData: {
    manualPayment: true,
    manualPaymentReason: reason || "Manual payment by admin",
    manualPaymentBy: `${req.user!.firstName} ${req.user!.lastName}`,
    manualPaymentAt: new Date().toISOString(),
    fullName: `${targetUser.firstName} ${targetUser.lastName}`,
    firstName: targetUser.firstName,
    lastName: targetUser.lastName,
    email: targetUser.email,
    phone: targetUser.phone || "",
    dateOfBirth: targetUser.dateOfBirth || "",
    address: targetUser.address || "",
    city: targetUser.city || "",
    state: targetUser.state || "",
    zipCode: targetUser.zipCode || "",
    disabilityCondition: draftData.disabilityCondition || "",
    reason: draftData.reason || "",
    additionalInfo: draftData.additionalInfo || "",
    ...draftCustomFields,
  },
  paymentStatus: "paid",
  paymentAmount: pkg.price,
});
```

Key changes:
- `draftData` is read from `targetUser.draftFormData`
- `draftCustomFields` contains all the radio button selections (stored by field name → radio ID)
- `...draftCustomFields` spreads them into formData so they're available for PDF auto-fill
- `draftData.packageId` is used as a fallback if the admin didn't select a different package

### 4.2 Clear Draft After Manual Payment

After the application is created and steps are set up, clear the patient's draft:

```typescript
await storage.updateUser(targetUser.id, { draftFormData: {} } as any);
```

---

## Part 5: Authorize.Net Payment Integration

### Overview

**Before**: The wizard submitted the application immediately with no payment step. Either `autoSendToDoctor: true` fired instantly, or the application sat with no payment mechanism.

**After**: The wizard has 3 steps — Select Permit → Your Information → Review & Pay. On Step 3, the patient sees a review of their order plus a credit card form. Card data is tokenized client-side by Authorize.Net Accept.js (never touches our server), then the token is sent to our backend which charges the card via the Authorize.Net API. On successful payment, the application is created with `paid` status and automatically assigned to a doctor via round-robin. Admin can also manually process payment for `awaiting_payment` applications as a fallback.

**Secrets required**:
- `AUTHORIZENET_API_LOGIN_ID` — from Authorize.Net Merchant Interface > Account > Settings > API Credentials & Keys
- `AUTHORIZENET_TRANSACTION_KEY` — same location
- `AUTHORIZENET_CLIENT_KEY` — from Account > Settings > Manage Public Client Key
- `AUTHORIZENET_SANDBOX` — set to `"true"` for test mode (uses sandbox URLs), omit or set to `"false"` for production

### 5.1 Create Server Module: `server/authorizenet.ts`

Create this new file. It handles all Authorize.Net communication:

```typescript
const AUTHORIZENET_API_LOGIN_ID = process.env.AUTHORIZENET_API_LOGIN_ID || "";
const AUTHORIZENET_TRANSACTION_KEY = process.env.AUTHORIZENET_TRANSACTION_KEY || "";

const API_URL = process.env.AUTHORIZENET_SANDBOX === "true"
  ? "https://apitest.authorize.net/xml/v1/request.api"
  : "https://api.authorize.net/xml/v1/request.api";

export function isAuthorizeNetConfigured(): boolean {
  return !!(AUTHORIZENET_API_LOGIN_ID && AUTHORIZENET_TRANSACTION_KEY);
}

export function getAcceptJsUrl(): string {
  return process.env.AUTHORIZENET_SANDBOX === "true"
    ? "https://jstest.authorize.net/v1/Accept.js"
    : "https://js.authorize.net/v1/Accept.js";
}

export function getApiLoginId(): string {
  return AUTHORIZENET_API_LOGIN_ID;
}

interface ChargeResult {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  message: string;
  responseCode?: string;
}

export async function chargeCard(params: {
  opaqueDataDescriptor: string;
  opaqueDataValue: string;
  amount: number; // in cents
  orderId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  description?: string;
}): Promise<ChargeResult> {
  if (!isAuthorizeNetConfigured()) {
    throw new Error("Authorize.Net is not configured");
  }

  const amountStr = (params.amount / 100).toFixed(2); // convert cents to dollars

  const requestBody: any = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: AUTHORIZENET_API_LOGIN_ID,
        transactionKey: AUTHORIZENET_TRANSACTION_KEY,
      },
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: amountStr,
        payment: {
          opaqueData: {
            dataDescriptor: params.opaqueDataDescriptor,
            dataValue: params.opaqueDataValue,
          },
        },
        order: params.orderId ? {
          invoiceNumber: params.orderId.slice(0, 20),
          description: (params.description || "Handicap Permit Application").slice(0, 255),
        } : undefined,
        customer: params.customerEmail ? {
          email: params.customerEmail,
        } : undefined,
        billTo: (params.customerFirstName || params.customerLastName) ? {
          firstName: (params.customerFirstName || "").slice(0, 50),
          lastName: (params.customerLastName || "").slice(0, 50),
        } : undefined,
      },
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();
    const cleanText = text.replace(/^\uFEFF/, ""); // strip BOM
    const result = JSON.parse(cleanText);

    const txResponse = result?.transactionResponse;
    const messages = result?.messages;

    if (messages?.resultCode === "Ok" && txResponse?.responseCode === "1") {
      return {
        success: true,
        transactionId: txResponse.transId,
        authCode: txResponse.authCode,
        responseCode: txResponse.responseCode,
        message: "Payment processed successfully",
      };
    }

    let errorMessage = "Payment failed";
    if (txResponse?.errors?.length > 0) {
      errorMessage = txResponse.errors[0].errorText;
    } else if (messages?.message?.length > 0) {
      errorMessage = messages.message[0].text;
    }

    return {
      success: false,
      responseCode: txResponse?.responseCode,
      message: errorMessage,
    };
  } catch (error: any) {
    console.error("Authorize.Net API error:", error);
    return {
      success: false,
      message: error.message || "Payment processing error",
    };
  }
}
```

### 5.2 Backend: Import and Add Payment Endpoints (routes.ts)

#### a. Import the module

At the top of `routes.ts`, add:

```typescript
import { chargeCard, isAuthorizeNetConfigured, getAcceptJsUrl, getApiLoginId } from "./authorizenet";
```

#### b. Add the config endpoint (public, no auth)

This returns the Accept.js URL and public keys so the frontend can load the script and tokenize cards:

```typescript
app.get("/api/payment/config", (req, res) => {
  res.json({
    configured: isAuthorizeNetConfigured(),
    acceptJsUrl: getAcceptJsUrl(),
    apiLoginId: getApiLoginId(),
    clientKey: process.env.AUTHORIZENET_CLIENT_KEY || "",
  });
});
```

#### c. Add the charge endpoint (requires auth)

This receives the tokenized card data (opaqueData from Accept.js), charges the card, creates the application with `paid` status, and auto-assigns to a doctor. Place it before the `GET /api/applications/:id` route:

```typescript
app.post("/api/payment/charge", requireAuth, async (req, res) => {
  try {
    const { opaqueDataDescriptor, opaqueDataValue, packageId, formData } = req.body;

    if (!opaqueDataDescriptor || !opaqueDataValue) {
      res.status(400).json({ message: "Payment token is required" });
      return;
    }
    if (!packageId) {
      res.status(400).json({ message: "Package is required" });
      return;
    }

    const pkg = await storage.getPackage(packageId);
    if (!pkg) {
      res.status(404).json({ message: "Package not found" });
      return;
    }

    const patient = req.user!;
    const patientName = `${patient.firstName} ${patient.lastName}`;

    // Charge the card — amount comes from the package price (server-side), NOT from client
    const chargeResult = await chargeCard({
      opaqueDataDescriptor,
      opaqueDataValue,
      amount: Number(pkg.price), // price is stored in cents
      orderId: `APP-${Date.now()}`,
      customerEmail: patient.email,
      customerFirstName: patient.firstName,
      customerLastName: patient.lastName,
      description: `${pkg.name} - Handicap Permit Application`,
    });

    if (!chargeResult.success) {
      res.status(402).json({ message: chargeResult.message });
      return;
    }

    // Create the application with paid status
    const workflowSteps = (pkg.workflowSteps as string[]) || defaultConfig.workflowSteps;
    const application = await storage.createApplication({
      userId: patient.id,
      packageId,
      currentStep: 1,
      totalSteps: workflowSteps.length,
      status: "pending",
      formData: {
        ...(formData || {}),
        paymentTransactionId: chargeResult.transactionId,
        paymentAuthCode: chargeResult.authCode,
      },
      paymentStatus: "paid",
      paymentAmount: pkg.price,
    });

    for (let i = 0; i < workflowSteps.length; i++) {
      await storage.createApplicationStep({
        applicationId: application.id,
        stepNumber: i + 1,
        name: workflowSteps[i],
        status: i === 0 ? "in-progress" : "pending",
      });
    }

    // Auto-assign to doctor (same round-robin logic used elsewhere)
    const adminSettings = await storage.getAdminSettings();
    const patientAppState = formData?.state || patient.state || "";
    const doctor = await storage.getNextDoctorForAssignment(patientAppState || undefined);

    if (doctor) {
      const doctorUser = await storage.getUser(doctor.userId || doctor.id);
      const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
      const host = req.get("host") || "localhost:5000";

      if (adminSettings?.autoCompleteApplications) {
        // Auto-complete path (skip doctor review)
        await storage.updateApplication(application.id, {
          status: "doctor_approved",
          assignedReviewerId: doctor.userId || doctor.id,
          level2ApprovedAt: new Date(),
          level2ApprovedBy: doctor.userId || doctor.id,
        });
        await autoGenerateDocument(application.id, doctor.userId || doctor.id);
        fireAutoMessageTriggers(application.id, "doctor_approved");

        // Email patient
        const patientContactEmail = getContactEmail(patient);
        if (patientContactEmail) {
          const dashboardUrl = `${protocol}://${host}/dashboard/applicant/documents`;
          sendPatientApprovalEmail({
            patientEmail: patientContactEmail, patientName,
            packageName: pkg.name, applicationId: application.id, dashboardUrl,
          }).catch(err => console.error("Payment auto-complete patient email error:", err));
        }
        // Email doctor copy
        if (doctorUser) {
          sendDoctorCompletionCopyEmail({
            doctorEmail: getContactEmail(doctorUser),
            doctorName: doctorUser.lastName || doctor.fullName || "Doctor",
            patientName, patientEmail: getContactEmail(patient),
            packageName: pkg.name, applicationId: application.id,
            formData: formData || {},
          }).catch(err => console.error("Payment auto-complete doctor copy error:", err));
        }
        // Email admin notification
        const notificationEmail = adminSettings?.notificationEmail;
        if (notificationEmail) {
          sendAdminNotificationEmail({
            adminEmail: notificationEmail,
            doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
            patientName, patientEmail: getContactEmail(patient),
            packageName: pkg.name, formData: formData || {},
            reviewUrl: `${protocol}://${host}/dashboard/admin/applications`,
            applicationId: application.id,
          }).catch(err => console.error("Payment auto-complete admin email error:", err));
        }
      } else {
        // Normal path — assign to doctor for review
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await storage.createDoctorReviewToken({
          applicationId: application.id,
          doctorId: doctor.userId || doctor.id,
          token, status: "pending", expiresAt,
        });
        await storage.updateApplication(application.id, {
          status: "doctor_review",
          assignedReviewerId: doctor.userId || doctor.id,
        });

        const reviewUrl = `${protocol}://${host}/review/${token}`;

        // Email doctor with review link
        if (doctorUser) {
          sendDoctorApprovalEmail({
            doctorEmail: getContactEmail(doctorUser),
            doctorName: doctorUser.lastName || doctor.fullName || "Doctor",
            patientName, patientEmail: getContactEmail(patient),
            packageName: pkg.name, formData: formData || {},
            reviewUrl, applicationId: application.id,
          }).catch(err => console.error("Payment doctor email error:", err));
        }
        // Email admin notification
        const notificationEmail = adminSettings?.notificationEmail;
        if (notificationEmail) {
          sendAdminNotificationEmail({
            adminEmail: notificationEmail,
            doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
            patientName, patientEmail: getContactEmail(patient),
            packageName: pkg.name, formData: formData || {},
            reviewUrl, applicationId: application.id,
          }).catch(err => console.error("Payment admin email error:", err));
        }
        fireAutoMessageTriggers(application.id, "doctor_review");
      }
    }

    // Log the payment activity
    await storage.createActivityLog({
      userId: patient.id,
      action: "payment_completed",
      entityType: "application",
      entityId: application.id,
      details: {
        transactionId: chargeResult.transactionId,
        amount: Number(pkg.price),
        packageName: pkg.name,
      },
    });

    // Clear draft
    await storage.updateUser(patient.id, { draftFormData: {} } as any);

    res.json({
      success: true,
      application,
      transactionId: chargeResult.transactionId,
      message: "Payment processed and application submitted successfully",
    });
  } catch (error: any) {
    console.error("Payment charge error:", error);
    res.status(500).json({ message: error.message || "Payment processing failed" });
  }
});
```

### 5.3 Backend: Admin Process Payment Endpoint (routes.ts)

This endpoint lets an admin manually mark an `awaiting_payment` application as paid and trigger the doctor assignment pipeline. Add it near the other admin application routes:

```typescript
app.post("/api/admin/applications/:id/process-payment", requireAuth, requireLevel(3), async (req, res) => {
  try {
    const applicationId = req.params.id as string;
    const application = await storage.getApplication(applicationId);
    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (application.status !== "awaiting_payment") {
      res.status(400).json({ message: `Cannot process payment for application with status: ${application.status}` });
      return;
    }

    await storage.updateApplication(applicationId, {
      paymentStatus: "paid",
      status: "pending",
    });

    // Then trigger the same doctor assignment + email logic as the payment charge endpoint
    // (round-robin assignment, token creation, emails to doctor + admin)
    // ... same pattern as section 5.2 above, using application.formData and application.userId
    // See server/routes.ts for the full implementation

    res.json({
      success: true,
      message: "Payment processed and application sent for review",
      reviewUrl,  // from doctor assignment
      doctor: doctorInfo,  // { id, name }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

### 5.4 Frontend: Wizard State Variables (NewApplication.tsx)

Add these state variables alongside the existing wizard state:

```typescript
const [step, setStep] = useState(1);
const totalSteps = 3; // was 4, now: Select Permit → Your Information → Review & Pay

// Payment state
const [cardNumber, setCardNumber] = useState("");
const [cardExpMonth, setCardExpMonth] = useState("");
const [cardExpYear, setCardExpYear] = useState("");
const [cardCvv, setCardCvv] = useState("");
const [paymentProcessing, setPaymentProcessing] = useState(false);
const [paymentError, setPaymentError] = useState("");
const [acceptJsReady, setAcceptJsReady] = useState(false);
```

### 5.5 Frontend: Payment Config Query & Accept.js Loading (NewApplication.tsx)

Add this query after the packages query. It fetches the Authorize.Net config and dynamically loads the Accept.js script:

```typescript
const { data: paymentConfig } = useQuery<{
  configured: boolean;
  acceptJsUrl: string;
  apiLoginId: string;
  clientKey: string;
}>({
  queryKey: ["/api/payment/config"],
});

useEffect(() => {
  if (paymentConfig?.acceptJsUrl) {
    const existing = document.querySelector(`script[src="${paymentConfig.acceptJsUrl}"]`);
    if (existing) {
      if ((window as any).Accept) setAcceptJsReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = paymentConfig.acceptJsUrl;
    script.charset = "utf-8";
    script.onload = () => setAcceptJsReady(true);
    document.head.appendChild(script);
  }
}, [paymentConfig?.acceptJsUrl]);
```

### 5.6 Frontend: Payment Processing Function (NewApplication.tsx)

Replace the old `createApplication` mutation with `buildFormData` and `processPayment`:

```typescript
const buildFormData = () => {
  const data = form.getValues();
  const fullName = [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ");
  const conditionLabel = DISABILITY_CONDITIONS.find(c => c.value === data.disabilityCondition)?.label || data.disabilityCondition;
  return {
    ...data,
    ...customFields,
    fullName,
    firstName: profile?.firstName,
    middleName: profile?.middleName,
    lastName: profile?.lastName,
    email: profile?.email,
    phone: profile?.phone,
    dateOfBirth: profile?.dateOfBirth,
    address: profile?.address,
    city: profile?.city,
    state: profile?.state,
    zipCode: profile?.zipCode,
    driverLicenseNumber: profile?.driverLicenseNumber,
    medicalCondition: conditionLabel,
    disabilityCondition: data.disabilityCondition,
    ssn: profile?.ssn,
    hasMedicare: profile?.hasMedicare,
    isVeteran: profile?.isVeteran,
  };
};

const processPayment = async () => {
  if (!cardNumber || !cardExpMonth || !cardExpYear || !cardCvv) {
    setPaymentError("Please fill in all card fields");
    return;
  }

  setPaymentProcessing(true);
  setPaymentError("");

  try {
    const Accept = (window as any).Accept;
    if (!Accept) {
      throw new Error("Payment system is loading. Please wait a moment and try again.");
    }

    // Step 1: Tokenize card client-side via Accept.js
    const secureData = {
      authData: {
        clientKey: paymentConfig?.clientKey || "",
        apiLoginID: paymentConfig?.apiLoginId || "",
      },
      cardData: {
        cardNumber: cardNumber.replace(/\s/g, ""),
        month: cardExpMonth.padStart(2, "0"),
        year: cardExpYear.length === 2 ? "20" + cardExpYear : cardExpYear,
        cardCode: cardCvv,
      },
    };

    const opaqueData = await new Promise<{ dataDescriptor: string; dataValue: string }>((resolve, reject) => {
      Accept.dispatchData(secureData, (response: any) => {
        if (response.opaqueData) {
          resolve(response.opaqueData);
        } else {
          const errorMsg = response.messages?.message?.[0]?.text || "Card validation failed";
          reject(new Error(errorMsg));
        }
      });
    });

    // Step 2: Send token to server to charge and create application
    const formData = buildFormData();
    const res = await apiRequest("POST", "/api/payment/charge", {
      opaqueDataDescriptor: opaqueData.dataDescriptor,
      opaqueDataValue: opaqueData.dataValue,
      packageId: form.getValues("packageId"),
      formData,
    });
    const result = await res.json();

    if (!result.success) {
      throw new Error(result.message || "Payment failed");
    }

    // Step 3: Success — clear draft, redirect
    queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    apiRequest("PUT", "/api/profile/draft-form", { draftFormData: {} }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["/api/profile/draft-form"] });
    toast({
      title: "Payment Successful!",
      description: "Your application has been submitted and is being processed.",
    });
    setLocation("/dashboard/applicant");
  } catch (error: any) {
    setPaymentError(error.message || "Payment processing failed");
    toast({
      title: "Payment Failed",
      description: error.message || "Please check your card details and try again.",
      variant: "destructive",
    });
  } finally {
    setPaymentProcessing(false);
  }
};
```

### 5.7 Frontend: Step 3 — Review & Pay UI (NewApplication.tsx)

Replace the old Step 3 (payment placeholder) and Step 4 (review) with a single Step 3 that combines both:

```tsx
{step === 3 && (
  <div className="space-y-6">
    {/* Order Review Card */}
    <Card data-testid="step-review-submit">
      <CardHeader>
        <CardTitle>Review Your Order</CardTitle>
        <CardDescription>Verify your information before payment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground mb-1">Selected Permit Type</p>
          <p className="text-lg font-bold" data-testid="text-selected-package">{selectedPackage?.name}</p>
          <p className="text-sm text-muted-foreground mt-1">{selectedPackage?.description}</p>
          <p className="text-2xl font-bold text-primary mt-2" data-testid="text-selected-price">
            ${selectedPackage ? (Number(selectedPackage.price) / 100).toFixed(2) : "0.00"}
          </p>
        </div>
        {/* Applicant info, qualifying condition, reason — same review fields as before */}
      </CardContent>
    </Card>

    {/* Payment Card */}
    <Card data-testid="step-payment">
      <CardHeader>
        <CardTitle>Payment Information</CardTitle>
        <CardDescription>Enter your card details to complete your order</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg border bg-primary/5 text-center mb-4">
          <p className="text-sm text-muted-foreground">Amount Due</p>
          <p className="text-3xl font-bold text-primary" data-testid="text-payment-amount">
            ${selectedPackage ? (Number(selectedPackage.price) / 100).toFixed(2) : "0.00"}
          </p>
        </div>

        {paymentError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription data-testid="text-payment-error">{paymentError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="cardNumber">Card Number</Label>
          <Input
            id="cardNumber"
            placeholder="4111 1111 1111 1111"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 19))}
            maxLength={19}
            data-testid="input-card-number"
            disabled={paymentProcessing}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expMonth">Month</Label>
            <Select value={cardExpMonth} onValueChange={setCardExpMonth} disabled={paymentProcessing}>
              <SelectTrigger data-testid="select-exp-month">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, "0");
                  return <SelectItem key={m} value={m}>{m}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expYear">Year</Label>
            <Select value={cardExpYear} onValueChange={setCardExpYear} disabled={paymentProcessing}>
              <SelectTrigger data-testid="select-exp-year">
                <SelectValue placeholder="YYYY" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const y = String(new Date().getFullYear() + i);
                  return <SelectItem key={y} value={y}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cvv">CVV</Label>
            <Input
              id="cvv"
              placeholder="123"
              value={cardCvv}
              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              data-testid="input-cvv"
              disabled={paymentProcessing}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <Lock className="h-3.5 w-3.5" />
          Your payment is processed securely through Authorize.Net. Card details are never stored on our servers.
        </div>
      </CardContent>
    </Card>
  </div>
)}
```

### 5.8 Frontend: Submit Button (NewApplication.tsx)

Replace the old submit button with one that calls `processPayment` and shows loading states:

```tsx
{step < totalSteps ? (
  <Button type="button" onClick={nextStep} data-testid="button-next-step">
    Next
    <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
) : (
  <Button
    type="button"
    onClick={processPayment}
    disabled={paymentProcessing || !acceptJsReady}
    data-testid="button-submit-application"
  >
    {paymentProcessing ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Processing Payment...
      </>
    ) : !acceptJsReady ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Payment...
      </>
    ) : (
      <>
        <Check className="mr-2 h-4 w-4" />
        Pay ${selectedPackage ? (Number(selectedPackage.price) / 100).toFixed(2) : "0.00"} & Submit
      </>
    )}
  </Button>
)}
```

**Key details:**
- Button is `type="button"` (not `type="submit"`) — payment is handled by `processPayment`, not form submission
- Button is disabled until Accept.js has loaded (`acceptJsReady` state)
- Shows "Loading Payment..." while Accept.js script loads, "Processing Payment..." during charge

### 5.9 Frontend: Admin Applications List — Process Payment Button (ApplicationsListPage.tsx)

Add the ability for admins to manually process payment on `awaiting_payment` applications:

#### a. Add DollarSign icon import

```typescript
import { ..., DollarSign } from "lucide-react";
```

#### b. Add process payment mutation

```typescript
const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);

const processPaymentMutation = useMutation({
  mutationFn: async (applicationId: string) => {
    const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/process-payment`);
    return res.json();
  },
  onSuccess: (data) => {
    toast({
      title: "Payment Processed",
      description: data.message || "Application payment confirmed and sent for review.",
    });
    if (data.reviewUrl && data.doctor) {
      setReviewLinkDialog({ url: data.reviewUrl, doctorName: data.doctor.name || "Doctor" });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
    setProcessingPaymentId(null);
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to process payment",
      variant: "destructive",
    });
    setProcessingPaymentId(null);
  },
});
```

#### c. Add "Awaiting Payment" status filter and stat card

In the status filter dropdown:
```tsx
<SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
```

Add a stat card:
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
    <CardTitle className="text-sm font-medium">Awaiting Payment</CardTitle>
    <DollarSign className="h-4 w-4 text-orange-500" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{awaitingPaymentCount}</div>
    <p className="text-xs text-muted-foreground">Need payment</p>
  </CardContent>
</Card>
```

#### d. Add Process Payment button in application rows

In the application row, add this after the existing "Send to Doctor" button:
```tsx
{app.status === "awaiting_payment" && user.userLevel >= 3 && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      setProcessingPaymentId(app.id);
      processPaymentMutation.mutate(app.id);
    }}
    disabled={processPaymentMutation.isPending && processingPaymentId === app.id}
    data-testid={`button-process-payment-${app.id}`}
  >
    {processPaymentMutation.isPending && processingPaymentId === app.id ? (
      <Loader2 className="h-4 w-4 animate-spin mr-1" />
    ) : (
      <DollarSign className="h-4 w-4 mr-1" />
    )}
    Process Payment
  </Button>
)}
```

#### e. Add "Awaiting Payment" badge variant in ApplicantDashboard.tsx

In the `getStatusBadge` function, add:
```typescript
awaiting_payment: { variant: "outline", label: "Payment Pending" },
```

---

## Part 6: SendGrid Email Service

### Overview

Create a server-side email service that sends transactional emails via SendGrid at key workflow moments:
1. **Doctor gets a review request** with patient details + "Review & Approve" button
2. **Admin gets a notification copy** with the same approve link
3. **Doctor gets a records copy** when auto-complete is enabled (no action needed)
4. **Patient gets an approval email** directing them to log in and download their document

**Important**: The patient email does NOT include the PDF. It just tells them to sign in to their dashboard to download it.

**Secrets required**:
- `SENDGRID_API_KEY` — from SendGrid dashboard > Settings > API Keys
- `SENDGRID_FROM_EMAIL` — your verified sender email (defaults to `noreply@parkingrx.com`)

### 6.1 Install SendGrid Package

```bash
npm install @sendgrid/mail
```

### 6.2 Create `server/email.ts`

```typescript
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@parkingrx.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function isEmailConfigured(): boolean {
  return !!SENDGRID_API_KEY;
}

interface DoctorApprovalEmailData {
  doctorEmail: string;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  packageName: string;
  formData: Record<string, any>;
  reviewUrl: string;
  applicationId: string;
}

interface AdminNotificationEmailData {
  adminEmail: string;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  packageName: string;
  formData: Record<string, any>;
  reviewUrl: string;
  applicationId: string;
}

interface PatientDocumentEmailData {
  patientEmail: string;
  patientName: string;
  packageName: string;
  applicationId: string;
  dashboardUrl: string;
}

interface DoctorCompletionCopyData {
  doctorEmail: string;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  packageName: string;
  applicationId: string;
  formData: Record<string, any>;
}

function formatFormData(formData: Record<string, any>): string {
  if (!formData || Object.keys(formData).length === 0) return "<p>No additional details provided.</p>";
  let html = '<table style="width:100%;border-collapse:collapse;margin:16px 0;">';
  for (const [key, value] of Object.entries(formData)) {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).replace(/_/g, " ");
    html += `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-weight:600;color:#374151;white-space:nowrap;">${label}</td>
      <td style="padding:8px 12px;color:#4b5563;">${value ?? "—"}</td>
    </tr>`;
  }
  html += "</table>";
  return html;
}

export async function sendDoctorApprovalEmail(data: DoctorApprovalEmailData): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SendGrid not configured — skipping doctor approval email");
    return false;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#1e40af;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:14px;">New Application Review Request</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">Hello Dr. ${data.doctorName},</p>
        <p style="color:#374151;font-size:16px;line-height:1.6;">A new application has been submitted and requires your review.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #e5e7eb;">
          <h3 style="color:#1e40af;margin:0 0 12px;font-size:16px;">Patient Information</h3>
          <p style="margin:4px 0;color:#4b5563;"><strong>Name:</strong> ${data.patientName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Email:</strong> ${data.patientEmail}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Package:</strong> ${data.packageName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Application ID:</strong> ${data.applicationId}</p>
        </div>
        <div style="margin:20px 0;">
          <h3 style="color:#1e40af;margin:0 0 12px;font-size:16px;">Application Details</h3>
          ${formatFormData(data.formData)}
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${data.reviewUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 40px;text-decoration:none;border-radius:8px;font-size:18px;font-weight:600;">
            Review &amp; Approve
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;">
          This link will take you to the secure review portal. No login required.
        </p>
      </div>
      <div style="background:#f3f4f6;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Handicap Permit Services &bull; Secure Review System</p>
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to: data.doctorEmail,
      from: { email: FROM_EMAIL, name: "Handicap Permit Services" },
      subject: `Review Request: ${data.patientName} — ${data.packageName}`,
      html,
    });
    console.log(`Doctor approval email sent to ${data.doctorEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send doctor approval email:", error?.response?.body || error.message);
    return false;
  }
}

export async function sendAdminNotificationEmail(data: AdminNotificationEmailData): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SendGrid not configured — skipping admin notification email");
    return false;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#7c3aed;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#ddd6fe;margin:4px 0 0;font-size:14px;">Admin Notification — New Review Request</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">A new application has been sent for doctor review.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #e5e7eb;">
          <h3 style="color:#7c3aed;margin:0 0 12px;font-size:16px;">Assignment Details</h3>
          <p style="margin:4px 0;color:#4b5563;"><strong>Patient:</strong> ${data.patientName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Patient Email:</strong> ${data.patientEmail}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Package:</strong> ${data.packageName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Assigned Doctor:</strong> Dr. ${data.doctorName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Application ID:</strong> ${data.applicationId}</p>
        </div>
        <div style="margin:20px 0;">
          <h3 style="color:#7c3aed;margin:0 0 12px;font-size:16px;">Application Details</h3>
          ${formatFormData(data.formData)}
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${data.reviewUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 40px;text-decoration:none;border-radius:8px;font-size:18px;font-weight:600;">
            Review &amp; Approve
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;">
          You can also approve this application using the button above.
        </p>
      </div>
      <div style="background:#f3f4f6;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Handicap Permit Services &bull; Admin Notification</p>
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to: data.adminEmail,
      from: { email: FROM_EMAIL, name: "Handicap Permit Services" },
      subject: `[Admin] New Review: ${data.patientName} — ${data.packageName} (Assigned: Dr. ${data.doctorName})`,
      html,
    });
    console.log(`Admin notification email sent to ${data.adminEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send admin notification email:", error?.response?.body || error.message);
    return false;
  }
}

export async function sendDoctorCompletionCopyEmail(data: DoctorCompletionCopyData): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SendGrid not configured — skipping doctor completion copy email");
    return false;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0d9488;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#ccfbf1;margin:4px 0 0;font-size:14px;">Application Auto-Completed — Doctor Copy</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">Hello Dr. ${data.doctorName},</p>
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          The following application has been <strong style="color:#0d9488;">auto-completed</strong> and the patient has been sent their permit document. This email is for your records.
        </p>
        <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #e5e7eb;">
          <h3 style="color:#0d9488;margin:0 0 12px;font-size:16px;">Patient Information</h3>
          <p style="margin:4px 0;color:#4b5563;"><strong>Name:</strong> ${data.patientName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Email:</strong> ${data.patientEmail}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Package:</strong> ${data.packageName}</p>
          <p style="margin:4px 0;color:#4b5563;"><strong>Application ID:</strong> ${data.applicationId}</p>
        </div>
        <div style="margin:20px 0;">
          <h3 style="color:#0d9488;margin:0 0 12px;font-size:16px;">Application Details</h3>
          ${formatFormData(data.formData)}
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;">
          No action is required from you. This is a copy for your records.
        </p>
      </div>
      <div style="background:#f3f4f6;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Handicap Permit Services &bull; Doctor Records Copy</p>
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to: data.doctorEmail,
      from: { email: FROM_EMAIL, name: "Handicap Permit Services" },
      subject: `[Records] Auto-Completed: ${data.patientName} — ${data.packageName}`,
      html,
    });
    console.log(`Doctor completion copy email sent to ${data.doctorEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send doctor completion copy email:", error?.response?.body || error.message);
    return false;
  }
}

export async function sendPatientApprovalEmail(data: PatientDocumentEmailData): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SendGrid not configured — skipping patient document email");
    return false;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#16a34a;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#bbf7d0;margin:4px 0 0;font-size:14px;">Your Application Has Been Approved!</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">Hello ${data.patientName},</p>
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          Great news! Your <strong>${data.packageName}</strong> application has been reviewed and <strong style="color:#16a34a;">approved</strong> by a licensed medical professional.
        </p>
        <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #bbf7d0;">
          <h3 style="color:#16a34a;margin:0 0 8px;font-size:16px;">What's Next?</h3>
          <p style="margin:4px 0;color:#4b5563;">Your permit document has been prepared and is ready for download. Log in to your dashboard to access it.</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${data.dashboardUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;padding:14px 40px;text-decoration:none;border-radius:8px;font-size:18px;font-weight:600;">
            View My Dashboard
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;">Application ID: ${data.applicationId}</p>
      </div>
      <div style="background:#f3f4f6;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Handicap Permit Services &bull; Thank you for choosing us</p>
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to: data.patientEmail,
      from: { email: FROM_EMAIL, name: "Handicap Permit Services" },
      subject: `Your ${data.packageName} Has Been Approved!`,
      html,
    });
    console.log(`Patient approval email sent to ${data.patientEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send patient approval email:", error?.response?.body || error.message);
    return false;
  }
}
```

### 6.3 Import Email Functions in routes.ts

At the top of `server/routes.ts`:

```typescript
import { sendDoctorApprovalEmail, sendAdminNotificationEmail, sendPatientApprovalEmail, sendDoctorCompletionCopyEmail } from "./email";
```

---

## Part 7: Contact Email System & Admin Settings

### Overview

Two related features:

1. **Contact Email**: Each user can have a `contactEmail` field separate from their login email. All outbound emails use `contactEmail` if set, falling back to the login `email`. This lets users receive notifications at a different address than they log in with.

2. **Admin Settings**: Global configuration stored in a single Firestore document (`adminSettings/default`) with two key fields:
   - `notificationEmail` — the admin email that gets copies of all doctor review requests
   - `autoCompleteApplications` — boolean toggle that skips doctor review and auto-completes applications

### 7.1 Contact Email Helper (routes.ts)

Add this near the top of `routes.ts`, before route definitions:

```typescript
function getContactEmail(user: Record<string, any>): string {
  return user.contactEmail || user.email;
}
```

**Usage**: Every time you send an email, use `getContactEmail(user)` instead of `user.email`:
```typescript
sendDoctorApprovalEmail({ doctorEmail: getContactEmail(doctorUser), ... });
sendPatientApprovalEmail({ patientEmail: getContactEmail(patient), ... });
```

### 7.2 Admin Settings Storage (storage.ts)

Add these methods to your storage class. They read/write a single Firestore document at `adminSettings/default`:

```typescript
async getAdminSettings(): Promise<Record<string, any> | null> {
  const doc = await this.db.collection("adminSettings").doc("default").get();
  return doc.exists ? doc.data() as Record<string, any> : null;
}

async updateAdminSettings(data: Record<string, any>): Promise<Record<string, any>> {
  const ref = this.db.collection("adminSettings").doc("default");
  await ref.set(data, { merge: true });
  const updated = await ref.get();
  return updated.data() as Record<string, any>;
}
```

### 7.3 Admin Settings API Endpoints (routes.ts)

```typescript
app.get("/api/admin/settings", requireAuth, requireLevel(3), async (req, res) => {
  try {
    const settings = await storage.getAdminSettings();
    res.json(settings || {});
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/admin/settings", requireAuth, requireLevel(3), async (req, res) => {
  try {
    const settings = await storage.updateAdminSettings(req.body);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

### 7.4 Admin Settings UI (SettingsPage.tsx)

Add two components to the admin settings page, visible only when `user.userLevel >= 3`:

#### a. Auto-Complete Toggle

```tsx
function AutoCompleteSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { data: adminSettings } = useQuery<Record<string, any>>({
    queryKey: ["/api/admin/settings"],
  });

  const autoComplete = adminSettings?.autoCompleteApplications || false;

  const toggleAutoComplete = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", { autoCompleteApplications: enabled });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: enabled ? "Auto-Complete Enabled" : "Auto-Complete Disabled",
        description: enabled
          ? "Applications will be automatically completed after payment. The doctor will receive a copy."
          : "Applications will be sent to a doctor for manual review before completion.",
      });
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Auto-Complete Applications</CardTitle>
        </div>
        <CardDescription>
          When enabled, applications are automatically approved and completed after payment —
          no doctor review required. The patient receives their completed form immediately,
          and the assigned doctor gets a copy for their records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {autoComplete ? "Auto-Complete is ON" : "Auto-Complete is OFF"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {autoComplete
                ? "Applications skip doctor review and complete instantly after payment."
                : "Applications are sent to a doctor for review before completion."}
            </p>
          </div>
          <Switch
            checked={autoComplete}
            onCheckedChange={toggleAutoComplete}
            disabled={isSaving}
            data-testid="switch-auto-complete"
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

#### b. Notification Email Input

```tsx
function AdminNotificationSettings() {
  const { toast } = useToast();
  const [notificationEmail, setNotificationEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: adminSettings } = useQuery<Record<string, any>>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (adminSettings?.notificationEmail) {
      setNotificationEmail(adminSettings.notificationEmail);
    }
  }, [adminSettings]);

  const saveNotificationEmail = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", { notificationEmail: notificationEmail.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Notification Email Saved", description: "The admin notification email has been updated." });
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>Admin Notification Email</CardTitle>
        </div>
        <CardDescription>
          Set an email address that receives a copy of every approval request sent to doctors.
          Both the doctor and this email will get the same review link with an Approve button.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            type="email"
            placeholder="admin@example.com"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            data-testid="input-notification-email"
            className="flex-1"
          />
          <Button onClick={saveNotificationEmail} disabled={isSaving} data-testid="button-save-notification-email">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
        {adminSettings?.notificationEmail && (
          <p className="text-sm text-muted-foreground">
            Currently sending notifications to: <strong>{adminSettings.notificationEmail}</strong>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

#### c. Render in Settings page

In your SettingsPage component, add conditionally for admin+ users:
```tsx
{user.userLevel >= 3 && <AutoCompleteSettings />}
{user.userLevel >= 3 && <AdminNotificationSettings />}
```

---

## Part 8: Auto-Send to Doctor After Payment & Email Wiring

### Overview

After a successful Authorize.Net payment (or manual payment), the system automatically:
1. Creates the application with `paid` status
2. Picks the next doctor via state-filtered round-robin
3. Checks the `autoCompleteApplications` admin setting
4. **Auto-Complete ON**: Marks as `doctor_approved`, generates document, emails patient + doctor copy + admin
5. **Auto-Complete OFF**: Creates a review token (7-day expiry), emails doctor with review link + admin notification

This eliminates the need for any manual "send to doctor" step — it happens automatically on payment.

### 8.1 Auto-Send Logic in Payment Charge Endpoint

This logic is already covered in Part 5.2c (`POST /api/payment/charge`). The key section after the application is created:

```typescript
const adminSettings = await storage.getAdminSettings();
const patientAppState = formData?.state || patient.state || "";
const doctor = await storage.getNextDoctorForAssignment(patientAppState || undefined);

if (doctor) {
  const doctorUser = await storage.getUser(doctor.userId || doctor.id);
  const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
  const host = req.get("host") || "localhost:5000";

  if (adminSettings?.autoCompleteApplications) {
    // === AUTO-COMPLETE PATH ===
    await storage.updateApplication(application.id, {
      status: "doctor_approved",
      assignedReviewerId: doctor.userId || doctor.id,
      level2ApprovedAt: new Date(),
      level2ApprovedBy: doctor.userId || doctor.id,
    });
    await autoGenerateDocument(application.id, doctor.userId || doctor.id);
    fireAutoMessageTriggers(application.id, "doctor_approved");

    // Email patient (tells them to log in to download)
    const patientContactEmail = getContactEmail(patient);
    if (patientContactEmail) {
      const dashboardUrl = `${protocol}://${host}/dashboard/applicant/documents`;
      sendPatientApprovalEmail({
        patientEmail: patientContactEmail, patientName,
        packageName: pkg.name, applicationId: application.id, dashboardUrl,
      }).catch(err => console.error("Payment auto-complete patient email error:", err));
    }

    // Email doctor (records copy, no action needed)
    if (doctorUser) {
      sendDoctorCompletionCopyEmail({
        doctorEmail: getContactEmail(doctorUser),
        doctorName: doctorUser.lastName || doctor.fullName || "Doctor",
        patientName, patientEmail: getContactEmail(patient),
        packageName: pkg.name, applicationId: application.id,
        formData: formData || {},
      }).catch(err => console.error("Payment auto-complete doctor copy error:", err));
    }

    // Email admin notification
    const notificationEmail = adminSettings?.notificationEmail;
    if (notificationEmail) {
      sendAdminNotificationEmail({
        adminEmail: notificationEmail,
        doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
        patientName, patientEmail: getContactEmail(patient),
        packageName: pkg.name, formData: formData || {},
        reviewUrl: `${protocol}://${host}/dashboard/admin/applications`,
        applicationId: application.id,
      }).catch(err => console.error("Payment auto-complete admin email error:", err));
    }
  } else {
    // === DOCTOR REVIEW PATH ===
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await storage.createDoctorReviewToken({
      applicationId: application.id,
      doctorId: doctor.userId || doctor.id,
      token, status: "pending", expiresAt,
    });
    await storage.updateApplication(application.id, {
      status: "doctor_review",
      assignedReviewerId: doctor.userId || doctor.id,
    });

    const reviewUrl = `${protocol}://${host}/review/${token}`;

    // Email doctor with review link
    if (doctorUser) {
      sendDoctorApprovalEmail({
        doctorEmail: getContactEmail(doctorUser),
        doctorName: doctorUser.lastName || doctor.fullName || "Doctor",
        patientName, patientEmail: getContactEmail(patient),
        packageName: pkg.name, formData: formData || {},
        reviewUrl, applicationId: application.id,
      }).catch(err => console.error("Payment doctor email error:", err));
    }

    // Email admin notification (same review link)
    const notificationEmail = adminSettings?.notificationEmail;
    if (notificationEmail) {
      sendAdminNotificationEmail({
        adminEmail: notificationEmail,
        doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
        patientName, patientEmail: getContactEmail(patient),
        packageName: pkg.name, formData: formData || {},
        reviewUrl, applicationId: application.id,
      }).catch(err => console.error("Payment admin email error:", err));
    }

    fireAutoMessageTriggers(application.id, "doctor_review");
  }
}
```

### 8.2 Manual Send-to-Doctor Admin Endpoint

The `POST /api/admin/applications/:id/send-to-doctor` endpoint allows admins to manually (re)assign an application:

```typescript
app.post("/api/admin/applications/:id/send-to-doctor", requireAuth, requireLevel(3), async (req, res) => {
  try {
    const applicationId = req.params.id as string;
    const { doctorId: manualDoctorId } = req.body;

    const application = await storage.getApplication(applicationId);
    if (!application) { res.status(404).json({ message: "Application not found" }); return; }

    const appFormData = (application.formData || {}) as Record<string, any>;
    const appPatient = application.userId ? await storage.getUser(application.userId) : null;
    const appPatientState = appPatient?.state || appFormData.state || "";

    // Pick doctor: manual selection or round-robin
    let doctor;
    if (manualDoctorId) {
      doctor = await storage.getDoctorProfile(manualDoctorId);
      if (!doctor) {
        const allDoctors = await storage.getActiveDoctors();
        doctor = allDoctors.find(d => d.userId === manualDoctorId);
      }
    } else {
      doctor = await storage.getNextDoctorForAssignment(appPatientState || undefined);
    }
    if (!doctor) { res.status(400).json({ message: "No active doctors available" }); return; }

    // Create review token (7-day expiry)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await storage.createDoctorReviewToken({
      applicationId, doctorId: doctor.userId || doctor.id,
      token, status: "pending", expiresAt,
    });
    await storage.updateApplication(applicationId, {
      status: "doctor_review",
      assignedReviewerId: doctor.userId || doctor.id,
    });

    const patient = application.userId ? await storage.getUser(application.userId) : null;
    const pkg = application.packageId ? await storage.getPackage(application.packageId) : null;
    const doctorUser = await storage.getUser(doctor.userId || doctor.id);
    const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
    const host = req.get("host") || "localhost:5000";
    const reviewUrl = `${protocol}://${host}/review/${token}`;

    // Create notifications
    await storage.createNotification({
      userId: req.user!.id,
      type: "doctor_assignment",
      title: "Application Sent to Doctor",
      message: `Application for ${patient?.firstName || "Patient"} sent to Dr. ${doctorUser?.lastName || "Doctor"}. Review link: ${reviewUrl}`,
      isRead: false, actionUrl: reviewUrl,
    });

    if (doctorUser) {
      await storage.createNotification({
        userId: doctorUser.id,
        type: "review_assigned",
        title: "New Patient Review Assigned",
        message: `You have been assigned to review ${patient?.firstName || "a patient"}'s application.`,
        isRead: false,
      });
    }

    fireAutoMessageTriggers(applicationId, "doctor_review");

    // Send emails to doctor AND admin
    const doctorEmail = doctorUser ? getContactEmail(doctorUser) : null;
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Patient";
    const patientEmail = patient ? getContactEmail(patient) : "";
    const packageName = pkg?.name || "Handicap Permit";

    if (doctorEmail) {
      sendDoctorApprovalEmail({
        doctorEmail,
        doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
        patientName, patientEmail, packageName,
        formData: application.formData || {},
        reviewUrl, applicationId,
      }).catch(err => console.error("Doctor email error:", err));
    }

    const adminSettings = await storage.getAdminSettings();
    const notificationEmail = adminSettings?.notificationEmail;
    if (notificationEmail) {
      sendAdminNotificationEmail({
        adminEmail: notificationEmail,
        doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
        patientName, patientEmail, packageName,
        formData: application.formData || {},
        reviewUrl, applicationId,
      }).catch(err => console.error("Admin notification email error:", err));
    }

    res.json({
      success: true, reviewUrl,
      doctor: { id: doctor.userId || doctor.id, name: doctorUser?.lastName || doctor.fullName || "Doctor" },
      message: "Application sent to doctor for review",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

---

## Part 9: Doctor Approval → Auto-Generate Document & Email Patient

### Overview

When a doctor approves an application via the token-based review portal, the system:
1. Updates the application to `doctor_approved`
2. Auto-generates a document using the doctor's HTML template (or a default)
3. Sends the patient an email telling them to log in and download their document
4. Creates an in-app notification for the patient

**Important**: The PDF is NOT sent in the email. The patient must log in to view/download it.

### 9.1 Auto-Generate Document Function (routes.ts)

Place this function near the top of `routes.ts`, before route definitions:

```typescript
async function autoGenerateDocument(applicationId: string, doctorId: string) {
  try {
    const app = await storage.getApplication(applicationId);
    if (!app) return;

    const doctorProfile = await storage.getDoctorProfileByUserId(doctorId);
    const patient = app.userId ? await storage.getUser(app.userId) : null;
    const pkg = app.packageId ? await storage.getPackage(app.packageId) : null;
    const formData = (app.formData || {}) as Record<string, any>;

    const now = new Date();
    const dateLong = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const dateShort = now.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });

    const placeholders: Record<string, string> = {
      doctorName: doctorProfile?.fullName || "Physician",
      doctorLicense: doctorProfile?.licenseNumber || "",
      doctorNPI: doctorProfile?.npiNumber || "",
      doctorDEA: doctorProfile?.deaNumber || "",
      doctorPhone: doctorProfile?.phone || "",
      doctorFax: doctorProfile?.fax || "",
      doctorAddress: doctorProfile?.address || "",
      doctorSpecialty: doctorProfile?.specialty || "",
      doctorState: (doctorProfile as any)?.state || "",
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient",
      patientFirstName: patient?.firstName || "",
      patientLastName: patient?.lastName || "",
      patientDOB: patient?.dateOfBirth || formData.dateOfBirth || "",
      patientPhone: patient?.phone || formData.phone || "",
      patientEmail: patient?.email || formData.email || "",
      patientAddress: patient?.address || formData.address || "",
      patientCity: patient?.city || formData.city || "",
      patientState: patient?.state || formData.state || "",
      patientZipCode: patient?.zipCode || formData.zipCode || "",
      patientSSN: formData.ssn || patient?.ssn || "",
      patientDriverLicense: formData.driverLicenseNumber || patient?.driverLicenseNumber || "",
      patientMedicalCondition: formData.medicalCondition || patient?.medicalCondition || "",
      reason: formData.reason || "",
      packageName: pkg?.name || "Service Document",
      date: dateLong,
      dateShort: dateShort,
    };

    let generatedHtml = "";
    const template = (doctorProfile as any)?.formTemplate;
    if (template && template.trim().length > 0) {
      generatedHtml = renderTemplate(template, placeholders);
    } else {
      generatedHtml = `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;">
          <h1 style="text-align:center;color:#1e40af;">Medical Recommendation</h1>
          <p style="text-align:center;color:#6b7280;">${dateLong}</p>
          <hr style="margin:24px 0;border-color:#e5e7eb;" />
          <h3>Patient Information</h3>
          <p><strong>Name:</strong> ${placeholders.patientName}</p>
          <p><strong>Date of Birth:</strong> ${placeholders.patientDOB}</p>
          <p><strong>Address:</strong> ${placeholders.patientAddress}, ${placeholders.patientCity}, ${placeholders.patientState} ${placeholders.patientZipCode}</p>
          <p><strong>Phone:</strong> ${placeholders.patientPhone}</p>
          ${placeholders.patientMedicalCondition ? `<p><strong>Medical Condition:</strong> ${placeholders.patientMedicalCondition}</p>` : ""}
          ${placeholders.reason ? `<p><strong>Reason:</strong> ${placeholders.reason}</p>` : ""}
          <hr style="margin:24px 0;border-color:#e5e7eb;" />
          <h3>Service: ${placeholders.packageName}</h3>
          <p>This document certifies that the above-named patient has been evaluated and qualifies for the requested service.</p>
          <hr style="margin:24px 0;border-color:#e5e7eb;" />
          <h3>Certifying Physician</h3>
          <p><strong>Name:</strong> ${placeholders.doctorName}</p>
          <p><strong>License:</strong> ${placeholders.doctorLicense}</p>
          <p><strong>NPI:</strong> ${placeholders.doctorNPI}</p>
          ${placeholders.doctorDEA ? `<p><strong>DEA:</strong> ${placeholders.doctorDEA}</p>` : ""}
          ${placeholders.doctorSpecialty ? `<p><strong>Specialty:</strong> ${placeholders.doctorSpecialty}</p>` : ""}
          ${placeholders.doctorPhone ? `<p><strong>Phone:</strong> ${placeholders.doctorPhone}</p>` : ""}
          ${placeholders.doctorAddress ? `<p><strong>Address:</strong> ${placeholders.doctorAddress}</p>` : ""}
        </div>
      `;
    }

    const docContent = {
      applicationId,
      packageName: placeholders.packageName,
      patientName: placeholders.patientName,
      patientEmail: placeholders.patientEmail,
      doctorName: placeholders.doctorName,
      doctorLicense: placeholders.doctorLicense,
      doctorNPI: placeholders.doctorNPI,
      doctorDEA: placeholders.doctorDEA,
      generatedAt: now.toISOString(),
      status: "auto_generated",
      notes: app.level2Notes || app.level3Notes || "",
      generatedHtml,
      placeholders,
    };

    const document = await storage.createDocument({
      applicationId,
      userId: app.userId || "",
      name: `${placeholders.packageName} - Auto Generated`,
      type: "auto_generated",
      status: "completed",
      fileUrl: "",
      metadata: docContent,
    } as any);

    console.log(`Document auto-generated for application ${applicationId}`);
    return document;
  } catch (error) {
    console.error("Error auto-generating document:", error);
  }
}

function renderTemplate(template: string, placeholders: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => placeholders[key] || "");
}
```

### 9.2 Doctor Approval Decision Endpoint (routes.ts)

The token-based review endpoint that triggers document generation and patient email:

```typescript
app.post("/api/review/:token/decision", async (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!decision || !["approved", "denied"].includes(decision)) {
      res.status(400).json({ message: "Decision must be 'approved' or 'denied'" });
      return;
    }

    const tokenRecord = await storage.getDoctorReviewTokenByToken(req.params.token);
    if (!tokenRecord) { res.status(404).json({ message: "Review link not found" }); return; }
    if (tokenRecord.status !== "pending") { res.status(410).json({ message: "This review has already been completed" }); return; }
    if (new Date() > new Date(tokenRecord.expiresAt)) {
      await storage.updateDoctorReviewToken(tokenRecord.id, { status: "expired" } as any);
      res.status(410).json({ message: "This review link has expired" });
      return;
    }

    await storage.updateDoctorReviewToken(tokenRecord.id, {
      status: decision, usedAt: new Date(), doctorNotes: notes || null,
    } as any);

    const application = await storage.getApplication(tokenRecord.applicationId);

    if (decision === "approved") {
      await storage.updateApplication(tokenRecord.applicationId, {
        status: "doctor_approved",
        level2Notes: notes,
        level2ApprovedAt: new Date(),
        level2ApprovedBy: tokenRecord.doctorId,
        assignedReviewerId: tokenRecord.doctorId,
      });

      // Auto-generate the document
      await autoGenerateDocument(tokenRecord.applicationId, tokenRecord.doctorId);
      fireAutoMessageTriggers(tokenRecord.applicationId, "doctor_approved");

      // Notify and email the patient
      if (application?.userId) {
        await storage.createNotification({
          userId: application.userId,
          type: "application_approved",
          title: "Application Approved",
          message: "Your application has been approved by the reviewing doctor. Your documents are being prepared.",
          isRead: false,
        });

        const patient = await storage.getUser(application.userId);
        const pkg = application.packageId ? await storage.getPackage(application.packageId) : null;
        if (patient) {
          const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
          const host = req.get("host") || "localhost:5000";
          const dashboardUrl = `${protocol}://${host}/dashboard/applicant/documents`;
          sendPatientApprovalEmail({
            patientEmail: getContactEmail(patient),
            patientName: `${patient.firstName} ${patient.lastName}`,
            packageName: pkg?.name || "Handicap Permit",
            applicationId: tokenRecord.applicationId,
            dashboardUrl,
          }).catch(err => console.error("Patient approval email error:", err));
        }
      }
    } else {
      // Denied
      await storage.updateApplication(tokenRecord.applicationId, {
        status: "doctor_denied",
        level2Notes: notes,
        rejectedAt: new Date(),
        rejectedBy: tokenRecord.doctorId,
        rejectionReason: notes,
      });
      fireAutoMessageTriggers(tokenRecord.applicationId, "doctor_denied");

      if (application?.userId) {
        await storage.createNotification({
          userId: application.userId,
          type: "application_denied",
          title: "Application Not Approved",
          message: notes ? `Your application was not approved. Reason: ${notes}` : "Your application was not approved at this time.",
          isRead: false,
        });
      }
    }

    await storage.createActivityLog({
      userId: tokenRecord.doctorId,
      action: `doctor_${decision}`,
      entityType: "application",
      entityId: tokenRecord.applicationId,
      details: { notes, tokenId: tokenRecord.id } as any,
    });

    res.json({ message: `Application ${decision} successfully`, decision });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

---

## Part 10: Radio Button Positioning Fix for Oklahoma PDF

### Overview

The Oklahoma disability form PDF has checkboxes for conditions A-H (radio IDs 7-14), duration options (15-16), and radio 6. These placeholder tokens are scanned from the PDF text layer, but the text coordinates don't perfectly align with the visual checkbox squares. Radio buttons 6-16 need to shift **+1px right** and **-5px up** to align with the actual boxes.

### 10.1 GizmoForm.tsx: Radio Position Offset

In `extractPlaceholdersFromPdf`, update both radio detection paths to apply per-option offsets.

**Path 1 — Regex-based detection** (the `radioRegex` loop):

```typescript
if (anchorItem) {
  const num = parseInt(option, 10);
  const radioOffsetX = num >= 6 && num <= 16 ? 1 : 0;
  const radioOffsetY = num >= 6 && num <= 16 ? -5 : 0;
  const x = anchorItem.transform[4] + offsets.x + radioOffsetX;
  const y = viewport.height - anchorItem.transform[5] + offsets.y + radioOffsetY;
  const fontSize = anchorItem.height || 12;
  // ... rest of radio push
}
```

**Path 2 — Item-based detection** (the `addRadioFromItem` helper):

```typescript
const addRadioFromItem = (option: string, itemX: number, itemY: number, itemHeight: number) => {
  if (seenRadioOptions.has(option)) return;
  seenRadioOptions.add(option);

  const group = getRadioGroup(option);
  const num = parseInt(option, 10);
  const radioOffsetX = num >= 6 && num <= 16 ? 1 : 0;
  const radioOffsetY = num >= 6 && num <= 16 ? -5 : 0;
  const x = itemX + offsets.x + radioOffsetX;
  const y = viewport.height - itemY + offsets.y + radioOffsetY;
  const fontSize = itemHeight || 12;
  // ... rest of radio push
};
```

Both paths must have the same offset logic. The offsets are applied after the base `offsets.x/y` (which come from `DOCTOR_FORM_OFFSETS`) so they stack correctly.

**Tuning tip**: If other state PDFs have different alignment issues, you can adjust the conditions (`num >= 6 && num <= 16`) or add per-group offsets instead.

---

## Complete Data Flow Summary

1. **Admin** creates a package with radio fields: each option has a radio ID number and a statement
2. **Admin** configures notification email and auto-complete toggle in Settings
3. **Patient** opens the application wizard → draft is loaded from Firestore if they have one
4. **Patient** selects a package, answers radio questions → each answer saves the radio ID (e.g., `"7"`)
5. **Patient** progress auto-saves to Firestore every second (debounced)
6. **Patient** can close browser and come back — everything is restored
7. **Patient** enters credit card on Step 3 → Accept.js tokenizes client-side → server charges via Authorize.Net
8. **On successful payment**: application created with `paid` status, draft cleared
9. **Auto-assignment**: system picks next doctor via state-filtered round-robin
10. **If auto-complete ON**: application marked `doctor_approved`, document auto-generated, patient emailed to download, doctor gets records copy
11. **If auto-complete OFF**: review token created (7-day expiry), doctor emailed with "Review & Approve" link, admin notification email sent with same link
12. **Doctor clicks link** → reviews application in portal → clicks Approve/Deny
13. **On approval**: `autoGenerateDocument` runs, patient emailed to sign in and download, in-app notification created
14. **Patient views PDF** on dashboard → `GET /api/forms/data/:applicationId` runs:
    - Resolves PDF URL: `doctorProfile.stateForms[patientState]` → `doctorProfile.gizmoFormUrl` fallback
    - Collects `selectedRadioIds` from fields with `radioOptions` definitions
    - Returns `selectedRadioIds` array in response
15. **GizmoForm** scans the PDF for `{radio_id_N}` placeholders:
    - Applies position offsets for radio IDs 6-16 (+1px right, -5px up)
    - First checks if `N` is in the `selectedRadioIds` set (direct 1-to-1 match)
    - Falls back to `RADIO_AUTO_FILL` value map lookup (legacy support)
    - Checks the matching radio button on the PDF
16. **Patient downloads/prints** the auto-filled PDF from their dashboard

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `server/email.ts` | **New file** — SendGrid email service with 4 functions: sendDoctorApprovalEmail, sendAdminNotificationEmail, sendDoctorCompletionCopyEmail, sendPatientApprovalEmail |
| `server/authorizenet.ts` | **New file** — Authorize.Net Accept.js integration: chargeCard, isAuthorizeNetConfigured, getAcceptJsUrl, getApiLoginId |
| `server/routes.ts` | Email imports, getContactEmail helper, autoGenerateDocument function, payment config/charge endpoints, admin settings endpoints, send-to-doctor with email wiring, doctor review decision with patient email, admin process-payment endpoint, draft form endpoints, selectedRadioIds collection, manual payment draft integration, per-doctor state form resolution |
| `server/storage.ts` | Doctor profile stateForms field in create/update, getAdminSettings/updateAdminSettings methods |
| `client/src/pages/dashboard/admin/PackagesManagement.tsx` | radioOptions schema, radio ID + statement editor UI |
| `client/src/pages/dashboard/applicant/NewApplication.tsx` | 3-step wizard (Select Permit → Info → Review & Pay), Accept.js loading, payment processing, draft load/save, radioOptions rendering, draft clear on submit |
| `client/src/pages/dashboard/shared/SettingsPage.tsx` | AutoCompleteSettings toggle, AdminNotificationSettings email input (admin+ only) |
| `client/src/pages/dashboard/shared/ApplicationsListPage.tsx` | Awaiting Payment stat card/filter, Process Payment button for admin |
| `client/src/components/GizmoForm.tsx` | selectedRadioIds interface field, Set-based direct matching before RADIO_AUTO_FILL fallback, radio position offsets for IDs 6-16 |
| `client/src/components/shared/UserProfileModal.tsx` | stateForms UI (green cards, amber upload card, state dropdown) |

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key for sending transactional emails |
| `SENDGRID_FROM_EMAIL` | Verified sender email (defaults to `noreply@parkingrx.com`) |
| `AUTHORIZENET_API_LOGIN_ID` | Authorize.Net API Login ID |
| `AUTHORIZENET_TRANSACTION_KEY` | Authorize.Net Transaction Key |
| `AUTHORIZENET_CLIENT_KEY` | Authorize.Net Public Client Key (for Accept.js) |
| `AUTHORIZENET_SANDBOX` | Set to `"true"` for test mode, omit for production |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK service account JSON |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name |
