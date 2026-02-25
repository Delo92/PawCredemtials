# Doctor Profile Management & Form Template — Implementation Guide

This guide covers the admin-side doctor profile management features: creating doctor accounts with credentials and form templates via the Add User dialog, and editing existing doctor profiles via the UserProfileModal.

---

## What Was Added

### 1. UsersManagement.tsx — Add User Dialog with Doctor Tabs

**File: `client/src/pages/dashboard/admin/UsersManagement.tsx`**

Rewrote the "Add User" dialog to use a tabbed interface. When the admin selects Level 2 (Doctor) as the role, two additional tabs appear:

**Tab 1: Account** (always visible)
- First Name, Last Name, Email, Password, Phone, Role dropdown
- When Doctor is selected, a note appears: "Doctor selected — use the Credentials and Form Template tabs to set up their profile."

**Tab 2: Credentials** (only visible when Level 2 selected)
- Full Name (as it appears on documents)
- License Number, NPI Number
- DEA Number, Specialty
- Office Phone, Fax
- Office Address, State

**Tab 3: Form Template** (only visible when Level 2 selected)
- Info box explaining placeholder syntax
- "Show/Hide Available Placeholders" toggle button
- Collapsible placeholder reference grid (26 placeholders with descriptions)
- Large monospace textarea for HTML template input
- Description explaining that the template generates documents on approval

The form watches the `userLevel` field to conditionally show/hide the doctor tabs:

```typescript
const watchedLevel = form.watch("userLevel");
const isDoctor = watchedLevel === "2";
```

On submit, if doctor is selected, the payload includes a `doctorProfile` object:

```typescript
if (parseInt(data.userLevel) === 2) {
  payload.doctorProfile = {
    fullName: data.doctorFullName || `${data.firstName} ${data.lastName}`,
    licenseNumber: data.doctorLicense || "",
    npiNumber: data.doctorNPI || "",
    deaNumber: data.doctorDEA || "",
    phone: data.doctorPhone || data.phone || "",
    fax: data.doctorFax || "",
    address: data.doctorAddress || "",
    specialty: data.doctorSpecialty || "",
    state: data.doctorState || "",
    formTemplate: data.formTemplate || "",
  };
}
```

**User list also updated:** Doctor users (Level 2) now show a stethoscope icon next to their name in the table.

### 2. UserProfileModal.tsx — Doctor Profile Tab

**File: `client/src/components/shared/UserProfileModal.tsx`**

Added a "Doctor" tab (with stethoscope icon) to the user profile modal. This tab only appears when the selected user is Level 2.

**What's in the Doctor tab:**

- **Doctor Credentials section** — Editable fields for: Full Name (on documents), License Number, NPI Number, DEA Number, Specialty, Office Phone, Fax, Office Address, State
- **Active/Inactive badge** — Shows whether the doctor profile is active
- **Amber warning** if no doctor profile exists yet ("No doctor profile exists yet. Fill in the details below and save to create one.")
- **Form Template section** — Same as Add User: placeholder toggle, reference grid, large HTML textarea
- **Save button** — Creates profile via `POST /api/doctor-profiles` if none exists, or updates via `PUT /api/doctor-profiles/:id` if one does

**How the data is fetched:**

```typescript
const { data: doctorProfile } = useQuery({
  queryKey: ["/api/doctor-profiles", selectedUser?.id],
  enabled: !!selectedUser && isUserDoctor,
  queryFn: async () => {
    const res = await apiRequest("GET", "/api/doctor-profiles");
    const profiles = await res.json();
    return profiles.find((p: any) => p.userId === selectedUser.id) || null;
  },
});
```

A `useEffect` populates the local `doctorProfileData` state from the fetched profile, or initializes defaults from the user's name/phone if no profile exists.

**Save mutation handles both create and update:**

```typescript
const saveDoctorProfile = useMutation({
  mutationFn: async ({ profileId, data, userId }) => {
    if (profileId) {
      return apiRequest("PUT", `/api/doctor-profiles/${profileId}`, data);
    } else {
      return apiRequest("POST", `/api/doctor-profiles`, { ...data, userId });
    }
  },
});
```

### 3. Placeholder Reference (Shared Between Both Components)

Both UsersManagement and UserProfileModal define the same placeholder reference array:

```typescript
const PLACEHOLDERS_REFERENCE = [
  { tag: "{{doctorName}}", desc: "Doctor's full name" },
  { tag: "{{doctorLicense}}", desc: "License number" },
  { tag: "{{doctorNPI}}", desc: "NPI number" },
  { tag: "{{doctorDEA}}", desc: "DEA number" },
  { tag: "{{doctorPhone}}", desc: "Doctor phone" },
  { tag: "{{doctorFax}}", desc: "Doctor fax" },
  { tag: "{{doctorAddress}}", desc: "Doctor address" },
  { tag: "{{doctorSpecialty}}", desc: "Specialty" },
  { tag: "{{doctorState}}", desc: "Doctor state" },
  { tag: "{{patientName}}", desc: "Patient full name" },
  { tag: "{{patientFirstName}}", desc: "First name" },
  { tag: "{{patientLastName}}", desc: "Last name" },
  { tag: "{{patientDOB}}", desc: "Date of birth" },
  { tag: "{{patientPhone}}", desc: "Patient phone" },
  { tag: "{{patientEmail}}", desc: "Patient email" },
  { tag: "{{patientAddress}}", desc: "Patient street" },
  { tag: "{{patientCity}}", desc: "Patient city" },
  { tag: "{{patientState}}", desc: "Patient state" },
  { tag: "{{patientZipCode}}", desc: "Patient zip" },
  { tag: "{{patientSSN}}", desc: "Patient SSN" },
  { tag: "{{patientDriverLicense}}", desc: "Driver license #" },
  { tag: "{{patientMedicalCondition}}", desc: "Medical condition" },
  { tag: "{{reason}}", desc: "Reason for note" },
  { tag: "{{packageName}}", desc: "Note type name" },
  { tag: "{{date}}", desc: "Today (long format)" },
  { tag: "{{dateShort}}", desc: "Today (short)" },
];
```

Rendered as a toggleable 2-column grid inside a bordered box.

### 4. Backend Endpoints Used

These endpoints already existed — the frontend changes just wire into them:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/doctor-profiles` | List all doctor profiles (Level 3+) |
| `POST` | `/api/doctor-profiles` | Create doctor profile (accepts `userId` param for admin use) |
| `PUT` | `/api/doctor-profiles/:id` | Update doctor profile |
| `POST` | `/api/admin/users` | Create user + Firebase Auth + doctor profile in one request |

### 5. Imports Added

**UsersManagement.tsx** key imports:
- `Stethoscope`, `FileText`, `Info` from `lucide-react`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` from shadcn
- `ScrollArea` from shadcn
- `Textarea` from shadcn
- `FormDescription` from shadcn form

**UserProfileModal.tsx** key imports added:
- `Stethoscope`, `Info` from `lucide-react`
- `useEffect` from React (was only `useState` before)
